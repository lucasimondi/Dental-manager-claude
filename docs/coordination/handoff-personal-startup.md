# PERSONAL-STARTUP — 2026-10-20
- Owner: Codex, precedente PERSONAL-ACQUISTI-LAYOUT.
- Branch: codex/personal-startup da master 473b5014.
- Obiettivo: ridurre il lavoro all'avvio Personal e rendere subito disponibili i comandi Home.
- Completato: componenti schermata importati su richiesta, mantenendo registro e titoli sincroni; Suspense locale con messaggio errore e Riprova; foglio Aggiungi differito; comandi e acquisti Home prima dei dati; riepilogo archivio visualizzato prima di sessione/appuntamenti Studio; guardia effetto smontato.
- File: App.jsx, Differito.jsx, indici sezioni, Oggi.jsx, test startup e coordinamento.
- Database, sicurezza, API, script e dati produzione: nessuna modifica.
- Verifiche: ambiente locale non disponibile; CI nella PR da verificare. Nessun benchmark browser/iPhone eseguito.
- Rischi: il primo accesso a una schermata richiede il suo chunk; la connessione e la sessione restano dipendenze. Questo intervento non dimostra prestazioni pari a iCal. Nessuna cache persistente di contenuti personali.
- Rollback: revert PR; nessuna migrazione.
- Prossimo passo: controllare diff, test/build remoti e asset della build; merge soltanto dopo approvazione PO.

- Verifica remota completata su 6bff9555: 1403/1403 test Node, build Vite e controllo grafo startup OK; 436381 byte JS non compressi nel grafo iniziale; tutte le 9 schermate differite. Il numero non è un tempo di apertura né un confronto con la versione precedente. CI browser agenda e preview: stato finale nei controlli PR #233.
- Stato: WAITING_PRODUCT_OWNER. Nessun merge. Il presente aggiornamento cambia solo la documentazione.
