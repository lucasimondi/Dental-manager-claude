# POLIEDRON — architettura dell'agente unico

Stato: contratto architetturale autoritativo.
Ambito: qualunque lavoro su AI, Chat, campanello, attività, notifiche e automazioni.
Documenti correlati: `../../AGENTS.md`, `../POLIEDRA_MASTER_CONTEXT.md`
(§32 AI Operating System), `../mission/POLIEDRA_MISSION.md`,
`chat-polyedron.md`, `POL-AI-004-proactive-intelligence.md`,
`POL-AI-005A-planner-foundation.md`.

Questo documento non sostituisce i documenti di task (`POL-AI-*`), che restano il record
implementativo e di validazione. Qui vivono soltanto gli invarianti che ogni task AI deve
rispettare.

## 1. Principio fondamentale

**Poliedron è un unico agente.**

Poliedron può avere molte interfacce e molte capacità, ma rimane una sola entità: una sola
identità, un solo contesto, una sola memoria, un solo set di strumenti, una sola
orchestrazione.

## 2. Cosa non deve essere creato

Non devono esistere:

- un secondo Poliedron;
- un chatbot Poliedron separato;
- un secondo orchestration layer;
- una seconda memoria;
- un secondo context engine;
- un AI service parallelo;
- una seconda superficie che chiami direttamente un provider di modelli.

Qualunque nuova funzione AI deve estendere Poliedron, non affiancarlo. Se una funzione
sembra richiedere un secondo agente, è un `PRODUCT_OWNER_DECISION_REQUIRED`, non una
scelta di implementazione.

## 3. Punti di accesso

Poliedron è progressivamente raggiungibile attraverso più punti di accesso. Tutti aprono
lo stesso agente:

- pulsante centrale AI;
- Chat;
- campanello / badge;
- attività;
- moduli del gestionale;
- future automazioni.

Regola implementativa: un nuovo punto di accesso deve invocare l'istanza Poliedron
esistente (lo stesso controller già usato da Orb, Edge Dock, Mobile Dock e Chat) e passare
il contesto autorevole (paziente, appuntamento, modulo, attività). Non deve montare una
seconda istanza né duplicarne lo stato.

## 4. Chat Poliedron

La Chat non è un prodotto separato. È **un'interfaccia persistente** attraverso cui
comunicare con lo stesso Poliedron.

Deve condividere:

- identità;
- contesto;
- memoria;
- strumenti;
- orchestrazione.

La Chat è bidirezionale.

**Utente → Poliedron**: richieste, domande, comandi.

**Poliedron → Utente**: informazioni, richieste di conferma, attività e futuri alert.

La persistenza della conversazione deve essere tenant-safe, permission-aware e legata
all'utente e allo `studio_id`, e deve riusare la memoria/contesto di Poliedron invece di
introdurne una seconda. Il dettaglio implementativo della Chat persistente (tabelle,
RLS, paginazione, realtime) è in `chat-polyedron.md`; quel documento è il record
tecnico, questo è l'invariante architetturale.

## 5. Attività e notifiche

Le attività devono poter generare messaggi nella Chat.

Architettura prevista:

```
attività
→ richiede attenzione
→ Poliedron scrive nella chat
→ notifica / badge
→ utente apre la chat
→ utente risponde
→ Poliedron interpreta
→ stato attività aggiornato
```

Esempio:

> Utente: "Ricordami di ordinare quel pezzo."
>
> Successivamente Poliedron: "Hai ordinato quel pezzo?"

- risposta "Sì" → l'attività può diventare `completed`;
- risposta "No" → l'attività resta `pending` e potrà generare un nuovo follow-up.

### Stati previsti

- `pending`
- `completed`
- `snoozed`
- `cancelled`

### Regola invariante

**`read != completed`.**

Una notifica letta, aperta o vista non significa attività completata. Solo una conferma
esplicita dell'utente, o un fatto autorevole nei dati, può portare un'attività a
`completed`. In assenza di conferma lo stato resta `pending`: non si deduce il
completamento dal comportamento di lettura.

Coerentemente con i principi di veridicità di `AGENTS.md` e con il fail-closed del Master
Context, Poliedron non deve trasformare un'assenza di risposta in una conclusione.

## 6. Notifiche

Le notifiche non sono un secondo sistema conversazionale.

Il badge/campanello segnala soltanto che Poliedron ha qualcosa che richiede attenzione
nella conversazione. Non deve avere una propria coda di messaggi indipendente, un proprio
motore di risposta, né una propria memoria.

Non devono essere costruiti:

- un inbox separato dalla conversazione Poliedron;
- un secondo canale di risposta parallelo alla Chat;
- una notification engine che interpreti autonomamente il linguaggio dell'utente.

## 7. Vincoli operativi ereditati

Valgono senza eccezioni, come per ogni altra parte del prodotto:

- prima il deterministico, poi il modello: scanner, query, indici e cache prima di una
  chiamata a un modello esterno (`../mission/POLIEDRA_MISSION.md`);
- una sola sede per le chiamate ai modelli (Model Gateway); nessun componente UI chiama
  direttamente un provider;
- permission-aware e tenant-safe: RBAC/capabilities/assignment e RLS restano autorevoli;
- nessun dato inventato: distinguere dato certo, dato mancante, inferenza e opportunità;
- l'AI non finalizza autonomamente atti clinici sensibili; il clinico resta responsabile;
- le azioni che scrivono passano da un percorso di conferma esplicita.

## 8. Stato dell'implementazione

Rilevato dal repository al commit `a16d43a` (`master`, 2 settembre 2026). Etichette
secondo `AGENTS.md`.

- `VERIFIED` — esiste una sola implementazione Poliedron: `src/components/poliedron/`
  (Orb, Panel, Edge Dock, Mobile Dock, Conversation, Chat Page, Bell, action preview,
  search/intelligence results) e `src/lib/poliedron/` (`intentEngine`, `searchEngine`,
  `contextEngine`, `actionRegistry`, `permissionEngine`, `modelGateway`, `poliedraCore`,
  `conversationRepository`, planner, `intelligence/`).
- `VERIFIED` — `src/lib/poliedron/modelGateway.js` è l'unico punto di chiamata al modello;
  il suo header documenta esplicitamente il vincolo e registra che la preesistente
  superficie AI (`AssistenteAI.jsx`) è stata smontata e tenuta come logica in attesa di
  convergenza, non come secondo agente attivo.
- `VERIFIED` — la Chat persistente è presente su `master`: migration
  `supabase/migrations/20260824030000_chat_polyedron.sql`, pagina `chat` come `NAV` page,
  `PoliedronChatPage`, `usePoliedronConversation`, `conversationRepository.js`. Dettagli
  tecnici e RLS in `chat-polyedron.md`.
- `INFERRED` — il campanello e il badge Chat leggono lo stesso conteggio non letti della
  conversazione primaria e aprono la stessa pagina `chat` (base: `chat-polyedron.md`
  "UI and navigation"; non verificato in esecuzione in questo audit).
- `NOT VERIFIABLE` in questo audit — applicazione remota della migration
  `20260824030000_chat_polyedron.sql` e stati attività lato database: richiedono accesso
  allo schema Supabase di produzione, non disponibile qui. Il modello di dati per gli
  stati attività (`pending`/`completed`/`snoozed`/`cancelled`) e il flusso di notifica
  bidirezionale completo vanno progettati/verificati in un task dedicato, con migration
  versionata e RLS, senza inventare tabelle o campi.

## 9. Checklist per ogni task AI / Chat / attività / notifiche

1. La funzione estende Poliedron o crea una seconda entità? Se la seconda, fermarsi.
2. Il nuovo punto di accesso riusa l'istanza, il contesto e la memoria esistenti?
3. Le chiamate al modello passano solo dal Model Gateway?
4. Il percorso deterministico è stato tentato prima del modello?
5. Permessi, capability, assignment e tenant sono rispettati lato server?
6. Gli stati attività usati sono `pending`/`completed`/`snoozed`/`cancelled`?
7. `read` è tenuto distinto da `completed`?
8. Le notifiche restano un segnale sulla conversazione, non un secondo canale?
9. Le affermazioni nell'handoff sono etichettate `VERIFIED`/`INFERRED`/`NOT VERIFIABLE`?
