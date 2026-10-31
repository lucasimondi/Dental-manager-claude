# Poliedron ChatGPT MCP

Standalone server for the existing `poliedron-chatgpt-mcp-staging` Vercel project.

The integration must use the existing Google Drive archive and canonical Supabase document index. An authenticated OAuth 2.1 MCP server is required before connecting ChatGPT. Do not use a separate document bucket or a browser session as a substitute for authorization.

`get_document` now returns content by default: original images, extracted PDF text, or locally rendered scanned pages. It first resolves the document through the user's existing RLS-protected Personal archive, excludes `clinico_pazienti`, then uses the existing authenticated Apps Script `azione:file`. It never takes a URL or Drive ID from the caller. `include_content:false` retains metadata-only access. PDF requests use `start_page` and `page_count` (1–5, default 3), returning `next_page` when more remain. Original cap 10 MiB; images/rendered pages 4 MiB each; rendered page batch 6 MiB. Text truncation is explicit. Nothing is sent to another OCR/model service.

Run `npm ci && npm test` here (Node >=22.13). PDF.js and native canvas are pinned, with a lockfile. Vercel uses the same `api/index.mjs` entry and route layout as the previous deployment. Environment names are unchanged; never copy values into source. Health reports the actual read/write capability and server version, not the old misleading read-only label.

This changes only the standalone Personal server. No Studio, schema, RLS, Apps Script, archive rows, App IDs or OAuth grant configuration changes. Rollback target: deployment `dpl_FN1W8N1QXnCq7PNSnSowAsyQQFby`. Physical Android availability remains a separate unverified device check.
