# agente-assistente (Supabase Edge Function)

The model behind Poliedron's chat (`src/lib/poliedron/modelGateway.js` is its only
caller in the app). Source of truth is this folder since POL-AI-008: brought in
verbatim from production **v28** (`verify_jwt = true`), then changed in the next commit.

## Files

- `index.ts`: HTTP entry point, auth (user JWT, `studio_id` from `app_metadata`,
  studio membership, AI plan gate), system prompt, tool loop with Claude, usage logging.
- `confirmation.js`, `agenda.js`, `pazienti.js`, `team.js`: signed confirmations,
  agenda and patient tools, Poliedron team (read-only).
- `allegato.js` (POL-AI-008): pure logic for a PDF/photo attached to a chat message.
  Tested by `tests/poliedronAllegati.test.mjs`.
- `memoria.js` (POL-AI-009): memory tools (`ricorda`, `dimentica`), the prompt sections
  "Cosa ricordi di questo utente" / "Farmaci frequenti dello studio", and
  `prepara_ricetta`. Tested by `tests/poliedronMemoriaRicette.test.mjs`.
- `../_shared/agendaSlots.js`: imported by `agenda.js`. Kept exactly as deployed; it is
  **not** identical to `src/lib/agendaSlots.js` (time zone and validation differ).

## Attachments (POL-AI-008)

Request body may carry `allegato: { nome, media_type, data }` (base64):
- types: `application/pdf`, `image/jpeg|png|webp|gif`; max 6 MB (PDF) / 5 MB (image);
- only with a normal chat message (refused with `confirm` or `team`);
- becomes a `document`/`image` block (cached) in the **last** user message only;
- never stored, never echoed back (`messages` in the response carry `[file allegato]`).

## Memory and prescriptions (POL-AI-009)

- Memory lives in `public.poliedron_memoria` (migration `20261006120000`), read and
  written with the **user's** login, so RLS keeps every entry private to its owner.
  If the table is missing the read fails and memory is simply off (no tools, no section).
- `prepara_ricetta` writes nothing: it checks the patient belongs to the studio and
  returns `documento: { tipo: 'ricetta', paziente_id, paziente_nome, farmaci }` in the
  response; the app opens the Ricetta form filled in, the clinician reviews and generates.
  Offered only to professions that prescribe and when `cerca_pazienti` is available.
- The legacy `compila_ricetta_medica` tool (auto-generating, writes `ricette_bozze`) stays
  unreachable, as in v28.

## Deploy

Deploy all files of this folder plus `../_shared/agendaSlots.js` with `verify_jwt = true`.
Order: migration `20261006120000_pol_ai_009_poliedron_memoria.sql` → this function → frontend.
The attachment field is optional, so this version is backward compatible: deploy it
**before** the frontend that sends `allegato` (the old version would ignore the file).
