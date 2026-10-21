# Current task — AGENDA-PATIENT-ACTIONS (2026-10-21)
- OWNER: Codex; branch codex/agenda-patient-actions from master 5f6bc49.
- PO: appointment tap retains every existing action and adds direct treatment, prescription, documents and payment entry points.
- PREVIOUS: PATIENT-AGENDA-RETURN PR #237 merged; Vercel release verified in its PR record.
- SCOPE: existing appointment menu → existing stable patient forms, same authoritative patient ID; treatment entry reuses PianoDrillDown.
- STATUS: WAITING_PRODUCT_OWNER — PR #238; implementation complete, final-head CI required before release and explicit PO Mergia.
- DATABASE / AUTH / FINANCE: no schema or semantics changes; no production operations.
- ROLLBACK: revert PR; preserve immutable stable/2026-08-27-full-recovery.
- VALIDATION: 1422/1422 local Node tests, Studio build and diff --check pass; final browser CI results recorded on PR #238.
