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

### Chat come WhatsApp (2026-10-06)
PO: "Deve essere come WhatsApp, dove ci sono le chat con i contatti e io vado nella chat e comunico"; "manca la possibilità di installare la chat direttamente in home"; "deve essere tutto schermo".
- La pagina Chat si apre sull'elenco delle chat: Poliedron, Clinic Manager, specialisti e gruppi, ciascuno con ultimo messaggio e ora; "+" crea un gruppo. Su telefono elenco e conversazione sono due schermate a tutto schermo (freccia indietro); su computer due colonne.
- Su telefono la barra di navigazione in basso è nascosta nella Chat; i moduli sono nel menu ⋮ insieme a "Registro attività" e "Installa Poliedron sul telefono" (dal gestionale apre l'app `/poliedron/` con le istruzioni di installazione).
- Il test mobile `tests/browser/poliedron-mobile.cjs` ora apre la chat di Poliedron dall'elenco.

### Elenco chat stile WhatsApp iOS, nuova chat e ricerca (2026-10-06)
PO (con screenshot di WhatsApp): tutto schermo con dock flottante (chat, calendario, pazienti, gestionale), freccia indietro anche nelle schermate del "+", sezione cerca nelle chat, "+" per scrivere una chat nuova anche a un paziente.
- Elenco: ⋯ a sinistra (Registro attività, Installa, moduli), "+" a destra, titolo grande, ricerca, filtri Tutte/Team/Pazienti/Gruppi, dock flottante Chat · Agenda · Pazienti · Richiami · Studio (solo moduli consentiti all'utente).
- "+" → Nuova chat (con freccia indietro): Scrivi a un paziente, Nuovo gruppo, assistenti.
- Chat con un paziente: il messaggio si scrive in Poliedron e si apre WhatsApp dello studio (wa.me) con il testo pronto; bloccato senza telefono o senza consenso WhatsApp in scheda. Lo storico di ciò che è stato inviato resta sul dispositivo (non c'è ancora l'invio automatico via API né la lettura delle risposte).
- Ricerca: chat per nome/anteprima, pazienti per nome o telefono, messaggi dentro tutte le chat.

### Agenda nell'app Poliedron e "Installa" (2026-10-06)
PO: "l'agenda non è impaginata bene… togli il torna a Poliedron… il tasto installa non installa un bel niente".
- Tolta la barra "← Torna a Poliedron": si torna alla chat dal dock. Il viewport da tastiera dell'app vale solo nella chat.
- Causa dello spostamento dell'agenda: lo stile del contenitore mescolava `padding` e `paddingTop`; passando da Chat ad Agenda React riapplicava 13px in alto. Ora solo proprietà esplicite: agenda identica al gestionale.
- Causa di "Installa" che non installava: il service worker del gestionale rispondeva a `/poliedron/` con la pagina del gestionale (manifest e icona Poliedra). Ora `/poliedron` è escluso dal fallback e servito dalla rete (cache NetworkFirst per l'offline), con il manifest e l'icona Poliedron approvata (#130).
- "Installa": su Android usa il prompt del browser (catturato all'avvio); su iPhone mostra i passi di Safari (Condividi → Aggiungi alla schermata Home) e, dall'app già installata, "Apri in Safari" e "Copia link". Il foglio è disegnato sopra a tutto.

### Apertura istantanea dell'app Poliedron (2026-10-06)
PO: "La app si apre troppo lentamente, deve essere istantanea come WhatsApp".
- Causa: l'app mostrava "caricamento" finché non arrivavano tutti i dati dello studio (pazienti, appuntamenti, piani, pagamenti, listino, …) e solo dopo caricava la conversazione con 3 richieste in fila.
- Ora l'app Poliedron mostra subito l'elenco chat; i dati arrivano in sottofondo. Una pagina chiesta prima che i dati siano pronti (es. Agenda dal dock) si apre appena arrivano, con l'avviso "Apro Agenda…". Il gestionale resta invariato.
- Conversazione: gli ultimi 40 messaggi sono tenuti sul dispositivo e mostrati subito, poi aggiornati dal server (messaggi e non letti in parallelo). Al logout vengono cancellate le copie locali della chat e del team.
- Misura con dati simulati lenti (3 s): elenco chat visibile in ~0,6 s.

### Rubrica pazienti, ricerca globale e dock (2026-10-06)
PO: il tasto Pazienti portava al gestionale (doppione di Studio); ricerca veramente globale con scelta chat/scheda per i pazienti; X per cancellare; dock che sale con la tastiera.
- Dock: Chat · Agenda · **Pazienti (rubrica dentro Poliedron)** · Richiami · Studio. La rubrica elenca i pazienti in ordine alfabetico con ricerca; ogni paziente ha **Chat** (WhatsApp dello studio) e **Scheda** (apre la scheda paziente sopra la chat).
- Ricerca dell'elenco chat: pazienti (con Chat/Scheda), chat, messaggi dentro le chat e sezioni dello studio ("Nello studio"). X per cancellare il testo.
- Mentre si scrive in una ricerca il dock si nasconde e ricompare a tastiera chiusa.

### Consenso WhatsApp: non obbligatorio per ora (2026-10-06)
PO: "Non rendere obbligatorio il consenso per scrivere al paziente, cerchiamo più in là un modo, ricordati".
- La chat con il paziente blocca solo se manca il telefono; senza consenso mostra un promemoria ("Consenso WhatsApp non registrato in scheda") ma permette l'invio.
- In alto nella chat del paziente c'è **Scheda** per aprire la sua scheda.
- **PENDING_PO_DECISION — consenso WhatsApp nella chat pazienti**: definire come gestirlo (es. richiesta di consenso al primo messaggio, registrazione rapida dalla chat, regole per i messaggi di servizio). Da riprendere con il PO prima dell'invio diretto via WhatsApp Business.
