# POL-AI-005A — Domain audit (Phase A, read-only)

This audit is evidence-based: every claim below was verified by reading the
real, currently-shipped source in this repository (not inferred, not
assumed). File paths and line-level behavior are cited so Phase B can
re-verify quickly. No production data was read; no write was performed or
attempted.

## DOMAIN_SERVICES_FOUND

**Patients**
- `src/lib/supabase.js` — `DB.getAll('dm_p')`/`DB.insert('dm_p', ...)` etc.
  map to the real `patients` table, scoped by `studio_id` for every table in
  `STUDIO_TABLES` (`getStudioId()` reads `session.user.app_metadata.studio_id`,
  falling back to a fixed demo UUID only when there is no session at all —
  i.e. tenant scoping is real and session-derived, not client-chosen).
- `src/lib/ricercaPazienti.js` — `cercaPazienti(patients, query)`: the
  **single shared, reusable, tolerant patient search** already used across
  Agenda/Piani/ArchivioDocs/Pagamenti/Pazienti. Free word order, accent/case
  insensitive, small-typo tolerant (bounded Levenshtein), returns a
  **ranked** list (`score` 100/80/60/30, best first). This is the correct
  reuse target for patient resolution — see PATIENT_RESOLUTION below.
- `src/lib/poliedron/prescriptionWorkflow.js` has its **own**, separate,
  inline patient-scoring heuristic (`patientMatchScore`) instead of calling
  `cercaPazienti` — an existing, pre-POL-AI-005 duplication, not introduced
  here. Documented as a MISSING_ABSTRACTIONS item below; not touched (out of
  Phase A scope, no unrelated refactor).

**Treatment plans** (`src/components/Piani.jsx`, table `plans` via
`dm_pl`/`FIELD_MAP.plans`)
- A plan: `{ id, pazienteId, titolo, data, voci: [...], stato, sconto,
  scontoTipo, scadenzaPagamento, ortodonzia }`.
- A plan item ("voce"): `{ prestazione, dente, prezzo, eseguita, incassata,
  dataEsec }` — see TREATMENT_PLAN_SCHEMA_AUDIT below for the exact
  nullability/validation answers.
- `calcTot(voci, sconto, scontoTipo)` (Piani.jsx:76-81) — plan total minus
  discount; **not** the canonical financial engine (see below).
- `toggleEseguita(plId, i)` (Piani.jsx:106-111) — the real "mark completed"
  write path: flips `voce.eseguita`, stamps `dataEsec`, and auto-promotes
  `plan.stato` to `'concluso'` once every voce is `eseguita` (and demotes it
  back to `'attivo'` if un-toggled). This is the exact effect
  `MARK_TREATMENT_COMPLETED` must eventually reproduce in Phase B — it is
  **not** a separate `stato` enum on the voce itself, it is a boolean plus a
  derived plan-level status.

**Payments** (`src/components/Pagamenti.jsx`, table `payments` via
`dm_py`/`FIELD_MAP.payments`)
- A payment: `{ id, pazienteId, data, importo, metodo, nota, stato }` with
  `stato ∈ {'pagato','acconto','sospeso'}` (Pagamenti.jsx:255-257) and
  `metodo ∈ {'Contanti','Carta','Bonifico','POS','Assegno'}`.
- **No `planId`/voce linkage field exists.** A payment is associated with a
  patient only (`pazienteId`), never with a specific plan or plan item. See
  PAYMENT_MODEL_AUDIT below — this is a real, load-bearing constraint on any
  future "ensure pending payment for this specific treatment" step.
- `saldoPaz(pazId)` (Pagamenti.jsx:76-86) — the **legacy, per-patient**,
  local (not RPC) balance calculation: `dovuto` = sum of ALL of the
  patient's plan totals (not filtered by `eseguita`), `pagato` = sum of ALL
  of that patient's `payments.importo` **regardless of `stato`** (a
  `'sospeso'` row currently still reduces the computed residual — an
  existing quirk, not something POL-AI-005A changes or should rely on for
  new logic).
- `src/lib/canonicalFinancialSelectors.js` — the **canonical, server-side**
  financial engine: `CANONICAL_FINANCIAL_RPC = 'get_financial_snapshot_v1'`,
  aggregate/studio-wide (not per-patient), including a `credito_clienti`
  metric. This is the authority AGENTS.md's "Never duplicate financial
  formulas" protects. It is read-only aggregate reporting, not a write path
  a future executor could call to "register a payment".

**Poliedron** (`src/lib/poliedron/`)
- `intentEngine.js` — deterministic `classifyIntent(query, {navigationIndex})`
  → `{type, confidence, entities}` over `INTENT.{SEARCH,NAVIGATE,CREATE,
  UPDATE,ANALYZE,ASK,AUTOMATE}`, using Italian verb prefixes
  (`crea/nuovo/aggiungi/inserisci/prepara` → CREATE;
  `registra/modifica/aggiorna/segna` → UPDATE). Already has `extractAmount(text)`
  (handles "300", "€300", "300 euro", "300,50"). This is the deterministic
  layer POL-AI-005A's command parser extends, not replaces.
- `actionRegistry.js` — `riskLevel` is **already a first-class, documented
  concept**: `0` = read/navigate, executes immediately; `1` = opens an
  existing form for the human to fill/submit themselves (Poliedron never
  writes); `2` = "would create/update a business record — reserved for a
  future phase... not reachable from any registry entry in Phase 1"; `3` =
  irreversible, not implemented. **POL-AI-005 is exactly the future phase
  `riskLevel: 2` was reserved for.** No action in the current registry
  performs a direct write; every CREATE action opens an existing manual
  form via `quickActionsCatalog.js`'s `run(ctx)`.
- `permissionEngine.js` — `buildIntelligencePermissions(homePermissions)` →
  `{activeMember, operations, clinical, financial}`, itself derived from
  `homeDashboardModel.js`'s `buildHomePermissions` (`managementControl`,
  `capabilities: [...]`, etc. — the same capability model already used by
  `HOME_WIDGET_REGISTRY` and `quickActionsCatalog.js`). No second
  authorization model exists anywhere in Poliedron; every gate re-exposes
  server-authoritative capabilities. RLS remains the actual authority.
- `modelGateway.js` — `runModelTask({taskType, input, context, supabaseClient})`
  is the **only** place any AI model call happens; it proxies the
  `agente-assistente` Supabase edge function. `MODEL_TASK_TYPE` is
  `{ANSWER, ASK}` only — there is no task type for "extract structured
  entities from a write request" yet. This confirms §9's "these common
  patterns require ZERO Model Gateway calls" is already this codebase's own
  established philosophy (`docs/mission/POLIEDRA_MISSION.md`: "Prima il
  deterministico, poi il modello").
- `prescriptionWorkflow.js` — the one existing precedent for a
  clinical-write-adjacent workflow (drug/prescription drafting): resolves a
  patient by its own scorer, extracts free-text drug/posology, but **still
  only opens the real Ricetta form** (`ctx.openPrescription(...)`) for the
  human to complete/submit — it does not write directly either.
- `src/lib/poliedron/intelligence/` (POL-AI-004) — `model.js` defines
  `SIGNAL_TYPE`, `SIGNAL_TAXONOMY`, `SEVERITY`, and `createSignal({type,
  taxonomy, severity, reason, source, sourceId, confidence,
  confidencePenalty, contactRecommended, context})`; `studioDataHealth.js`
  aggregates known `SIGNAL_TYPE`s into a `{score, issues, message}` Data
  Health object. This is the exact shape DATA_HEALTH_HANDOFF below is
  designed to plug into in Phase B — Phase A does not modify either file.

## DIRECT_COMPONENT_WRITES_FOUND

Every write path audited is a **local React `setState` call** on data
already loaded client-side, which the app's existing Supabase persistence
layer (`useEffect`s not shown here, out of this audit's scope) then
syncs — i.e. plans/payments are edited as whole JS objects in component
state, not via a dedicated service module with its own validation layer.
Concretely: `Piani.jsx`'s `save`/`toggleEseguita`/`toggleIncassata`/`setStato`
and `Pagamenti.jsx`'s `save` all call `setPlans`/`setPayments` directly. This
means **there is no existing "canonical domain function" a future executor
can call for "ensure treatment item" or "ensure pending payment" that
isn't itself a full component-state reducer** — see MISSING_ABSTRACTIONS.

## REUSABLE_FUNCTIONS

- `cercaPazienti`/`normalizza` (`ricercaPazienti.js`) — patient resolution.
- `classifyIntent`/`extractAmount`/`hasExplicitOperationalVerb`
  (`intentEngine.js`) — verb classification and amount extraction.
- `buildHomePermissions`/`buildIntelligencePermissions` — permission facts.
- `createSignal`/`SIGNAL_TYPE`/`SIGNAL_TAXONOMY` (`intelligence/model.js`) —
  Data Health signal shape.
- Odontogramma's `ODO_ROWS` (`Odontogramma.jsx:5-7`) — the canonical valid
  FDI tooth set (`{11-18,21-28,31-38,41-48}`, 32 permanent teeth, no
  deciduous). `toothModel.js` (below) reproduces this exact 32-number set
  by formula rather than importing a `.jsx` component into a pure lib
  module, with a comment cross-referencing this file.

## MISSING_ABSTRACTIONS

1. **No canonical procedure ID.** `voce.prestazione` is a free-text string,
   optionally pre-filled from `pricelist.nome` via exact string match
   (`selPr`, Piani.jsx:115) but never enforced — a user can type any text.
   There is no `procedure_id` foreign key anywhere in this model. Any
   "procedure resolution" contract must resolve against **pricelist row
   names** (+ a small alias table Phase A defines, see
   PROCEDURE_RESOLUTION), not a nonexistent canonical catalog ID.
2. **No treatment-item ↔ payment linkage.** A payment cannot reference which
   plan/voce it pays for. "Ensure pending payment for this specific
   treatment" can only be approximated (e.g. by patient + amount + date
   proximity), never guaranteed structurally. Documented as a real
   Phase B design constraint, not solved here.
3. **No per-write-type capability.** Today, editing a plan item
   (`toggleEseguita`) or registering a payment (`Pagamenti.jsx` `save`) is
   gated only by page-level navigation + `activeMember` (see
   `quickActionsCatalog.js`'s `pagamento` entry — no `capability` field).
   There is **no** finer-grained "may mark clinical work completed" or "may
   register a payment" capability distinct from general active membership.
   `managementControl` gates aggregate financial *reporting*, not the
   per-payment write. PERMISSION_PLAN below reuses `activeMember` as the
   baseline for both step families and flags this gap explicitly rather
   than inventing a new capability that doesn't exist server-side.
4. **No dedicated domain-write service.** As above — writes are inline
   component `setState` reducers, not an importable
   `createTreatmentItem()`/`recordPayment()` function. A real Phase B
   executor will need either (a) new pure functions extracted from
   `Piani.jsx`/`Pagamenti.jsx`'s existing reducer logic (byte-identical
   behavior, just made importable/testable), or (b) a Product Owner
   decision on a proper domain-service layer. Phase A does not extract
   these, to avoid an unrelated refactor of shipped components.
5. **No "incomplete/needs-review" state.** No existing enum represents
   "clinical fact recorded, some metadata missing" — `eseguita` is a plain
   boolean, `dente` is a plain nullable string. This is exactly the gap
   TOOTH_MODEL (§12/§13) is designed to fill at the *planning* layer without
   any schema change.

## SCHEMA_CONSTRAINTS

See TREATMENT_PLAN_SCHEMA_AUDIT and PAYMENT_MODEL_AUDIT below for the
itemized answers. Headline: **nothing found requires a schema change for
Phase A or for a conservative Phase B** (mark-completed with unknown tooth,
record a payment) — the existing `voce.dente`/`voce.prestazione` are already
free-text/nullable-in-practice, and `payments` already has no required
clinical linkage to break.

## PERMISSION_GATES

- `activeMember` (from `buildHomePermissions`) — baseline for any write.
- `managementControl` — gates canonical financial **reporting** only (KPI
  widgets, `Controllo di Gestione`); not currently required for an
  individual payment write in the shipped app.
- No RLS/RBAC/Supabase policy was read, changed, or needs to change for
  Phase A — Phase A performs no Supabase call of its own beyond what
  already-loaded, already-authorized `patients`/`plans`/`payments` arrays
  the caller passes in.

## RISKS

- `saldoPaz`'s inclusion of `stato: 'sospeso'` payments in `pagato` (see
  above) means a future "duplicate pending payment" check that naively
  reuses `saldoPaz` could under-detect. IDEMPOTENCY_DESIGN below defines its
  own explicit duplicate-detection rule instead of depending on `saldoPaz`.
- No structural link between a payment and a treatment item means any
  Phase B "ensure pending payment" step is inherently a **best-effort
  match**, not a guaranteed one — this must remain visible to the user
  (via `requiresConfirmation`/`warnings` on the Action Plan), never silently
  assumed reliable.
- Reusing `Piani.jsx`/`Pagamenti.jsx`'s exact reducer semantics in a future
  executor (rather than re-deriving it) is essential to avoid silently
  diverging from what a human clicking "Segna eseguita" actually does
  (e.g. the auto `stato: 'concluso'` promotion) — flagged for Phase B.
