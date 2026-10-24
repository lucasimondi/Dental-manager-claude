# Current task — ASSISTANT-CONNECTORS (2026-10-24)
- OWNER: Codex; branch codex/photo-import-workflow, PR #246 expanded by explicit PO request: build connectors for ChatGPT and Gemini.
- PREVIOUS: PHOTO-TO-ACTIONS implant tool, 1458 tests/builds passing; no merge/deploy.
- AUTHORIZATION: PO explicitly requested both connectors, including the necessary authenticated integration. Implementation uses current Vercel host and Supabase OAuth server; no new hosting provider. Remote auth configuration/migrations/release remain gated and unperformed.
- SCOPE: standard shared Streamable HTTP MCP endpoint; per-user OAuth/PKCE with separate approved ChatGPT/Gemini clients; existing domain reads and reviewed draft→single browser approval→canonical execution; consent, revocation, setup page; synthetic tenant/security tests.
- STATUS: implementation complete, draft PR #246; predecessor2144047 CI/PG17 passed; final cancellation/status guard follow-up under review. Google currently documents custom Gemini Apps connectors as US/English only; compatible implementation is not proof of Italian account availability.
- VALIDATION: 1470/1470 Node tests, Studio/Personal builds, four-width Chromium consent/review/revoke/uncertain QA and screenshot review pass. Disposable PostgreSQL17 migration/RLS/two-tenant/client isolation/audience/retention tests pass in workflow40102076681; same SQL unchanged by final follow-up. No live OAuth account round-trip claimed.
- DATABASE: versioned connector configuration/request migration + RLS/tests; no production data used, no remote changes.
- RELEASE: draft PR→tests/review→WAITING_PRODUCT_OWNER; explicit Mergia, controlled migration/Edge/OAuth configuration, then user account linking. No manual deployment.
- ROLLBACK: disable connector clients, restore prior function/endpoint; preserve immutable stable/2026-08-27-full-recovery (070b28fd4eae4e2cc397584201d0bb149468fae7).
