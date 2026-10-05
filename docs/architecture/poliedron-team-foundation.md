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
