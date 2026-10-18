# Current task — POL-VITA-018 Personal: cartelle suggerite, notifiche sul telefono, stato delle cartelle (2026-10-18)
- OWNER: CLAUDE. BRANCH: `claude/catalogazione-facile-latjs9` da `master@d4ed1347` più merge di `origin/master` (fino a `3b8bbb27`).
- RICHIESTA PO (verbatim): "Ok vai con tute e tre" — le tre proposte dopo POL-VITA-016: cartelle suggerite dall'AI, notifiche sul telefono per i promemoria, stato della cartella (aperta/in attesa/chiusa) con elenco "in attesa da più di 15 giorni".
- FATTO: (1) Proposte "Cartelle da unire": dal database (stesso dominio del mittente, domini generici esclusi, max 8 cartelle per proposta) e, a richiesta, dall'AI (`suggerisci`); Luca sceglie cartelle e nome, "Unisci" (rinomina una a una) o "Non unire" (per sempre). (2) Notifiche: service worker `/personal/sw-notifiche.js` (solo push, nessuna cache), `lib/notifiche.js` (iPhone: solo app sulla schermata Home), sezione in Impostazioni (Attiva, Invia una prova, Spegni); funzione Supabase `notifiche-personal` (web push, chiavi VAPID generate e tenute da lei, una notifica al giorno per promemoria, mai clinici, prova solo per il proprietario); lo script la chiama alle 7 e al massimo ogni ora 8–21. (3) Stato: Aperta/In attesa/Chiusa in cartella (con data), badge nell'elenco, filtri Attive/Aperte/In attesa/Chiuse, avviso "in attesa da più di 15 giorni".
- DATABASE: migrazione additiva `20261018150000_pol_vita_018_stato_suggerimenti_notifiche.sql` applicata (nome in Supabase: `pol_vita_017_stato_suggerimenti_notifiche`).
- DEPLOY: funzione `notifiche-personal` v1 (verify_jwt false, autenticazione propria per la prova); chiavi create al primo giro dello script, nessun errore. Script versione 12 (contiene anche Gemini di riserva di PR #218: la mia versione 11 l'aveva tolta per qualche minuto, ripristinata unendo master).
- VALIDATION: `npm test` 1347/1347 (Node 20; +14 test `personalNotificheStato`); build OK; Chromium 390×844: avviso di attesa, badge, filtro, proposta OPT unita (2 rinomine), stato salvato, AI ferma con messaggio; nessun errore.
- LIMITI: la notifica reale va provata sull'iPhone (app sulla schermata Home, Impostazioni › Notifiche sul telefono › Attiva); proposte AI ferme finché Claude è in pausa.
- STATO: in revisione (PR).

---

# Current task — POL-VITA-017 (seguito) Personal: Agenda e Documenti in file più piccoli (2026-10-18)
- OWNER: CLAUDE, branch `claude/document-layout-management-vaktuz`, ripartito da `master@75aeba7` (PR #217 e #218 mergiate). PO verbatim: "Dividi sezioni" (proposta: dividere ancora le sezioni più grandi).
- COSA: `sezioni/agenda/Agenda.jsx` (509) → `Agenda.jsx` (vista ed elenco del giorno, 167), `Evento.jsx` (nuovo/modifica evento, serie, 237), `Appuntamento.jsx` (appuntamento dello studio, 114). `sezioni/documenti/Documenti.jsx` (425) → `Documenti.jsx` (vista, 130), `Selezione.jsx` (elenco con selezione multipla e fogli di scelta, 227), `Filtri.jsx` (barra dei filtri, 43), `Ricerca.jsx` (pagina di ricerca, 45). Import ridotti a quelli usati. Nessun cambiamento visibile; nessuna modifica a database, script, Studio o `shared/agenda`.
- TEST: verifiche esistenti spostate sui file nuovi (Evento, Selezione), fixture visiva su Evento/Appuntamento.
- VALIDATION: `npm test` 1335/1335; build OK; eslint (no-undef, jsx-no-undef, no-unused-vars) pulito; visita guidata Chromium 390×844 master↔branch: 21 schermate (anche ricerca, selezione multipla, nuovo appuntamento) con testo identico, nessun errore; `test:agenda:visual` e reliability Chromium OK; WebKit in CI.
- EXACT NEXT ACTION: su "Mergia" del PO → PR, CI verde, merge.

---

