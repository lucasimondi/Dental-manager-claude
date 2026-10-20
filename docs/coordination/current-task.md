# Current task — PERSONAL-STARTUP (2026-10-20)
- OWNER: Codex; branch `codex/personal-startup`, base master 473b5014.
- PO: apertura Personal rapida, con riferimento iCal.
- SCOPE: download differito schermate; metadati dock sincroni; comandi Home disponibili prima del riepilogo; riepilogo indipendente dall'attesa agenda Studio.
- PREVIOUS: PERSONAL-ACQUISTI-LAYOUT conservato nello storico.
- STATUS: WAITING_PRODUCT_OWNER — PR #233; merge non eseguito, dopo controlli completati.
- DATABASE / AUTH / DEPLOY ARCHITECTURE: nessuna modifica; nessuna cache di dati privati.
- VALIDATION: CI sul commit 6bff9555: suite Node 1403/1403, build Vite e controllo grafo startup OK (436381 byte JS non compressi, 9 schermate differite). Controllo browser agenda separato da verificare sulla PR; nessuna misura iPhone fisico.
- ROLLBACK: revert PR. Nessuna migrazione.
