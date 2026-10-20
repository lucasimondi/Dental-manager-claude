# Current task — AGENDA-CONDIVISA (2026-10-20)
- OWNER: Codex; branch `codex/agenda-condivisa`, base `fa54f122648945b09e8f846deb6fadc9cc7b3992`.
- PO: Personal e Studio condivisi per default, anche nel passato; esclusione esplicita per agenda; domenica occupata visibile anche in Settimana lavoro; stessa presentazione.
- PREVIOUS: PERSONAL-STARTUP, PR #233, documented separately in handoffs.
- STATUS: IN_PROGRESS — remote implementation and CI verification.
- SCOPE: same canonical tables, same shared presentation, shared visibility editor; occupied weekend helper; restore excluded entries from either calendar; Personal refresh on focus/realtime.
- DB: additive booleans on appointments and impegni_personali; existing explicit visibile_studio=false preserved. No rewriting clinical records, policy/auth/tenancy changes or production operations.
- VALIDATION: pending CI. Local execution environment unavailable.
- ROLLBACK: revert frontend and leave additive columns to preserve choices. Stable checkpoint stable/2026-08-27-full-recovery@070b28fd4eae4e2cc397584201d0bb149468fae7 unchanged.
