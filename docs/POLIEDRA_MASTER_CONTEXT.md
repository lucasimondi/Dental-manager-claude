# POLIEDRA — MASTER CONTEXT

Versione: Agosto 2026
Product Owner: Luca Simondi
Repository: `lucasimondi/Dental-manager-claude`
Stack principale: React/Vite + Supabase/PostgreSQL + GitHub + Vercel
Deployment authority approvata: Vercel

> Questo documento è la fonte stabile Product Owner per visione, architettura, decisioni trasversali, roadmap e vincoli di Poliedra. Non sostituisce `docs/coordination/current-task.md`, che descrive il task operativo corrente.

## 1. Visione di prodotto

Poliedra è una piattaforma SaaS modulare per professionisti sanitari, studi, ambulatori e poliambulatori. Non deve essere un semplice gestionale amministrativo, ma un Clinical + Operational + Financial Operating System capace di unificare pazienti, agenda, cartella clinica, documenti, consensi, preventivi, pagamenti, controllo di gestione, collaboratori, AI, automazioni, verticali professionali, app paziente e integrazioni esterne.

Il principio strutturale è: **un unico core condiviso + verticali professionali specializzati**.

Il prodotto deve funzionare per professionista singolo, piccolo studio, studio multi-operatore, centro multidisciplinare, ambulatorio e poliambulatorio.

## 2. Posizionamento

Poliedra deve essere semplice per chi vuole semplicità e molto potente per chi vuole controllo. Deve essere modulare, configurabile, multi-tenant, mobile/tablet/desktop, permission-aware e AI-native.

Non deve sembrare un vecchio gestionale medico, un ERP pesante o un clone di un software odontoiatrico. Deve sembrare un SaaS premium moderno.

## 3. Principi non negoziabili

### Una sola fonte di verità per dominio
- Finanza: canonical financial engine server-side.
- Clinica: authoritative clinical model server-side.
- Permessi: authoritative capabilities + RLS server-side.
- Frontend: non deve diventare una seconda fonte di verità.

### Fail closed
- Se un dato non è autorevole, non inventarlo.
- Se una metrica non è disponibile, mostrare `Non disponibile`.
- Se un permesso non è dimostrabile, accesso negato.

### Tenant safety
Ogni funzione deve rispettare `studio_id` e isolamento tra tenant.

### Versioning / audit
Storico clinico, costi, modifiche e attività rilevanti non devono essere riscritti retroattivamente.

### UX prima della complessità
La complessità tecnica deve restare dietro un'interfaccia rapida e leggibile.

### Modularità
Home, dashboard, workflow e verticali devono essere componibili e configurabili.

## 4. Stack e infrastruttura

Frontend:
- React
- Vite

Backend/database:
- Supabase
- PostgreSQL 17 in produzione

Repository:
- GitHub

Deployment:
- Vercel = unica deployment authority approvata.

Netlify:
- eventuali check/integrations residue non sono deployment authority;
- rimozione/neutralizzazione prevista in Platform Hardening.

Storage:
- Supabase Storage;
- dati clinici e documenti privati devono usare bucket privati e URL firmate;
- vietato `getPublicUrl` per dati clinici.

## 5. Modello di lavoro con agenti AI

ChatGPT:
- Product Owner assistant;
- architettura;
- roadmap;
- definizione missioni;
- review PR;
- review sicurezza;
- decisioni Product Owner;
- coordinamento.

Claude Code:
- implementazione pesante;
- migration;
- frontend;
- test;
- commit;
- push.

Codex:
- review e task mirati quando disponibile.

Gemini:
- può lavorare sul codice, ma ogni output deve essere revisionato prima dell'accettazione.

Strategia approvata: preferire **macro missioni** a micro-task frammentati.

Macro missioni:
1. FISIO PILOT READY
2. CONTROLLO DI GESTIONE READY
3. AI OPERATING SYSTEM
4. PATIENT APP
5. MULTI-PROFESSIONAL / POLIAMBULATORI

Gli agenti devono proseguire autonomamente fino a `WAITING_PRODUCT_OWNER`, salvo vera `PRODUCT_OWNER_DECISION_REQUIRED`.

## 6. Workflow Git / deploy

Durante sviluppo:
- non modificare produzione senza approvazione;
- non applicare migration remote senza approvazione;
- non fare deploy manuale;
- non fare merge;
- non fare backfill remoto;
- non lavorare direttamente su master.

Workflow:
`branch dedicato → draft PR → test → review → WAITING_PRODUCT_OWNER → Product Owner review → merge → migration controllata → smoke test`.

Validazione tipica:
- Node tests;
- PostgreSQL 17;
- Supabase migration;
- RLS;
- due tenant;
- database lint;
- advisor;
- build Vite;
- secret scan;
- `git diff --check`;
- scope check.

## 7. Architettura del prodotto

### Core condiviso
- Identity / Auth
- Multi-tenant
- RBAC / capabilities
- Patients
- Agenda
- Payments
- Documents
- Financial Engine
- Widget Engine
- AI layer
- Integrations

### Vertical Engine
- Odontoiatria
- Fisioterapia
- Personal Trainer
- Psicologo
- Medico
- Dietologo / Nutrizionista
- Naturopata
- Massaggiatore
- futuri verticali

## 8. Home / Dashboard

La Home è un workspace modulare a widget.

POL-UI-001 ha introdotto:
- widget registry;
- aggiunta/rimozione widget;
- drag & drop;
- resize;
- responsive;
- mobile touch reorder;
- personalizzazione utente;
- default studio;
- fallback piattaforma;
- reset.

Gerarchia layout:
`USER OVERRIDE → STUDIO DEFAULT → ROLE/VERTICAL PRESET → PLATFORM DEFAULT`.

POL-UI-002 ha introdotto:
- canonical financial widget pack;
- periodo Home condiviso;
- preset per ruolo;
- permission-aware widget catalog;
- accesso finanziario basato su capability;
- nessun fallback legacy.

## 9. Direzione grafica approvata

No bordeaux.

Palette:
- bianco / off-white;
- blu;
- indaco;
- azzurro;
- turchese;
- gradienti controllati.

Stile:
- premium SaaS;
- profondità;
- shadow morbide;
- card tridimensionali leggere;
- bordi sottili;
- tipografia leggibile;
- contrasto alto.

Evitare UI crypto, colori casuali ed effetti pesanti.

Serve un design system condiviso con primitive coerenti per PageShell, PageHeader, SectionCard, StatCard, button, Tabs, FormSection, EmptyState, Modal/Drawer, DataCard e Toolbar.

Pagine prioritarie da uniformare:
1. Home
2. Agenda
3. Pazienti
4. Scheda Paziente
5. Controllo di gestione
6. Setup
7. Fisio

## 10. POL-UX-001 — missione UX corrente

Obiettivi Product Owner:
- migliorare header;
- eliminare bordeaux;
- migliorare gradienti e profondità;
- rendere menu Home visibile;
- ripristinare greeting `Buongiorno, Luca`;
- aumentare leggibilità;
- migliorare `Personalizza Home`;
- correggere Mese/Anno poco leggibili;
- eliminare preset `Mese corrente`, `Mese precedente`, `Anno corrente`;
- uniformare widget;
- ridisegnare Pannello Economico;
- rendere Azioni rapide personalizzabili;
- supportare workflow;
- rendere grafica coerente fra Home e resto del prodotto.

Responsive obbligatorio: 375 / 768 / 1024 / 1440.

## 11. Quick Actions / Workflow

Azioni rapide sono un elemento strategico della Home.

Esempi:
- Nuovo appuntamento
- Nuovo paziente
- Nuovo preventivo
- Nuova spesa
- Pagamento
- Apri Agenda
- Nuova seduta Fisio
- Documento
- Task
- Richiamo

Devono essere personalizzabili, riordinabili, permission-aware e vertical-aware.

Supportare workflow predefiniti senza costruire subito un editor tipo Zapier.

Esempio `Nuovo paziente + appuntamento`:
1. crea paziente;
2. continua alla prenotazione;
3. mostra slot liberi;
4. conferma appuntamento.

## 12. Agenda / Prenotazione

Decisione Product Owner:
- `Apri Agenda` → navigazione all'Agenda;
- `Nuovo appuntamento` → apre direttamente il booking flow.

Quick booking minimo:
- paziente;
- operatore;
- prestazione;
- data;
- durata;
- orario;
- stanza/poltrona/risorsa se supportata;
- note.

Mostrare slot liberi reali derivati da dati autorevoli dell'agenda. Non inventare disponibilità.

## 13. Controllo di gestione

Due modalità:
- BASE
- ADVANCED

L'utente sceglie dal Setup.

BASE deve rispondere rapidamente a:
- quanto sto producendo;
- quanto sto incassando;
- quanto mi costa lavorare;
- margine;
- break-even.

ADVANCED deve aggiungere:
- trend;
- budget;
- forecast;
- operatori;
- saturazione;
- redditività;
- drill-down;
- capacità;
- confronto temporale.

## 14. POL-003 — Financial Source of Truth

Canonical financial engine server-side.

Lifecycle distinti:
`PREVENTIVATO → ACCETTATO → PRODOTTO → FATTURATO → INCASSATO → CREDITO RESIDUO`.

Metriche:
- costi fissi;
- costi variabili;
- margine di contribuzione;
- EBITDA;
- break-even;
- costo orario;
- produzione/ora;
- incasso/ora.

Regole:
- server-side;
- tenant-safe;
- versionato;
- deterministico;
- drill-downable;
- nessuna formula finanziaria duplicata nel frontend.

Canonical RPC: `get_financial_snapshot_v1`.

Legacy `get_kpi_periodo` non deve essere usato come fallback nei nuovi widget.

## 15. POL-003F — costi e ore

Implementato e applicato.

Include:
- costi canonici;
- ore disponibili;
- versionamento append-only dei costi collaboratore.

Regola fondamentale: un costo attuale non può riscrivere il passato.

Ore lavorate non ancora autorevoli: Produzione/ora e Incasso/ora devono restare `Non disponibile` quando manca il denominatore autorevole.

## 16. CFO AI

Poliedra deve avere un CFO AI operativo, non un semplice chatbot.

Deve:
- leggere KPI;
- evidenziare anomalie;
- segnalare dati mancanti;
- chiedere inserimenti;
- suggerire decisioni;
- confrontare budget/consuntivo;
- evidenziare capacità inutilizzata.

## 17. RBAC / Capabilities

POL-RBAC-001 implementato e applicato.

Legacy `admin` / `utente` restano per compatibilità, ma non sono la fonte autorevole delle capability cliniche.

Capability server-side includono:
- `studio.owner`
- `studio.manage_members`
- `finance.management.read`
- `home.owner`
- `home.front_desk`
- `clinical.general`
- `clinical.physiotherapist`
- `clinical.personal_trainer`
- `clinical.massage_therapist`

Admin legacy ottiene capability gestionali, mai capability cliniche automatiche.

## 18. Capability vs Assignment

POL-RBAC-001A distingue:
- CAPABILITY = cosa un utente può fare;
- ASSIGNMENT = con quale paziente/percorso può farlo.

Esempio: avere `clinical.personal_trainer` non significa poter vedere tutti i pazienti Fisio. Serve assegnazione attiva al percorso/paziente.

## 19. Patient Care Assignment

Tabella: `patient_care_assignments`.

Concetti principali:
- studio_id;
- patient_id;
- episode_id;
- user_id;
- assignment_type;
- active;
- created_by;
- created_at;
- ended_at;
- ended_by.

Tipi minimi:
- responsible_physiotherapist
- physiotherapist
- personal_trainer
- massage_therapist

## 20. Regole Fisio RBAC

Fisioterapista:
- cartella completa;
- valutazione;
- piano;
- note;
- finalizzazione;
- team.

Personal trainer:
- solo pazienti assegnati;
- solo percorso operativo;
- documenta propria attività;
- non modifica valutazione/piano.

Massaggiatore:
- solo pazienti assegnati;
- documenta proprio intervento;
- non modifica valutazione/piano.

Front desk:
- nessun contenuto clinico.

Owner non clinico:
- nessun accesso clinico automatico.

Multi-ruolo:
- capability si sommano, senza escalation implicita.

## 21. Team del percorso

UI prevista/implementata:
- Fisioterapista responsabile;
- altri fisioterapisti;
- Personal Trainer;
- Massaggiatore.

Azioni:
- Assegna professionista;
- rimuovi/termina assegnazione.

Roster PT/massaggiatore minimizzato a identità, ruolo e stato. Non deve esporre capability globali, altri pazienti, altri assignment o contenuti clinici aggiuntivi.

## 22. Fisio — visione

Verticale Fisio è la priorità clinica principale.

Obiettivo: **FISIO PILOT READY**.

Criterio pratico: una fisioterapista reale deve poter lavorare una settimana con Poliedra senza tornare al gestionale precedente.

## 23. POL-FIS-001

PR #14, ancora aperta/draft.

Clinical core sviluppato:
- episodi;
- overview;
- anamnesi;
- body map;
- seduta rapida;
- bozza;
- copia seduta precedente;
- firma/chiusura;
- immutabilità note chiuse;
- amendment append-only;
- timeline;
- problemi;
- obiettivi;
- piano;
- outcome server-side;
- storico precedente.

## 24. Collisione autorizzativa POL-FIS-001

POL-FIS-001 introduce un secondo modello autorizzativo (`physio_clinical_access_v1`) indipendente da `studio_user_capabilities` e `patient_care_assignments`.

Decisione architetturale: POL-RBAC-001 / POL-RBAC-001A devono essere il modello autorevole. POL-FIS-001 non deve mantenere un RBAC parallelo.

## 25. Episodio Fisio

POL-RBAC-001A usa temporaneamente `episode_id → physio_piani` come transitional compatibility layer.

Decisione Product Owner: approvato solo temporaneamente.

Quando POL-FIS-001 stabilizza l'episodio canonico, `patient_care_assignments` deve convergere su quello senza creare un secondo modello episodio e senza backfill inventati.

## 26. FISIO PILOT READY — scope

Missione futura:
- RBAC convergente;
- episodio canonico;
- cartella completa;
- anamnesi;
- valutazioni modulari;
- body map;
- problemi;
- obiettivi;
- piano;
- seduta rapida;
- rivalutazione;
- outcome;
- dimissione;
- documenti privati;
- timeline;
- team;
- agenda integration;
- post-visit prompt;
- responsive;
- tablet/mobile;
- visual QA;
- widget Home;
- voice/dictation;
- AI assistance con guardrail.

## 27. Altri verticali

Previsti:
- Personal Trainer
- Psicologo
- Medico professionista
- Naturopata
- Dietologo / Nutrizionista
- Massaggiatore

Dopo Fisio va creata una **Vertical Factory**: core condiviso per paziente, agenda, documenti, pagamenti, AI, controllo gestione, widget e RBAC; ogni verticale cambia cartella, workflow, outcome e specifiche professionali.

## 28. Odontoiatria

Poliedra nasce da Dental Manager e mantiene odontoiatria come verticale importante.

Funzioni esistenti includono pazienti, agenda, preventivi, pagamenti, prestazioni, consensi, documenti, materiali, marginalità, operatori, multi-chair, richiami, ricette e gestione studio.

## 29. Patient App

Roadmap prevista: app/PWA unica Poliedra con appuntamenti, documenti, esercizi, questionari/outcome, consensi, pagamenti, notifiche, comunicazioni e percorso terapeutico.

## 30. Poliambulatori

Roadmap futura:
- multi-professionista;
- multi-sede;
- direttore sanitario;
- scadenze;
- documentazione autorizzativa;
- procedure;
- audit;
- personale;
- apparecchiature;
- compliance.

## 31. Integrazioni

Roadmap:
- SumUp
- Satispay
- Flatpay
- Revolut
- software commercialisti
- software radiologici
- Sistema TS opt-in
- Google Calendar multi-operatore

## 32. AI Operating System

L'AI deve entrare nei workflow, non restare una chat isolata.

Esempi:
- dettatura clinica;
- strutturazione cartella;
- proposta note;
- controllo dati mancanti;
- CFO;
- reminder;
- agenda;
- task;
- documenti;
- follow-up.

Guardrail: l'AI non finalizza autonomamente atti clinici sensibili; il clinico resta responsabile.

### Missione futura — allegati in Poliedron (non ancora pianificata in dettaglio)

Oggi Poliedron è solo testuale: `processQuery`/`poliedraCore.js`/`modelGateway.js` non accettano un allegato (immagine/PDF). La lettura documenti esiste solo isolata in Spese/Costi (`UploadDocumentoSpesa.jsx` + edge function `estrai-spesa-documento`, un documento = un'estrazione, nessuna conversazione).

Caso d'uso che ha originato questa nota (POL-FIN-003, settembre 2026): leggere un estratto conto mensile con più pagamenti, collegarli ai pazienti/piani, confrontare con quanto già registrato. Implementato per ora come widget dedicato in Incassi (stesso pattern di Spese/Costi, non passa da Poliedron) — vedi missione operativa collegata.

Portare la lettura documenti dentro il motore condiviso di Poliedron (allegare un file in chat, non solo un widget isolato) è un cambiamento strutturale che tocca il motore usato da tutte le funzioni AI dell'app — non va fatto incidentalmente dentro un task verticale. Da pianificare come missione a sé quando prioritizzata.

## 33. Referral / Founder model

Idea da mantenere in roadmap: founder / ambassador / referral partner con tracking segnalazioni e possibile revenue sharing/passivo ricorrente collegato alla rete generata.

Da studiare sotto profilo legale, fiscale e societario prima di implementare.

## 34. Roadmap macro

### Fase 1 — Core Foundation
Quasi completata:
- security;
- storage;
- financial source of truth;
- costs/hours;
- widget engine;
- RBAC;
- assignments.

### Fase 2 — UX / Design System
In corso:
- POL-UX-001;
- Home;
- header;
- quick actions;
- booking;
- design consistency.

### Fase 3 — FISIO PILOT READY

### Fase 4 — Controllo di gestione 2.0

### Fase 5 — AI Operating System

### Fase 6 — Patient App

### Fase 7 — Vertical Factory

### Fase 8 — Poliambulatori

### Fase 9 — Integrations

### Fase 10 — Growth Engine

## 35. Principali task completati

- POL-002A — security hardening
- POL-002B — private patient files
- POL-003 — financial source of truth
- POL-003A — financial semantics
- POL-003B — legacy adapter reconciliation
- POL-003C — management modes Base/Advanced
- POL-003D — EUR discount normalization
- POL-003F — canonical costs / available hours / personnel history
- POL-UI-001 — modular widget dashboard
- POL-UI-002 — canonical financial widgets + role presets
- POL-RBAC-001 — authoritative capabilities
- POL-RBAC-001A — patient/care assignment

POL-FIS-001 resta aperto.

## 36. Lock finanziari

- rimborsi non allocati: mai FIFO automatico;
- stock metrics: apertura / movimenti / chiusura;
- costo orario struttura: solo costi fissi operativi di struttura + personale base;
- escludere costi variabili diretti e componenti non operative.

## 37. Home come cockpit

Home non deve essere una dashboard passiva. Deve diventare cockpit operativo con tre famiglie principali:
- Finanza
- Organizzazione
- Clinica

L'utente deve poterla rendere più finanziaria, più organizzativa o più clinica tramite widget e quick actions.

## 38. Responsive

Ogni nuova funzione deve essere progettata per 375 / 768 / 1024 / 1440.

Mobile:
- una colonna;
- touch target ampi;
- drawer/fullscreen;
- evitare tabelle orizzontali quando possibile.

Tablet è particolarmente importante per Fisio.

## 39. Sicurezza

Principi:
- RLS sempre;
- no service role frontend;
- no public URL dati clinici;
- least privilege;
- membership attiva;
- tenant match;
- capability;
- assignment quando necessario;
- authorship server-side.

Owner non significa automaticamente clinician.

## 40. Debito tecnico / Platform Hardening

Temi già emersi:
- warning SECURITY DEFINER;
- `google_calendar_tokens`;
- `super_admins`;
- leaked password protection;
- oggetti admin legacy;
- integrazione Netlify residua.

Da affrontare in una missione Platform Hardening dedicata.

## 41. Product Owner decision flow

Quando una semantica è ambigua:
- scrivere `PRODUCT_OWNER_DECISION_REQUIRED`;
- continuare sulle parti non ambigue;
- non inventare decisioni di prodotto.

Quando il Product Owner decide, documentare il lock.

## 42. Cosa non fare

Non:
- duplicare financial engine;
- duplicare RBAC;
- creare secondo episode Fisio;
- affidarsi al frontend per sicurezza;
- inventare dati storici;
- inventare slot;
- inventare KPI;
- creare accessi temporaneamente permissivi;
- rifare sistemi già esistenti senza audit;
- creare micro-PR inutili.

## 43. North Star

Poliedra non deve diventare “un gestionale con AI”.

Deve diventare **il sistema operativo intelligente dello studio sanitario**.

## 44. Priorità immediate

1. completare POL-UX-001;
2. review Product Owner;
3. uniformare UI;
4. correggere booking/slot;
5. chiudere persistenza Home;
6. riallineare POL-FIS-001;
7. eliminare doppio modello authorization Fisio;
8. far convergere episode;
9. lanciare MISSION FISIO PILOT READY;
10. pilot reale.
