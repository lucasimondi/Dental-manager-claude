# Current task — PATIENT-AGENDA-RETURN (2026-10-21)
- OWNER: Codex; branch codex/patient-agenda-return from master 925ec44.
- PO: use the actual Poliedra agenda; compress the patient record without losing its draft; choose a real slot and reopen the same record automatically.
- PREVIOUS: AGENDA-FLUIDITA PR #236 merged on master; retain its shared agenda behavior.
- SCOPE: patient workspace lifetime, real agenda slot-selection flow, existing tenant-scoped appointment persistence and failure handling. No replacement calendar or financial logic.
- STATUS: IN_PROGRESS.
- DATABASE / AUTH / RLS: no changes; no production writes in this implementation session.
- ROLLBACK: revert dedicated PR; preserve stable/2026-08-27-full-recovery at 070b28fd4eae4e2cc397584201d0bb149468fae7.
