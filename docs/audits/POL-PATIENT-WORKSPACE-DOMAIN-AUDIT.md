# POL Patient Workspace — domain and integration audit

Date: 2026-08-25  
Scope: repository-only, read-only audit for PR #59. No remote database introspection, migration, schema change, data write, or production wiring was performed.

## A. Executive summary

Poliedra already has a usable patient/agenda/plan/payment/document surface and a canonical financial engine. Dental clinical work is still represented mainly by legacy `plans.voci` JSON rather than a canonical treatment table. A “plan” currently carries both clinical intent and quote economics; a separate quote aggregate is absent. Payments exist, but payment plans and installments do not. Recalls are first-class legacy rows; follow-ups and automation rules are not first-class persisted entities. Timeline-like UI is assembled from source tables rather than an event store. The existing odontogram is an input selector, not an authoritative tooth-state model.

The recommended direction is incremental: preserve the stable legacy path, introduce one canonical clinical aggregate behind adapters, reuse the existing financial engine, and dual-read/verified-dual-write only after Product Owner approval and tenant/RLS tests. Do not create parallel patient, financial, permission, or Polyedron models.

Evidence limits: migrations in this repository fully describe the newer financial, Fisio, RBAC and Polyedron objects. Several older production tables are referenced by frontend adapters but have no creation migration here. Their field lists below are therefore limited to fields evidenced by code; live constraints, indexes, triggers and RLS remain `NOT_VERIFIED_REMOTE`.

## B. Current data model

### B1. Operational/legacy objects

| Object | Role and principal fields evidenced in code | Relations / keys | Read/write paths | Risk |
|---|---|---|---|---|
| `patients` | Patient identity; `id`, `studio_id`, `data_nascita`, UI fields such as name/contact/history | tenant `studio_id`; patient PK `id` | generic `DB` in `src/lib/supabase.js`; `Pazienti.jsx`, `App.jsx` | Creation DDL absent from migrations; full schema/RLS not verified here |
| `plans` | Combined care plan/quote; `id`, `studio_id`, `paziente_id`, `titolo`, `data`, `voci jsonb`, `stato`, `sconto`, `sconto_tipo`, `scadenza_pagamento`, optional orthodontic JSON | patient `paziente_id`; tenant `studio_id`; treatment identity is array index/embedded JSON | `Piani.jsx`, stable `SchedaPaz.jsx`, generic `DB`, Polyedron planner/executor | Core clinical source is mutable JSON; no stable treatment FK; plan and quote semantics overlap |
| `pricelist` | Service catalogue; `nome`, `prezzo`, `richiamo_mesi`, `durata_minuti` plus UI catalogue fields | tenant `studio_id`; referenced textually from plan voices | `Listino.jsx`, `Piani.jsx`, procedure resolver | Plan rows copy names/prices; no evidenced FK/version reference |
| `payments` | Patient payment; `id`, `studio_id`, `paziente_id`, `data`, `importo`, `metodo`, `nota`, `stato` | patient and tenant keys; no evidenced plan/quote/line allocation FK | `Pagamenti.jsx`, `SchedaPaz.jsx`, generic `DB`, Polyedron executor | Residual is recomputed client-side from all plans minus all payments; allocation ambiguous |
| `appointments` | Agenda booking; `paziente_id`, date/time/type/status, operator/chair and Google IDs | patient and tenant keys | `Agenda.jsx`, `QuickBookingModal.jsx`, generic `DB`, Realtime in `App.jsx` | Reliable operational object, but DDL/RLS not in this migration set |
| `richiami` | Recall queue; `paziente_id`, `categoria`, `motivo`, `data_scadenza`, `origine`, `stato`, `chiave_bot` | patient and tenant keys | `Richiami.jsx`, `richiamiBot.js`, generic `DB`, Realtime | First-class recall exists; generated rules live in frontend code, not persisted automation rules |
| `implants` | Implant tracking; `paziente_id`, `plan_id`, `data_inserimento`, `data_corona`, `note_corona` | patient/plan/tenant | generic `DB`; older patient UI history | Specialized legacy silo, not a general anatomical event model |
| `documenti_medici` | Medical documents including prescriptions; evidenced fields `id`, `tipo`, `titolo`, `data`, `paziente_id`, `paziente_nome`, `pdf_base64`, `studio_id` on writes | patient and tenant keys | `DocMedico.jsx`, `ArchivioDocs.jsx` | Large PDF stored as base64; document/clinical subtype mixed; DDL absent |
| `documenti_fiscali` | Fiscal documents; patient, date/type/amount/PDF metadata | patient and tenant keys | `DocFiscale.jsx`, `ArchivioDocs.jsx` | Financial document and patient document concerns overlap |
| `consenso_modelli` | Tenant consent templates; title/text/type/active | tenant key | `Impostazioni.jsx` | Template is not a signed patient consent |
| signed consent objects | Stable UI previously referenced consent/document flows, but no creation migration is present in this branch | patient/tenant relationship not proven | public `FirmaConsenso.jsx` and archive routing | Persisted canonical `CONSENT` cannot be claimed from repository evidence |
| `storia_clinica_voci` | Configurable clinical-history question definitions | tenant key | `Impostazioni.jsx` | Definitions, not patient answers |
| patient anamnesis/history | Patient fields and remote-history RPCs `info_link_storia_clinica`, `completa_storia_clinica_remota` | patient/token/tenant details not fully visible in migrations | `StoriaClinicaRemota.jsx`, stable patient data | RPC definitions absent from repository migration set |
| `impegni_personali` | Agenda commitments | tenant; dates/times | generic `DB`, Agenda | Operational, not patient timeline |
| `todos` / Dashboard activities | Generic task/activity data | patient association is optional/shape-based | `Dashboard.jsx`, Polyedron activity scanner | Not a canonical FOLLOWUP; association can be legacy text/name based |

### B2. Canonical financial objects

Migration: `supabase/migrations/20260818190642_pol_003_financial_engine_v1.sql`. These objects use `studio_id`, source provenance, tenant-safe composite FKs, RLS, and append-only event semantics.

| Object | Role | Principal relations/status |
|---|---|---|
| `financial_contracts_v1` | Proposed economic contract | `patient_id`, discount kind/value, `source_table/source_id` |
| `financial_contract_lines_v1` | Economic service lines | contract FK, patient, service/operator refs, gross amount, source line identity |
| `financial_line_events_v1` | Acceptance/production lifecycle | stages `ACCETTATO`, `PRODOTTO`; direction and reversal kind |
| `financial_invoice_events_v1` | Invoices/credit notes | optional contract/line, required patient, explicit amounts and direction |
| `financial_payment_events_v1` | Payments/refunds/external payments | optional contract, required patient, reconciliation and provenance |
| `financial_payment_allocations_v1` | Explicit payment allocation | payment → invoice/contract/line; validated by constraint trigger |
| `financial_cost_events_v1` | Canonical costs | stage/classification/scope and provenance |
| `financial_hours_v1` | Available/worked hours | structure/operator scope |

Canonical read entry point: `get_financial_snapshot_v1` and frontend selectors in `src/lib/canonicalFinancialSelectors.js` plus management components. Legacy ingestion/adaptation is documented and tested in POL-003B migrations/tests. This engine should be reused; no new Patient Workspace financial formula should be created.

### B3. Other canonical/modern objects

- Fisio clinical tables (`physio_piani`, `physio_valutazioni`, `physio_obiettivi`, `physio_diario_sedute`, `physio_esercizi`, `physio_prescrizioni`, `physio_esecuzioni`) are defined in `20260818000000_physio_schema_dati.sql`. They are vertical-specific and must not be repurposed as the dental clinical core.
- `patient_care_assignments` is defined in `20260819210000_pol_rbac_001a_patient_care_assignment.sql`; it is assignment/RBAC scope, not clinical treatment ownership.
- `studio_user_capabilities` is defined in `20260819200029_pol_rbac_001_authoritative_capabilities.sql`; it must remain the authorization authority.
- `poliedron_conversations` and `poliedron_messages` are defined in `20260824030000_chat_polyedron.sql`; they store private conversation history, not clinical truth or actions.

### B4. RPC, view and trigger inventory relevant to this audit

- Canonical finance: private tenant helpers, allocation validation trigger, snapshot and legacy-adapter functions in the POL-003 migration series.
- Remote history RPC calls evidenced in frontend: `info_link_storia_clinica`, `completa_storia_clinica_remota`; definitions are not present in this branch.
- RBAC/assignment triggers: capability author guards and `patient_care_assignments_guard_v1` in the corresponding migrations.
- Polyedron chat triggers: message immutability/read-state guard and conversation touch trigger in `20260824030000_chat_polyedron.sql`.
- No repository migration proves a canonical dental-treatment trigger, quote workflow trigger, installment trigger, timeline event-store trigger, dental odontogram view, or automation-rule table.

### B5. Named migration-backed database inventory

This inventory is exhaustive for objects directly relevant to Patient Workspace that are evidenced by the checked-in migration set. “Reader/writer” names the repository path, not an assertion about deployed grants.

| Kind / object | Migration evidence | Fields / relation and lifecycle | Repository reader / writer | Verification |
|---|---|---|---|---|
| Function `private.financial_current_studio_v1` | POL-003 financial migration | Resolves tenant context used by canonical finance | finance RPCs | `VERIFIED_REPOSITORY` |
| Functions `private.financial_has_tenant_access_v1`, later `private.financial_verified_studio_membership_v1` | POL-003 / hardening migrations | Membership/tenant authorization guard | finance policies and RPCs | `VERIFIED_REPOSITORY`; deployed version `NOT_VERIFIED_REMOTE` |
| Function + constraint trigger `private.validate_financial_allocation_v1` / `financial_payment_allocations_v1_validate` | POL-003 | Validates payment allocation target consistency across payment, invoice, contract and line | canonical financial writes | `VERIFIED_REPOSITORY` |
| Views `private.financial_line_values_v1`, `private.financial_effective_allocations_v1` | POL-003 | Derived contract-line and effective allocation values | snapshot/drilldown RPCs | `VERIFIED_REPOSITORY` |
| RPCs `public.get_financial_snapshot_v1`, `public.get_financial_drilldown_v1` | POL-003 series | Tenant/patient-scoped canonical financial read models | management UI and `canonicalFinancialSelectors.js` | `VERIFIED_REPOSITORY` |
| Functions `private.run_pol_003b_legacy_adapter_v1`, `private.run_pol_003f_costs_hours_adapter_v1`, `private.pol_003f_frequency_months_v1` | POL-003B / POL-003F | Idempotent legacy provenance adapters and frequency normalization | migration/test jobs; no Patient Workspace call | `VERIFIED_REPOSITORY` |
| Personnel append-only guard function/trigger | POL-003 personnel hardening | Prevents mutation of canonical personnel events | canonical finance/event writes | `VERIFIED_REPOSITORY` |
| Function `private.pol_002b_can_access_patient_file` | POL-002B file security migration | Tenant/patient authorization for protected patient files | storage/file policies | `VERIFIED_REPOSITORY`; storage deployment `NOT_VERIFIED_REMOTE` |
| Functions `public.is_studio_admin`, `pol_002a_require_studio_admin` and conditional GDPR helpers | POL-002A security migrations | Administrative and GDPR authorization | security policies/RPCs | `VERIFIED_REPOSITORY` |
| Capability functions and author-guard triggers | POL-RBAC-001 migration | Enforce authoritative capability authorship | `studio_user_capabilities` writes | `VERIFIED_REPOSITORY` |
| Patient-assignment functions and `patient_care_assignments_guard_v1` | POL-RBAC-001A | Validates tenant, patient and care-team assignment scope | assignment writes / permission reads | `VERIFIED_REPOSITORY` |
| Function/trigger `poliedron_messages_guard_v1` | Polyedron chat migration | Guards message immutability/read-state and conversation membership | Polyedron chat | `VERIFIED_REPOSITORY` |
| Function/trigger `poliedron_messages_touch_conversation_v1` | Polyedron chat migration | Updates conversation activity when a message is inserted | Polyedron chat writes | `VERIFIED_REPOSITORY` |

Older tables in B1 and frontend-called RPCs such as `info_link_storia_clinica` and `completa_storia_clinica_remota` have no complete definition in this checkout. Their columns, policies, grants, indexes, publications and deployed function bodies remain explicitly `NOT_VERIFIED_REMOTE`.

### B6. End-to-end frontend flow inventory

| Flow | Entry / reader | Write path | Source of truth and duplication assessment |
|---|---|---|---|
| Create clinical plan | `Piani.jsx`, stable `SchedaPaz.jsx` | generic `DB` → `plans` | Legacy `plans`; combines clinical plan and quote, so semantics are duplicated |
| Add treatment | `Piani.jsx`, catalogue resolution from `pricelist` | read-modify-write of `plans.voci` JSON | Array item is the only treatment record; no stable ID/FK, high concurrency risk |
| Create/send quote | `Piani.jsx`, PDF/share presentation | updates/presents the same `plans` row; document/share helpers | No separate `QUOTE`; economic intent duplicates clinical plan |
| Register payment | `Pagamenti.jsx`, stable `SchedaPaz.jsx` | generic `DB` → legacy `payments`; Polyedron has a legacy executor | Legacy operational truth; canonical event/allocation engine exists but Workspace is not wired to it |
| Payment plan / installment | Round 4 prototype only | none | `MISSING`; UI must not imply persistence |
| Agenda appointment | `Agenda.jsx`, `QuickBookingModal.jsx` | generic `DB` → `appointments`; realtime refresh in `App.jsx` | Mature legacy path; deployed DDL/RLS `NOT_VERIFIED_REMOTE` |
| Recall | `Richiami.jsx`, `richiamiBot.js` | generic `DB` → `richiami` | First-class legacy row; proposals/rules are hard-coded and can duplicate manual recalls |
| Follow-up | Dashboard/todo/activity conventions | generic todo/activity writes where used | No explicit canonical entity or lifecycle; must remain distinct from recall |
| Timeline / history | stable `SchedaPaz.jsx` and source-specific histories | none as a unified timeline; each source writes independently | Read aggregation only; no `TIMELINE_EVENT` source of truth |
| Patient record | `SchedaPaz.jsx`, `Pazienti.jsx` | generic `DB` → `patients` and related legacy tables | Stable production path; base DDL/RLS `NOT_VERIFIED_REMOTE` |
| Odontogram | `Odontogramma.jsx`, patient/plan UI | selection feeds plan voice/tooth fields | UI selector, not persisted clinical tooth-state authority |
| Medical/fiscal documents | `DocMedico.jsx`, `DocFiscale.jsx`, `ArchivioDocs.jsx` | generic `DB` → `documenti_medici` / `documenti_fiscali`, including base64 PDF | Split legacy stores; metadata/storage lifecycle is duplicated |
| Prescription | `DocMedico.jsx`, Polyedron prefill/navigation | medical-document write/PDF flow | Document subtype rather than structured prescription truth |
| Consent | `Impostazioni.jsx`, `FirmaConsenso.jsx`, archive routing | template writes are evidenced; signed-record backend definition is absent | Templates exist; signed consent persistence is `NOT_VERIFIED_REMOTE` |
| Polyedron | `poliedraCore.js`, planner, action registry, executor, chat components | narrow confirmed legacy plan/payment actions via passed DB adapter; chat tables | Consumes legacy arrays and must not become a second clinical/financial source of truth |

Repository-wide RPC calls also cover registration, consent signing, remote clinical history, public booking and team roster. Where their server definition is absent from migrations, behavior and authorization remain `NOT_VERIFIED_REMOTE`; this audit does not infer them from client call names.

## C. Canonical entity mapping

| Entity | Classification | Current closest object | Finding |
|---|---|---|---|
| `PATIENT` | `EXISTS_LEGACY` | `patients` | Operational and tenant-scoped in adapter; baseline DDL missing here |
| `CLINICAL_PLAN` | `EXISTS_LEGACY` | `plans` | Exists, but mixes clinical and economic concerns |
| `CLINICAL_PATHWAY` | `EXISTS_PARTIAL` | Fisio episode/plan concepts, orthodontic JSON | No shared cross-vertical pathway aggregate |
| `TREATMENT` | `EXISTS_LEGACY` | `plans.voci[]` | Embedded mutable rows without stable IDs/FKs |
| `ANATOMICAL_SITE` | `EXISTS_PARTIAL` | `voci.dente`, implant fields, UI odontogram | Tooth-only string plus specialized implant data; no typed site model |
| `QUOTE` | `EXISTS_LEGACY` | `plans` + PDF/WhatsApp presentation | Not distinct from clinical plan |
| `PAYMENT` | `EXISTS_CANONICAL` | `financial_payment_events_v1` | Legacy `payments` remains operational adapter/source |
| `PAYMENT_PLAN` | `MISSING` | none | UI prototype only |
| `INSTALLMENT` | `MISSING` | none | No due-date/status installment model evidenced |
| `APPOINTMENT` | `EXISTS_LEGACY` | `appointments` | Mature operational flow; DDL not in migration set |
| `RECALL` | `EXISTS_LEGACY` | `richiami` | Distinct first-class row, frontend automation logic |
| `FOLLOWUP` | `EXISTS_PARTIAL` | `todos`/activity/recall conventions | No explicit domain/status contract |
| `CLINICAL_ALERT` | `EXISTS_PARTIAL` | computed risks/Data Health/recall bot | Derived signals, not persisted canonical alerts |
| `PRESCRIPTION` | `EXISTS_LEGACY` | `documenti_medici` type + client PDF | Document subtype; no structured prescription aggregate |
| `CONSENT` | `EXISTS_PARTIAL` | templates + signing UI | Patient signed record schema not proven in migrations |
| `DOCUMENT` | `EXISTS_LEGACY` | medical/fiscal document tables | Multiple tables and base64 storage conventions |
| `TIMELINE_EVENT` | `MISSING` | aggregation of plans/payments/appointments/docs/recalls | No event store |
| `AUTOMATION_RULE` | `MISSING` | `richiamiBot.js` and hard-coded rules | Logic exists, persisted rule model does not |

## D. Gap analysis

1. `plans.voci` needs stable treatment identity, typed anatomical site, explicit lifecycle and provenance before Patient Workspace can safely write clinical state.
2. Clinical plan and quote require separate aggregates with an explicit derivation/link; today one `plans` row serves both jobs.
3. Legacy payments lack explicit allocations. Canonical financial allocation exists and should be the destination, not a second formula.
4. Payment plans/installments need a Product Owner-locked lifecycle (scheduled, due, paid, overdue, cancelled, adjusted) and links to contract/payment events.
5. Recall exists; follow-up does not. They must not be collapsed because recall is a due clinical/operational intent while follow-up is a task/contact/check after an event.
6. Timeline needs a read model over authoritative sources before considering a write-side event store.
7. Odontogram state must derive from canonical treatments/events and anatomical sites; the current selector cannot be the source of truth.
8. Polyedron can navigate, resolve patients/procedures, propose and execute a narrow set of plan/payment workflows, but its current planner consumes legacy arrays.

## E. Duplications and legacy hazards

- Treatment name, price, tooth and completion live inside copied `plans.voci`; catalogue changes do not have an evidenced version/FK relationship.
- `voci.eseguita`, `voci.dataEsec`, plan `stato`, payment rows and document history can describe overlapping lifecycle facts without a shared event identity.
- Plan totals/residuals are calculated in `Piani.jsx`, `Pagamenti.jsx`, stable `SchedaPaz.jsx` and the preview. New production wiring must use canonical server financial outputs.
- “Preventivo” is a presentation mode of a plan rather than a separate persisted object.
- Documents are split by fiscal/medical purpose; prescription is a medical-document type; signed consent storage is not proven by migrations.
- Recalls are both manual rows and frontend-bot proposals. Hard-coded automation logic has no versioned rule record.
- Generic activities can associate to patients by optional ID or conservative name matching; they are unsuitable as clinical follow-up truth.

## F. Recommended sources of truth

- Patient: retain `patients`, but bring its authoritative DDL/RLS into repository history before integration.
- Clinical plan: one canonical plan header linked to stable treatment rows; preserve legacy `plans` through an adapter during transition.
- Treatment: dedicated stable entity with `id`, `studio_id`, `patient_id`, plan/pathway link, service reference/version, lifecycle status, price snapshot/provenance and typed anatomical-site relation. This is a proposal, not an implemented schema.
- Quote: separate economic document/contract derived from selected treatment IDs; map to `financial_contracts_v1` and lines.
- Payment: `financial_payment_events_v1` plus explicit allocations; legacy `payments` is an ingestion/compatibility source only.
- Recall/follow-up: keep separate canonical meanings and IDs; appointments may satisfy them but should not replace them.
- Timeline: initially a server-side/read-layer union with stable source type/id and timestamps; do not invent copied events.
- Documents/consents/prescriptions: one document metadata layer with private object storage, plus typed domain records where structured content matters.
- Odontogram: projection of anatomical sites + treatments + clinical events, never a parallel mutable diagram.
- Polyedron: consume a permission-filtered structured `PatientWorkspaceContext`; execute only registered actions with confirmation and fresh server-side preconditions.

## G. Suggested migration plan (proposal only)

1. Read-only remote inventory approved by the Product Owner: export `information_schema`, constraints, RLS, functions, triggers, views and publication membership; reconcile with this repository audit.
2. Lock semantics for treatment lifecycle, plan vs quote, recall vs follow-up, payment-plan lifecycle and anatomical-site types.
3. Add repository tests and canonical read adapters before schema creation.
4. Create additive canonical clinical tables with tenant keys, RLS, immutable provenance and stable IDs in a separate approved mission.
5. Backfill only deterministically mappable legacy rows; quarantine ambiguous array items instead of guessing.
6. Run verified dual-read comparisons; then guarded dual-write with idempotency/source keys.
7. Wire Patient Workspace to canonical reads; keep stable `SchedaPaz.jsx` as rollback until Product Owner acceptance.
8. Wire Polyedron through the same service/action boundary, never through DOM or direct unverified client mutation.
9. Retire legacy writes only after reconciliation, two-tenant/RLS tests, financial equality checks and rollback rehearsal.

## H. Implementation sequence

`remote inventory → semantic locks → canonical clinical read model → treatment/plan core → quote-to-financial adapter → payment allocation → recall/follow-up → timeline projection → odontogram projection → documents/consents/prescriptions → automation rules → Polyedron integration → staged UI rollout`.

## I. Production risks

- Missing baseline migrations mean repository-only assumptions about old-table constraints/RLS can be wrong.
- `src/lib/supabase.js#getStudioId` contains a legacy fallback UUID when session metadata lacks `studio_id`; future canonical services must fail closed and must not copy this behavior.
- Generic `DB.update/remove` rely mainly on RLS and filter only by row ID; canonical services need fresh tenant/patient preconditions.
- Client-side JSON array updates have index/TOCTOU risks and weak auditability.
- Recomputing financial truth in the UI can diverge from POL-003.
- Preview and production must remain isolated until canonical reads, permissions and migration reconciliation are proven.

## J. Polyedron integration map

Current inputs in `poliedraCore.js`: permission-filtered `patients`, `plans`, `payments`, `pricelist`, appointments/recalls/activities for intelligence. Current capabilities include navigation/search, prescription prefill, deterministic patient/procedure resolution, treatment-plan proposal/execution, payment proposal/execution and missing-tooth completion. The executor uses a passed DB adapter and confirmation/precondition checks; it does not yet operate on the Round 4 canonical entities.

| Round 4 action | Current state | Required future adapter / risk |
|---|---|---|
| `CREATE_CLINICAL_PLAN` | Partially implemented through legacy plan executor | Canonical plan service; avoid JSON/index writes |
| `ADD_TREATMENT` | Partially implemented as plan voice | Stable treatment ID and typed site |
| `UPDATE_TREATMENT_STATUS` | Partially implemented for completed status | Full lifecycle, audit event and concurrency guard |
| `CREATE_QUOTE` / `SEND_QUOTE` / `PRINT_QUOTE` | Navigation/presentation only | Separate quote linked to financial contract and document delivery |
| `REGISTER_PAYMENT` | Partially implemented against legacy payments | Canonical payment event and explicit allocation |
| `CREATE_PAYMENT_PLAN` / `UPDATE_PAYMENT_PLAN` | Missing | Canonical schedule/installments; no client-only residual math |
| `CREATE_RECALL` | Existing recall UI/data path; not shared action executor | Canonical service with idempotency and appointment satisfaction |
| `CREATE_FOLLOWUP` | Missing | Separate task/follow-up entity and lifecycle |
| `SUGGEST_APPOINTMENT` | Partial deterministic intelligence/navigation | Real availability and explicit user confirmation |
| `CHECK_MISSING_STEP` | Partial Data Health/intelligence | Structured canonical context and explainable rules |
| `NOTIFY_CLINICIAN` | Missing as patient-domain action | Capability/assignment-aware delivery and audit |
| `CREATE_PRESCRIPTION` | Existing prefill/navigation | Structured prescription plus clinician confirmation/document output |
| `CREATE_CONSENT` | UI/navigation partial | Signed consent record, private document storage and audit |

Security rule: Polyedron suggestions are not facts. Every write action must resolve authoritative IDs server-side, verify active membership/capability/assignment, scope by `studio_id` and patient, require confirmation according to risk, use idempotency/source keys, and read back the result. `PatientWorkspaceContext` must be assembled from authorized structured data, never DOM text.

## Repository evidence index

- Legacy data adapter and table/field map: `src/lib/supabase.js`
- Current plan/quote/treatment flow: `src/components/Piani.jsx`
- Current payment/residual flow: `src/components/Pagamenti.jsx`
- Stable patient read flow: `src/components/SchedaPaz.jsx`
- Agenda: `src/components/Agenda.jsx`, `src/components/QuickBookingModal.jsx`
- Recall and rule logic: `src/components/Richiami.jsx`, `src/lib/richiamiBot.js`
- Odontogram selector: `src/components/Odontogramma.jsx`
- Documents/prescriptions/consent templates: `src/components/DocMedico.jsx`, `src/components/ArchivioDocs.jsx`, `src/components/Impostazioni.jsx`, `src/lib/pdfDocs.js`
- Polyedron: `src/lib/poliedron/poliedraCore.js`, `src/lib/poliedron/actionRegistry.js`, `src/lib/poliedron/planner/*`, `src/components/poliedron/*`
- Financial core: `supabase/migrations/20260818190642_pol_003_financial_engine_v1.sql` and POL-003B/3C/3D/3F migrations/tests
- Fisio core: `supabase/migrations/20260818000000_physio_schema_dati.sql`
- RBAC/assignment: `supabase/migrations/20260819200029_pol_rbac_001_authoritative_capabilities.sql`, `20260819210000_pol_rbac_001a_patient_care_assignment.sql`
- Polyedron chat: `supabase/migrations/20260824030000_chat_polyedron.sql`

This audit ends at recommendation. No backend implementation is authorized or included.
