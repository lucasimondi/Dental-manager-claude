# Current task — PERSONAL-DIARIO-AMOR-FATI (2026-10-30)
- OWNER: Codex; branch codex/personal-diario-amor-fati, from master 12fb382.
- AUTHORIZATION: PO requests vintage diary in Poliedron Personal: cover, page turning, automatic dates, writing, photos/paste, search/date jumps, manual/automatic pages and skipped pages.
- SCOPE: isolated Personal section; existing private archivio impostazioni_app JSON rows, no schema/RLS/Studio changes.
- STATUS: WAITING_PRODUCT_OWNER. 1479/1479 Node tests; Personal and Studio production builds; browser synthetic cover/write/date/search/paste/reload/blank pages/long-text checks passed. No merge or production deployment.
- DELIVERY: PO explicitly authorized source publication and PR creation after reviewing the diary. Git HTTPS credentials unavailable; publish through connected GitHub tools. No merge/production deployment authorized yet.
- ROLLBACK: revert dedicated PR; diary rows preserved. Stable checkpoints untouched.

---
Previous task:

# Current task — CALENDAR-STARTUP (2026-10-28)
- OWNER: Codex; branch codex/calendar-startup, from latest origin/master.
- AUTHORIZATION: PO requests Poliedra open directly on calendar with immediate startup.
- SCOPE: Studio default Agenda; preload calendar during auth/data fetch; lazy-load Home.
- PRESERVE: Poliedron chat entry, explicit agenda URLs, authentication/data gates, document recovery.
- STATUS: WAITING_PRODUCT_OWNER. 1472/1472 Node tests passed; Studio production build passed; diff check passed. No merge/deploy or database changes.
- ROLLBACK: revert dedicated PR. Stable checkpoints untouched.
