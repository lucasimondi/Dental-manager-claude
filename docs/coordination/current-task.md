# Current task — Personal: pulizia in massa con Poliedron (Gemini) e tasto Risolta (2026-10-18)
- OWNER: CLAUDE, branch `claude/poliedron-agenda-actions-kz6mmk`, da `master@75aeba7`. PO verbatim: "con poliedron collegato ad api gemini ora facciamo che gli si possa chiedere di analizzare documenti e risolverli in massa. Inoltre mettimi il tastino risolta su pratiche così spariscono da app e non intasano, voglio che pian piano si scremi tutto l'inutile e si possano cancellare anche le mail indietro e i documenti allegati che non servono, tipo tutti i preventivi e i depliant". Conferme esplicite (regole sez. 3 dell'archivio): email → Cestino Gmail; pazienti → "Sì, se lo chiedo".
- COSA: `Code.gs` — chat con Gemini quando Claude è in pausa (`chatGemini_`, function calling, parti del modello rimandate invariate); strumenti di sola proposta `proponi_eliminazione` / `proponi_rianalisi` / `proponi_risolvi_pratiche` (criteri obbligatori, max 300, clinici solo se nominati e mai i loro titoli al modello); azione `cestina_email` (Cestino Gmail solo se tutti gli allegati archiviati dell'email sono eliminati, mai i caricati). App — scheda di proposta nella chat (elenco con spunte, Drive ed email facoltativi, conferma); `lib/pulizia.js`; tasto "✓ Risolta" sulle pratiche (Documenti › Pratiche e Oggi).
- DEPLOY: dopo "Mergia" `clasp push -f` + aggiornamento della web app (stesso URL) da questa sessione (clasp autorizzato da Luca).
- VALIDATION: `npm test` verde (+7 `tests/archivioPulizia.test.mjs`); build e build:personal OK; prova Chromium 390×844 con script finto: proposta → spunte → conferma → cestina, cestina_email, archivio nell'ordine.

---

# Current task — Archivio: Gemini di riserva per l'analisi (2026-10-18)
- OWNER: CLAUDE, branch `claude/poliedron-agenda-actions-kz6mmk`, da `master@d4ed1347` (merge di master per POL-VITA-017). PO verbatim: "Ma se usassimo gemini per analizzarli!?" → (avvisato su privacy del piano gratuito) "Gratuita".
- COSA: `poliedron/archivio/Code.gs` — con Claude in pausa (limite di spesa fino al 2026-11-01) e la proprietà `GEMINI_API_KEY`, `analizza_()` usa Gemini (`gemini-flash-latest` o `GEMINI_MODELLO`) con lo stesso prompt/JSON: import, caricamenti dall'app e i ~3.800 "da analizzare". Riordino, chat, cartelle e bozze restano a Claude. Quota del giorno o chiave rifiutata → Gemini in pausa 3 h, catalogo a regole. Mai i clinici.
- DEPLOY: non fatto da qui (niente clasp in questa sessione). Luca: chiave su aistudio.google.com → Proprietà script `GEMINI_API_KEY`; incollare `Code.gs` nell'editor (o `clasp push -f`) e salvare.
- VALIDATION: `node --check` OK; `npm test` 1331/1331 (+6 `tests/archivioGemini.test.mjs`, aggiornato `archivioRiservaDrive`).
- EXACT NEXT ACTION: CI della PR verde → "Mergia" → Luca pubblica lo script.

---

# Current task — POL-VITA-017 Personal a sezioni: il codice diviso per area (2026-10-18)
- OWNER: CLAUDE, branch `claude/document-layout-management-vaktuz`, ripartito da `master@4f9cdc3` (PR #216 mergiata). PO verbatim: "Dobbiamo rendere lapp a sezioni , tu hai un codice unico ?" → alla proposta (1 codice in moduli per sezione, 2 aspetto) "Dalle 1".
- COSA: `personal/src/App.jsx` (1.195 righe) diventa solo la cornice (~150: accesso, testata, dock, pagine sovrapposte, +). Ogni sezione in `personal/src/sezioni/<sezione>/` con un `index.jsx` che dichiara vista del dock, pagine (tipo → titolo, modulo, render) e classi/azioni di testata: oggi, documenti (Documenti, Documento, Pratica, Carica), agenda (Agenda, AgendaGriglia), conti (Conti, Pagamento), personali, foto, poliedron, impostazioni. Registro in `sezioni/index.js`; accesso in `Accesso.jsx`. Parte comune invariata (`lib/`, `ui.jsx`, `Icone.jsx`, `Miniatura.jsx`, `Pagina.jsx`, `Aggiungi.jsx`). Regola: le sezioni si usano tra loro solo via `index.jsx`. Nessun cambiamento visibile; nessuna modifica a database, script, Studio o `shared/agenda`.
- TEST: percorsi aggiornati nei test esistenti (stesse verifiche, file nuovi); nuovo `tests/personalSezioni.test.mjs` (cartelle e registro, App solo cornice, import tra sezioni solo da index, ogni pagina aperta registrata una sola volta).
- VALIDATION: `npm test` 1316/1316; build e build:personal OK; eslint (no-undef, jsx-no-undef, no-unused-vars) pulito sui file nuovi; visita guidata in Chromium 390×844 con dati finti su master e sul branch: 16 schermate (5 schede, Poliedron, documento, foto, pagamento, impostazioni, sezione, spesa, pagamento da fare, evento, scansione, carica) con testo identico, nessun errore; `test:agenda:visual` Chromium (Studio pixel identico) e reliability Chromium 3/3; WebKit in CI.
- EXACT NEXT ACTION: CI della PR verde → merge (PO: "Mergia"). Unito `master@d4ed134` (#215 cartelle): `Cartelle.jsx` spostato in `sezioni/documenti/`, pagine `cartella` e `senza-cartella` registrate nella sezione Documenti.

---

# Current task — POL-VITA-016 Personal: cartelle in Documenti (2026-10-18)
- OWNER: CLAUDE. BRANCH: `claude/catalogazione-facile-latjs9` ripartito da `master@6c9a296f` (PR #206 e #209 mergiate).
- RICHIESTA PO (sintesi del verbatim): documenti mischiati → in elenco e a icone vanno in cartelle organizzate (es. cartella Kerdos con i suoi 8 documenti), apribili, cancellabili, modificabili; documenti selezionabili per inviarli, condividerli, cancellarli; info del periodo; analisi del contenuto e sintesi anche con AI; contatti da cui arriva; bozza di risposta; etichette; termini, date e promemoria ("che andranno dove?"); consigli.
- FATTO: Documenti si apre su "Cartelle" (una per ente) a icone o in elenco, con ricerca e filtro per etichetta; "Documenti senza cartella". Pagina cartella: periodo, numero, categoria, totale, etichette, note, Sintesi AI (script, azione `cartella`, salvata in `cartelle_ente`), Rispondi (bozza in Gmail con `createDraftReply`, nulla inviato), Promemoria (scadenza con `cartella`: Agenda, Oggi, riepilogo delle 7; proposta .ics per il Calendario del telefono; esclusi dai pagamenti di Conti se senza importo), Modifica (rinomina/unisci, note), Elimina (togli solo la cartella oppure elimina documenti con scelta Drive), contatti dai mittenti, documenti selezionabili. Selezione multipla ovunque: Condividi (più file insieme col foglio del sistema, max 10, preparati prima del tocco; mai i clinici), Cartella (sposta o nuova), Categoria, Altro, Elimina. I documenti Kerdos (8, prima divisi tra due mittenti) riuniti nella cartella "Kerdos SPV" come da esempio del PO.
- DATABASE: migrazione additiva `20261018090000_pol_vita_014_cartelle.sql` applicata (tabella `cartelle_ente` con RLS proprietario, colonna `scadenze.cartella`, vista `v_cartelle` security_invoker senza clinici, funzione `rinomina_cartella` security invoker). Dati: `documenti.ente = 'Kerdos SPV'` sugli 8 documenti che citano Kerdos.
- DEPLOY: script versione 9 (web app @9). Frontend al merge.
- VALIDATION: `npm test` 1311/1311 (Node 20; +14 test `personalCartelle`); build OK; Chromium 390×844 con dati finti: cartelle a icone ed elenco, apertura Kerdos, contatti, selezione e condivisione di 2 file, promemoria salvato con la cartella, bozza, AI ferma con messaggio chiaro, nessun errore, nessun overflow.
- LIMITI: con il limite di spesa Claude (fino al 2026-11-01) Sintesi AI e Rispondi mostrano l'avviso; molte cartelle dei documenti importati senza Claude hanno il nome del mittente (si sistemano con l'analisi completa o unendole da Modifica).

---

# Current task — POL-VITA-018 Personal: cartelle suggerite, notifiche sul telefono, stato delle cartelle (2026-10-18)
- OWNER: CLAUDE. BRANCH: `claude/catalogazione-facile-latjs9` da `master@d4ed1347` più merge di `origin/master` (fino a `3b8bbb27`).
- RICHIESTA PO (verbatim): "Ok vai con tute e tre" — le tre proposte dopo POL-VITA-016: cartelle suggerite dall'AI, notifiche sul telefono per i promemoria, stato della cartella (aperta/in attesa/chiusa) con elenco "in attesa da più di 15 giorni".
- FATTO: (1) Proposte "Cartelle da unire": dal database (stesso dominio del mittente, domini generici esclusi, max 8 cartelle per proposta) e, a richiesta, dall'AI (`suggerisci`); Luca sceglie cartelle e nome, "Unisci" (rinomina una a una) o "Non unire" (per sempre). (2) Notifiche: service worker `/personal/sw-notifiche.js` (solo push, nessuna cache), `lib/notifiche.js` (iPhone: solo app sulla schermata Home), sezione in Impostazioni (Attiva, Invia una prova, Spegni); funzione Supabase `notifiche-personal` (web push, chiavi VAPID generate e tenute da lei, una notifica al giorno per promemoria, mai clinici, prova solo per il proprietario); lo script la chiama alle 7 e al massimo ogni ora 8–21. (3) Stato: Aperta/In attesa/Chiusa in cartella (con data), badge nell'elenco, filtri Attive/Aperte/In attesa/Chiuse, avviso "in attesa da più di 15 giorni".
- DATABASE: migrazione additiva `20261018150000_pol_vita_018_stato_suggerimenti_notifiche.sql` applicata (nome in Supabase: `pol_vita_017_stato_suggerimenti_notifiche`).
- DEPLOY: funzione `notifiche-personal` v1 (verify_jwt false, autenticazione propria per la prova); chiavi create al primo giro dello script, nessun errore. Script versione 12 (contiene anche Gemini di riserva di PR #218: la mia versione 11 l'aveva tolta per qualche minuto, ripristinata unendo master).
- VALIDATION: `npm test` 1347/1347 (Node 20; +14 test `personalNotificheStato`); build OK; Chromium 390×844: avviso di attesa, badge, filtro, proposta OPT unita (2 rinomine), stato salvato, AI ferma con messaggio; nessun errore.
- LIMITI: la notifica reale va provata sull'iPhone (app sulla schermata Home, Impostazioni › Notifiche sul telefono › Attiva); proposte AI ferme finché Claude è in pausa.
- STATO: in revisione (PR).

---

# Current task — POL-VITA-017 (seguito) Personal: Agenda e Documenti in file più piccoli (2026-10-18)
- OWNER: CLAUDE, branch `claude/document-layout-management-vaktuz`, ripartito da `master@75aeba7` (PR #217 e #218 mergiate). PO verbatim: "Dividi sezioni" (proposta: dividere ancora le sezioni più grandi).
- COSA: `sezioni/agenda/Agenda.jsx` (509) → `Agenda.jsx` (vista ed elenco del giorno, 167), `Evento.jsx` (nuovo/modifica evento, serie, 237), `Appuntamento.jsx` (appuntamento dello studio, 114). `sezioni/documenti/Documenti.jsx` (425) → `Documenti.jsx` (vista, 130), `Selezione.jsx` (elenco con selezione multipla e fogli di scelta, 227), `Filtri.jsx` (barra dei filtri, 43), `Ricerca.jsx` (pagina di ricerca, 45). Import ridotti a quelli usati. Nessun cambiamento visibile; nessuna modifica a database, script, Studio o `shared/agenda`.
- TEST: verifiche esistenti spostate sui file nuovi (Evento, Selezione), fixture visiva su Evento/Appuntamento.
- VALIDATION: `npm test` 1335/1335; build OK; eslint (no-undef, jsx-no-undef, no-unused-vars) pulito; visita guidata Chromium 390×844 master↔branch: 21 schermate (anche ricerca, selezione multipla, nuovo appuntamento) con testo identico, nessun errore; `test:agenda:visual` e reliability Chromium OK; WebKit in CI.
- EXACT NEXT ACTION: su "Mergia" del PO → PR, CI verde, merge.

---

