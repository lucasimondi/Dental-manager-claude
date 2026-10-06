# agente-assistente (Supabase Edge Function)

The model behind Poliedron's chat (`src/lib/poliedron/modelGateway.js` is its only
caller in the app). Source of truth is this folder since POL-AI-008: brought in
verbatim from production **v28** (`verify_jwt = true`), then changed in the next commit.

## Files

- `index.ts`: HTTP entry point, auth (user JWT, `studio_id` from `app_metadata`,
  studio membership, AI plan gate), system prompt, tool loop with Claude, usage logging.
- `confirmation.js`, `agenda.js`, `pazienti.js`, `team.js`: signed confirmations,
  agenda and patient tools, Poliedron team (read-only).
- `allegato.js` (POL-AI-008): pure logic for a PDF/photo attached to the current chat
  message. Tested by `tests/poliedronAllegati.test.mjs`.
- `../_shared/agendaSlots.js`: imported by `agenda.js`. Kept exactly as deployed; it is
  **not** identical to `src/lib/agendaSlots.js` (time zone and validation differ).

## Attachments (POL-AI-008)

Request body may carry `allegato: { nome, media_type, data }` (base64):
- types: `application/pdf`, `image/jpeg|png|webp|gif`; max 6 MB (PDF) / 5 MB (image);
- only with a normal chat message (refused with `confirm` or `team`);
- becomes a `document`/`image` block (cached) in the **last** user message only;
- never stored, never echoed back (`messages` in the response carry `[file allegato]`).

## Deploy

Deploy all files of this folder plus `../_shared/agendaSlots.js` with `verify_jwt = true`.
The attachment field is optional, so this version is backward compatible: deploy it
**before** the frontend that sends `allegato` (the old version would ignore the file).
