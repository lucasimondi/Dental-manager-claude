# Poliedron Personal (POL-VITA-001, POL-VITA-003)

App per telefono dell'archivio personale, servita su **`/personal/`** dalla build principale e installabile sulla schermata Home.
Collegata solo al progetto Supabase `archivio-documenti` (`tkcwvjzjkfhcuebrjvsp`); nessun codice, chiave o service worker dell'app dello studio (verificato da `tests/poliedronPersonal.test.mjs`).

## Sezioni
- **Oggi**: scadenze entro 30 giorni (e quelle già scadute), documenti da gestire, ultimi arrivati.
- **Documenti**: fascicoli e ricerca. Il Core deterministico (`src/lib/coreArchivio.js`, nessun modello AI) risponde a richieste come "Quanto devo a Edison?", "Scadenze di questo mese", "Cosa devo fare?" e "Bollette".
- **+ Carica**: foto o PDF dal telefono. Il file va a Google Drive tramite la web app di `poliedron/archivio/Code.gs` (`doPost`), che verifica a ogni richiesta il token di sessione del proprietario, salva in `Archivio personale/Caricati/<anno>`, cataloga e registra con `registra_documento` (`gmail_message_id` = `caricato:<uuid>`). I documenti clinici non vengono mai letti.
- **Portafoglio**: documenti con il tag `portafoglio` più tutti quelli del fascicolo `identita`. Si aggiungono o tolgono dal dettaglio del documento.
- **Pratiche**: aperte, risolte, tutte.
- **Dettaglio documento**: apri il file su Drive, apri l'email, Portafoglio, scadenze ("Fatta"), dati estratti, sposta fascicolo, elimina dall'archivio (il file su Drive resta).

## Accesso
Email e password. La sessione resta valida nell'app sulla Home, che su iOS ha una memoria separata da Safari: per questo non si usano link magici.
"Imposta o recupera la password" manda un link (flusso implicito). Il link si apre in Safari: lì si sceglie la password, poi si entra dall'app.
Supabase Auth deve avere `https://dental-manager-acmeproduction.vercel.app/**` tra i Redirect URLs.

## Comandi
```sh
npm run dev:personal     # http://localhost:5174/personal/
npm run build            # include /personal/ in dist/
```
