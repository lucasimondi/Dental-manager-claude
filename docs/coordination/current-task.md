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
