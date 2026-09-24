# POLIEDRA MARKET READINESS

Avvio: 2026-09-24. Owner: Codex. Base verificata su GitHub:
`master@9e57cf51fc568e1b9acd78cf853d2217c594105e`.
Branch primo intervento: `security/pol-mr-001-tenant-fail-closed`.

## Inventario iniziale in sola lettura

- Checkout precedente: `feature/modulo-incassi@17c26025938c7c5a0d313a9b82d4304e7278a51a`, cinque modifiche locali in AnnualFinancialOverview, FinancialWorkspace, Incassi, PremiumVisualSystem e UploadDocumentoSpesa. Nessun file modificato in quel checkout. Il nuovo clone proviene direttamente da master remoto.
- Golden Rollback verificato con `git ls-remote`: `stable/2026-08-27-full-recovery@070b28fd4eae4e2cc397584201d0bb149468fae7`. Riferimento remoto lasciato intatto.
- `src/lib/supabase.js`: fallback UUID fisso confermato; insert può costruire payload senza tenant; update/delete filtrano solo id; setStudioInfo può terminare senza segnalare il mancato salvataggio.
- `src/lib/useFormPersistente.js`: bozze serializzate in localStorage, TTL logico di due minuti, chiavi prive di tenant/utente. La scadenza impedisce il ripristino ma non elimina fisicamente il valore. Chiamanti includono DocMedico, DocFiscale, Pagamenti e Agenda.
- `src/App.jsx`, makeSyncSetter: insert/update/delete asincroni nel callback di aggiornamento React; non costituiscono una transazione server. Gli errori insert rimuovono ora il record ottimistico: miglioramento presente sul master aggiornato, insufficiente per atomicità e concorrenza.
- Esistono migration, test SQL di finanza/RBAC/assignment/Chat, test Node e CI test/build. Le affermazioni storiche «nessun test/CI» e «nessuna policy versionata» non descrivono più tutto il repository. Non è ancora dimostrata la copertura completa del core.
- current-task registra POL-FIN-009/PR109 come merged, con 815 test storicamente passati. L'ultima entry fisica di handoffs è ancora POL-UI-026 follow-up: disallineamento documentale, non prova sullo stato remoto.
- RLS/grants/RPC/triggers/Storage/Realtime, impostazioni Auth, backup, deploy e advisor remoti NON interrogati in questa sessione. Gli esiti remoti riportati nei vecchi documenti restano evidenze storiche, non verifiche attuali.

## Roadmap e criteri di accettazione

| Ordine | Intervento | Gate di accettazione |
| --- | --- | --- |
| P0 / MR-001 | Tenant fail-closed nell'adapter DB | Nessun fallback; nessuna chiamata dati con tenant/sessione assente o claim invalido; scritture rifiutate con errore; letture vuote; filtri tenant per update/delete; test sintetici A/B e suite/build verdi. Non certifica RLS. |
| P0 / MR-002 | Baseline riproducibile core e isolamento | Inventario completo oggetti e accessi; estrazione metadati remoti autorizzata senza dati paziente; confronto con migration; bootstrap isolato PostgreSQL17; test anon/A/B, membership sospesa/revocata, FK cross-tenant, RPC, Storage privato e Realtime; nessun accesso incrociato. |
| P0 / MR-003 | Bozze sensibili | Censimento completo chiamanti; rimozione persistenza browser dei contenuti sensibili o soluzione protetta approvata; pulizia delle vecchie chiavi; test cambio utente/tenant/logout/scadenza/reload senza recupero improprio. |
| P0 / MR-004 | Operazioni atomiche/idempotenti | Contratti server per ciascun workflow, transazione completa, chiave idempotenza, conflitti espliciti; test retry/doppio click/concorrenza/fallimento parziale e riconciliazione UI. Nessuna formula finanziaria duplicata. |
| P0 / MR-005 | Audit append-only | Mappa degli eventi clinici/finanziari e attore server-side; impedire update/delete non autorizzati; rettifica con nuovo evento; test integrità, accesso minimo e storico invariato. Riutilizzare audit/eventi esistenti dove adeguati. |
| P1 / MR-006 | Auth, MFA, revoca e registrazione | Matrice ruoli; MFA dove stabilito; revoca effettiva provata; claim/membership coerenti; signup senza studio orfano e retry idempotente; test negativi e recupero account. |
| P1 / MR-007 | Backup e continuità | RPO/RTO concordati; verifica PITR e backup separato Storage; restore drill isolato documentato con integrità e tempi misurati. |
| P1 / MR-008 | Sicurezza delivery e affidabilità | CSP/header verificati in staging; dependency/secret scanning; lint/types proporzionati, E2E golden path, carico/concorrenza; alert redatti e monitoraggio con prova di notifica. |
| Gate rilascio | Governance e pilot | Staging separato; docs riallineati; DPIA/DPA/retention/breach validati dai professionisti responsabili; checklist, rollback e review PO; nessun pilot prima della chiusura gate sicurezza. |

Ogni riga richiede branch reversibile, evidenze e handoff. Nessun merge,
deploy, modifica produzione o migration remota è autorizzato da questo avvio.
La roadmap non è una certificazione di conformità né una promessa di assenza di difetti.

## Contratto MR-001

Il browser applica difesa aggiuntiva; l'autorità resta RLS/server. Accettare UUID
PostgreSQL in forma canonica senza imporre version/variant: esistono tenant legacy
con nibble versione zero. Un UUID fisso è ammesso solo come claim esplicito,
mai come default. Usare esclusivamente app_metadata, mai user_metadata.
La rimozione del fallback può rendere inutilizzabili sessioni senza claim: è il
comportamento richiesto; il rimedio è ripristinare membership/claim autorevoli,
non introdurre un altro default. Query dirette, cache React e workflow concorrenti
restano da verificare nei passi successivi.

Riferimento SDK consultato: https://supabase.com/docs/reference/javascript/auth-getsession
(sessione locale, non prova di autorizzazione server).

## Esito MR-001

- Implementato: claim validato, nessun fallback, guardie prima di qualsiasi
  richiesta dati, errore `TENANT_CONTEXT_REQUIRED` sulle scritture senza contesto,
  filtri studio per update/delete, nessun trasferimento studio nel payload update.
  Insert/upsert verificano anche che autore e tenant restituiti da getUser coincidano
  con la sessione. getStudioInfo mantiene la verifica getUser preesistente.
- Validazione locale Node 24.19.0: 23 test comportamentali sul sorgente reale con
  SDK sostituito da stub; tutti i 10 mapping CRUD, studio_info, tenant A/B,
  UUID legacy esplicito, assenza/errori Auth, metadata modificabili, cambio
  tenant/logout, spoofing payload, autore incoerente, errori DB. Sul sorgente base
  gli stessi test producono 22 failure/1 pass; sul fix 23/23 pass.
- Suite completa: `npm test` 838/838, zero skip/failure. `npm run build`: PASS,
  warning chunk oltre 500 kB. Primo tentativo build bloccato dal filesystem sandbox
  Windows, poi riuscito con esecuzione locale autorizzata; nessun deploy.
- `git diff --check`: PASS. Package/lockfile/schema/migration invariati.
- Limiti: nessun test database/RLS o browser autenticato eseguito; query dirette
  fuori dall'adapter e race con cambio sessione durante una richiesta dipendono
  ancora dai controlli server. Update/delete senza righe interessate conservano
  il contratto preesistente; conflitti/atomicità sono MR-004. Nessuna garanzia
  sull'isolamento remoto può essere dedotta dagli stub.
- Rollback: revert del commit MR-001 sul branch di sviluppo; non spostare stable.
  Il revert reintrodurrebbe il fallback e va quindi valutato come rollback di
  sicurezza, non come rimedio per account privi di claim.
- Prossimo passo: MR-002, inventario core e piano test SQL isolati, poi confronto
  metadati remoti solo nel perimetro autorizzato. Merge e produzione richiedono
  l'approvazione esplicita del Product Owner.
