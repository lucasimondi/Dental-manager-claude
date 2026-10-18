# Copia di iCloud sul computer

`scarica_icloud.py` scarica sul tuo computer una copia di:

- **Posta** di iCloud Mail: ogni messaggio come file `.eml` (si apre con Mail, Outlook, Thunderbird), diviso per cartella;
- **iCloud Drive**: tutti i file con le loro cartelle;
- **Foto**: tutte le foto e i video in originale, ordinati per anno e mese.

È in sola lettura: su iCloud non cancella, non sposta e non segna come letto niente. Puoi rilanciarlo quando vuoi: scarica solo quello che manca.

## Prima volta (circa 10 minuti)

1. **Python 3.10 o più recente.** Su Mac: apri Terminale e scrivi `python3 --version`. Se manca, installalo da python.org.
2. **Scarica questa cartella** (`poliedron/archivio/icloud/`) sul computer, poi nel Terminale:
   ```
   cd percorso/della/cartella/icloud
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
3. **Password per la posta.** Vai su https://account.apple.com > Accesso e sicurezza > Password specifiche per le app, creane una (es. "Backup posta") e tienila a portata di mano. La posta non accetta la password normale dell'Apple ID.
4. **Accesso web a iCloud.** Su iPhone: Impostazioni > [il tuo nome] > iCloud > "Accedi ai dati di iCloud sul web" deve essere attivo. Se hai la "Protezione avanzata dei dati", Drive e Foto si scaricano solo con questa opzione attiva.

## Uso

Sempre dalla cartella, con `source .venv/bin/activate` fatto:

```
python3 scarica_icloud.py tutto --apple-id TUO_APPLE_ID --email-icloud TUO_INDIRIZZO@icloud.com
```

Oppure una parte alla volta: `posta`, `drive`, `foto` al posto di `tutto`.

- `--apple-id`: l'email con cui entri in iCloud.
- `--email-icloud`: l'indirizzo @icloud.com (o @me.com) della posta; serve solo se è diverso dall'Apple ID.
- `--destinazione`: dove salvare (predefinito: cartella `Backup-iCloud` nella tua home). Puoi indicare un disco esterno, es. `--destinazione /Volumes/Disco/Backup-iCloud`.

Lo script chiede a video:
- la password specifica per l'app (posta);
- la password dell'Apple ID e il codice a 6 cifre che compare sull'iPhone (Drive);
- di nuovo la password dell'Apple ID per le Foto (e il codice, se Apple lo richiede).

Nessuna password viene salvata. Apple ricorda l'accesso per circa due mesi nella cartella `~/.pyicloud` (fuori dal repository): nei giri successivi il codice di solito non serve.

## Cosa trovi

```
Backup-iCloud/
  posta/<Cartella>/uidvalidity-<n>/<data>_<numero>.eml
  drive/<cartelle di iCloud Drive>/...
  foto/<anno>/<mese>/...
```

## Tempi e spazio

La prima volta può durare ore (le foto soprattutto). Controlla di avere spazio sufficiente: in Impostazioni > [il tuo nome] > iCloud vedi quanto occupa ogni parte. Se si interrompe, rilancia lo stesso comando: riparte da dove era arrivato.

## Problemi comuni

- **"Accesso a iCloud Mail non riuscito"**: usa la password specifica per l'app e l'indirizzo @icloud.com in `--email-icloud`.
- **Drive o Foto non entrano**: controlla il punto 4 (accesso web a iCloud), poi riprova.
- **Un file di Drive "non scaricato"**: rilancia `drive`, riprova solo quelli mancanti.

## Nota sull'archivio

Questi file restano sul tuo computer. Non entrano da soli nell'Archivio personale (quello lavora sugli allegati Gmail): se vorrai catalogarli lì andrà deciso a parte, tenendo fuori i documenti clinici dei pazienti.
