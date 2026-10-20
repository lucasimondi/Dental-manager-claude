# PERSONAL-ACQUISTI-LAYOUT — 2026-10-20
- Owner Codex; precedente PERSONAL-PAGAMENTI-ACQUISTI; branch codex/personal-acquisti-layout da master 5917fe8e.
- Obiettivo: correggere layout lista acquisti nello screenshot mobile.
- Completato: modulo chiuso inizialmente e apribile da + Aggiungi, pulsante alto 49 px allineato al select, checkbox accanto al nome, categoria su riga propria, testo lungo a capo e CSS limitato alla lista.
- File: personal.css, Acquisti.jsx, current-task e questo handoff.
- Database: nessuna modifica o scrittura dati, nessuna migrazione, script invariato.
- Verifiche: build:personal OK e git diff --check OK; test acquisti 2/2. Nessuna verifica visuale: installazione Chromium fallita per download incompleto.
- Rischi/limiti: nessuno smoke test su iPhone; dati e logica invariati.
- Rollback: revert PR; lista salvata invariata.
- Next: review nuova PR, merge solo con autorizzazione PO; poi controllare pubblicazione.
