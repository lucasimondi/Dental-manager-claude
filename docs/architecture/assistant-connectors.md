# Connettori ChatGPT e Gemini

## PO update — confirmation inside the assistant chat (2026-10-24)
This section supersedes the earlier mandatory browser-review wording below.
Show the full returned summary in ChatGPT/Gemini, await a NEW explicit user reply
Conferma or Annulla, then call conferma_richiesta with that request ID and decision.
The same bound OAuth client can execute/cancel the immutable stored proposal after
fresh grant/capability/domain checks and single-use claim. No proposal token or new
clinical payload is accepted from the model. The browser link remains optional.
MCP marks this as a write: the host may request its own approval. The server checks
the decision enum and request binding, but cannot independently prove a natural
language reply occurred in a new turn; the assistant/host must enforce that user
interaction. Do not describe this as a cryptographic proof of user confirmation.
The request-table UPDATE policy now also permits the matching OAuth client to
record status/result; proposal_token remains immutable and other clients/tenants
remain excluded. No existing clinical-table RLS change. Migration remains unapplied.


PO request 2026-10-24: “Realizza connettori sia per qui che per gemini”.
This expands PR #246 and explicitly authorizes the authenticated integration.
Existing Vercel host, Supabase identity and domain actions remain the authorities.
Golden checkpoint stable/2026-08-27-full-recovery is untouched.

## Operational path

The external assistant reads the photo with its own vision model, calls real
patient/agenda/catalog tools, asks for missing facts and submits structured fields.
No second model call is made in Poliedra. `prepara_impianti`, `prepara_preventivo`,
`prepara_incasso` and `prepara_appuntamento` reuse the existing domain preparers.
A private ten-minute request holds the signed proposal, bound to user/studio/client.
The assistant receives only summary, request ID, expiry and review URL, never the
proposal token. One explicit confirmation in the assistant chat covers all rows; browser review is optional. The bound delegated session (or optional normal browser session) rechecks delegation, capability, current plan/autonomy and fresh
domain data before execution. Shared one-time claims prevent replay; canonical
executors and implant read-back remain authoritative. The external OAuth token cannot call arbitrary chat or raw confirmation tokens;
conferma_richiesta executes only the previously prepared immutable request.
`stato_richiesta` returns only a projection of the stored outcome, not the token.
No prescription signing, diagnostic inference, expense import or general SQL tool.

## Transport and authentication

`api/mcp.js` exposes stateless Streamable HTTP JSON-RPC for ChatGPT and Gemini:
initialize/ping/tools/list/tools/call, empty optional resource/prompt lists and
notification acknowledgements. Versions 2025-03-26/06-18/11-25; no SSE stream/session
is required. GET/DELETE return 405. Body bound 64 KiB. Foreign Origin denied;
public resource discovery uses the canonical configured HTTPS URI, never Host.
Tool descriptors carry OAuth security schemes and read/write annotations.

Supabase OAuth 2.1 owns authorization-code/PKCE, token rotation and consent. Two
pre-registered clients are approved in `poliedra_connector_clients`; DCR stays off.
The optional access-token hook adds the registered resource URI to `aud`, retaining
`authenticated` for existing PostgREST/RLS. It leaves ordinary sessions alone and
must compose with any existing hook. No client can edit the registry or call the
hook. The resource server validates signed claims, exact issuer/resource audience,
expiry/nbf, session/client/role, current user/studio, active registry entry and live
OAuth grant. The Edge boundary repeats registry/grant/clinical checks and existing
membership/plan/autonomy gates. All business operations use the user's JWT/RLS.
No service-role key is given to an assistant or the new MCP endpoint.

The first connector version is for users with canonical `clinical.general`;
owner/admin status alone is insufficient. Authenticated source-code access is not
an additional credential and existing Supabase management tools are not exposed.

Important OAuth limitation: Supabase OAuth access tokens have the same Data API
permissions as the user, plus client_id; `openid` is an identity scope, not a
fine-grained clinical scope. The consent page explicitly discloses that delegation.
Existing domain table RLS is preserved; this is NOT a claim that a stolen OAuth
JWT can only call MCP tools. Stronger direct Data API client restrictions would
require a separate reviewed RLS change. Do not grant access to untrusted clients.

## New data / privacy

Migration 20261024140257_assistant_connectors.sql adds only client registry,
private request table, RLS/column grants, an optional audience hook and an
administrator-only retention function. No existing table policy is weakened.
Requests are scoped to current user/studio, active clinical membership and matching
OAuth client; the user's normal session can review them. Only the matching OAuth client or the owner’s normal session can finalize status; OAuth clients cannot delete requests; proposal tokens are immutable after insertion.
Status is operational feedback, not a financial ledger. Actual domain records and
claims remain authoritative. No originals or training data are stored here.
Configure the approved retention job to run purge_poliedra_connector_requests()
hourly (24-hour record horizon). This configuration is a release prerequisite,
not a claim that a job already runs. The function is invoker-only, callable only
by the administrative service role; it is never exposed as an assistant tool.

## Uncertainty / limits

Claim, business write, read-back and request status update are separate calls.
If status update or response is lost, mark/show uncertain; never automatically
replay or claim no write happened. A stale preview (including new duplicates or
changed plan/payment facts) is refused before claim. Independent concurrent
proposals still do not gain a new domain database uniqueness/locking guarantee.
Photo transcription quality is not established by synthetic tests.

## Client availability and release

ChatGPT custom MCP setup is through its web plugin/custom-server management;
account/workspace rules still apply. Google documents Gemini Apps custom
connectors as US/English only at this date. A standards-compatible server does
not remove that restriction for an Italian account. Other supported MCP clients
may connect using the same server after their own account setup.

Source implementation is not activation: migration, existing Edge deployment,
Vercel environment, OAuth server/consent/hook/client registration, retention and
the user's final linking must be completed and smoke-tested. Read-only public
OAuth discovery for the existing project returned 404 during this task; no
production patient read/write or remote configuration change was made.
See the exact release/rollback sequence in the runbook.

## Primary references checked 2026-10-24

- https://developers.openai.com/plugins/build/auth
- https://developers.openai.com/plugins/deploy/connect-chatgpt
- https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
- https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication
- https://supabase.com/docs/guides/auth/oauth-server/getting-started
- https://supabase.com/docs/guides/auth/oauth-server/token-security
- https://support.google.com/gemini/answer/17209137?co=GENIE.Platform%3DAndroid&hl=en
