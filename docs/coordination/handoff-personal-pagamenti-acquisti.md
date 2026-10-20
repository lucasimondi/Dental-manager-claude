
## 2026-10-20 — Codex — PERSONAL-PAGAMENTI-ACQUISTI
- OWNER: Codex; precedente PERSONAL-LEGAL; branch `codex/personal-pagamenti-acquisti` da master.
- OBJECTIVE: rendere verificabili i totali per categoria e inserire lista acquisti in Home.
- COMPLETED: categorie espandibili ai pagamenti canonici, riassunto/oggetto email nel dettaglio e indicazione fonte assente; lista acquisti con categorie, spunta, ripristino, rimozione comprati. Errori mostrati; doppio invio bloccato.
- FILES: Conti/Pagamento/Oggi, nuovo Acquisti.jsx e lib/acquisti.js, README, test e coordinamento.
- DATABASE: riuso impostazioni_app con chiave per acquisto e policy proprietario esistente. Nessun cambio schema/RLS, nessuna scrittura produzione. Query read-only per rintracciare il totale segnalato. Dati privati esclusi da test/commit.
- VALIDATION: suite esistente 1401/1401; due nuovi test comportamentali 2/2; build:personal OK; git diff --check OK. Browser Chromium non disponibile: nessuna verifica visuale/iPhone. Warning build preesistenti.
- LIMITS: lista aggiornata al caricamento Home/refresh, non realtime; ultima modifica della stessa voce prevale; niente push, voce in chat, scadenze o ricorrenze. Non modificata classificazione o stato dei pagamenti.
- ROLLBACK: revert PR; acquisti salvati restano nelle impostazioni senza impatto contabile.
- NEXT: review PR e merge con autorizzazione PO; verifica su iPhone dopo pubblicazione. Nessun deploy/merge eseguito.
