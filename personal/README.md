# Poliedron Personal (POL-VITA-001, 003, 004, 005, 006)

App per telefono dell'archivio personale, servita su **`https://personal.poliedrasoft.it/`** (dominio proprio, rewrite per host in `vercel.json`, manifest `personal-dominio.webmanifest`) e anche su `/poliedron/personal/` e `/personal/` del sito dello studio, dalla build principale e installabile sulla schermata Home. Sotto `/poliedron/` il service worker dello studio non interviene, nemmeno nelle copie vecchie rimaste in Safari.
Collegata solo al progetto Supabase `archivio-documenti` (`tkcwvjzjkfhcuebrjvsp`); nessun codice, chiave o service worker dell'app dello studio (verificato da `tests/poliedronPersonal.test.mjs`).

## Sezioni
- **Oggi**: scadenze entro 30 giorni (e quelle già scadute), documenti da gestire, ultimi arrivati.
- **Documenti**: fascicoli e ricerca. Il Core deterministico (`src/lib/coreArchivio.js`, nessun modello AI) risponde a richieste come "Quanto devo a Edison?", "Scadenze di questo mese", "Cosa devo fare?" e "Bollette".
- **+ Carica**: foto o PDF dal telefono. Il file va a Google Drive tramite la web app di `poliedron/archivio/Code.gs` (`doPost`), che verifica a ogni richiesta il token di sessione del proprietario, salva in `Archivio personale/Caricati/<anno>`, cataloga e registra con `registra_documento` (`gmail_message_id` = `caricato:<uuid>`). I documenti clinici non vengono mai letti.
- **Portafoglio**: documenti con il tag `portafoglio` più tutti quelli del fascicolo `identita`. Si aggiungono o tolgono dal dettaglio del documento.
- **Pratiche**: aperte, risolte, tutte.
- **Dettaglio documento**: apri il file su Drive, apri l'email, Portafoglio, scadenze ("Fatta"), dati estratti, sposta fascicolo, elimina dall'archivio (il file su Drive resta).

## Conti, cruscotto e aggiunte (POL-VITA-006)
- **Conti** (nel dock): incassi e spese (tabella `movimenti`), pagamenti da fare dell'archivio e bilancino del mese o dell'anno. Segnare "Pagato" un pagamento registra la spesa (una sola per pagamento); rimetterlo da pagare la toglie.
- **Oggi** è un cruscotto: saldo del mese, azioni rapide, indicatori, agenda, prossimi pagamenti, ultimi documenti con anteprima, pratiche in corso.
- **Documenti**: Recenti, Cartelle (sezioni e fascicoli), Pratiche e sezioni; griglia con le miniature dei file (`azione: 'miniature'` dello script, mai per i documenti dei pazienti; memorizzate nel telefono).
- **Pagine**: il corpo scorre da solo; si chiudono con Indietro, con il tasto rotondo in basso a destra o scorrendo dal bordo sinistro.
- **+**: scansione multipagina (foto → bianco e nero o colori → un PDF), fotocamera, foto, file da iCloud, Drive e altre app, documento personale, spesa, incasso, pagamento da fare, evento.

## Agenda (POL-VITA-004)
È l'agenda dello studio: stessi dati, modificabile dalle due app. Si collega una volta con l'account di Poliedra (sessione propria, persistente).
- Appuntamenti dei pazienti in sola lettura, a blocchi pieni. Si spostano dall'agenda dello studio.
- Eventi personali senza paziente (`impegni_personali`), bianchi con il contorno del colore dell'etichetta. Si creano, modificano ed eliminano da qui; nello studio compaiono con il contorno tratteggiato.
- Etichette e colori in Impostazioni.
- Pagamenti e scadenze dell'archivio in una striscia in alto e nei pallini del mese.
- `lib/studio.js` è l'unico file che conosce il progetto dello studio e tocca solo le tabelle dell'agenda (test in `tests/poliedronPersonal.test.mjs`).

## Chat Poliedron (POL-VITA-005)
Pulsante **Poliedron** in alto e "Chiedi a Poliedron su questo documento" nel dettaglio.
- **Poliedron AI**: la domanda va alla web app di `Code.gs` (`azione: 'chiedi'`, solo il proprietario verificato), dove Claude risponde usando strumenti di sola lettura sull'archivio (ricerca, dettaglio, scadenze, pratiche, riepilogo). La chiave Anthropic resta nelle Proprietà script. Cita i documenti come link apribili.
- **Solo ricerca**: il Core deterministico, senza AI. È anche il ripiego automatico se l'AI non risponde.
- I documenti clinici dei pazienti sono esclusi da ogni risultato passato al modello; l'agenda dello studio non passa dalla chat. Niente invii: al massimo bozze di testo.

## Accesso
Email e password. La sessione resta valida nell'app sulla Home, che su iOS ha una memoria separata da Safari: per questo non si usano link magici.
"Imposta o recupera la password" manda un link (flusso implicito). Il link si apre in Safari: lì si sceglie la password, poi si entra dall'app.
Supabase Auth deve avere `https://dental-manager-acmeproduction.vercel.app/**` tra i Redirect URLs.

## Comandi
```sh
npm run dev:personal     # http://localhost:5174/personal/
npm run build            # include /personal/ in dist/
```

### Agenda — POL-VITA-011
Personal mostra tutte le 24 ore (Giorno/Settimana), indipendentemente dall'orario clinico dello Studio. Il collegamento in alto «Vai a Studio» usa `/studio` sul dominio Personal: è già servito dal rewrite SPA di Vercel e non incontra il redirect della sola `/` verso Personal. Non passa dal dominio tecnico Vercel; conserva data, vista e mese. Le sessioni delle due app restano separate.

I nuovi impegni usano un ID numerico generato dal client, come nello Studio: la tabella esistente richiede `id` e non ha un default. Il messaggio di successo arriva solo dopo la risposta del database; durante il salvataggio il pulsante è disabilitato. Nessuna migrazione.

### Revisione archivio — 19 ottobre 2026
Documenti apre sei aree tematiche virtuali: gli enti sono conservati al loro interno, senza cancellare o spostare file. Le fusioni effettive fra enti restano nella funzione «Unisci cartelle dello stesso ente». Badge rosso per termini scaduti/oggi e arancione entro 14 giorni; documenti con azione richiesta hanno un indicatore arancione.

«Da valutare» è raggiungibile da Oggi, Conti e Documenti. Separa importi da verificare, inviti/opportunità, termini/rinnovi e documenti importanti. Una fattura riferita a un anno precedente resta da verificare anche con un sollecito recente; la conferma esplicita di Luca la rende un pagamento attuale. «Già saldato / risolto» chiude l'avviso senza creare una spesa odierna. Non certifica un movimento bancario.

«Rileggi mail e allegati già archiviati» richiede la nuova versione Apps Script: accoda una scansione a lotti, esclusi clinici e originali foto Drive. Legge allegato e corpo email (fino a 40.000 caratteri), entro quote e limiti AI. Le date già estratte rimangono conservate; non vengono ricalcolati saldi contabili. Se il contenuto non è leggibile la classificazione resta basata sui dati disponibili. La revisione mostra fino a 2.000 scadenze recenti e 50 documenti importanti; non rappresenta una riconciliazione bancaria completa. Nessun invio di messaggi a terzi.

### Area Legal — 19 ottobre 2026
Accesso dal dock e da Documenti. Riusa `pratiche`/`v_pratiche` con fascicolo `legale`: creazione e modifica di titolo, stato, urgenza e note manuali; documenti e scadenze canonici. La catalogazione delle scansioni può usare l'ID di una pratica esistente o crearne una: non riscrive le note manuali. Nessuna nuova scansione avviata da questa modifica.
Dal dettaglio si collegano documenti legali senza pratica (ultimi 300) senza sovrascrivere collegamenti esistenti. I termini manuali hanno data e descrizione, senza importo né movimento contabile. Nell'area legale si usa «Fatta», mai «Pagato». Note modificabili, non storico versionato. Nessuna migrazione o modifica dello script richiesta. Le pratiche classificate in altri fascicoli restano nelle Pratiche generali; Legal non riclassifica retroattivamente gli originali.
