# Attivare ChatGPT e Gemini per Poliedra

Implementation: PR #246. No production credentials belong in this document,
commits, chat, screenshots or test output. The PO requested both connectors;
merge/release still follows AGENTS.md, not an unattended auth configuration change.

## Controlled release

1. Inspect final-head CI, PostgreSQL 17 two-tenant/RLS/hook tests and browser QA.
   Obtain explicit PO Mergia for this PR. Preserve immutable rollback checkpoint.
2. Confirm real schema/migration history and backup. Apply only the reviewed
   20261024140257_assistant_connectors.sql through the approved migration process.
   It enables no OAuth clients and does not install a hook automatically.
3. Merge/deploy the reviewed frontend/API. Existing deploy-agente-assistente.yml
   attempts to deploy the full Edge folder on master changes if its existing
   GitHub secret is configured; verify its actual outcome, do not infer success
   from Vercel. Ordinary app paths work without connector tables/configuration.
4. On the existing Vercel project set server environment:

   | Variable | Value |
   | --- | --- |
   | POLIEDRA_MCP_URL | Exact stable HTTPS studio origin + `/api/mcp` |
   | SUPABASE_URL | Existing project URL |
   | SUPABASE_ANON_KEY | Existing publishable key; never a service-role key |
   | POLIEDRA_MCP_ORIGINS | Optional extra exact origins, comma-separated |

   The canonical host must also serve `/connector/consent`, `/connector/review`
   and `/connector/setup`; use the current production studio host, not an
   ephemeral preview alias. Do not guess a production custom domain.
5. Enable OAuth 2.1 Server in existing Supabase Authentication settings. Set the
   authorization path to `/connector/consent` and Auth Site URL to that origin,
   after checking effects on current login/redirect configuration. Keep Dynamic
   Client Registration off. Use two separately registered OAuth clients named
   Poliedra ChatGPT / Poliedra Gemini, PKCE S256, and copy each assistant's exact
   displayed callback URI. No wildcard callback. Configure the token endpoint
   authentication method supported by both discovery and that client.
6. Register their public client UUIDs in poliedra_connector_clients with the
   appropriate provider, the SAME canonical MCP resource URI and enabled=true.
   Never place OAuth client secrets in this table. Those secrets remain in the
   authorization server and the respective assistant's protected configuration.
7. Inspect any existing access-token hook first. Compose this migration's
   poliedra_connector_access_token_hook into it, preserving all existing tenant,
   role and metadata claims; do not blindly replace a live hook. Configure it
   only after testing a synthetic first-party login and each OAuth grant/refresh.
   Resource tokens must contain audiences `authenticated` AND the canonical MCP
   URL; an ordinary session must retain its original audience. Unsupported token
   audience shape/configuration is a blocker, never relax the audience check.
8. Schedule the invoker-only purge_poliedra_connector_requests() via the approved
   administrative scheduler, hourly. Confirm removal of synthetic rows older than
   24h. No cron extension/job is assumed to exist or silently installed here.
9. Verify public resource metadata and AS discovery, 401 + WWW-Authenticate,
   PKCE, approval/denial, grants/revoke, expiry/refresh and wrong-resource rejection.
   Run a synthetic clinician with two implants: external fields→pending request→
   normal-session review→verified save→status; repeat must not create extra rows.
   Repeat with another tenant and revoked clinical permission. No real records
   until smoke tests and release approval are complete.

## ChatGPT

Use ChatGPT on the web: Plugins → plus → Add custom MCP server. Enter the canonical
MCP URL, choose OAuth and the pre-registered client credentials using the exact
callback shown in server management. Complete Poliedra login/consent. Install the
personal plugin and invoke it in a supported chat/Work surface. Surface availability
and workspace permissions vary; do not promise the current iOS conversation gains
new tools automatically. Setup page displays the URL and current user grants.

## Gemini

Where the Google account supports custom apps: Gemini web → settings/Connected
Apps → Add a custom app → SAME MCP URL → Advanced features for pre-registered
client credentials → Poliedra login/consent. Google currently specifies US,
English, personal accounts and Keep Activity on. This task cannot enable the
feature for an unsupported Italian account. The server is protocol-compatible;
a native Gemini account link has NOT been verified. Do not suggest country
spoofing or share administrative keys as a workaround.

## User workflow

Attach the photo to the linked assistant and state the patient. It searches real
records and asks only for missing placement date/tooth/price/payment facts. It
returns one review URL. Open, check all rows and tap Conferma e registra. Return
to the chat; the assistant reads stato_richiesta. Use /connector/setup for recent
requests and revocation. No original photo is automatically archived by MCP.

## Rollback / disconnect

Disable registry entries first (blocks gateway, Edge and pending reviews), revoke
the user's grants, remove/disable the MCP endpoint and roll back frontend/Edge to
the preceding approved release. An audience hook must be restored/composed under
Auth change control, preserving existing normal login. New tables may remain
RLS-protected until retention/delete is approved; never drop clinical records or
rewrite existing ledger/history. Reverting UI alone does not revoke OAuth grants.
