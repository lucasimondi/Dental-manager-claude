# Archivio Documenti — installazione

Tre pezzi:
- **Supabase** (piano gratuito): l'indice con dati estratti, soggetti, scadenze e pratiche.
- **Google Apps Script**: il motore che legge Gmail, analizza con Claude e archivia su Drive.
- **Dashboard** (`index.html` su Vercel): per consultare, cercare, scaricare e gestire.

Tempo di installazione: circa 30 minuti.

---

## 1. Supabase

1. Crea un progetto su supabase.com. Come regione scegli **Central EU (Frankfurt)**.
2. Apri **SQL Editor**, incolla tutto `schema.sql` ed esegui con **Run**.
   L'accesso è limitato a `luca.simondi@gmail.com`. Se vuoi entrare con un'altra email, cambiala nella funzione `e_proprietario()` prima di eseguire.
3. In **Project Settings > API Keys** copia tre valori:
   - l'URL del progetto (`https://xxxx.supabase.co`);
   - la **publishable key**, che va nella dashboard;
   - la **secret key**, che va solo nello script e non va mai inserita nella dashboard.

## 2. Chiave API di Claude

1. Su console.anthropic.com crea una chiave in **API Keys**.
2. In **Billing**, imposta un **limite di spesa mensile**. Il recupero dello storico è la fase che costa di più, e il limite ti protegge da sorprese.

## 3. Google Apps Script

1. Vai su script.google.com e crea un **Nuovo progetto** chiamato "Archivio Documenti".
2. Sostituisci il contenuto di `Code.gs` con il file fornito.
3. Nel menu a sinistra, alla voce **Servizi**, aggiungi **Drive API**. Serve per leggere i file Word ed Excel.
4. In **Impostazioni progetto > Proprietà script** aggiungi:

   | Proprietà | Valore |
   |---|---|
   | `SUPABASE_URL` | URL del progetto Supabase |
   | `SUPABASE_KEY` | secret key di Supabase |
   | `ANTHROPIC_API_KEY` | chiave di Claude |
   | `DASHBOARD_URL` | (facoltativo) indirizzo della dashboard |
   | `EMAIL_DIGEST` | (facoltativo) a chi mandare il riepilogo |

5. Seleziona la funzione **`setup`**, premi **Esegui** e autorizza gli accessi richiesti (Gmail, Drive, connessioni esterne).
6. Fai una prova: esegui **`elabora`** a mano e controlla tre cose:
   - su Drive compare la cartella **Archivio personale**, con gli originali divisi per anno e mese;
   - in Supabase, nella tabella `documenti`, ci sono le prime righe;
   - in Gmail i thread elaborati hanno l'etichetta **Archivio/Elaborato**.

Da qui in poi lavora da solo: ogni 10 minuti elabora i nuovi allegati, e alle 7 di ogni mattina ti manda il riepilogo, ma solo se c'è qualcosa da fare.

## 4. Dashboard

1. In `index.html` incolla in alto `SUPABASE_URL` e la **publishable key**.
2. Pubblica il file su Vercel. Puoi farlo da vercel.com trascinando la cartella con `index.html`, oppure posso pubblicarlo io con il connettore Vercel.
3. In Supabase, alla voce **Authentication > URL Configuration**, imposta come **Site URL** l'indirizzo della dashboard.
4. Apri la dashboard, inserisci la tua email e apri il link che ricevi.
5. Dopo il primo accesso, in **Authentication > Sign In / Providers** disattiva **Allow new users to sign up**. Anche senza questo passaggio nessun altro potrebbe vedere i dati, ma così l'accesso è chiuso del tutto.

---

## Come funziona il recupero dello storico

Lo script importa dal più vecchio al più recente, un lotto per volta (un lotto = un mese di posta). Alla fine di ogni lotto con documenti salva il resoconto nella tabella `lotti_importazione` e te lo manda via email: documenti importati, duplicati saltati, errori, conteggio per fascicolo, nuove pratiche e documenti urgenti. Per non ricevere le email imposta `EMAIL_PER_LOTTO: false`. Sugli account Google gratuiti gli script automatici hanno un tetto di tempo di esecuzione giornaliero (circa 90 minuti). Quando lo raggiunge si ferma e riprende il giorno dopo da solo. Con alcune migliaia di allegati, il recupero completo richiede da qualche giorno a un paio di settimane.

Quando ha finito, apri **Pratiche** nella dashboard e usa **Archivia le pratiche ferme da oltre 12 mesi**. Restano aperte solo le questioni ancora vive.

## Privacy

- I **documenti clinici dei pazienti** vengono riconosciuti in due modi: dal dominio del mittente o destinatario (`CLINICO_DOMINI`) e da parole chiave nell'oggetto o nel nome del file (`CLINICO_PAROLE`). Vengono archiviati su Drive e catalogati, ma **il loro contenuto non viene mai inviato a Claude**. Puoi ampliare entrambe le liste in cima a `Code.gs`.
- Se vuoi tenere fuori dall'analisi anche i documenti sanitari di famiglia, aggiungi i domini delle strutture (per esempio `ieo.it`) a `CLINICO_DOMINI`.
- I file restano privati sul tuo Drive. La dashboard mostra solo i link, che si aprono esclusivamente con il tuo account Google.
- Attiva la verifica in due passaggi su Google, Supabase, Vercel e Anthropic.

## Manutenzione

- **Thread in errore**: hanno l'etichetta **Archivio/Errore**. Per rimetterli in coda esegui `riprovaErrori`. Gli errori sono registrati nella tabella `log_elaborazione`.
- **Categoria sbagliata**: dal dettaglio del documento nella dashboard usa **Sposta**.
- **Modello**: si cambia in `CONFIG.MODELLO`. Quello predefinito è economico e adatto allo smistamento.
- **Duplicati**: ogni file viene identificato dal suo contenuto (hash SHA-256), quindi lo stesso allegato ricevuto più volte viene archiviato una volta sola.
