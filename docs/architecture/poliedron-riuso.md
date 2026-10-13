# Riusare Poliedron in un'altra app

Guida per una sessione di Claude (o uno sviluppatore) che deve costruire **un'altra
app** partendo dal codice di Poliedron. Richiesta del Product Owner (2026-10-12):
"Voglio che un'altra chat di Claude possa leggere e prendere il codice di
Poliedron per poter costruire un'altra app con Poliedron".

## Regole per chi riusa

- **Questo repository è solo una fonte.** Chi costruisce l'altra app lo legge e
  copia il codice nel *proprio* repository. Non apre branch, commit o PR qui e non
  tocca il progetto Supabase di Poliedra (`idklxdqebfceplrualgh`). `AGENTS.md`
  governa chi lavora su Poliedra, non chi copia da qui.
- **Progetto Supabase separato** per la nuova app, con i suoi secret. Mai
  riusare chiavi, URL o database di Poliedra.
- **Nessun dato**: si copia codice e struttura (schema, RLS), mai righe del
  database di produzione.
- **Le regole di sicurezza di Poliedron vanno copiate insieme al codice**, non
  sono opzionali (vedi "Invarianti").

## Come è fatto Poliedron (in breve)

```
App React (src/components/poliedron, src/lib/poliedron)
   │  fetch con il JWT dell'utente
   ▼
Edge Function agente-assistente (supabase/functions/agente-assistente/index.ts)
   1. sessione utente + appartenenza attiva allo studio (studio_users)
   2. Core deterministico: capisce la frase senza modello AI
      (poliedron-language*, poliedron-agenda, poliedron-actions, poliedron-planner)
      → se basta, risponde/prepara l'azione e finisce qui
   3. altrimenti modello AI con strumenti (provider.js: OpenAI / Anthropic,
      con riserva automatica) — gli strumenti sono filtrati per permessi
   4. ogni scrittura: modulo di dominio prepara e valida → conferma firmata
      (confirmation.js) oppure esecuzione diretta "Safe Autonomy" → RPC atomica
   5. registra un evento strutturato (poliedron-eventi.js) e risponde
   ▼
Postgres con RLS: tutte le letture/scritture usano il client con il JWT
dell'utente, quindi la RLS filtra sempre.
```

## Mappa dei file: cosa si riusa e cosa va riscritto

### Server — `supabase/functions/agente-assistente/`

| File | Cosa fa | Riuso |
|---|---|---|
| `index.ts` (~2000 righe) | Ingresso: auth, membership, Core, prompt, ciclo strumenti, conferme, eventi | **Adattare**: tenere lo scheletro (auth → Core → modello → conferme → eventi), sostituire elenco strumenti e prompt del dominio |
| `provider.js` | Adattatori OpenAI/Anthropic in un formato unico, catena di riserva | **Così com'è** |
| `confirmation.js` | Proposte firmate HMAC, scadenza, claim anti-doppia-esecuzione | **Così com'è** (richiede tabella `poliedron_action_claims`) |
| `confidence.js` | Motore di confidenza deterministico | **Così com'è** |
| `poliedron-conversation.js` | Risposte brevi che completano una domanda in sospeso ("alle 10") | **Così com'è** |
| `poliedron-context.js` | Contesto firmato tra due messaggi | **Così com'è** |
| `poliedron-eventi.js` | Statistica Core vs modello (niente testo chat) | **Così com'è** (tabella `poliedron_eventi`) |
| `emergency.js` | Modalità essenziale in sola lettura se l'AI non risponde | **Adattare** (letture del dominio) |
| `poliedron-language.js`, `poliedron-language-data.js`, `poliedron-language-matcher.js` | Lessico italiano e riconoscimento intenti | **Adattare**: struttura riusabile, frasi/intenti del dominio da riscrivere |
| `poliedron-agenda.js` | Giorni/orari in italiano ("giovedì alle 10"), spostamenti | **Così com'è** se la nuova app ha un'agenda |
| `poliedron-actions.js`, `poliedron-core-actions.js`, `poliedron-planner.js`, `poliedron-core.js` | Comandi riconosciuti dal Core e loro esecuzione | **Riscrivere** per i comandi della nuova app, stesso schema |
| `agenda.js`, `pazienti.js`, `pagamenti.js`, `piani.js` | Moduli di dominio: prepare → riepilogo → execute | **Riscrivere** per le entità della nuova app; sono il modello da imitare |
| `memoria.js` | Ricordare preferenze/fatti per studio | **Così com'è** (tabella `poliedron_memoria`) |
| `team.js` | Specialisti con soli strumenti di lettura | **Adattare** (ruoli del dominio) |
| `allegato.js` | PDF/foto allegati in chat | **Così com'è** |
| `learning.js` | Contratto eventi del Learning Engine (non importato da `index.ts`) | Facoltativo |
| `../_shared/agendaSlots.js` | Calcolo slot liberi | Con l'agenda |
| `README.md` | Contratti dell'API (domande, conferme, esiti incerti) | **Leggere per primo** |

### App — React

- `src/components/poliedron/` — interfaccia: `Poliedron.jsx` (contenitore e
  chiamate), `PoliedronChatPage.jsx`, `PoliedronConversation.jsx`,
  `PoliedronModelConfirmation.jsx` (conferma delle proposte),
  `PoliedronAttivita.jsx` (registro e cruscotto), orb/dock/mobile.
  **Riusabile** cambiando testi ed etichette.
- `src/lib/poliedron/` — motori lato client: `intentEngine.js`,
  `permissionEngine.js`, `actionRegistry.js`, `confirmationReply.js`,
  `conversationRepository.js`, `memoryRepository.js`, `statistiche.js`.
  Le cartelle `intelligence/` (scanner clinici: richiami, igiene, piani) e
  `planner/` (denti, prestazioni) sono **specifiche del dentale**.
- `src/components/AgenteAISetup.jsx` — pannello "Agente AI" dello studio
  (prompt, FAQ, documenti, azioni personalizzate).

### Database

Migrazioni in questo repository che servono a Poliedron:

| Migrazione | Contenuto |
|---|---|
| `20261004160708_pol_ai_010_action_claims.sql` | `poliedron_action_claims` + RPC `poliedron_execute_agenda_v1` |
| `20261005120000_pol_ai_010_pazienti.sql` | RPC `poliedron_execute_pazienti_v1` (dominio) |
| `20261005170000_pol_ai_010_registro_annullati.sql` | `poliedron_attivita` (registro attività) |
| `20261006120000_pol_ai_009_poliedron_memoria.sql` | `poliedron_memoria` |
| `20261012120000_pol_ai_011_poliedron_eventi.sql` | `poliedron_eventi` + `poliedron_statistiche_v1` |
| `20260824030000_chat_polyedron.sql` | `poliedron_conversations`, `poliedron_messages` (storico chat) |

**Attenzione:** alcune tabelle di base **non sono nelle migrazioni** di questo
repository (create prima che le migrazioni fossero versionate). Vanno ricreate
nella nuova app, con RLS per studio:

| Tabella | Colonne |
|---|---|
| `studios` | id uuid, nome, email, piano, attivo, feature_overrides jsonb, … |
| `studio_users` | id, studio_id, user_id, email, nome, ruolo, stato (`attivo`), created_at |
| `ai_agent_config` | id, studio_id, system_prompt, tone, topics_enabled jsonb, enabled, updated_at, updated_by |
| `ai_agent_actions` | id, studio_id, nome, descrizione, tipo_effetto, parametri jsonb, config jsonb, richiede_conferma, attiva, created_at |
| `ai_agent_faq` | id, studio_id, domanda, risposta, ordine, created_at |
| `ai_agent_documenti` | id, studio_id, nome, testo, created_at |
| `ai_agent_usage` | id, studio_id, fonte, modello, input_tokens, output_tokens, costo_usd, creato_il |

Le tabelle di dominio (`patients`, `appointments`, `payments`, `plans`,
`richiami`, `impegni_personali`, `pricelist`, `todos`, `operatori`,
`studio_info`, `ricette_bozze`) e l'RPC `get_kpi_periodo` sono del gestionale
dentistico: nella nuova app si sostituiscono con le sue entità.

### Secret della Edge Function (nel nuovo progetto Supabase)

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (forniti da
Supabase; la service role serve solo a firmare/verificare proposte e contesto
e a leggere la configurazione dell'agente dello studio (`ai_agent_*`, dopo il
controllo di appartenenza); mai per i dati di dominio né per scrivere), `OPENAI_API_KEY`, `OPENAI_MODEL`,
`ANTHROPIC_API_KEY`, `POLIEDRON_LLM_PROVIDER` (`openai` | `anthropic` | `auto`).
Il valore dei secret non va mai scritto nel codice, nei documenti o in chat.

### Test

`tests/poliedron*.test.mjs` (Node test runner, `npm test`): i test di
`provider`, conferme, conversazione, eventi e linguaggio si portano quasi
identici e sono la migliore documentazione del comportamento atteso.

## Invarianti da conservare

1. Letture e scritture dei dati usano il client Supabase **con il JWT
   dell'utente**: la RLS decide cosa si vede. La service role è limitata alle
   firme e alla configurazione dell'agente (vedi "Secret").
2. Prima di tutto: sessione valida + membro **attivo** dello studio.
3. Gli strumenti offerti al modello sono filtrati per permessi; un nome di
   strumento non consentito non si esegue mai.
4. Il browser non può far eseguire blocchi di strumenti: le scritture partono
   solo da proposte create e firmate dal server.
5. Un esito incerto non si ripete mai in automatico (claim prima della scrittura).
6. Il Core decide solo quando è sicuro; nel dubbio chiede o passa al modello,
   e la somiglianza di frasi non autorizza mai una scrittura.
7. Niente testo delle chat né dati personali nei log e nelle statistiche.

## Ordine di lavoro consigliato per la nuova app

1. Leggere `README.md` della funzione, questo file, `docs/POLIEDRA_MASTER_CONTEXT.md`
   e `docs/architecture/poliedron-learning-engine.md`.
2. Creare il progetto Supabase: tabelle di base (sopra) + migrazioni Poliedron
   generiche (claims, memoria, attività, eventi), con RLS e test.
3. Copiare i file "così com'è"; scrivere un modulo di dominio della nuova app
   sul modello di `pazienti.js` (prepare → riepilogo → execute via RPC atomica).
4. Ridurre `index.ts` agli strumenti della nuova app; poi aggiungere al Core i
   comandi più frequenti (guardare il cruscotto "Come risponde Poliedron").
5. Copiare l'interfaccia `src/components/poliedron/` e cambiare i testi.
