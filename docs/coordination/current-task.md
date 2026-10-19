# Current task — PERSONAL-FOTO-DOCK-DRIVE (2026-10-19)
- OWNER: Codex, branch `codex/personal-foto-dock-drive`, da master. Richiesta diretta PO: area Foto più visibile nel dock, importazione delle foto caricate su Drive dal cellulare e catalogazione.
- COMPLETATO: Foto nel dock con vista autonoma; importazione periodica a pagine delle immagini possedute su Drive, data di scatto se disponibile e album dalla cartella. Deduplica per identità Drive, recupero dopo errori, originali non copiati/spostati/rinominati. Nessun invio del contenuto ai modelli. Non importa da Google Foto o dal rullino del telefono.
- DATABASE: nessuna migrazione. Usa registro e campi album/data già esistenti. Identità `drivefoto:<id>` nel campo testuale hash_sha256, distinta dagli hash di contenuto; non deduplica copie con ID Drive diversi.
- DEPLOY: script Apps Script da pubblicare dopo merge; nessuna credenziale clasp disponibile qui. Importazione reale non ancora eseguita/verificata.
- VALIDATION: npm test 1387/1387; build:personal OK (avviso bundle grande); ulteriori verifiche e PR nel handoff.
- NEXT: review PR; merge solo con approvazione PO, poi pubblicazione script aggiornata da master e verifica primo lotto reale.


---

Task precedente (storico):

# Current task — Personal swipe delete (2026-10-19)
- OWNER: Codex. Branch `codex/personal-swipe-delete`.
- Richiesta PO: swipe a sinistra per eliminare documenti/allegati e cartelle anche da Drive.
- Implementazione: gesture con conferma, Drive prima dell’archivio, cartelle complete, esclusione clinici. Nessuna migration o deploy script.
- VALIDATION: npm test 1385/1385; npm run build OK; git diff --check OK.
- Stato: pronta per review; nessuna prova su iPhone fisico. Merge solo su approvazione PO.
