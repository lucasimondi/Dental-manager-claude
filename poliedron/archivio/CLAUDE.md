# Archivio personale: istruzioni per Claude Code

Questa cartella (`poliedron/archivio/`) contiene il sistema che importa, cataloga e tiene sotto controllo i documenti di Luca arrivati come allegati Gmail. Leggi questo file per intero prima di agire. Se qualcosa qui è in conflitto con una richiesta di Luca, vale la richiesta di Luca. Le regole della sezione 3 fanno eccezione: in quel caso fermati e chiedi conferma.

## 1. Architettura

| Pezzo | Dove gira | File |
|---|---|---|
| Motore di importazione | Google Apps Script sull'account di Luca (trigger ogni 10 min + riepilogo alle 7) | `Code.gs`, `appsscript.json` |
| Indice e logica | Supabase, progetto `archivio-documenti` | `schema.sql`, `aggiornamento-lotti.sql` |
| Originali | Google Drive: `Archivio personale/<Categoria>/<anno>` e `Archivio personale/Persone/<Persona>` (POL-VITA-013) | creati e spostati dallo script |
| Consultazione | Dashboard web (Vercel) e in futuro Poliedron | `index.html` |
| App per telefono | Poliedron Personal su `/personal/` (consultazione, Portafoglio, caricamento) | `personal/` nella radice del repo |
| Caricamento dall'app | Web app dello stesso Apps Script (`doPost`), file in `Archivio personale/Caricati/<anno>`; anche anteprima, miniature (mai dei pazienti) e chat | `Code.gs` |
| Cartelle dell'app (POL-VITA-016) | Una cartella per ente: vista `v_cartelle`, tabella `cartelle_ente` (etichette, note, sintesi; la vecchia tabella `cartelle` dello schema iniziale non si usa e non si tocca), promemoria = `scadenze.cartella`, RPC `rinomina_cartella`; azioni `cartella` (sintesi AI) e `bozza` (bozza di risposta in Gmail, mai invii) di `doPost`, mai i clinici | `supabase/archivio/migrations/`, `Code.gs` |
| Stato, suggerimenti e notifiche (POL-VITA-018) | `cartelle_ente.stato` (aperta, in attesa, chiusa) e `stato_dal`; vista `v_suggerimenti_cartelle` (stesso dominio del mittente) e `suggerimenti_ignorati`; azione `suggerisci` di `doPost` (proposte dell'AI, mai i clinici); notifiche: funzione Supabase `notifiche-personal` (chiavi VAPID create da lei in `push_chiavi`, mai lette dall'app), iscrizioni in `push_iscrizioni`, invii in `push_inviate`, chiamata da `inviaNotifiche_()` alle 7 e ogni ora 8–21 | `supabase/archivio/functions/notifiche-personal/`, `Code.gs` |
| Conti dell'app | Tabella `movimenti` (incassi e spese di Luca, RLS proprietario). Incassi "Studio" e "Collaborazione" si registrano solo nello studio (`payments` / `pagamenti_esterni`, POL-VITA-022); Conti legge dallo studio il lavoro netto (pazienti + collaborazioni − `spese`) e lo somma al bilancio. `studio_tabella`/`studio_riga` non usate | `supabase/archivio/migrations/` |
| Testo completo e ricerca (POL-VITA-034) | Drive legge ogni file (OCR italiano per PDF e immagini, conversione per Word/Excel, più il corpo dell'email) in `estraiTesti_()`, un po' a ogni giro di `elabora` (`leggiTestiOra()` a mano); testo in `documenti_testo` (RLS: solo lettura del proprietario, scrittura solo con la chiave di servizio), coda `documenti_senza_testo`, avanzamento `v_testo_avanzamento`. Nessun modello. I clinici non vengono mai aperti e la tabella rifiuta o toglie il loro testo. `cerca_archivio_v2` cerca anche nel testo; la chat la usa (`cercaArchivio_`, ripiego su `cerca_documenti`) e legge i dati precisi con `testo_documento` (passaggi, mai i clinici) | `Code.gs`, `supabase/archivio/migrations/20261116120000_pol_vita_034_testo_completo.sql` |
| Ricerca per significato (POL-VITA-035) | Vettori Gemini (`gemini-embedding-001`, 768, proprietà facoltativa `GEMINI_VETTORI_MODELLO`) calcolati da `calcolaVettori_()` (20 per giro, `calcolaVettoriOra()` a mano; quota finita → `VETTORI_PAUSA_FINO` 3 ore) sul testo di `testo_per_vettore` (scheda + 2000 caratteri del testo completo); tabella `documenti_vettori` (pgvector, HNSW, RLS come `documenti_testo`), coda `documenti_senza_vettore` (solo non clinici con testo letto e non escluso), RPC `cerca_significato`, avanzamento `v_significato_avanzamento`. La chat unisce parole e significato (`fondiRisultati_`); l'app chiede i «Simili per significato» con l'azione `significato` di `doPost`. Mai i clinici: niente vettore (la tabella lo rifiuta e lo toglie) e mai nei risultati. A Gemini vanno solo scheda e inizio testo dei non clinici (come per l'analisi) e la domanda | `Code.gs`, `supabase/archivio/migrations/20261116150000_pol_vita_035_significato.sql`, `…151000_pol_vita_035_significato_esclusi.sql` |
| Ricerca nel contenuto con Drive (2026-11-17) | `cercaNelContenuto_()`: la ricerca di Drive (`fullText contains`, nessun modello) trova i file che contengono le parole, anche quelli il cui testo non è ancora in `documenti_testo`; si tengono solo i file registrati in `documenti` e mai `clinico_pazienti`. La chat la unisce a parole e significato (`nel_testo: true`); l'app la chiede con l'azione `contenuto` di `doPost` («Trovati dentro i file» in Chiedi). `testoPulito_()` toglie i caratteri che Postgres rifiuta e un testo rifiutato non ferma più la coda. Se la chat chiede il testo di un file non ancora letto, `leggiSubito_()` lo legge al momento come la coda e lo salva (mai i clinici: `escluso` senza aprire il file) | `Code.gs`, `personal/src/sezioni/documenti/Chiedi.jsx` |
| Documenti firmati e cartelle gemelle (2026-11-17) | Ogni cartella di «Le mie cartelle» (`cartelle_mie`) ha, dal primo file salvato lì, la gemella su Drive in `Archivio personale/<cartella>` (`drive_cartella_id`; `cartellaDriveDi_()`, nome e padre allineati a ogni giro da `allineaCartelleDrive_()`). «Documenti firmati» è la cartella speciale (`speciale = 'firmati'`, `cartellaFirmati_()`). Il caricamento dall'app con `firmati`/`cartella` crea il file lì con nome = titolo scelto, `drive_fissa = true` (`ordinaDrive_` non lo sposta) e lo aggiunge alla cartella. Azioni `titolo_suggerito` (modello solo per i non clinici), `destinatari_risposta` (mittente, A e Cc dell'email originale, Luca escluso) e `bozza_allegato` (bozza Gmail con il file: risposta nella stessa conversazione alle persone scelte da Luca con la Gmail API, servizio avanzato Gmail; se non disponibile email nuova alle stesse persone; oppure email nuova; mai inviata) | `Code.gs`, `personal/src/pdf/SalvaArchivio.jsx`, `supabase/archivio/migrations/20261117120000_documenti_firmati.sql` |
| Schede delle pratiche (LEGAL-SCHEDE, 2026-11-18) | Azione `scheda_pratica` (`schedaPratica_()`): legge i documenti della pratica e quelli della stessa controparte, scrive in `pratiche_schede` sintesi, punti salienti e cose da attenzionare con i documenti di origine, e i passi come promemoria di «Da fare» con `pratica_id` (senza doppioni). Mai i pazienti: un solo documento clinico e la pratica non va a nessun modello. `aggiornaSchede_()` rifà al massimo una scheda all'ora quando arrivano documenti nuovi | `Code.gs`, `personal/src/sezioni/legal/`, `supabase/archivio/migrations/20261118210000_legal_schede.sql` |
| Concordato (2026-11-20) | Beni immobili di Luca dalla visura (`concordato_beni`: dati catastali, quota di Luca e di Anna, vincoli, valore dell'intero bene) e proposte di divisione con Anna (`divisione_scenari`: a chi va ogni bene, voci di conguaglio). Solo app Personal (sezione Concordato) e Claude Code in sessione; nessun modello, nessun dato dei pazienti | `personal/src/sezioni/concordato/`, `personal/src/lib/concordato*.js`, `supabase/archivio/migrations/20261120100000_concordato.sql` |
| Guida manuale | per Luca | `LEGGIMI.md` |

Riferimenti fissi:
- Supabase project ref: `tkcwvjzjkfhcuebrjvsp`, URL `https://tkcwvjzjkfhcuebrjvsp.supabase.co`, regione `eu-central-1`.
- Publishable key (pubblica, già in `index.html`): `sb_publishable_oJeCgTR2TiLKJmC9L_kiFA_mL4hb48f`.
- Accesso ai dati: RLS limitata a `luca.simondi@gmail.com` (funzione `e_proprietario()`).
- Etichette Gmail: `Archivio/Elaborato` (fatto), `Archivio/Errore` (da riprovare).
- Modello di analisi: `CONFIG.MODELLO` in `Code.gs`.

## 2. Specifica dell'importazione (fonte di verità)

Importa tutti gli allegati Gmail, escludendo Promozioni e Social, **dal più vecchio al più recente, a lotti** (un lotto corrisponde a un mese di posta). Per ogni allegato:

1. Calcola lo SHA-256 del file e salta quelli già importati (stesso hash).
2. Salva l'originale su Drive in `Archivio personale/<Categoria>/<anno>` (anno del documento, altrimenti dell'email). I documenti delle persone elencate nelle Impostazioni dell'app vanno in `Archivio personale/Persone/<Persona>`. `ordinaDrive_()` sposta a ogni giro i file fuori posto (anche dopo un cambio di categoria o persona dall'app) e annota la cartella in `drive_cartella`; `sistemaDrive()` lo fa a mano per ~5 minuti. Si sposta, non si copia né si cancella: id e link restano uguali. Le vecchie cartelle anno/mese restano vuote.
3. Leggi il file e classificalo in uno di questi fascicoli: `identita`, `immobili`, `successione`, `conti`, `fiscale`, `previdenza`, `utenze`, `riscaldamento` (pellet, legna, gasolio, GPL, caldaie e stufe; aggiunto il 2026-10-15 su richiesta di Luca), `studio_fornitori`, `studio_fatture_emesse`, `legale`, `assicurazioni`, `veicoli`, `famiglia_scuola`, `sanitario_famiglia`, `clinico_pazienti`, `servizi`, `acquisti`, `formazione` (corsi ECM, congressi, tesi), `personale_studio` (curriculum e candidature), `corrispondenza` (email personali, catene), `foto_video`, `pubblicita` (volantini, listini, offerte non richieste), `altro` (solo se nient'altro va bene; le cinque categorie nuove sono state aggiunte il 2026-10-16 su richiesta di Luca). Ogni documento ha anche `ente` (chi lo ha emesso o riguarda, nome sempre uguale) e `rilevanza` (alta, normale, bassa: le cose poco utili si nascondono nell'app).
4. Registralo in Supabase con `registra_documento(jsonb)`, compilando questi campi: `hash_sha256`, `gmail_message_id`, `gmail_thread_id`, `email_oggetto`, `email_mittente`, `email_data`, `nome_file_originale`, `mime_type`, `dimensione_byte`, `drive_file_id`, `drive_url`, `fascicolo`, `tipo_documento`, `titolo`, `riassunto` (2 righe), `data_documento`, `importo`, `tag[]`, `azione_richiesta`, `azione_descrizione`, `urgenza` (bassa/media/alta), `dati_estratti{}`, `pratica {id_esistente | nuova_titolo}`, `soggetti[{nome, tipo, ruolo}]`, `scadenze[{data, descrizione, importo}]`.
5. Raggruppa nella stessa pratica i documenti della stessa vicenda (stesso soggetto e stesso oggetto). I titoli delle pratiche seguono il formato "Soggetto – oggetto", per esempio "Fornitore luce – via Roma 1" per fatture, solleciti e preavvisi della stessa utenza.
6. I documenti dei pazienti vanno in `clinico_pazienti`, **senza riassunto clinico**.
7. Alla fine di ogni lotto produci un resoconto: email a Luca più una riga in `lotti_importazione`.

Riordino (POL-VITA-007): `riordinaLotto_()` rilegge 30 documenti a ogni giro di `elabora` usando solo i dati già in archivio (mai i file, mai i clinici) e corregge fascicolo, tipo, titolo ("Tipo – Ente – riferimento"), ente, rilevanza e tag; titolo e fascicolo di prima restano in `titolo_originale` e `fascicolo_originale`. `riordinaDaCapo()` lo fa ripartire.

Limite di spesa dell'API: se Claude risponde che il limite è raggiunto, lo script si mette in pausa per un'ora (`API_PAUSA_FINO`) e non segna le email come errore. Dal 2026-10-17 (POL-VITA-013, richiesta di Luca) l'importazione **continua senza Claude**: `analisiDiRiserva_()` assegna fascicolo, tipo, ente e titolo con regole su oggetto, nome del file e mittente (nulla esce dallo script), il documento resta `da_analizzare` con il tag "da analizzare". Quando l'API torna disponibile, `analizzaRimasti_()` rilegge pochi documenti a ogni giro (mai i clinici; se le regole cliniche li riconoscono finiscono in `clinico_pazienti`) e completa il catalogo con l'RPC `completa_analisi`. Riordino e analisi aspettano la fine della pausa. Dopo aver alzato il limite su console.anthropic.com, Luca può eseguire `riprovaErrori` (toglie la pausa e rimette in coda tutte le email in errore).

Chat di Poliedron: con Claude in pausa risponde Gemini (`chatGemini_`, stessi strumenti). Gemini di riserva (2026-10-18, richiesta di Luca: "Ma se usassimo Gemini per analizzarli?", piano **gratuito** scelto da lui): se la proprietà `GEMINI_API_KEY` esiste, con Claude in pausa `analizza_()` passa a Gemini (`modello_()` → `gemini_()`, modello `GEMINI_MODELLO` o `CONFIG.MODELLO_GEMINI`) con lo stesso prompt e lo stesso JSON; `apiInPausa_()` vuol dire ora "nessun modello", `claudeInPausa_()` solo Claude. Il riordino aspetta Claude. Con Claude in pausa anche sintesi delle cartelle, bozze di risposta e cartelle suggerite passano a Gemini (`testoAI_`, 2026-10-18, Luca: "Dobbiamo usare anche api gemini"); i clinici restano esclusi prima della chiamata. Più modelli in ordine (`CONFIG.MODELLI_GEMINI` o `GEMINI_MODELLO` con nomi separati da virgola, prima Flash-Lite; 2026-11-15, Luca: "sistema Gemini"): quota del giorno finita su un modello → solo quel modello in pausa fino all'azzeramento (mezzanotte del Pacifico, `GEMINI_PAUSE`) e si passa al successivo; modello inesistente o con limite 0 → saltato per 7 giorni; chiave rifiutata → `GEMINI_PAUSA_FINO` per 3 ore. Catalogo a regole solo quando tutti i modelli sono fermi. `riprovaGemini()` toglie le pause. I documenti dei pazienti non arrivano mai a Gemini (stessi controlli `eClinico_` prima di `analizza_`).

Rinomina su Drive (2026-11-15, Luca: "Rinomina anche i file su drive"): i documenti con `drive_rinomina = true` prendono il nome `<data>_<titolo>.<ext>` a ogni giro di `elabora` (`rinominaDrive_`, a mano `rinominaDriveTutto()`); mai i clinici, mai i file caricati dall'app o messi su Drive da Luca; solo rinomina, id e link invariati.

Email importanti senza allegati (2026-11-16, Luca: "Iniziamo così 1 2 basta link 3 si"): `importaEmail_()` a ogni giro guarda le conversazioni senza allegati (mai Promozioni, Social, chat) dal `EMAIL_DAL` (ultimi 12 mesi; `emailAncheStorico()` allarga di altri 12) e ne registra una scheda per conversazione se un partecipante è un mittente già in archivio nelle categorie importanti o una PEC, se l'oggetto ha parole come diffida/sollecito/preavviso/pignoramento/decreto/udienza, o se Luca ha risposto a un indirizzo non personale. Esclusi i messaggi automatici (Klarna, AliExpress, ricevute pagoPA/IO, codici) e tutto ciò che sembra clinico (`EMAIL_CLINICO`, più severo di `eClinico_`). La scheda ha `mime_type = 'message/rfc822'`, `hash_sha256 = 'email:<threadId>'`, nessun file su Drive e `drive_url` = link a Gmail; etichette `Archivio/Email` (importata) e `Archivio/Email vista` (scartata). `analizzaRimasti_()` legge il testo della conversazione (mai i clinici); i messaggi nuovi in una conversazione già importata la rimettono da leggere (`aggiornaEmail_`). Solo lettura ed etichette: niente invii, spostamenti o cancellazioni.

`Code.gs` implementa già tutto questo. Se modifichi lo script, la specifica resta il riferimento.

## 3. Regole non negoziabili

- **Segreti.** Non scrivere mai chiavi segrete (Supabase secret/service_role, chiave API Anthropic, chiave Gemini, token) nei file del repository, nei commit o nei log. Le chiavi segrete stanno solo nelle Proprietà script di Apps Script (`SUPABASE_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) o in variabili d'ambiente locali non versionate.
- **Pazienti.** Il contenuto dei documenti clinici dei pazienti non va mai inviato a un modello o a un servizio esterno. Se tocchi `eClinico_()`, puoi solo ampliare i criteri, mai restringerli.
  Decisione di Luca del 2026-11-16 (domanda esplicita sul filtro clinico, risposta: "Toglilo del tutto"): Claude Code, nelle sessioni con Luca, può leggere e riassumere anche i documenti e le email cliniche. Lo script resta invariato finché l'unico modello disponibile è Gemini **gratuito**, perché nel piano gratuito Google può usare i dati per l'addestramento: Claude non ha attivato l'invio dei dati dei pazienti a quel servizio. Quando Luca ricarica l'API Claude o passa a Gemini a pagamento, l'apertura dello script ai clinici va proposta di nuovo.
- **Niente invii a terzi.** Non inviare email, PEC o messaggi a nome di Luca. Prepara solo bozze. Le uniche email automatiche ammesse sono quelle dello script a Luca stesso (resoconto lotti e riepilogo giornaliero).
- **Niente cancellazioni.** Non cancellare email, file su Drive o righe con dati. Le pratiche si archiviano, non si eliminano.
  Eccezione decisa da Luca il 2026-10-16: dall'app Personal Luca può scegliere, documento per documento o con la selezione multipla e dopo una conferma, di eliminare documenti dall'archivio e, se spunta la casella, anche i loro file da Drive. I file vanno nel Cestino di Drive (recuperabili per 30 giorni), solo se registrati in archivio, compresi quelli dei pazienti. Claude non lo fa mai di sua iniziativa.
  Seconda eccezione decisa da Luca il 2026-10-18 ("si possano cancellare anche le mail indietro e i documenti allegati che non servono"; risposte esplicite: "Cestino Gmail", pazienti "Sì, se lo chiedo"): la chat di Poliedron può **proporre** pulizie in massa (`proponi_eliminazione`, `proponi_rianalisi`, `proponi_risolvi_pratiche`); niente si esegue senza la conferma di Luca nell'app, dove vede l'elenco e può togliere ciò che vuole tenere. All'eliminazione confermata: file nel Cestino di Drive, email nel Cestino di Gmail (`cestinaEmail_`, solo se tutti gli allegati archiviati di quell'email sono eliminati; mai i caricati dall'app; mai eliminazione definitiva), poi le righe. I documenti dei pazienti entrano in una proposta solo se Luca li nomina nella domanda, e i loro titoli non vanno mai al modello; la rianalisi non li tocca mai.
- **Database.** Solo migrazioni additive e idempotenti (`create ... if not exists`, `create or replace`). Prima di qualsiasi modifica distruttiva serve la conferma esplicita di Luca.
- **Clinica.** Non usare dati dei pazienti per nessuna analisi, report o statistica.

## 4. Fase 1: installazione (una volta sola)

Esegui i passaggi in ordine e verifica ognuno prima di passare al successivo. Quando un passaggio richiede Luca (login, autorizzazioni, chiavi), fermati, spiegagli esattamente cosa fare e aspetta la sua conferma.

1. **Database.** Lo schema base è già installato. Verifica che esista la tabella `lotti_importazione`. Se manca, applica `aggiornamento-lotti.sql`: con il server MCP di Supabase se è configurato, altrimenti chiedi a Luca di incollare il file nel SQL Editor.
2. **Apps Script con clasp.**
   - Luca attiva l'Apps Script API su https://script.google.com/home/usersettings.
   - Installa clasp: `npm i -g @google/clasp`.
   - Esegui `clasp login`. Il login avviene nel browser di Luca.
   - Dentro questa cartella esegui `clasp create --type standalone --title "Archivio personale" --rootDir .`. Il comando genera `.clasp.json`, che contiene solo lo scriptId e può essere versionato.
   - Crea `.claspignore` con questo contenuto:
     ```
     **/**
     !Code.gs
     !appsscript.json
     ```
   - Esegui `clasp push -f`, poi `clasp open` per dare a Luca il link all'editor.
3. **Chiavi.** Luca le inserisce a mano nell'editor, in Impostazioni progetto > Proprietà script:
   - `SUPABASE_URL` = `https://tkcwvjzjkfhcuebrjvsp.supabase.co`
   - `SUPABASE_KEY` = la secret key, da Supabase > Project Settings > API Keys
   - `ANTHROPIC_API_KEY` = da console.anthropic.com, con un limite di spesa impostato
   - facoltative: `DASHBOARD_URL`, `EMAIL_DIGEST`

   Tu non devi né vedere né chiedere i valori.
4. **Avvio.** Luca esegue `setup` dall'editor e autorizza. Poi esegue `elabora` una volta a mano. Verifica:
   - che esista la cartella Drive `Archivio personale`;
   - che `documenti` contenga righe;
   - che `log_elaborazione` sia vuota o con errori comprensibili.
5. **Dashboard.** Pubblica `index.html` su Vercel: dalla cartella con il solo `index.html` esegui `vercel deploy --prod`, oppure usa il connettore Vercel. Poi Luca imposta l'URL in Supabase > Authentication > URL Configuration > Site URL e nella proprietà `DASHBOARD_URL`. Dopo il primo accesso, Luca disattiva le nuove registrazioni in Authentication.

## 5. Fase 2: controllo dell'avanzamento

Quando Luca chiede "a che punto siamo", esegui queste query in sola lettura e riassumi i risultati in poche righe:

```sql
-- ultimi lotti
select periodo, documenti, duplicati, errori, per_fascicolo, nuove_pratiche, urgenti
from lotti_importazione order by periodo desc limit 5;

-- totali per fascicolo
select fascicolo, count(*) from documenti group by 1 order by 2 desc;

-- errori recenti
select creato_il, riferimento, left(errore, 300) from log_elaborazione order by creato_il desc limit 20;

-- pratiche urgenti aperte con prossima scadenza
select titolo, fascicolo, n_documenti, ultima_attivita, prossima_scadenza
from v_pratiche where stato in ('aperta','in_corso') and urgenza = 'alta'
order by prossima_scadenza nulls last;

-- scadenze nei prossimi 30 giorni o scadute negli ultimi 90
select s.data, s.descrizione, s.importo, d.titolo
from scadenze s join documenti d on d.id = s.documento_id
where not s.completata and s.data between current_date - 90 and current_date + 30
order by s.data;
```

Se ci sono thread in errore, leggi la causa in `log_elaborazione`. Se è transitoria (rete, quota), spiega a Luca come eseguire `riprovaErrori`. Se è un bug, correggi `Code.gs` (fase 3).

## 6. Fase 3: manutenzione

- **Modifiche allo script.** Dopo ogni modifica a `Code.gs`: controlla la sintassi con `cp Code.gs /tmp/c.js && node --check /tmp/c.js`, poi `clasp push -f`, poi commit.
- **Pratiche doppie** (stessa vicenda divisa in due). Unisci B in A e archivia B senza cancellarla:
  ```sql
  update documenti set pratica_id = '<A>' where pratica_id = '<B>';
  update scadenze  set pratica_id = '<A>' where pratica_id = '<B>';
  update pratiche  set stato = 'archiviata', note = coalesce(note,'') || ' Unita in <A>.' where id = '<B>';
  ```
  Prima di eseguire, mostra a Luca le due pratiche.
- **Dopo lo storico.** Proponi a Luca di eseguire `select archivia_pratiche_ferme(12);` per chiudere le vicende ferme da oltre un anno.
- **Riclassificazioni.** `update documenti set fascicolo = '...' where id = '...'`. Il file su Drive segue da solo al giro successivo (`ordinaDrive_`).

## 7. Fase 4: integrazione in Poliedron

Poliedron (`poliedron/`) deve diventare l'interfaccia principale dell'archivio. Per l'integrazione:
- Riusa le query di `index.html`: viste `v_conteggi_fascicoli` e `v_pratiche`, RPC `cerca_documenti` e `archivia_pratiche_ferme`, tabelle `documenti`, `scadenze`, `pratiche`, `lotti_importazione`.
- Usa l'autenticazione Supabase via email. Lato client va solo la publishable key.
- Per i documenti mostra sempre il link all'originale su Drive (`drive_url`) e all'email (`https://mail.google.com/mail/u/0/#all/<gmail_message_id>`).
- Tutte le azioni verso terzi (risposte, solleciti, istanze) producono bozze, mai invii.
