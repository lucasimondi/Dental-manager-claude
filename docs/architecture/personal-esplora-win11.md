# PERSONAL-ESPLORA-WIN11 — Esplora file e barra in basso stile Windows 11 in Poliedron Personal

Richiesta del Product Owner, 2026-11-21 (testuale):
- "Che possa prendere i file aprirli e spostarli da una cartella ad un'altra trascinandoli, creare nuove cartelle con il click prolungato sullo schermo insomma le funzioni base di win11 con elenco cartelle di fianco che poi clicco e si aprono di fianco o sotto in questo caso, un workflow da win 11"
- "Devo anche poterli spostare i file e le cartelle"
- "Facciamo su drive, ovviamente dobbiamo avere la stessa cosa anche su drive, per ora deve essere interna a poliedra personal […] il dock in basso stile win anche"

Prototipo approvato da Luca (canvas di design): https://claude.ai/artifact/SCrK2tvPe5imoSRAsvbJeY. Riferimenti: le tavole «Esplora file · orizzontale/verticale (funzionante)», «Poliedra OS · Desktop», «Start» e «Notifiche». Se non riesci ad aprirlo, le specifiche visive sono nella sezione 6.

## 0. Regole di processo (obbligatorie)

- Segui `AGENTS.md`, `CLAUDE.md` e, per tutto ciò che tocca l'archivio, `poliedron/archivio/CLAUDE.md` (niente segreti, niente invii, niente cancellazioni fuori dalle eccezioni di Luca, migrazioni solo additive).
- Registra il task in `docs/coordination/current-task.md`. Lavora su un branch nuovo da `master` (il task IMPOSTAZIONI-UNICHE in corso non si sovrappone). Alla fine, handoff completo.
- Non tornare al tema Windows 95: il 2026-11-08 Luca ha deciso "tema win togliamo". Questo task non è un tema. È una vista nuova (Esplora file) più una barra in basso che sostituisce il dock attuale, nello stile moderno di `pro.css` con l'estetica Windows 11 descritta sotto.
- Consegna in **3 PR separate**, una per fase. Per ognuna: build, test, anteprima Vercel con `_vercel_share` per provarla sul telefono, poi merge solo con "Mergia".

## 1. Modello dei dati: si riusa quello che c'è

- **Albero**: `cartelle_mie` / `v_cartelle_mie` (`padre_id`, `posizione`, `archiviata_il`, `drive_cartella_id`) e `personal/src/lib/cartelleMie.js` (`costruisciAlbero`, `percorso`, `discendenti`, `destinazioniPossibili`, `elencoConPercorso`, `creaCartella`, `rinominaCartella`, `spostaCartelle`, `archiviaCartelle`).
- **Contenuto**: `cartelle_mie_documenti` (`aggiungiDocumenti`, `togliDocumenti`, `documentiDellaCartella`).
- **Cartelle virtuali in sola lettura come origine** (da lì si trascina via, non ci si mette dentro):
  - «Da catalogare»: documenti che non stanno in nessuna cartella mia, più recenti prima, con un limite e la paginazione.
  - «Per categoria»: un nodo per fascicolo (i fascicoli esistenti, `clinico_pazienti` escluso dalla vista).
- La radice dell'albero è «Personale» = `Archivio personale/` su Drive.
- **Nessuna migrazione** prevista per la fase 1. Se uno spostamento atomico lo richiede, crea una RPC additiva `sposta_documenti(origine uuid, destinazione uuid, ids bigint[])` (security invoker, RLS proprietario) in `supabase/archivio/migrations/`, con i suoi test.

## 2. Semantica di "Sposta" (decisione di Luca: Drive identico all'app)

- In Esplora file un documento ha **una posizione**, come in Windows. Sposta = tolto dalla cartella di partenza (se è una cartella mia), aggiunto a quella di arrivo, **file spostato su Drive** nella cartella gemella.
- Questo cambia la regola di POL-VITA-031 ("i file su Drive non si spostano") **solo** per gli spostamenti fatti da Esplora file. Il comando esistente "aggiungi anche a un'altra cartella" resta com'è: in quel caso il file su Drive resta dove sta.
- Un file spostato da Esplora prende `drive_fissa = true` e `drive_cartella = 'cartella:<id>'`, così `ordinaDrive_()` non lo rimette nella cartella Categoria/anno (stesso meccanismo del caricamento in una cartella, `Code.gs` intorno alla riga 1702).
- **Cartelle su Drive subito**: oggi la gemella nasce al primo file salvato. Da adesso nasce quando crei la cartella nell'app, e rinomina e spostamento si riflettono subito, senza aspettare i 10 minuti di `allineaCartelleDrive_()`.
- **Elimina**: le cartelle si **archiviano** (`archiviaCartelle`, ripristinabili; la cartella su Drive non si tocca). I documenti passano dal flusso di eliminazione già esistente, con conferma e Cestino di Drive (eccezione di Luca del 2026-10-16). Niente cancellazioni definitive.
- I documenti dei pazienti si possono spostare (operazione su Drive, nessun modello), ma il loro contenuto non va mai a nessun modello.

## 3. Fase 1: Esplora file nell'app (UI su dati esistenti)

Nuova vista `personal/src/sezioni/documenti/Esplora.jsx` (più `esplora.css`), raggiungibile da Documenti e dalla barra (fase 3). Logica pura in `personal/src/lib/esplora.js`, testabile senza DOM.

**Disposizione (decisa dall'orientamento, non dal dispositivo)**
- Orizzontale (larghezza > altezza): elenco cartelle ad albero a **sinistra** (~200 px, frecce per aprire/chiudere), contenuto **di fianco**.
- Verticale: elenco cartelle in **alto** (~300 px, scorre, divisorio trascinabile per cambiarne l'altezza), contenuto **sotto** con intestazione (nome cartella, numero di elementi).
- Finestra stile Windows 11:
  - barra del titolo («Esplora file»);
  - barra comandi: ↑ cartella superiore, percorso cliccabile, «Nuova cartella»;
  - griglia di icone grandi (6 colonne in orizzontale, 4 in verticale; cartelle prima, poi file);
  - barra di stato: «N elementi · M da gestire».

**Interazioni**
- **Tocco** su una cartella (nell'albero o nella griglia): la apre. **Tocco** su un file: anteprima (riusa `AnteprimaDocumento` / `Documento`).
- **Pressione prolungata** (riusa `useTrascina`, 380 ms, vibrazione breve):
  - se poi muovi il dito, l'elemento si stacca e lo trascini;
  - se lasci senza muoverti, si apre il **menu contestuale**. Oggi `useTrascina` in quel caso seleziona: aggiungi un'opzione `onFermo` da usare in Esplora, senza cambiare il comportamento negli altri usi.
- Con il mouse: trascinamento immediato e **tasto destro** per il menu.
- **Trascinamento**: file **e cartelle**, su qualsiasi cartella dell'albero o della griglia (`data-bersaglio="cartella:<id>"`).
  - La destinazione valida si evidenzia in azzurro, con la scritta «Sposta in X» sotto il dito.
  - Mai una cartella dentro se stessa o una sua sottocartella (`destinazioniPossibili`), mai nella cartella in cui l'elemento si trova già, mai dentro le cartelle virtuali.
  - Vicino ai bordi la lista scorre da sola.
  - Nell'albero in verticale lo scorrimento resta possibile: il trascinamento parte solo dopo la pressione prolungata.
- **Menu su spazio vuoto**: Nuova cartella · Incolla (con il nome dell'elemento tagliato) · Aggiorna.
- **Menu su un file**: Apri · Taglia · Sposta in… · Rinomina · Elimina.
- **Menu su una cartella**: Apri · Nuova cartella qui · Taglia · Sposta in… · Rinomina · Elimina (= archivia). Per «Personale» e le cartelle virtuali le voci non applicabili sono disattivate.
- **Nuova cartella**: compare subito nella griglia con il nome «Nuova cartella» già selezionato in un campo di testo. Invio conferma, Esc annulla.
- **Sposta in…**: foglio con l'albero completo (`elencoConPercorso`), le destinazioni vietate in grigio, quella attuale con la scritta «attuale». In verticale si apre dal basso, in orizzontale come finestra di dialogo.
- **Ogni spostamento e ogni eliminazione** mostra un avviso con **Annulla** (circa 4,5 s), che rifà l'operazione inversa.
- Aggiornamento **ottimistico** dell'interfaccia. Se il database rifiuta, si torna indietro e compare un avviso.

**Pallini rossi (badge)**
- Il numero su ogni cartella = documenti con scadenza aperta già passata o entro 14 giorni + documenti con `azione_richiesta` non fatta, **contando anche le sottocartelle**.
- Su «Da catalogare» il numero è il totale dei documenti da smistare.
- Stesso pallino accanto al nome nell'albero e sull'icona di Esplora nella barra in basso.
- I numeri si ricalcolano dopo ogni spostamento.
- Riusa i criteri di scadenza già presenti in Documenti (la «Revisione archivio» del 19 ottobre). Non duplicare le regole: estraile in una funzione condivisa.

**Test della fase 1**
- `tests/esplora.test.mjs`: calcolo dei pallini ricorsivo, destinazioni valide, Taglia/Incolla, Annulla.
- `npm test`, `npm run build`, `npm run build:personal`.
- Prova visiva a 390×844 e 844×390: nessuno sforamento orizzontale, menu e fogli dentro lo schermo.

## 4. Fase 2: Drive allineato subito (Apps Script)

Nuove azioni di `doPost` in `poliedron/archivio/Code.gs`, con verifica del token del proprietario come le altre:
- `cartella_drive` `{ id }`: crea o allinea subito la gemella (riusa `cartellaDriveDi_`, nome e padre come `allineaCartelleDrive_`). L'app la chiama dopo crea, rinomina e sposta cartella.
- `sposta_documenti` `{ ids:[documento_id], cartella_id }`: per ogni documento con `drive_file_id`, `moveTo` nella gemella, poi `drive_fissa = true` e `drive_cartella = 'cartella:<id>'`. Restituisce spostati / non trovati / errori. Niente copie, niente cancellazioni; id e link dei file restano uguali.
- Le email senza file (`message/rfc822`) non hanno nulla da spostare su Drive: si sposta solo il collegamento nell'app.
- Se Drive fallisce, il documento resta spostato nell'app e compare un avviso «Su Drive lo sistemo al prossimo giro». `allineaCartelleDrive_` / `ordinaDrive_` devono recuperare da soli usando `drive_cartella`.

La nuova versione dello script va pubblicata da Luca: `clasp push` più una nuova versione della web app, procedura in `poliedron/archivio/CLAUDE.md`. Fermati e dagli i passi esatti. Aggiorna la tabella dell'architettura in quel file.

## 5. Fase 3: barra in basso e Start stile Windows 11

Sostituisce il dock attuale di Personal (`IconeDock.jsx`, navigazione in `App.jsx`) **senza cambiare le destinazioni né le viste salvate** (Oggi, Agenda, Documenti, Assistente, Altro restano gli stessi percorsi).

**Barra delle applicazioni**
- Altezza 64 px in verticale, 48 in orizzontale.
- Sfondo chiaro semitrasparente con sfocatura (`backdrop-filter`), bordo superiore sottile.
- Icone **centrate**, area di tocco 44×44:
  - Start (logo poliedro);
  - Oggi;
  - Agenda;
  - Esplora file (cartella gialla) con il pallino del totale «da gestire»;
  - Assistente;
  - Altro.
- App attiva: sfondo bianco più una **lineetta blu** (#005FB8) di 12×3 px sotto l'icona.
- **A destra**: ora e data, più il numero delle notifiche → apre le notifiche esistenti (`lib/notifiche.js`).
- Rispetta `env(safe-area-inset-bottom)`.

**Start** (tocco sul logo): pannello che sale dal basso.
- Ricerca (riusa la ricerca reale dell'archivio).
- «Aggiunte»: griglia di 4 colonne con le sezioni (Oggi, Agenda, Documenti, Esplora, Conti, Legal, Pratiche, Portafoglio, Diario, Impostazioni…), ognuna col suo pallino.
- «Consigliati»: ultimi documenti da `lib/recenti.js`.
- In fondo «Luca» e blocca/esci.
- Si chiude con un tocco fuori, con Indietro o toccando di nuovo il logo.

I pallini di sezione riusano conteggi già calcolati in Oggi e Documenti. Nessun nuovo conteggio lato server.

## 6. Specifiche visive (dal prototipo)

- **Carattere**: `'Segoe UI Variable Text','Segoe UI',Inter,system-ui`.
- **Colori**: finestra #F3F3F3, contenuto #FFFFFF, testo #1A1A1A, testo secondario #5C5C5C, accento #005FB8, evidenziazione destinazione #CCE4F7 con bordo #005FB8, voce attiva nell'albero #E3E8EE.
- **Pallino**: #C42B1C con testo bianco, 18–24 px, bordo bianco di 1,5–2 px, in alto a destra dell'icona, numero (non punto).
- **Icona cartella**: viewBox 96×80, dorso #E0A21B, foglio bianco, fronte #FFC83D.
- **Icona file**: foglio con l'angolo piegato e banda colorata per tipo (PDF #C42B1C, immagini #0E700E, Office #0F6CBD).
- **Menu contestuale**: #F9F9F9, angoli 8 px, ombra morbida, voci da 40–44 px con icona lineare.
- **Avviso con Annulla**: scuro #2B2B2B, pulsante «Annulla» azzurro.
- Modalità scura: segui le variabili di `pro.css`; i colori sopra sono quelli della modalità chiara.

## 7. Fuori da questo task

Finestre multiple e Snap (le tavole «Modalità finestre» del canvas), widget, desktop virtuali, blocco schermo: sono la direzione futura di "Poliedra OS", da autorizzare a parte. Esplora non entra nell'app dello studio.
