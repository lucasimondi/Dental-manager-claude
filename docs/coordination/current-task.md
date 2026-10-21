# Current task — AGENDA-FLUIDITA (2026-10-21)
- OWNER: Codex; branch codex/agenda-fluidita-studio from master afbdbc1d.
- PO: Studio should use Personal's agenda behavior; restore personal events; remove ugly excluded button; fix native scrolling.
- CONCURRENT COMPLETED: Studio diagnostic requests PR #235 retained unchanged, including its handoff.
- PREVIOUS: PR #234 merged afbdbc1d; migration applied and Vercel deployment verified in its PR release record.
- SCOPE: one shared Personal-derived gesture/zoom/scroll hook; Studio touch scrolling without appointment mutations; 24h mobile range; shared all-day event ribbon; excluded events inside view menu.
- STATUS: WAITING_PRODUCT_OWNER — PR #236; no merge/deploy. Final verification recorded on PR.
- DATABASE / AUTH / RLS: no changes or production writes.
- ROLLBACK: revert this PR; preserve stable/2026-08-27-full-recovery at 070b28fd4eae4e2cc397584201d0bb149468fae7.
- VALIDATION: CI ceee4776: 1412/1412 Node tests including concurrent PR #235; Studio/Personal builds pass; baseline comparisons, reliability and sharing pass Chromium/WebKit. Native gesture suite final status recorded on PR #236. Local diff --check clean.
