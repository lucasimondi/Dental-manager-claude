# agente-assistente

Poliedron's authenticated Edge Function (POL-AI-010). Production v25 = steps 0-2;
step 2b (direct execution and speed) is not yet deployed.

## Contracts

- Questions: `messages` contains only user/assistant text, bounded to 21 messages.
- Clear write, no conflict (step 2b): executed directly through the same atomic RPC
  with a fresh claim id; response `{ text, changed }` where `text` is the server
  summary of what was done. If a model turn contains only successful writes the
  response returns at once, with no further model call.
- Conflict, invalid data or an ID not seen in a read of the same request: nothing is
  written; the model receives the error (for an occupied slot, the real free slots)
  and asks the user.
- Possible duplicate patient, or studio autonomy `medio`: signed proposal
  `needsConfirmation { token, summary, expiresAt }`; no write yet.
- Decision: `confirm { token, cancelled? }`; no client tool blocks or conversation
  replay is needed. Rechecks active membership, current plan/autonomy and signature.
- Uncertain result: explicit message and refresh; never automatically replay writes.

Speed: `output_config.effort = "low"`, prompt caching on the tools and on the
stable system block (studio name, knowledge, date and level come after the cache
point), initial reads in parallel, usage logging off the critical path.

Reviewed writes exposed to the model: agenda (create, modify, soft-cancel) and, from
step 2, patients and clinical organisation (`pazienti.js`: new patient,
contact/consent update, dated note, recall, activity, agenda block; executed by
`poliedron_execute_pazienti_v1`). Read tool `scheda_paziente`.
From step 4a, patient payments (`pagamenti.js`, tool `registra_pagamento_paziente`):
**always** a signed summary first (also with full autonomy), then on "Conferma" a
claim in `poliedron_action_claims` and one insert into `payments` with the user's
session (RLS `payments_studio`); the existing triggers feed the financial ledger
when `stato = 'pagato'`. Plan link as in the app (one open plan → automatic, several
→ ask, none → NULL); same amount on the same day → warning in the summary. Not
undoable from the activity log (the ledger has no reversals): corrected in Incassi.
Any ID the model writes against must come from a read in the same request. Read tools include real availability and
operator listing. Other domain writes remain in existing deterministic workflows
and will be integrated in subsequent steps. No permanent deletion or forced overlap.

All business operations use the caller's session/RLS. The service-role client only
reads the existing four tenant-filtered `ai_agent_*` configuration tables. The
existing service-role secret is also used for domain-separated HMAC signatures;
never expose it or persist confirmation tokens in chat/localStorage.

`verify_jwt=true`. Deploy the full function folder and its imported
`../_shared/agendaSlots.js`, after the approved migrations
`20261004160708_pol_ai_010_action_claims.sql` and `20261005120000_pol_ai_010_pazienti.sql`. No new secret is required:
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`.

The legacy financial read tools still require canonical-source convergence in
step 4. Do not treat this step as a financial audit or complete AI integration.

Validation, exact limitations, release order and rollback:
`docs/architecture/POL-AI-010-agenda.md`.

## POL-AI-008 / POL-AI-009 (allegati, memoria, ricette)

The folder below was re-imported from production v28 (identical to the code above) and extended; production is now **v31**.

### Files

- `index.ts`: HTTP entry point, auth (user JWT, `studio_id` from `app_metadata`,
  studio membership, AI plan gate), system prompt, tool loop with Claude, usage logging.
- `confirmation.js`, `agenda.js`, `pazienti.js`, `team.js`: signed confirmations,
  agenda and patient tools, Poliedron team (read-only).
- `pagamenti.js` (POL-AI-010 passo 4a): payments from chat, always confirmed.
  Tested by `tests/agentePagamenti.test.mjs`.
- `allegato.js` (POL-AI-008): pure logic for a PDF/photo attached to a chat message.
  Tested by `tests/poliedronAllegati.test.mjs`.
- `memoria.js` (POL-AI-009): memory tools (`ricorda`, `dimentica`), the prompt sections
  "Cosa ricordi di questo utente" / "Farmaci frequenti dello studio", and
  `prepara_ricetta`. Tested by `tests/poliedronMemoriaRicette.test.mjs`.
- `../_shared/agendaSlots.js`: imported by `agenda.js`. Kept exactly as deployed; it is
  **not** identical to `src/lib/agendaSlots.js` (time zone and validation differ).

### Attachments (POL-AI-008)

Request body may carry `allegato: { nome, media_type, data }` (base64):
- types: `application/pdf`, `image/jpeg|png|webp|gif`; max 6 MB (PDF) / 5 MB (image);
- only with a normal chat message (refused with `confirm` or `team`);
- becomes a `document`/`image` block (cached) in the **last** user message only;
- never stored, never echoed back (`messages` in the response carry `[file allegato]`).

### Memory and prescriptions (POL-AI-009)

- Memory lives in `public.poliedron_memoria` (migration `20261006120000`), read and
  written with the **user's** login, so RLS keeps every entry private to its owner.
  If the table is missing the read fails and memory is simply off (no tools, no section).
- `prepara_ricetta` writes nothing: it checks the patient belongs to the studio and
  returns `documento: { tipo: 'ricetta', paziente_id, paziente_nome, farmaci }` in the
  response; the app opens the Ricetta form filled in, the clinician reviews and generates.
  Offered only to professions that prescribe and when `cerca_pazienti` is available.
- The legacy `compila_ricetta_medica` tool (auto-generating, writes `ricette_bozze`) stays
  unreachable, as in v28.

### Deploy

Deploy all files of this folder plus `../_shared/agendaSlots.js` with `verify_jwt = true`.
Order: migration `20261006120000_pol_ai_009_poliedron_memoria.sql` → this function → frontend.
The attachment field is optional, so this version is backward compatible: deploy it
**before** the frontend that sends `allegato` (the old version would ignore the file).
