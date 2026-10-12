# POL-VITA-001 — Archivio personale e assistente di vita in Poliedron

Brief del Product Owner (Luca), consegnato in chat il 2026-10-12 nella sessione
`claude/catalogazione-facile-latjs9`. Testo conservato integralmente, salvo l'indirizzo email personale (non messo nel repository).
Analisi e stato operativo: `docs/coordination/current-task.md` (blocco POL-VITA-001).

## Visione (PO, verbatim)

“Poliedron sarà la mia assistente di vita oltre che di studio; l’agenda sarà la mia agenda scadenze;
il team sarà composto da commercialisti, avvocati, notai e geometri, tutti AI con le API;
i documenti saranno scaricabili sia in originale sia come documenti di sintesi;
dovranno poter essere cancellati se voglio; il crea documenti userà la mia carta intestata.
Io con Poliedron cercherò, catalogherò, caricherò e lui interpreterà e renderà trovabile subito.”

Fonte iniziale dei documenti: tutti gli allegati Gmail della casella personale del PO
(~200+ thread con allegati: bollette, solleciti e recupero crediti, diffide legali,
fatture attive/passive, PagoPA, polizze, documenti scolastici, documenti sanitari familiari).

## Decisioni PO richieste prima del codice (`PRODUCT_OWNER_DECISION_REQUIRED`)

1. **Ambito dei dati — proposta: nuovo ambito “personale” legato a `auth.uid()`, non a `studio_id`.**
   I documenti di vita non appartengono allo studio: non devono mai essere visibili ad altri
   membri dello studio né entrare nelle tabelle del tenant. RLS: solo proprietario, fail-closed.
   È un cambio del modello di tenancy → gate PO obbligatorio (AGENTS.md).
2. **Dove — proposta: stesso progetto Supabase di produzione (`idklxdqebfceplrualgh`)**, tabelle e bucket
   dedicati, un solo login e un solo Poliedron. Alternativa: progetto separato `archivio-documenti`
   (`tkcwvjzjkfhcuebrjvsp`, eu-central-1, già creato e vuoto) → isolamento più forte ma secondo login.
3. **Dati sanitari di terzi (familiari) e dati di pazienti finiti nella mail personale:** categorie
   particolari art. 9 GDPR. Proposta: categoria `sanitario` cifrata/separata, esclusa dal team AI
   salvo richiesta esplicita; documenti di pazienti rilevati → proposta di spostamento nell’archivio
   del paziente dello studio, mai indicizzati nello spazio personale.
4. **Fornitore AI:** la lettura documenti richiede il modello. Risolvere prima il problema già
   registrato (credito OpenAI esaurito / `ANTHROPIC_API_KEY` assente come riserva).

## Fasi (ognuna: branch proprio, migrazione + RLS + test insieme, rollback documentato)

### Fase 1 — Ingestione Gmail

- Google OAuth con scope `gmail.readonly`; refresh token cifrato lato server, mai nel client.
  Verificare i limiti di Google per app non verificate / in modalità test (durata del refresh token).
- Edge Function `importa-gmail`: elenca i messaggi con allegati (esclusi promozioni/social),
  scarica gli allegati, deduplica per SHA-256, salva l’originale in bucket **privato**
  `archivio-personale/<uid>/<aaaa>/<mm>/`, URL firmate a scadenza breve.
- Tabella `documenti_personali`: owner, file path, hash, nome originale, mime, dimensione,
  mittente, oggetto, data mail, id messaggio/thread Gmail, stato elaborazione.
- Import storico completo dal più vecchio, a lotti ripartibili; poi incrementale.

### Fase 2 — Interpretazione

- Riutilizzare il pattern di `estrai-spesa-documento` (`UploadDocumentoSpesa.jsx`):
  per ogni documento estrarre JSON strutturato → categoria (utenze, fisco, legale, banca,
  assicurazioni, scuola, casa/catasto, successione, identità, sanitario, fornitori studio),
  ente/controparte, intestatario, importi, scadenze, riferimenti (n. fattura, codice avviso,
  codice cliente), stato (da pagare / pagato / contestato / informativo), sintesi in 2 righe.
- Collegamento a **pratiche**: tabella `pratiche_personali` che raggruppa i documenti della
  stessa vicenda (es. “Edison – Via Piccona 33”: fatture, solleciti Fides, preavvisi di sospensione).

### Fase 3 — Scadenze e agenda

- Tabella `scadenze_personali` derivata dall’estrazione (data, importo, documento, pratica, stato).
- Vista nell’agenda di Poliedron, separata/filtrabile da quella dello studio.
- Avvisi con il meccanismo esistente di `team/alerts.js` (risposte rapide: Pagato / Contesto /
  Già gestito / Aggiungi nota), insistenza giornaliera finché non c’è risposta.

### Fase 4 — Ricerca immediata in chat

- Full-text italiano + ricerca semantica (pgvector) su testo estratto e sintesi.
- Strumenti read-only per `agente-assistente`: `cerca_documenti_personali`,
  `riepilogo_pratica`, `scadenze_aperte`. Risposta sempre con link all’originale.
  Esempio: “Quanto devo a Edison?” → totale, dettaglio fatture, prossima scadenza, PDF.

### Fase 5 — Team personale

- Nuovi descrittori in `team/catalog.js` e `agente-assistente/team.js` (test di coerenza ID):
  Commercialista, Avvocato, Notaio, Geometra. Stesse regole del team esistente:
  solo strumenti di lettura, solo documenti della propria area, pareri attribuiti,
  divergenze conservate, nessuna azione diretta.
- Prodotti: analisi, bozze di risposta (es. a una diffida), checklist documenti mancanti.
  Gli atti formali restano al professionista reale.

### Fase 6 — Download e sintesi

- Scarico originale (URL firmata) e “documento di sintesi” generato (PDF via `pdfLayout.js`).

### Fase 7 — Cancellazione definitiva (diritto all’oblio, art. 17 GDPR)

- Cancellare = file nel bucket + riga + testo estratto + embedding + scadenze derivate,
  in un’unica operazione transazionale lato server, con conferma esplicita. Nessun soft-delete
  nascosto. Test che verifichi l’assenza di residui.

### Fase 8 (dopo) — Crea documenti su carta intestata personale

- Da progettare con il PO.

## Criteri di accettazione minimi

- Test RLS a due utenti: l’utente B (anche dello stesso studio) non vede nulla dell’utente A.
- Nessun dato dello spazio personale nei log, negli eventi `poliedron_eventi` o nel Learning Engine.
- Import ripartibile senza duplicati; cancellazione senza residui.
- `npm test` e `npm run build` verdi; handoff completo come da AGENTS.md.
