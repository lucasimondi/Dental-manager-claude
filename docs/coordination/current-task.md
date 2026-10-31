# Current task — PERSONAL-OAUTH-CONSENT (2026-10-31)
- OWNER: Codex; dedicated branch codex/personal-oauth-consent from master 96445bf.
- AUTHORIZATION: PO "Correggi" after the Personal MCP OAuth link opened Studio at /oauth/consent.
- SCOPE: exact OAuth consent route to the Personal entry, archive-only authentication and explicit consent; exclude it from Studio service-worker fallback. Preserve /connector/* Studio flow.
- STATUS: implementation and local validation; dedicated PR before merge. No production release or auth configuration change.
- DATA: no schema/RLS/tenant changes, no document writes. Existing separate Personal auth client/storage and Auth server remain authoritative.
- ROLLBACK: revert this dedicated PR; no stored records or OAuth grants deleted. Stable checkpoints unchanged.
- PREVIOUS TASK: diary native-scroll was merged as PR253 at 96445bf; this branch does not change the diary.
