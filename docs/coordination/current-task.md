# Current task — PERSONAL-MCP-DOCUMENT-CONTENT (2026-10-31)
- OWNER: Codex; branch codex/personal-mcp-document-content from master 64e2224.
- AUTHORIZATION: PO requests autonomous Personal MCP completion and replies Vai after OAuth/upload/search/metadata test, explicitly including content reading. Existing staging Vercel project/endpoint is the release target. Studio must remain unchanged.
- SCOPE: restore existing standalone source from codex/poliedron-chatgpt-connector (server/upload SHA1 verified against deployed source); add authenticated original retrieval and bounded reading, tests, deploy only poliedron-chatgpt-mcp-staging. Preserve App/OAuth IDs and archive ownership checks.
- DATA: no schema/RLS/grants/tenancy/Studio changes. Synthetic tests only; no existing document edits.
- STATUS: implementation and validation.
- ROLLBACK: restore staging deployment dpl_FN1W8N1QXnCq7PNSnSowAsyQQFby; source PR revert; retain documents/grants. Golden checkpoints untouched.
- PREVIOUS TASK: PERSONAL-OAUTH-CONSENT merged PR255; OAuth verified in ChatGPT on 2026-10-31. Physical Android unavailable for direct tests.
