# agente-assistente (Supabase Edge Function)

The AI behind Poliedron (the in-app chat). Called only by
`src/lib/poliedron/modelGateway.js` (`supabase.functions.invoke('agente-assistente')`).

Source of truth is this folder from POL-AI-010 step 0. `index.ts` is a **faithful copy
of production version 24** (read on 2026-10-04, `verify_jwt = true`); before that the
function existed only in production.

## What it does

- Tool loop with Claude (at most 5 turns). Tools: `cerca_pazienti`, `appuntamenti`,
  `situazione_economica`, `kpi_controllo_gestione`, `andamento_kpi`, `richiami`,
  `storico_paziente`, `catalogo_prestazioni` (read); `crea_appuntamento`,
  `modifica_appuntamento`, `crea_impegno_personale`, `crea_promemoria`,
  `aggiungi_nota_paziente`, `compila_ricetta_medica` (direct writes);
  `elimina_appuntamento`, `registra_pagamento`, `crea_paziente`,
  `crea_proposta_commerciale` (writes that return `needsConfirmation` first);
  plus the studio's custom actions (`azione_<nome>`, table `ai_agent_actions`).
- Plan gate `feature_overrides.assistente_ai`: `off` (403), `base` (no tools), `pro`
  (read tools only), `premium` (all tools + custom actions).
- Autonomy dial `feature_overrides.agente_azione` (capped by `agente_azione_max`):
  `consulente` (read only), `medio` (every write needs confirmation), `su_richiesta`,
  `completo`.
- Confirmation protocol: the response carries `needsConfirmation {tool_use_id, name, input}`
  and the conversation so far; the client calls again with `confirm {tool_use_id, cancelled?}`.
- Every model call is logged in `ai_agent_usage` (tokens and estimated cost).

## Data access

- All tools run with the **caller's session** (anon key + the user's `Authorization`),
  so RLS scopes every read and write to the user's studio.
- The service-role client is used only for 4 read-only configuration reads
  (`ai_agent_config`, `ai_agent_faq`, `ai_agent_documenti`, `ai_agent_actions`), each
  filtered by the caller's `studio_id`, because those tables are admin-only under RLS
  while the chat is open to all staff. `tests/agenteAssistenteBaseline.test.mjs` fails
  if the service-role client is used for anything else.

## Known issues (recorded in POL-AI-010 step 0, fixed in later steps, not here)

See `docs/coordination/handoffs.md` (POL-AI-010 step 0) for the full list. The most
important: `appuntamenti` does not return appointment ids, so `modifica_appuntamento` /
`elimina_appuntamento` have no reliable id to use; the `confirm` path executes the
tool named in the client-supplied history without re-checking that tool against the
plan/autonomy gates; Poliedron's chat does not yet handle `needsConfirmation` or the
prescription `pdf_data` (only the unmounted `AssistenteAI.jsx` did).

## Deployment settings

- `verify_jwt = true` (only logged-in users).
- Single file `index.ts`.

## Required project secrets (names only, never commit values)

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`.

## Changing it

Edit here, run `npm test`, deploy from the repository. Never edit the function in the
Supabase dashboard.
