# Current task — POL-VITA-017 (seguito) Personal: Agenda e Documenti in file più piccoli (2026-10-18)
- OWNER: CLAUDE, branch `claude/document-layout-management-vaktuz`, ripartito da `master@75aeba7` (PR #217 e #218 mergiate). PO verbatim: "Dividi sezioni" (proposta: dividere ancora le sezioni più grandi).
- COSA: `sezioni/agenda/Agenda.jsx` (509) → `Agenda.jsx` (vista ed elenco del giorno, 167), `Evento.jsx` (nuovo/modifica evento, serie, 237), `Appuntamento.jsx` (appuntamento dello studio, 114). `sezioni/documenti/Documenti.jsx` (425) → `Documenti.jsx` (vista, 130), `Selezione.jsx` (elenco con selezione multipla e fogli di scelta, 227), `Filtri.jsx` (barra dei filtri, 43), `Ricerca.jsx` (pagina di ricerca, 45). Import ridotti a quelli usati. Nessun cambiamento visibile; nessuna modifica a database, script, Studio o `shared/agenda`.
- TEST: verifiche esistenti spostate sui file nuovi (Evento, Selezione), fixture visiva su Evento/Appuntamento.
- VALIDATION: `npm test` 1335/1335; build OK; eslint (no-undef, jsx-no-undef, no-unused-vars) pulito; visita guidata Chromium 390×844 master↔branch: 21 schermate (anche ricerca, selezione multipla, nuovo appuntamento) con testo identico, nessun errore; `test:agenda:visual` e reliability Chromium OK; WebKit in CI.
- EXACT NEXT ACTION: su "Mergia" del PO → PR, CI verde, merge.

---

