# whatsapp-webhook (Supabase Edge Function)

`index.ts` is the source of the function deployed on the production Supabase
project, version 3 (last deployed 2026-07-26), copied verbatim into the
repository by POL-WA-001 on 2026-09-30. Before this, the source existed only
in Supabase.

POL-WA-002 changes the AI call (`max_tokens` 512 → 4096, `effort: "low"`) so
the adaptive thinking of `claude-sonnet-5` cannot use up the whole budget and
leave the patient with the fallback text. That version is deployed to
production only when POL-WA-002 is merged.

## Deployment settings (as in production)

- `verify_jwt = false`: Meta calls the webhook without a Supabase JWT. The
  function authenticates POSTs itself with the `X-Hub-Signature-256` HMAC and
  the GET handshake with `WHATSAPP_VERIFY_TOKEN`.
- Public entry point: `api/whatsapp-webhook.js` (Vercel) forwards the raw
  body byte-for-byte to this function.

## Required project secrets (names only, never commit values)

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`,
`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`.

## Schema

Tables `whatsapp_config` and `whatsapp_messages`:
`supabase/migrations/20260930120000_pol_wa_001_whatsapp_baseline.sql`.

## Changing it

The repository copy is now the source of truth. Edit `index.ts` here, then
deploy it with `verify_jwt = false`. Do not edit the function directly in the
Supabase dashboard.
