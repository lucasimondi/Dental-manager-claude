# ANDROID-AGENDA-ICON — icona launcher di Poliedra Agenda

PO (2026-11-07): "Lavora graficamente all'icona che sembra poco professionale".
L'icona precedente (`drawable/ic_agenda.xml`) era un quadrato verde #00887F con
blocchi bianchi; ritagliata dalle maschere del launcher perdeva la forma.

## Nuova icona

- Icona adattiva (`mipmap-anydpi-v26/ic_launcher*.xml`, minSdk 26 → nessun PNG):
  - sfondo: gradiente blu Poliedra #1767D6 → #0A1C64 con faccette appena visibili
    (richiamo alla gemma di `public/poliedron-v2-*.png`);
  - primo piano: calendario bianco con testata turchese, anelli, griglia dei giorni
    e un giorno evidenziato in blu; ombra morbida; tutto nella zona sicura 66dp;
  - monocromatica per le icone a tema di Android 13+.
- Manifest: `android:icon="@mipmap/ic_launcher"` e `android:roundIcon`.
- APK 0.3.1 (versionCode 4) per aggiornare l'icona sopra l'installazione esistente.
- Anteprima (prima, cerchio, squircle, 48px, monocromatica):
  `docs/architecture/android-agenda-icon-preview.png` (render Chromium dei tracciati SVG equivalenti).

Solo presentazione: nessun codice Java, widget, dati o database modificati.

## Verifica

XML ben formati. Gradle/aapt2 non disponibili in questa sessione: `assembleDebug`
e `lintDebug` girano nella CI Android della PR. Nessuna prova su dispositivo.
Rollback: revert del commit.
