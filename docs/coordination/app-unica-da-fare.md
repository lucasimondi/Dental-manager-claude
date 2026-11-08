# APP-UNICA — cosa resta da fare (registro per la prossima sessione)

Decisioni del Product Owner (2026-11-08), da rispettare senza ridiscuterle:
- un solo posto, nome **Poliedron**; tema Windows 95 **tolto**; il **+** accanto alla barra di ricerca
  dell'agenda apre «Crea» (deve essere "pro, immediato e bello");
- agenda di partenza **Tutto** (Studio + Personal), vista **settimana**; desktop **invariato** (si cambia solo il telefono);
- regole dell'archivio personale (`poliedron/archivio/CLAUDE.md`): nessun segreto nel repo, contenuto clinico
  dei pazienti mai inviato a modelli, solo bozze verso terzi, nessuna cancellazione.

Anteprima approvata: artifact "Poliedron app unica" (4 schermate: Agenda con +, Crea, Altro, Documenti).

## Fatto nel passo 1 (ramo `ccr-4fbd3db0-8ou289`, PR APP-UNICA passo 1)
- `shared/crea/CreaSheet.jsx` + `crea.css`: + rotondo accanto alla ricerca; foglio con «Appuntamento» e «Impegno»
  grandi in cima, poi Studio / Per te; un tocco apre subito il modulo; si chiude con ✕, Esc, tocco fuori o trascinando giù.
- Studio (`src/components/Agenda.jsx`, `src/App.jsx`): voci Appuntamento, Impegno, Paziente, Incasso, Spesa, Documento,
  Nota (campo già pronto), Password (modulo già aperto). Personal (`AgendaGriglia.jsx`): Appuntamento, Impegno, Nota,
  Documento, Spesa, Da pagare, Password, Paziente (apre Studio con `?sezione=paz&nuovo=1`).
- Dock unico nelle due parti: Agenda · Note · Poliedron · Documenti · **Altro** (tolti la casetta verso Personal e il tasto Studio).
- `shared/altro/AltroPage.jsx`: «Altro» a tessere, uguale nelle due parti — Lavoro · Studio e Vita · Personale.
  L'altra parte si apre con `sectionDestination()` / `readSectionLocation()` (`shared/agenda/navigation.js`).
- Tema Windows 95 rimosso da Personal (`retro.css` cancellato, `lib/aspetto.js` sempre «moderno»).
- App Studio sul telefono chiamata **Poliedron** (manifest PWA e titolo). Personal resta «Poliedron Personal»
  finché le due parti non diventano un'app sola (passo 2), per non avere due icone uguali.

## Fatto nel passo 2a (PR APP-UNICA passo 2a)
- `shared/agenda/navigation.js` → `appBase()`: dentro l'app installata (Poliedron in `/poliedron…`, o qualsiasi
  pagina aperta come app) Studio e Personal si aprono nello STESSO indirizzo (`/poliedron/` ↔ `/poliedron/personal/`,
  `/` ↔ `/personal/`): niente più salto su `personal.poliedrasoft.it`. Nel browser del computer resta tutto come prima.
- `personal/src/lib/studio.js`: un solo accesso allo studio — Personal riusa la sessione di Studio salvata nello stesso
  indirizzo (`sb-idklxdqebfceplrualgh-auth-token`, solo se il token ha lo studio); «Esci dallo studio» in Personal resta
  rispettato (`poliedron-personal-studio-scollegato`).
- Resta da fare la prima volta: il collegamento all'archivio personale (progetto Supabase separato) nell'indirizzo dell'app.

## Da fare — passo 2: Personal dentro l'app Poliedron (una sola app installata)
0. NOTA COORDINAMENTO: Codex ha in corso `codex/personal-pdf-manager` (PERSONAL-PDF-MANAGER) che tocca
   `personal/src/App.jsx`, `personal/src/main.jsx`, `personal/src/sezioni/documenti/*` e i manifest di Personal:
   aspettare che sia unito prima di toccare quei file (manifest, scope, rinomina) per non creare conflitti.
0b. Dominio `personal.poliedrasoft.it`: il manifest ha `scope: /personal/`, quindi `/studio` esce dall'app installata;
   portarlo a `scope: /` (dopo il ramo di Codex) e verificare start_url, icone e widget Android (`WIDGET_ORIGIN`).
0c. FATTO (PO 2026-11-08 "Apri sull'agenda settimana"): l'app Poliedron (`/poliedron`) apre sull'agenda in settimana.
1. Montare le sezioni di Personal dentro l'app Studio sul telefono (lazy import da `personal/src/sezioni/*`):
   Oggi, Conti, Personali, Pratiche (legal), Foto, Diario, Biblioteca (didattica). Servono: il `ctx` di Personal
   (`apri`, `vai`, `aggiungi`, `esegui`, `mostra`, `impostazioni`, `chat`…) ricostruito in un adattatore Studio, le
   pagine sovrapposte di Personal (`Pagina.jsx`) e i loro CSS (`personal.css`, `pro.css`, `icone-base.css`) scopati
   per non toccare il desktop.
2. Accesso unico: l'archivio personale è un altro progetto Supabase (`archivioDb`, login separato). Al primo uso
   chiedere una volta il collegamento all'archivio dentro Poliedron, poi sessione ricordata (stessa logica di
   `personal/src/lib/supabasePersonal.js`). Nessun segreto nel repo; nessun contenuto clinico verso modelli.
3. In «Altro» → Vita le tessere aprono le sezioni dentro l'app (non più `href` a Personal).
4. L'indirizzo di Personal (`personal.poliedrasoft.it`, `/personal/`) porta alla stessa app (redirect o stessa build)
   conservando `?sezione=` e i link dei widget Android esistenti; poi rinominare il manifest di Personal / unire i manifest
   e aggiornare `tests/poliedronPersonal.test.mjs` e `tests/personalCaricamento.test.mjs` (oggi si aspettano «Poliedron Personal»).
5. Chat di Poliedron — DECISO (PO 2026-11-08 "tieni la chat che è meglio tenere", scelta di Claude Code): resta il
   **pannello Poliedron di Studio** (tasto centrale del dock), perché agisce su agenda, pazienti, incassi e documenti dello
   studio e ha già i comandi senza AI esterna (PR277). La chat di Personal non si cancella: le sue capacità proprie
   (domande sull'archivio personale, allegati archiviati, promemoria) vanno portate nel pannello come fonte/azioni, poi
   il tasto Poliedron di Personal apre lo stesso pannello. Regola: il contenuto clinico dei pazienti non va mai ai modelli.
6. Test: visual `tests/visual/*` su 375/390/430 per le sezioni importate; nessuna modifica al desktop.

## Da fare — passo 3: Documenti unificati
1. Pagina Documenti unica con filtro **Tutti · Studio · Personale** (come nell'anteprima), avviso scadenze vicine,
   etichetta Studio/Personale su ogni riga, tasto «Acquisisci».
2. Fonti: Studio = `cerca_documenti_studio` (già in produzione, migrazione 20261108130000); Personale = `cerca_documenti`
   dell'archivio (`personal/src/lib/archivio.js`), escluso `clinico_pazienti`.
3. «Acquisisci» chiede dove salvare (Studio o Personale) e usa il flusso giusto (Studio: `AcquisisciDocumento`;
   Personale: `Carica.jsx` / `scansione`).
4. La barra dell'agenda cerca in entrambi gli archivi (oggi Studio cerca solo lo studio, Personal solo il personale).

## Altri punti aperti
- Prova su iPhone vero: barra di ricerca con tastiera, foglio «Crea», acquisizione con fotocamera, modulo appuntamento.
- Ricerca che agisce: frasi più ricche (es. "sposta tutti gli appuntamenti di giovedì"), ripetizioni; sempre con conferma.
- Riferimenti visivi `tests/visual` dell'agenda da riallineare quando cambierà ancora l'aspetto.
- Governance: ogni passo nella sua PR; unione solo dopo «Mergia» del PO e controlli verdi; migrazioni con RLS e test PGlite insieme.
