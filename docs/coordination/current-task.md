# Current task — PERSONAL-LEGAL (2026-10-19)
- OWNER: Codex; branch `codex/personal-legal` da master.
- PO: area Legal con tutte le pratiche/recuperi, aggiornamenti manuali e da scansioni.
- SCOPE: sezione dedicata, creazione/modifica pratiche esistenti, collegamento documenti, scadenze non contabili. Nessuna migration/RLS/deploy.
- COMPLETATO: Legal nel dock/Documenti; pratiche legali con modifica manuale, note, stati, urgenza, collegamenti documenti e scadenze senza movimenti. Scansioni riusano pratiche canoniche e preservano note.
- TEST: npm test 1401/1401; build:personal OK; git diff --check OK. Chromium non installato: nessuna prova visiva/iPhone.
- LIMITI: nessuna ricatalogazione retroattiva; documenti collegabili fra ultimi 300 legali; note modificabili senza versioni. Nessun accesso/scrittura produzione, nessun merge/deploy.
- ROLLBACK: revert commit; dati manuali restano nelle pratiche canoniche.
- STATO: WAITING_PRODUCT_OWNER; review PR e merge solo dopo autorizzazione.
