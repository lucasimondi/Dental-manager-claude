# Poliedra Scan — Android con scanner Google (ML Kit)

SCAN-MLKIT (PO 2026-11-12: «Ml kit»). App Android che apre la pagina Scan di Personal (`https://personal.poliedrasoft.it/scan/`) in una WebView e sostituisce la fotocamera con lo **scanner documenti di Google** (ML Kit `play-services-mlkit-document-scanner`): inquadratura dal vivo con bordo evidenziato, scatto automatico, raddrizzamento, rimozione di ombre e dita, filtri, più pagine, importazione dalla galleria. Gratuito; il riconoscimento avviene sul telefono (il modulo è scaricato da Google Play Services la prima volta).

## Come funziona
- Ogni «Scatta» della pagina (input file con `capture`) apre lo scanner Google: fino a 20 pagine dove la pagina accetta più file (Scanner, tasto fotocamera), 1 pagina per fronte/retro della Carta d'identità e Estrai testo. Le pagine tornano come `scan-mlkit-*.jpg` già raddrizzate (la pagina non le raddrizza di nuovo).
- Senza Google Play Services aggiornati si apre la scelta normale (fotocamera o galleria) con un avviso.
- «Da album», «Da file», PDF: scelta file di Android (WebChromeClient). Conferme `confirm()` visibili.
- Condividi (file e testo) e Scarica/Salva passano dal ponte `PoliedraScan` (AndroidX WebMessageListener, solo origine `https://personal.poliedrasoft.it`, solo frame principale; nessun `addJavascriptInterface`): foglio «Condividi» di Android e «Salva in…».
- «Condividi → Poliedra Scan» e «Apri con → Poliedra Scan» (PDF e foto) aprono il file in Scan.

## Privacy
Solo il permesso INTERNET (la fotocamera è dello scanner Google). File di lavoro nella cache privata dell'app, svuotata a ogni avvio; condivisioni tramite FileProvider non esportato. Backup disattivato, `FLAG_SECURE` (niente anteprima nelle app recenti). SSL errati annullati, niente cleartext, niente accesso file/content per la WebView. Accesso a Personal con la stessa login (la sessione della WebView è separata da Chrome).

## Build
JDK 17, Android SDK 35, Gradle 8.11.1: `gradle -p android/scan :app:assembleDebug :app:lintDebug`. Il workflow `Android Scan (ML Kit)` compila l'APK su ogni PR; dopo il merge pubblica `poliedra-scan.apk` nella pre-release fissa `scan-android`. APK firmato in debug: versione di prova, non Play Store. Prova sul telefono reale necessaria (fotocamera, Play Services, condivisione).
