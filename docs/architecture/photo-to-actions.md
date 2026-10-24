# Foto → azioni del gestionale

PO authorization: 2026-10-24. First implementation: implant labels in Poliedron.

## User workflow

Attach a photo and ask to register its data for a named patient. Resolve the
patient through current-request reads. Read only the visible label fields.
Ask one short question for missing/unreadable facts, grouping tooth and placement
date when both are absent. An agenda event can suggest a date, but does not prove
that surgery happened then. A manufacture/expiry date never supplies placement.
One summary contains every proposed implant and a single Confirm button.
Then claim the signed operation, recheck clinical permission and current rows,
write missing implants in one bulk INSERT and independently read them back.
The chat returns verified teeth and the app refreshes the implant register.
Only an explicit archive-file request uses the existing file-only shortcut.

## Implemented scope and actual coverage

| Input | Existing domain action / outcome | This PR |
| --- | --- | --- |
| Implant labels / dictated implant fields | `registra_impianti_paziente`, existing `implants` table | New preparation, clinical review, execution and read-back |
| Payment receipt with explicit patient/amount/payment facts | `registra_pagamento_paziente`, existing payment gate | Unchanged; no claim that OCR or photo proves receipt of funds |
| Handwritten procedures/quote | `crea_piano_cura`, catalog/explicit prices, plan rules | Unchanged; not a new expense/procedure executor |
| Prescription details | `prepara_ricetta`, clinician reviews/generates existing document | Unchanged; no automatic prescribing |
| Photo/report to archive | Existing authenticated private patient-file archive | Preserved; not structured diagnosis extraction |
| Supplier invoice → expense | No reviewed chat expense action | Unsupported by this PR; prepare data only, never report saved |

This is the first operational slice, not universal photo automation. Recognition
quality depends on provider/image; synthetic tests do not establish OCR accuracy.
Original image/UDI/expiry have no new archive columns. We store only the existing
implant fields. No use of clinical photos as training examples.

## Shared domain boundary

`impianti.js` defines a provider-independent tool schema, preparation and execution.
The authenticated `agente-assistente` handler owns patient/studio/user identity,
observations, plan/autonomy gates, expiry/signatures and cancellation. Implant
operations are offered only in the dental vertical where existing plan/autonomy
allows writes; preparation AND execution require the canonical
`has_studio_capability_v1(..., 'clinical.general')` RPC. Owner/admin status alone
does not grant clinical access. RLS remains unchanged and authoritative.
Model/tool arguments cannot supply tenant/user/ID fields for inserts.
No raw SQL, service-role business writes, public clinical files or parallel RBAC.
Existing activity log labels the action; no Undo is offered for implants.

Exact same tooth/date/fields is skipped; differing data for that tooth/date blocks
without overwrite. Patient and stored rows are re-read at confirmation.
One claim prevents replay of that signed operation. Different simultaneous signed
proposals do NOT have a new cross-request database uniqueness/locking guarantee.
The single implants INSERT is atomic; claim + write + verification are separate
requests. A timeout/read-back failure consumes the attempt and returns uncertain,
refreshing implants; never automatically retry or claim nothing was written.

## External ChatGPT / Gemini connection

The initial implant slice did not create an external connection. The later PO
request extends this PR with the shared MCP/OAuth implementation described in
[assistant-connectors.md](assistant-connectors.md); deployment and account linking
remain unperformed. Existing Supabase admin tools available in a development session
are not a general operational integration for every assistant.

The target is an approved user-authorized connector for each assistant, which
passes through the SAME authenticated action boundary and tool schemas. Require
per-user login/delegation, current tenant/membership/capabilities, scoped domain
tools, signed one-time clinical proposals and read-back results. Do not share
service-role keys or ask a user to paste session JWTs in chat. Do not expose the
Supabase management API as the clinician's day-to-day integration.

The subsequent explicit PO request approves implementing both connectors on the
existing Vercel/Supabase infrastructure. The expanded implementation, data boundary,
account availability and controlled activation are documented in
assistant-connectors.md and the corresponding runbook. Expense ingestion and
broader documents still need their reviewed domain adapters.

## Validation / release

Run synthetic handler and domain tests plus full Node suite and both Vite builds.
Handler tests cover actual attachment delivery, signed review/confirm, cancellation,
changed autonomy/clinical permission, missing date, batch insert, duplicate and
conflict detection, independent read-back failure, replay and uncertainty.
No real patient, image, production query or write is used in tests or repository.

Frontend merge alone cannot publish a changed Edge Function. Controlled release
must deploy the complete existing `agente-assistente` folder with the new
`impianti.js`, existing shared imports and JWT verification preserved; no secrets
or migrations are added. Validate capability availability and smoke-test an
authorized synthetic account before clinical use. No manual deployment performed.
Rollback: revert this PR and restore the previous approved function version.
