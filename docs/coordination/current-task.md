# Current task — PERSONAL-REVISIONE-ARCHIVIO (2026-10-19)
- OWNER: Codex; branch `codex/personal-revisione-archivio`, da master.
- PO: meno cartelle, lettura contenuti, badge scadenze, documenti importanti con proposte, verifica vecchi pagamenti, inviti separati.
- IN CORSO: aree tematiche virtuali, revisione senza inventare debiti, classificazione scadenze, lettura completa in Apps Script.
- Produzione: sola lettura autorizzata dal PO; nessun backfill/deploy. Merge dopo review PO.
- IMPLEMENTATO: sei aree virtuali (enti conservati), badge scadenze, Da valutare con verifica saldo e inviti separati. Conferme storiche senza creazione spesa odierna; decisione esplicita da pagare conservata nei tag. Rilettura Apps Script a lotti su richiesta autenticata; testo mail fino a 40k, regole legali corrette.
- DATABASE: nessuna migration/RLS/auth modificata. Nessuna scrittura produzione. Accesso read-only ai dati estratti per verificare gli errori segnalati.
- LIMITI: non è una fusione fisica di tutte le cartelle; revisione 2000 scadenze recenti/50 documenti; nessuna prova iPhone; script da pubblicare con credenziali clasp non presenti. Nessuna rilettura originale avviata.
- VALIDATION FINALE: suite completa 1397/1397; test mirati finali 19/19; build:personal OK; node --check Code.gs e git diff --check OK.
- STATO: WAITING_PRODUCT_OWNER dopo PR. Pubblicazione Apps Script ancora necessaria.
