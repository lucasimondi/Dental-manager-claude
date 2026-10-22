# Current task — APPOINTMENT-PATIENT-CARD (2026-10-22)
- OWNER: Codex; branch codex/appointment-patient-card, PR #245.
- PO: patient card from appointment, compact actions; latest request moves call beside name, stabilizes booking near top, creates patients from booking and improves opening speed.
- STATUS: implementation complete; draft pending browser CI and screenshot review.
- SCOPE: call beside patient name; WhatsApp/Modifica/Sposta/Scheda top toolbar. Booking top-aligned at final position, no entrance transform or automatic keyboard, safe-area bounds independent of agenda overlay measurements. Always-visible Nuovo paziente button, inline name/surname/optional phone and automatic selection using existing quick-create persistence/reconciliation and limits. Patient search memoized; appointment chunk preloaded on agenda entry; eager shell geometry prevents lazy CSS movement.
- VALIDATION: 1437/1437 Node tests, Studio and Personal builds pass; diff check clean. Existing browser suite updated for header call, top booking, no autofocus and create/select synthetic patient with phone. Local browser validation remains blocked by unavailable Chromium download; no timing benchmark/physical iPhone claim.
- DATABASE: no schema, authorization, tenancy or financial changes; no production reads/writes.
- LIMITS: existing background patient persistence/error handling and temporary ID reconciliation unchanged. Memoization and prefetch are targeted UI optimizations, not measured global app speedup.
- RELEASE: browser CI/review before ready, explicit PO Mergia required; no merge/manual deploy.
- ROLLBACK: revert PR; immutable stable checkpoint unchanged.

## Latest follow-up — visit tags and plan entry
- PO: one color-tag series; enter a priced treatment in the popup, saving it to a plan only when absent.
- Unique normalized visit names render once in one horizontally scrollable tag row; persisted configuration unchanged.
- Booking now exposes description/list price, editable price and optional tooth; selects sole active plan or creates one if none, asks when several. Fresh patient/plan reads and confirmed plan writes precede existing appointment sync. No treatment fields leak into appointment payloads.
- Shared appointment-entry preparation skips existing same normalized procedure/tooth pairs without changing price/status; also skips repeated input rows. A no-op still preserves contextual payment linkage to the existing plan.
- Validation: 1445/1445 Node tests, Studio/Personal builds and diff check pass. Browser fixture updated for duplicate tags and priced booking entry, local browser run still blocked by the documented download failure.
- Limits: same tooth identity is preserved; different teeth remain distinct. Explicit new quotes and implant quote presets retain their existing behavior. Plan save and existing background appointment save are not a transaction; concurrency locking is unchanged. Uncertain plan writes block resubmission until review/reopen.
