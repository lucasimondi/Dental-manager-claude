# Piano — Modulo Incassi / Da Incassare (saldo piano, eseguito, acconto)

Data: 29/08/2026. Definito con Luca in sessione chat, da eseguire seguendo `runbook-sviluppo-sicuro.md` e `runbook-rls-nuove-tabelle.md`. Nessuna modifica al codice o al database è stata fatta da questa sessione — nessun accesso push disponibile qui.

## 1. Problema di partenza (caso reale)

Paziente Lauretti Giacomo: piano da 1.400€, eseguiti due impianti (700€), pagati 900€ non associati a prestazione specifica. Il "da incassare" attuale mostra 700€ (= solo il totale eseguito, senza sottrarre alcun pagamento) invece del saldo reale di 500€ (1.400 − 900).

**Causa:** il calcolo attuale è per-prestazione e non attinge dai pagamenti, che sono registrati per-piano senza associazione a prestazione. Non è un bug puntuale ma un limite del modello: eseguito e pagato oggi sono trattati come se dovessero coincidere, e non devono.

## 2. Modello corretto — tre valori sempre calcolati a livello di piano

Non modificare lo schema pagamenti (restano non associati a prestazione salvo scelta esplicita, vedi §5). Aggiungere una funzione condivisa che, dato un `piano_id`, ritorna:

```
saldo_piano          = totale_piano - totale_pagato_piano
eseguito_non_pagato  = MAX(0, totale_eseguito_piano - totale_pagato_piano)
acconto              = MAX(0, totale_pagato_piano - totale_eseguito_piano)
```

- `saldo_piano` è il **"Da incassare"** mostrato ovunque nell'app (sostituisce l'attuale calcolo su sola prestazione/eseguito). Non dipende dallo stato di esecuzione.
- `eseguito_non_pagato` e `acconto` sono mutuamente esclusivi (uno dei due è sempre 0) e servono solo come dettaglio informativo, mai come "da incassare" primario.
- Caso Lauretti con questo modello: saldo 500€, eseguito non pagato 0€, acconto 200€. Nessun conflitto tra i tre numeri.

**Implementazione:** funzione Postgres `get_saldo_piano(p_piano_id uuid)` — SQL `SECURITY INVOKER`, RLS si applica normalmente via `studio_id` del piano. Riusata sia da RPC che da funzioni di aggregazione (§4). Seguire da subito `REVOKE EXECUTE ... FROM PUBLIC/anon` dopo la creazione (vedi lezioni apprese, runbook RLS).

## 3. UI — Scheda paziente (sostituisce il riquadro "da incassare" attuale)

- Numero principale in evidenza: **Da incassare** (`saldo_piano`), colore rosso (`--bg-danger`/`--text-danger`, adattivo dark/light)
- Due riquadri secondari affiancati: "Eseguito non pagato" e "Acconto" (quest'ultimo con stile positivo/verde)
- Footer con i due totali grezzi (eseguito, pagato) sempre visibili per trasparenza/audit, coerente col principio "dato reale deve essere reale"
- Mockup approvato in sessione chat (widget `scheda_paziente_riquadro_economico_v2`)

## 4. Nuova sezione "Incassi"

Doppia esposizione dello stesso componente/dato — **nessuna duplicazione di logica**:
1. Voce di menu dock a sé stante (come Pazienti, Agenda) — richiede aggiunta a `studio_info.dock_settings.menuItems` per ogni studio (vedi lezione runbook)
2. Tab dentro Controllo di Gestione (si aggancia alla voce "Scadenze di pagamento" già prevista in roadmap in `piano-controllo-gestione-dashboard.md`)

**Contenuto:**
- Due KPI in alto: **Incassato** (periodo selezionato, somma pagamenti) e **Da incassare** (totale, somma `saldo_piano` su tutti i piani attivi dello studio — nuova funzione aggregata `get_saldi_aperti_studio(p_studio_id uuid, p_periodo ...)`)
- Lista pazienti con saldo aperto (`saldo_piano > 0`), **interamente visibile di default**, scrollabile oltre soglia (non paginata a pezzi)
- Filtro ordina: per importo decrescente o per giorni di attesa decrescente — selettore in header, preferenza persistita come le altre personalizzazioni dashboard
- Ogni riga: nome paziente (cliccabile → naviga a scheda paziente, tab Pagamenti, richiede routing `?tab=pagamenti` o equivalente), descrizione piano/prestazione, giorni di apertura, saldo in rosso
- Nota a piè lista: chiarire che include acconti non compensati tra pazienti diversi

Mockup approvato: widget `sezione_incassi_da_incassare`.

## 5. Azione "+ Aggiungi da incassare" / "+ Aggiungi prestazione"

Stessa funzione di fondo, due punti di accesso (dentro sezione Incassi, e accesso rapido tipo dashboard/scheda paziente). Copre il caso reale: prestazione fatta ("dev", non ricorda il dente), paziente promette pagamento futuro.

**Form (Opzione A confermata — sempre visibile, non collassato):**
- Paziente (selezione/ricerca)
- Toggle prezzo: **Da listino** (select prestazione da listino prezzi, importo si autocompila ma resta modificabile per sconti) oppure **Libero** (descrizione testo libero + importo manuale)
- Checkbox "Già eseguita" (default: spuntata)
- Campo opzionale "Pagamento ricevuto ora" — se valorizzato, registra contestualmente un pagamento collegato
- Riepilogo live "Rimane da incassare" = importo prestazione − pagamento ricevuto ora, aggiornato in tempo reale, sempre in evidenza rossa

**Destinazione piano:**
- Se il paziente ha piani esistenti → la prestazione viene aggiunta al **piano più recente** (ordinamento per data creazione piano), senza chiedere conferma
- Se il paziente **non ha nessun piano** → il sistema **crea automaticamente un piano** (nome di default generico, es. "Piano prestazioni occasionali", rinominabile). Non è un'entità speciale: è un piano normale a tutti gli effetti, compare nella lista piani del paziente, editabile come ogni altro.

Mockup approvati: `modale_aggiungi_da_incassare_v2`.

## 6. Piani sempre editabili (aggiungi/rimuovi prestazioni)

Requisito esplicito: ogni piano (incluso quello auto-creato di cui sopra) deve poter avere prestazioni aggiunte o rimosse in qualsiasi momento, non solo alla creazione.

**Regola di sicurezza sui dati — rimozione prestazione con pagamenti collegati:**
Se la prestazione da rimuovere ha pagamenti associati (diretti o per quota, a seconda di come evolve il modello), il sistema **non cancella il pagamento**. Mostra un avviso esplicito tipo:
> "Questa prestazione ha 100€ di pagamenti collegati — rimuovendola diventeranno un acconto libero sul piano."

Il pagamento resta sempre nel piano come acconto generico riassegnabile. Nessuna cancellazione silenziosa di denaro già registrato — coerente col principio "dato reale deve essere reale".

Mockup approvato: `piano_di_cura_editabile` (righe con pallino stato eseguita/da eseguire, cestino per rimozione, "+ Aggiungi prestazione" in fondo lista, riepilogo piano/eseguito/pagato/da incassare in coda).

## 7. Workflow "Segna eseguita" — UI + assistente AI, stessa azione condivisa

**Via UI:** click sullo stato della riga prestazione → mini selettore inline "Da eseguire / Eseguita" (non un modale pieno). Selezionando "Eseguita" appare opzione non obbligatoria "Registra pagamento adesso" (checkbox), che apre il form pagamento rapido (§8) solo se spuntata.

**Via assistente AI (`agente-assistente`):** nuovo tool, es. `segna_prestazione_eseguita`.
- Input: nome paziente (fuzzy match), descrizione prestazione (fuzzy match, es. "impianto")
- Cerca tra le prestazioni **non eseguite** del paziente
- **1 match** → mostra conferma esplicita con dettagli (piano, importo, eventuale dente) prima di applicare, stesso schema già usato per `modifica_appuntamento`/`elimina_appuntamento`
- **N match** (es. impianto dente 26 e 27 entrambi da eseguire) → chiede quale, non sceglie a caso
- **0 match** → lo comunica chiaramente; non propone automaticamente di crearne una nuova (evitare azioni implicite non richieste — se serve, l'utente usa esplicitamente "+ Aggiungi da incassare")
- Livello di accesso: azione di scrittura sensibile → riservata a tier Premium (full write), stesso criterio delle altre azioni scrittura dell'agente
- Segue il flusso di conferma esplicita già implementato lato Edge Function e frontend

Mockup approvato: `workflow_segna_eseguita` (doppio pannello UI + conversazione agente).

## 8. Registra pagamento — Opzione A con default per click singolo

Form sempre visibile (non collassato in un solo campo), ma precompilato per restare un click nel caso comune:
- **Importo**: precompilato con il totale dovuto sulla prestazione/piano, modificabile
- **Metodo**: precompilato su "Contanti" (select comunque visibile e modificabile inline, un click in più se serve cambiarlo)
- **Data**: precompilata a oggi, modificabile

**Gestione differenza (automatica, nessun calcolo manuale):**
Se l'importo registrato è inferiore al dovuto (es. 300€ invece di 450€), la differenza (150€) confluisce automaticamente nel `saldo_piano` tramite la formula di §2 — non serve alcun campo aggiuntivo, è conseguenza diretta del ricalcolo `totale_piano - totale_pagato`.

Se l'importo registrato è superiore al dovuto sulla singola prestazione ma il piano ha altre prestazioni da eseguire, il surplus si riflette come `acconto` a livello di piano (stessa formula, nessuna gestione speciale necessaria).

## 9. Elenco funzioni/RPC da creare o estendere

- `get_saldo_piano(p_piano_id uuid)` → `{saldo_piano, eseguito_non_pagato, acconto, totale_piano, totale_eseguito, totale_pagato}` — nuova
- `get_saldi_aperti_studio(p_studio_id uuid)` → lista pazienti/piani con `saldo_piano > 0`, con giorni di apertura — nuova, usata sia da sezione Incassi sia da widget Dashboard futuro
- Funzione/trigger per creazione automatica piano "contenitore" quando si aggiunge prestazione a paziente senza piani esistenti — nuova
- Estensione tool `agente-assistente`: nuovo tool `segna_prestazione_eseguita` con schema di conferma esplicita — estende Edge Function esistente
- Verificare se serve una funzione dedicata per "registra pagamento con differenza automatica" o se basta l'insert su `payments` esistente + ricalcolo lato frontend via `get_saldo_piano`

Ogni nuova funzione/RPC segue il runbook RLS: `REVOKE` esplicito da `PUBLIC`/`anon`, test di simulazione JWT, `get_advisors(type: security)` prima di considerarla chiusa.

## 10. Componenti frontend da toccare

- Scheda paziente: componente riquadro economico (nome file da confermare in repo, verosimilmente dentro `SchedaPaz.jsx` o componente dedicato tab economico)
- Nuova pagina/sezione "Incassi" + voce dock
- `ControlloGestione.jsx`: nuovo tab o integrazione nella tab Panoramica esistente
- Componente piano di cura: aggiungere toggle stato riga, cestino rimozione con avviso, bottone "+ Aggiungi prestazione"
- Nuovo modale/form "Aggiungi da incassare" (toggle listino/libero, pagamento parziale contestuale)
- Nuovo form rapido "Registra pagamento" (Opzione A, default precompilati)
- `AssistenteAI.jsx` / Edge Function `agente-assistente`: nuovo tool `segna_prestazione_eseguita`

## 11. Vincoli espliciti da rispettare durante l'implementazione

- **Nessuna cancellazione silenziosa di pagamenti già registrati** in nessun flusso (rimozione prestazione, modifica piano)
- **Studio Simondi (vertical dentistico) non deve avere regressioni** — questo modulo è trasversale a tutti i vertical, non è una feature dentistico-specifica, ma va comunque testato sui dati reali dello Studio Simondi prima del merge
- Seguire branch dedicato (es. `feature/modulo-incassi`), preview Vercel, branch Supabase se le migration toccano schema/RLS, come da `runbook-sviluppo-sicuro.md`
- Prima di merge: confronto esplicito tra "da incassare" vecchio e nuovo su tutti i piani attivi di Studio Simondi, per verificare che il nuovo calcolo non produca numeri inattesi rispetto ai pagamenti reali già registrati

## 12. Messaggio operativo per la sessione Code

Lavoriamo sul repo GitHub lucasimondi/Dental-manager-claude (branch master). Prima verifica accesso push (git push --dry-run); se non funziona, fermati e dimmelo.

Leggi nel progetto Claude "Poliedra Soft" questo documento (piano-modulo-incassi-da-incassare.md) insieme ai runbook runbook-sviluppo-sicuro.md e runbook-rls-nuove-tabelle.md, seguili per tutto il flusso.

Branch feature/modulo-incassi: implementa il modello a tre valori (saldo_piano/eseguito_non_pagato/acconto) descritto alla sezione 2, come funzione Postgres get_saldo_piano condivisa. Aggiorna il riquadro economico della scheda paziente (sezione 3). Crea la nuova sezione Incassi con doppia esposizione — voce dock e tab Controllo di Gestione — usando get_saldi_aperti_studio (sezione 4). Implementa il form Aggiungi da incassare (sezione 5) con creazione automatica di piano contenitore quando il paziente non ne ha. Rendi i piani sempre editabili con l'avviso su rimozione prestazioni pagate (sezione 6). Implementa il workflow segna eseguita sia lato UI sia come nuovo tool dell'assistente AI (sezione 7), col medesimo schema di conferma esplicita già usato per modifica/elimina appuntamento. Implementa il form di registrazione pagamento rapido con gestione automatica della differenza (sezione 8).

Rispetta i vincoli della sezione 11: nessuna cancellazione silenziosa di pagamenti, nessuna regressione su Studio Simondi, confronto esplicito prima/dopo sui piani attivi reali prima del merge in produzione. Segui il runbook per branch Supabase se tocchi RLS/RPC, preview Vercel, get_advisors, e merge solo dopo verifica.
