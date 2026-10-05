# POL-AI-TEAM-001 — base isolata per assistenti e gruppi

## Obiettivo e stato

Luca, 5 ottobre 2026: leggere PR #123 e iniziare a costruire senza conflitti
con l'altra sessione. Fonte di prodotto: PR #123,
`docs/architecture/poliedron-team-vision.md` sul branch
`codex/poliedron-team-vision` (non ancora in master).

Questa prima implementazione è un modulo di dominio puro, **non attivo nella
chat e non collegato a un modello**. Implementa definizioni di gruppi, piano
di consultazione del Clinic Manager e raccolta dei contributi specialistici.
Non simula risposte AI né presenta contatti fittizi come funzionanti.

## Confine con il lavoro parallelo

Base `master@ea83464`, branch `codex/poliedron-team-foundation`.
CLAUDE mantiene POL-AI-010, Documenti, chat/PWA e il proprio branch.
Nessuna modifica a `App.jsx`, componenti chat/controller, `poliedraCore.js`,
`modelGateway.js`, Edge Functions, SQL, permessi, Master Context o deployment.
I documenti di coordinamento conservano integralmente i blocchi dell'altro owner.
Un eventuale conflitto documentale va risolto conservando entrambe le voci.

## Audit delle fonti esistenti

- `chat-polyedron.md`: un controller, un Model Gateway, una conversazione primaria.
- `conversationRepository.js`: conversazioni private tenant/utente, storico bounded;
  nessun modello esistente per membri/obiettivi di gruppo. Non sovraccaricare
  `conversation_kind` o metadata senza progettazione e verifica schema/RLS.
- `modelGateway.js`: solo `agente-assistente`; gli `allowedTools` non sono
  applicati dal gateway attuale. Chiamarlo più volte con ruoli specialistici
  potrebbe attivare le scritture dirette di POL-AI-010. Perciò qui non è chiamato.
- `permissionEngine.js`: filtri di presentazione, non autorità server.
- POL-AI-010: azioni, autonomia, conferme e registro già esistenti; gruppi e
  Clinic Manager non devono costituire un secondo esecutore.

## Contratti implementati

`src/lib/poliedron/team/catalog.js` definisce descrittori immutabili:
Clinic Manager, Agenda, Finanza, Clinico, Documenti. È un primo catalogo
tecnico estendibile, non un elenco di agenti già addestrati. I descrittori
non concedono capability, accesso a dati o strumenti.

`consultation.js` espone:

1. `defineTeamGroup`: identità studio/utente, titolo, obiettivo, specialisti
   espliciti e Clinic Manager come coordinatore. Solo in memoria.
2. `planTeamConsultation`: identità del chiamante uguale al proprietario del
   gruppo; callback obbligatoria di autorizzazione per manager e specialisti;
   un turno, massimo tre specialisti, budget massimo specialisti + una sintesi.
3. `collectTeamContributions`: attribuzione e ordine stabili, risultati completi
   o parziali, specialisti mancanti/non disponibili/negati, rifiuto di risposte
   appartenenti a un'altra richiesta/gruppo/studio/utente. Ricontrolla accesso
   prima di restituire il testo. Nessuna azione eseguibile.

Il piano è un oggetto interno fidato e immutabile, non un token di sicurezza:
non accettarlo dal browser come autorizzazione server. La callback è sincrona
(literal `true`), non un nuovo RBAC; in integrazione deriva da controlli
server già completati. L'uso client può servire soltanto alla presentazione.
Non contiene cartelle, KPI o documenti; le future proiezioni di contesto devono
essere minimizzate e ottenute dalle fonti canoniche con il client dell'utente.

Il budget è un contratto per il futuro esecutore, non un limite di spesa già
imposto a un provider. La raccolta restituisce opinioni: mantenere divergenze
e dati mancanti, senza trasformare l'accordo in verifica dei fatti. I campi
estranei alla risposta testuale non diventano tool o istruzioni di sistema.

## Incrementi successivi

1. Coordinarsi con il lavoro POL-AI-010 prima di toccare gateway/server/chat.
2. Implementare un percorso server di consultazione strettamente read-only
   dentro il gateway esistente, con scope verificato per ogni specialista,
   timeout/cancellazione e budget effettivi. Test negativi contro tool di scrittura.
3. Aggiungere routing del Clinic Manager e sintesi attribuita senza perdita di
   divergenze. Non inferire un dominio autorizzato dalla sola parola nel messaggio.
4. Collegare contatti/gruppi alla chat; progettare persistenza solo dopo audit
   schema/RLS e test due tenant/utenti. Non duplicare il controller Poliedron.
5. QA mobile/tablet/desktop e smoke in staging prima del rilascio.

## Verifica e rollback

16 test comportamentali dedicati verificano gruppi, bounded planning,
identità, deny-by-default, revoca, risultati parziali, attribuzione, duplicati,
risposte obsolete e nessuna trasformazione dei campi tool in azioni.
Esiti finali della suite completa/build nel handoff.

Nessuna migration, scrittura remota, merge o deploy. Nessun nuovo import in
produzione: il comportamento corrente resta identico. Rollback: chiudere la
bozza oppure revert del commit di questa PR; nessuna operazione sui dati.

## POL-AI-TEAM-002 — team attivo in chat (2026-10-05)

Product Owner: "Sì ma mettiamo anche marketing, clinico e poi dimmi tu, voglio
già creare di questa sera questa cosa". Presa in carico da CLAUDE della bozza
#125 (Codex) su istruzione del PO.

- **Assistenti**: Clinic Manager, Agenda, Clinico, Marketing, Finanza, Documenti
  (`src/lib/poliedron/team/catalog.js` lato app, `supabase/functions/agente-assistente/team.js`
  lato server; un test verifica che gli ID coincidano).
- **Server** (`agente-assistente`, campo `team` della richiesta): ogni membro del
  team riceve solo strumenti di **lettura**, intersecati con quelli che piano,
  autonomia e utente hanno già in chat; nessuna scrittura, nessuna conferma,
  nessuna riga nel registro azioni. Lo specialista ha solo i propri strumenti.
  Il Clinic Manager legge e ha lo strumento `consulta_specialisti`: consulti in
  parallelo, solo membri del gruppo, senza doppioni, massimo 2 consultazioni per
  richiesta, 45 s per specialista; i pareri tornano attribuiti (`team.pareri`)
  con stato `ok`/`non_disponibile`. Richieste team non valide falliscono prima
  di chiamare il modello.
- **App**: pulsante "Team" nella Chat Polyedron → contatti (Clinic Manager,
  specialisti, gruppi), conversazione per contatto, "Nuovo gruppo" con nome,
  obiettivo e specialisti; i pareri dei singoli specialisti sono apribili sotto
  la risposta del Clinic Manager. Le azioni restano a Poliedron nella chat
  principale.
- **Persistenza**: gruppi e conversazioni del team per ora restano sul
  dispositivo (localStorage per studio+utente). Salvarli nel database richiede
  una tabella con RLS: decisione del PO.
- **Test**: `tests/agenteTeamFlow.test.mjs` (handler reale: strumenti per ruolo,
  rifiuto delle scritture, consulti attribuiti, gruppi, parziali, PRO/consulente/
  BASE, richieste non valide) e `tests/poliedronTeamThreads.test.mjs`.
