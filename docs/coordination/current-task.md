# Current task — PERSONAL-DOCUMENT-FOLDERS (2026-10-21)
- OWNER: Codex; branch codex/personal-document-folders from master.
- PO authorization: "Sì ma su tutti i documenti vai". Entire Personal archive, not just San Raffaele.
- SCOPE: selectable folders in search, complete paginated folder loading, original-file ZIP export/share, scoped AI reading with coverage, matching Drive folder organization.
- Existing archive owner authentication and clinical-patient AI exclusion remain authoritative. No Studio changes or schema/security changes.
- STATUS: IMPLEMENTED; local 1441/1441 tests, both builds, script syntax and diff check pass. GitHub/browser CI not started: automatic approval review rejected git push because explicit destination/publication authorization is required. No remote branch or PR created by this session. Google Apps Script publishing is a release blocker (no script authorization/tooling here). No merge, remote migration, manual deployment or production backfill.
- PREVIOUS: APPOINTMENT-RAPID-FORM; coordination record retained in handoffs.
- ROLLBACK: revert dedicated PR; Drive file IDs preserved on moves. Immutable stable/2026-08-27-full-recovery preserved.
