# whatsapp-webhook (Supabase Edge Function)

The WhatsApp assistant of each studio. Source of truth is this folder (POL-WA-001);
production history: v3 (copied in POL-WA-001), v4 (POL-WA-002: token limit),
POL-WA-003a: the real assistant described below.

## Files

- `index.ts`: HTTP entry point, Meta signature check, conversation handling,
  the tool loop with Claude and the tool implementations (all database access).
- `logica.js`: pure logic (no network, no database): webhook parsing, Coexistence
  staff echoes, history building, staff pause, input validation, system prompt.
  Tested by `tests/whatsappAssistenteLogica.test.mjs`.
- `agendaSlots.js`: **byte-identical copy** of `src/lib/agendaSlots.js`, so the
  assistant proposes exactly the free slots the app would. A test fails if the two
  differ: after changing the app file, copy it here.

End-to-end behaviour (Meta, Supabase and Claude simulated) is tested by
`tests/whatsappWebhookFlusso.test.mjs`.

## What the assistant does (Product Owner decisions, 2026-10-02)

- Answers every message with the last 7 days / 30 messages of the conversation as memory,
  in a warm, human tone, never giving clinical advice.
- Tools: studio info, the patient's next appointments, real free slots, appointment
  requests (book / move / cancel), the patient's open balance, pending recalls,
  hand-over to staff.
- **Proposes, never confirms**: requests go to `richieste_prenotazione`
  (`origine = 'whatsapp'`), the same "Richieste di prenotazione" list of the Agenda.
  Staff confirms by saving the appointment; the agenda is never written by the assistant.
- **Pauses when staff writes from the phone** (Coexistence `smb_message_echoes`):
  no AI replies on that conversation for 4 hours (`whatsapp_conversazioni.ai_pausa_fino`).
- Personal data (appointments, balance, recalls) only for a number that matches exactly
  one patient; patient ids are never taken from the model.
- Hand-over creates an activity (`todos.categoria = 'WHATSAPP'`) and flags the conversation.
- If the AI fails or refuses, the patient gets a kind fallback and staff gets an activity.
- Meta redeliveries (same `wamid`) are ignored; the signature is checked before any
  database read.

## Deployment settings

- `verify_jwt = false`: Meta calls the webhook without a Supabase JWT. The function
  authenticates POSTs with the `X-Hub-Signature-256` HMAC and the GET handshake with
  `WHATSAPP_VERIFY_TOKEN`.
- Deploy all three files (`index.ts`, `logica.js`, `agendaSlots.js`).
- Public entry point: `api/whatsapp-webhook.js` (Vercel) forwards the raw body.
- Requires migration `20261002120000_pol_wa_003a_assistente_whatsapp.sql`.

## Required project secrets (names only, never commit values)

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`,
`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`.

## Changing it

Edit here, run `npm test`, deploy from the repository. Never edit the function in the
Supabase dashboard.
