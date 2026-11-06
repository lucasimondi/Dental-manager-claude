# Foto iCloud → Google Drive, 1000 alla volta

`icloud_drive.py` scarica le foto (e i video) dalla Fototeca iCloud a lotti di 1000, le carica su Google Drive e si ricorda cosa ha già fatto. Ogni volta che lo lanci prende le 1000 foto successive. Con `--continua` va avanti da solo, un lotto dopo l'altro, fino all'ultima foto.

Cosa fa e cosa non fa:
- **Non cancella niente da iCloud.** Legge e copia, basta.
- Su Drive le foto vanno in `Foto iCloud/<anno>/<mese>/` con il nome originale (es. `Foto iCloud/2021/07/IMG_1234.HEIC`). Due foto con lo stesso nome nello stesso mese non si sovrascrivono: alla seconda si aggiunge un pezzo del suo codice iCloud.
- Scarica gli originali (HEIC, JPG, MOV…). I video ci sono; il filmato breve delle Live Photo solo con `--live`.
- Ogni lotto passa per una cartella temporanea sul computer. I file si cancellano da lì solo dopo il caricamento riuscito. Se restano meno di 2 GB liberi il lotto si chiude prima.
- Se lo interrompi (Ctrl+C, computer spento, rete giù), rilanci lo stesso comando e riparte da dove era rimasto senza riscaricare.

Gira sul tuo computer (Mac, Windows o Linux), perché all'inizio Apple chiede il codice di verifica sul telefono.

## 1. Installazione (una volta)

1. **Python 3.10 o più recente.** Sul Mac: `brew install python` (oppure da python.org).
2. **Libreria iCloud.** Da questa cartella:
   ```
   python3 -m venv .venv
   source .venv/bin/activate        # su Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```
3. **rclone per Google Drive.** `brew install rclone` (Windows/Linux: https://rclone.org/install/). Poi:
   ```
   rclone config
   ```
   `n` (nuovo) → nome `gdrive` → tipo `drive` → client id e secret vuoti → scope `1` (accesso completo) → il resto Invio → al login si apre il browser: entra con il tuo account Google. Controlla con `rclone lsd gdrive:`.

   In alternativa, se hai **Google Drive per desktop**, puoi saltare rclone e dare come destinazione la cartella di Drive sul computer (es. `"/Users/luca/Library/CloudStorage/GoogleDrive-…/Il mio Drive/Foto iCloud"`): lo script ci sposta i file e Drive li carica da solo. Con rclone però il disco non si riempie.

4. **Su iPhone** controlla in Impostazioni → [il tuo nome] → iCloud che **"Accedi ai dati iCloud sul web"** sia attivo. Se usi la **Protezione avanzata dei dati**, lo scaricamento da fuori può non funzionare: in quel caso va disattivata.

## 2. Primo lotto

```
python3 icloud_drive.py --apple-id tua@email.com --destinazione "gdrive:Foto iCloud"
```

La prima volta:
- chiede la password dell'ID Apple e se salvarla nel **portachiavi del computer** (rispondi `s` se vuoi i lotti automatici: la password non finisce in nessun file);
- Apple manda un codice di 6 cifre sull'iPhone: scrivilo nel terminale.

La sessione resta valida per circa due mesi; dopo, lo script richiede il codice.

Per vedere quante foto hai e quante sono già su Drive, senza scaricare:
```
python3 icloud_drive.py --apple-id tua@email.com --conta
```

## 3. Tutto in automatico

Un lotto dopo l'altro fino alla fine (pausa di 30 secondi tra un lotto e l'altro):
```
python3 icloud_drive.py --apple-id tua@email.com --destinazione "gdrive:Foto iCloud" --continua
```

Opzioni utili:

| Opzione | Effetto |
|---|---|
| `--lotto 500` | lotti da 500 invece di 1000 |
| `--max-lotti 5` | con `--continua`, si ferma dopo 5 lotti (5000 foto) |
| `--senza-video` | salta i video (molto più veloce, meno spazio) |
| `--live` | aggiunge il video delle Live Photo |
| `--pausa 300` | 5 minuti di pausa tra i lotti |

Puoi anche cambiare idea dopo: se prima usi `--senza-video` e poi lo togli, al giro dopo scarica solo i video che mancano.

### Un lotto ogni notte (Mac)

Per non tenere il computer occupato tutto il giorno, fai partire un lotto alle 2 di notte con `crontab -e` e questa riga (adatta i percorsi):
```
0 2 * * * cd ~/Dental-manager-claude/poliedron/foto-icloud && .venv/bin/python icloud_drive.py --apple-id tua@email.com --destinazione "gdrive:Foto iCloud" --max-lotti 3 --continua >> ~/.icloud-drive-foto/log.txt 2>&1
```
Serve la password salvata nel portachiavi (passo 2). Se il Mac non dà la password a cron (portachiavi bloccato), lancia il lotto a mano o con `--continua` in una finestra di Terminale lasciata aperta. Quando Apple richiede il codice (circa ogni due mesi) il lotto notturno si ferma con un messaggio nel log: rilancia una volta il comando a mano.

## 4. Dove stanno le cose

Tutto in `~/.icloud-drive-foto/` (puoi cambiarla con `--cartella-lavoro`):
- `sessione/`: i cookie di iCloud (riservati, non condividerli);
- `registro.sqlite`: cosa è stato scaricato e caricato, lotto per lotto;
- `temporanei/`: le foto del lotto in corso.

Per ricominciare da zero cancella `registro.sqlite` (Drive non si tocca: rclone non ricarica i file già identici).

## 5. Problemi frequenti

- **"Il remote rclone 'gdrive:' non esiste"**: rifai `rclone config` usando il nome `gdrive`, o metti il tuo nome nella destinazione.
- **Login rifiutato / errore 503 da Apple**: aspetta qualche ora e riprova; Apple limita i login ripetuti.
- **Errori di download su poche foto**: vengono riprovate in automatico al lotto successivo.
- **Chiave di sicurezza fisica** sull'ID Apple: non supportata.

Test (non toccano iCloud): `python3 -m unittest test_icloud_drive.py`
