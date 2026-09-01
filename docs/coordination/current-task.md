# Current task

- TASK: POL-FIN-005 — ROUND 3 (production fix + merge)
- TITLE: "Da incassare" was genuinely empty in production — root cause found and fixed, PR merged to master
- OWNER: CLAUDE, on direct Product Owner report ("per il da incassare è a 0?") after round 2's preview, then explicit "mettiamo a posto poi mergiamo, poi facciamo il resto".
- BRANCH: `feature/modulo-incassi` → merged to `master`.
- STATUS: MERGED.
- ROOT CAUSE (confirmed by querying production directly, not guessed): `public.get_saldi_aperti_studio(p_studio_id)` calls `private.financial_has_tenant_access_v1(p_studio_id)`, which internally re-derives "the current studio" from the JWT via `private.financial_current_studio_v1()` and compares it to `p_studio_id` — it never actually trusts the value the RPC itself was given. `financial_current_studio_v1()` only accepts a JWT `app_metadata.studio_id` claim that matches a strict UUID-version/variant regex (`[1-5]` version nibble, `[89ab]` variant nibble) — added by `20260821120000_pol_003a_tenant_access_fix.sql`. Studio Simondi's real `studio_id` (`00000000-0000-0000-0000-000000000001`) has a `0` version nibble, so the regex rejects it, the comparison never succeeds, and the RPC silently returns zero rows for every caller regardless of real membership or real balances — confirmed by querying `private.incassi_plan_saldo_v1` directly: **~10,997€ in genuinely open balances**, matching exactly what the fixed RPC returns after the fix (verified below). Controllo di gestione's other figures (Prodotto, Incassato, EBITDA) were unaffected because `get_financial_drilldown_v1`/`get_financial_snapshot_v1` already had this exact bug fixed by the same `20260821120000` migration — they independently verify a caller-supplied `p_studio_id` via `private.financial_verified_studio_membership_v1` (a plain `studio_users` active-membership check, no JWT/regex dependency) and set a transaction-local override `financial_current_studio_v1()` prefers; `get_saldi_aperti_studio` (POL-FIN-002/003) predates that fix and was never updated to use it.
- FIX: new migration `supabase/migrations/20260901150000_pol_fin_005_saldi_aperti_tenant_fix.sql` — gives `get_saldi_aperti_studio` the identical verify-then-override pattern already used by the two POL-003A RPCs (reusing `private.financial_verified_studio_membership_v1` unchanged; no regex touched, no RLS policy touched, no new authorization surface). Applied directly to production (`idklxdqebfceplrualgh`) via `apply_migration` after explicit Product Owner go-ahead.
- VERIFICATION (all via direct SQL against production, not assumed):
  1. Simulated an authenticated call as `luca.simondi@gmail.com` (real `sub`/`app_metadata.studio_id` from `auth.users`) — `get_saldi_aperti_studio` now returns **12 rows, totale 10.997€**, matching the manual sum from `private.incassi_plan_saldo_v1` exactly.
  2. Simulated a DIFFERENT authenticated user (a different studio's account) requesting Studio Simondi's `p_studio_id` — correctly rejected with `POL-FIN-005: access denied` (cross-tenant isolation intact).
  3. `get_advisors(security)`: **54 findings total (52 WARN + 2 INFO) — identical to the established baseline**, zero new findings, nothing mentioning `get_saldi_aperti_studio`/`saldi_aperti`/`financial_current_studio`.
- SEPARATE FINDING, NOT FIXED HERE (explicitly deferred by Product Owner — "poi facciamo il resto"): "Prodotto" in Controllo di gestione is NOT a live figure. `public.financial_line_events_v1` (feeding `PRODOTTO`/`ACCETTATO`/etc.) is a plain table with **zero triggers** on `plans`/`payments` — its 17 `PRODOTTO` rows for this studio all share the exact same `created_at` (2026-08-19 14:21:55), i.e. a one-time manual backfill, frozen since. Any prestazione marked eseguita after that date is invisible to "Prodotto". This is the same gap `get_financial_snapshot_v1`'s own `data_quality_status: 'PO_SEMANTICS_LOCKED_LEGACY_ADAPTER_PENDING'` already documents. A prior CODEX session already investigated this (branch `feature/POL-FIN-003-management-canonical`, **PR #77, never merged**): first attempt cut Cockpit/Proiezioni over to the canonical snapshot, found the adapter gap, reverted, then proposed showing an explicit "source pending" notice instead of presenting stale/zero canonical figures as real — that correction was never merged into `master`, so today's Controllo di gestione still presents the frozen 2026-08-19 snapshot with no indication it's stale. Building the real fix (a live sync from `plans.voci[].eseguita`/`payments` into the event-sourcing tables) is a substantial task, tracked separately, not started.
- MERGE: PR opened `feature/modulo-incassi` → `master`, merged by explicit Product Owner instruction ("mergiamo").
- VALIDATION: full `npm test` 624/624 (unchanged by this round — server-side fix only); `npm run build` clean; `git diff --check` clean.
- EXACT NEXT ACTION: Product Owner re-tests "Da incassare" live in production (should now show real balances). Next task (explicitly deferred, "poi facciamo il resto"): design and build the live Prodotto/canonical-engine adapter, and/or revisit PR #77's "don't show stale-as-live" notice as an interim step.

---

# Previous current task

- TASK: POL-FIN-005 — ROUND 2
- TITLE: Incassi buttons reorganized to 3 (allega/registra incasso/registra da incassare), Controllo di gestione mobile cards + PDF/Excel export + click-to-month-detail confirmed
- OWNER: CLAUDE, on direct Product Owner follow-up after testing round 1's preview.
- BRANCH: `feature/modulo-incassi` (same branch, continued — no new branch, not pushed as of this entry's writing... see EXACT NEXT ACTION).
- STATUS: IMPLEMENTED, awaiting push/QA.
- PRODUCT OWNER REQUEST (verbatim, Italian): "in incassi i tasti devono essere: allega foto o pdf, registra incasso, registra da incassare. quando alleghiamo foto o pdf il lettore riconoscerà estratto conto o contabile o altro, il da incassare lo abbiamo già spiegato. in controllo, bisogna che su mobile la tabella sia responsive e ci stia nello schermo, inoltre deve essere possibile estrarre il pdf o excel da quella tabella, deve anche essere possibile cliccare i mesi della tabella in modo che si vada in visualizzazione mensile dettagliata."
- WHAT SHIPPED:
  1. **Incassi.jsx — three distinct toolbar buttons**: "Allega foto o PDF" (was "Leggi estratto conto"), "Registra incasso" (now purely manual amount — the manuale/ricevuta toggle from round 1 was removed), "Registra da incassare" (was "Aggiungi voce da fatturare"/"Aggiungi da incassare", same underlying `saveReceivable` behavior, only relabelled — the Product Owner said this one was "already explained", i.e. no new behavior needed). "Allega foto o PDF" now handles BOTH document types with no upfront classification: the AI extraction (`estrai-pagamenti-estratto-conto`, unchanged) always returns a row array; the UI branches client-side on `righe.length` — one row (a single receipt/"contabile") routes straight into the "Registra incasso" form, prefilled, patient still to pick; more than one row (a bank statement) opens the existing multi-row review table. No new edge function, no AI document-type classification invented — the row count alone is enough to route correctly.
  2. **AnnualFinancialOverview.jsx — mobile-responsive ledger**: below the `useIsMobile()` breakpoint, the 12-month table is replaced by one stacked card per month (Mese + EBITDA in the head, Prodotto/Incassato/Costi fissi/Costi variabili in a 2-column grid), plus a totals card — same click-through to the monthly detail, same data, no horizontal scroll needed on a phone. Desktop/tablet keep the real `<table>` unchanged from round 1.
  3. **PDF/Excel export**: new `src/lib/annualLedgerExport.js` — `exportAnnualLedgerCsv` (semicolon-separated CSV with a UTF-8 BOM so accented characters and Excel's Italian locale — comma as decimal separator — both work; no new dependency, a `.csv` opens directly in Excel) and `exportAnnualLedgerPdf` (reuses `jspdf`, already a dependency and already used by `src/lib/pdfDocs.js` for every other document in this app; a manual table draw, no `jspdf-autotable` plugin since this project doesn't have it installed and 12 rows/6 columns doesn't need it). Both read the exact same `months`/`totals` the on-screen table already computes — no separate data path, so the export can never disagree with what's displayed. Two small "Esporta PDF"/"Esporta Excel" buttons added next to the ledger's own header.
  4. **Click a month → detailed monthly view, confirmed and made visible**: `openMonth(index)` already switched `view` to `'month'` (round 1) but the detail card renders ABOVE the table the user just clicked in, so nothing seemed to happen unless they scrolled up manually. Added a `detailRef` + `scrollIntoView({behavior:'smooth'})` on click, so tapping a month now visibly jumps to its detail.
  5. **Tests**: full suite **624/624** (12 new/updated: 2 replaced in `tests/incassiSection.test.mjs` for the 3-button reorg and the single/multi-row routing; 4 new in `tests/annualFinancialOverviewExcel.test.mjs` for the mobile cards, the scroll-into-view, and the export wiring, plus a new `tests/annualLedgerExport` coverage folded into the same file for the export module itself). `npm run build` clean. `git diff --check` clean.
- SAFETY: no migration/RLS/schema change; no new dependency (jsPDF already present, CSV needs none); the AI extraction endpoint and its security model are unchanged from POL-FIN-004, only how the frontend routes its result changed.
- NOT VERIFIABLE IN THIS SESSION: authenticated live QA — in particular the real single-receipt-vs-multi-row routing with a real AI extraction call, the actual on-screen mobile card layout on a real phone, and that the exported PDF/CSV files open correctly in real Excel/PDF viewers (built and reasoned about, not opened by a human here).
- EXACT NEXT ACTION: push this branch (same `feature/modulo-incassi`) and hand the Product Owner an updated preview link. Open a PR only if explicitly asked. Do not merge without explicit approval.

---

# Previous current task

- TASK: POL-FIN-005
- TITLE: Incassi — sezione unificata, "Incassa" reale dal saldo aperto, incasso con foto/PDF; Controllo di gestione — tabella "excel" con totali e andamento annuale
- OWNER: CLAUDE, su richiesta diretta Product Owner dopo aver testato la preview di un round di lavoro precedente (branch `feature/modulo-incassi`, commit `17c2602`, non di questa sessione — vedi nota sotto) che aveva già introdotto `FinancialWorkspace.jsx`/`AnnualFinancialOverview.jsx`.
- BRANCH: `feature/modulo-incassi` — continuato da questa sessione sullo stesso branch (nessun nuovo branch), non pushato, nessuna PR aperta.
- STATUS: IMPLEMENTATO, NON ANCORA PUSHATO/PR — in attesa di istruzione esplicita del Product Owner.
- NOTA DI CONTINUITÀ: al momento di riprendere questo task, questa sessione ha scoperto che `master` era avanzato di suo (PR #78 POL-FIN-003 "collegamento esplicito payments.piano_id", PR #80 POL-FIN-004 "lettura AI estratto conto", entrambe mergiate) e che il branch `feature/modulo-incassi` aveva 3 commit nuovi non fatti da questa sessione (`7f1865a` "simplify management hub and patient navigation", `314c002` "unify incassi and payments workspace", `17c2602` "add incassi tabs and annual overview") — riportati dal Product Owner in chat come "fatto e pubblicato in preview" con relativo commit/test/build. Confermato via `git merge-base --is-ancestor` che questi commit erano già basati sul `master` più recente. Il fix precedente di questa stessa sessione sul toggle "Incassata"/"Da incassare" (branch `claude/pol-ui-017-mobile-home-r2-3pizhn`, basato sul VECCHIO modello FIFO pre-POL-FIN-003) non è mai stato mergiato né pushato in `feature/modulo-incassi` — è rimasto sul suo branch, superato dall'architettura `piano_id` esplicito nel frattempo. Il lavoro descritto sotto riparte quindi da zero sul modello attuale (payments.piano_id esplicito), non riusa quel fix.
- RICHIESTA PRODUCT OWNER (testuale): "incassi deve avere sia incassato che da incassare in stessa sezione, cliccabili e che diano elenco incassi ed elenchi da incassare, a loro volta segnabili come incassati (e quindi aggiornino il paziente anche). deve esserci il tasto incasso che dia scelta di mettere cifra o fare foto o allegare foto o pdf. sezione controllo gestione, le voci devono essere come un excel pi eventualmente cliccabili ma pro. vista mensile deve essere selzionabile appunto il mese, vista annuale deve contenere tutti i mesi anche con un andamento."
- COSA È STATO FATTO:
  1. **Sezione Incassi unificata** (`src/components/Incassi.jsx`): "Incassato" e "Da incassare" sono ora due riquadri KPI **cliccabili nella stessa pagina** (`activeView` state, non più due tab/pagine separate) — cliccando uno si apre, sotto, il relativo elenco (saldi aperti, oppure la lista "Incassi registrati" — quest'ultima prima viveva solo dentro `Pagamenti.jsx`, ora è integrata direttamente qui). "Pagamenti da assegnare" e "Leggi estratto conto" (POL-FIN-003/004) restano intatti, mostrati sotto la vista "Da incassare".
  2. **Ogni saldo aperto è segnabile come incassato da qui** — nuovo bottone "Incassa" per riga in "Saldi aperti", apre il modale "Registra incasso" prefilato con paziente/piano/importo (=saldo). Salvando scrive un vero pagamento (`payments` con `piano_id`, `stato:'pagato'`) tramite il normale `setPayments` sincronizzato — mai un flag cosmetico — quindi muove per davvero `get_saldo_piano`/`get_saldi_aperti_studio`, che è la stessa fonte letta dal widget "Situazione finanziaria" di `SchedaPaz.jsx`: segnare un incasso da qui aggiorna per davvero il paziente, come richiesto.
  3. **Un solo tasto "Registra incasso"**, riusato da: (a) il bottone di toolbar (vuoto), (b) l'azione "Incassa" per riga (prefilata), (c) l'arrivo dalla quick action Home "Pagamento" (stesso pattern `autoOpenNew`/`onAutoOpenNewHandled` già usato ovunque in app). Offre la scelta tra **importo manuale** (default) e **foto/PDF della ricevuta**: quest'ultima riusa `UploadDocumento` con lo stesso endpoint AI già esistente `estrai-pagamenti-estratto-conto` (una ricevuta singola è solo un estratto conto di una riga — nessuna nuova edge function), che precompila importo/data/nota lasciando comunque salvare esplicitamente. Coerente con l'assenza deliberata, già documentata in questo repo, di un sistema di allegati persistiti ("Missione futura — allegati in Poliedron", `docs/POLIEDRA_MASTER_CONTEXT.md` §32): la foto/PDF viene letta, mai salvata come documento — stesso confine già rispettato da "Leggi estratto conto".
  4. **`FinancialWorkspace.jsx`** semplificato: non più uno switcher a tab tra `Incassi.jsx`/`Pagamenti.jsx` — ora mostra `Incassi.jsx` come unica vista primaria (che è già la sezione unificata sopra); "Collaborazioni esterne" (incassi non-paziente, funzione distinta e già esistente) resta raggiungibile da un bottone secondario che apre `Pagamenti.jsx` in un Modal con un nuovo prop additivo `soloEsterno` (nasconde lo switcher e la vista "Studio" ora ridondante con Incassi.jsx; aggiunto anche un bottone "Aggiungi incasso esterno" nel corpo, che prima mancava quando il componente era embedded — gap preesistente, sistemato di passata).
  5. **Controllo di gestione — tabella "excel"** (`src/components/AnnualFinancialOverview.jsx`, `PremiumVisualSystem.css`): la vista mensile ha già (invariato) il selettore mese; la vista annuale mostrava già tutti i 12 mesi nella tabella (incondizionata dal `view`) ma senza andamento — aggiunto un grafico `ComposedChart` (barre Incassato + linea EBITDA, stessa libreria Recharts già usata in Dashboard.jsx, nessuna nuova dipendenza), visibile solo nella vista annuale. La tabella stessa ora ha look "excel": gridlines verticali tra colonne, righe zebrate, intestazione sticky durante lo scroll, cifre tabulari (`font-variant-numeric: tabular-nums`), e una riga totali in `<tfoot>` (somma dei 12 mesi per ogni colonna) — le righe restano cliccabili per aprire il dettaglio mese, invariato.
  6. **Test**: 619/619 (8 nuovi: 5 in `tests/incassiSection.test.mjs` — vista unificata cliccabile, azione "Incassa" per riga è un vero pagamento mai un flag, scelta cifra/foto-pdf, Collaborazioni esterne isolata — più 1 aggiornato per la nuova struttura DOM della riga; 4 in nuovo `tests/annualFinancialOverviewExcel.test.mjs` — selettore mese/andamento annuale, righe cliccabili, riga totali, stile excel). `npm run build` pulita (solo warning pre-esistenti su chunk-size). `git diff --check` pulito.
- VINCOLI RISPETTATI: nessuna migrazione/RLS/schema toccata — stesse tabelle (`plans`, `payments`) e stessa RPC canonica (`get_saldo_piano`/`get_saldi_aperti_studio`) già in produzione da POL-FIN-002/003; nessuna cancellazione silenziosa di pagamenti (l'unica cancellazione, nell'elenco "Incassi registrati", chiede sempre conferma); nessuna nuova formula finanziaria (tutti i totali derivano da campi RPC esistenti o somme dirette come già fa il resto della sezione); nessun nuovo sistema di allegati persistiti (limite esplicito già documentato, rispettato). Non toccati i file di PR #74.
- NON VERIFICABILE IN QUESTA SESSIONE: QA autenticato dal vivo (in particolare il flusso reale "foto ricevuta → estrazione AI → conferma → salvataggio", che ha un costo reale per chiamata a Claude Haiku 4.5, e il rendering effettivo del grafico Recharts) — nessuna sessione browser autenticata disponibile qui.
- EXACT NEXT ACTION: pushare il branch e condividere la preview col Product Owner per QA; aprire una PR solo su istruzione esplicita (non ancora richiesta). Non mergiare senza approvazione esplicita.

---

# Previous current task

- TASK: POL-FIN-004
- TITLE: "Leggi estratto conto" — lettura AI di un estratto conto bancario in Incassi, matching pagamenti→pazienti, registrazione selettiva
- OWNER: CLAUDE, su richiesta diretta Product Owner (discussione in chat dopo la chiusura di POL-FIN-003).
- BRANCH: `feature/incassi-lettura-estratto-conto` (PR #80, mergiata) — merge commit `92204a4`.
- STATUS: MERGED — Product Owner ha dato via libera esplicito in chat ("mergia") dopo aver visto il riepilogo dell'implementazione. PR #80 aperta e mergiata su `master`. QA dal vivo con un vero estratto conto resta da fare (vedi punto 8 sotto).
- CONTESTO: durante la chiusura di POL-FIN-003 il Product Owner ha chiesto come rilevare errori nel software; discusso "Studio Data Health" (POL-AI-004) come strada naturale per un audit generico, poi il Product Owner ha proposto un'idea più concreta e prioritaria: leggere l'estratto conto mensile con l'AI (stesso pattern già esistente in Spese/Costi per bollette/fatture), farsi proporre l'abbinamento pagamento→paziente, avere una lista di conferma con checkbox, e vedere le discrepanze rispetto a quanto già registrato. Valutata e scartata l'idea di farlo fare a Poliedron stesso: oggi `processQuery`/`poliedraCore.js`/`modelGateway.js` sono solo testuali, nessun allegato — portarlo dentro il motore condiviso è una missione strutturale a sé (registrata in `docs/POLIEDRA_MASTER_CONTEXT.md` §32, "Missione futura — allegati in Poliedron"). Implementato invece come widget dedicato in Incassi, stesso pattern isolato di Spese/Costi.
- COSA È STATO FATTO:
  1. **Nuova edge function** `estrai-pagamenti-estratto-conto` (deployata via `mcp__Supabase__deploy_edge_function` su `idklxdqebfceplrualgh`, `verify_jwt: true`) — stesso pattern di sicurezza di `estrai-spesa-documento` (JWT verificato, `studio_id` dalla sessione, Claude Haiku 4.5 via API Anthropic diretta, nessuna scrittura server-side, nessuna persistenza). Estrae SOLO le righe di entrata/accredito (mai le uscite) con `{data, importo, descrizione}` più `periodo_da`/`periodo_a`; `max_tokens` alzato a 4096 (vs 500 dell'originale) per estratti conto multi-riga/multi-pagina.
  2. **`UploadDocumento`** (`src/components/ui/UploadDocumentoSpesa.jsx`) generalizzato con una prop `endpoint` (default `estrai-spesa-documento`, quindi Spese.jsx/Costi.jsx invariati) invece di riscrivere upload/webcam/base64 da zero.
  3. **Matching paziente**: nuova `trovaPazienteInTesto(patients, testo)` in `src/lib/ricercaPazienti.js` (direzione opposta della `cercaPazienti` già esistente — cerca quale paziente è nominato dentro un testo libero, richiede nome+cognome entrambi presenti, `null` se ambiguo o nessun match — niente inferenza silenziosa, stesso principio di POL-FIN-003).
  4. **`planAssignmentForPatient(plans, pazienteId)`** estratta in `src/lib/domain/incassiActions.js` (unico piano attivo → auto; più di uno → `choose` con le opzioni; zero → `none`) e **riusata** (non duplicata) in `PatientQuickActions.jsx` e `Pagamenti.jsx`, che prima avevano la stessa logica scritta due volte — ora è una sola fonte, tre chiamanti (i due esistenti più questo nuovo flusso).
  5. **Nuovo `src/lib/domain/estrattoContoService.js`** (pure, nessun I/O): `matchPaymentsToPatients`, `flagPossibleDuplicates` (segnala righe che sembrano già registrate — stesso importo, data entro 5 giorni — deselezionate di default per non registrare due volte lo stesso pagamento), `riepilogoEstrattoConto` (totale estratto conto vs. totale già registrato in app nello stesso periodo — nessuna nuova formula finanziaria, solo somme dirette come già fa Incassi.jsx per "Incassato"), `buildPaymentsFromEstrattoConto` (righe confermate → `payments` con `metodo:'Bonifico'`, `stato:'pagato'`, `piano_id` secondo `planAssignmentForPatient`).
  6. **UI**: nuovo bottone "Leggi estratto conto" in Incassi.jsx → modal con upload, poi tabella di revisione (checkbox per riga, importo/data/descrizione, selettore paziente con match pre-compilato ma sempre correggibile, selettore piano se il paziente ha più piani attivi — checkbox disabilitata finché la riga non è "pronta": paziente scelto e, se serve, piano scelto), riepilogo periodo/totali/possibili duplicati, "Registra selezionati (N)" che scrive i pagamenti tramite il normale `setPayments` sincronizzato e forza un refresh dei saldi aperti.
  7. **Test**: 608/608 (nuovi: `tests/estrattoContoService.test.mjs`, `tests/ricercaPazienti.test.mjs`, più `planAssignmentForPatient` in `tests/incassiActions.test.mjs`). `npm run build` pulita. `git diff --check` pulito.
  8. **PR #80** aperta e mergiata su `master` (merge commit `92204a4`) su istruzione diretta del Product Owner.
- NON VERIFICABILE IN QUESTA SESSIONE: QA autenticato end-to-end (caricare un vero estratto conto e vedere l'estrazione AI reale) — nessuna sessione browser autenticata disponibile qui, e ogni chiamata reale alla edge function ha un costo (Claude Haiku 4.5) che non ho voluto generare senza un documento reale da testare. La logica di matching/riepilogo/costruzione pagamenti è invece coperta da test unitari completi.
- VINCOLI RISPETTATI: nessuna scrittura lato server nella edge function (solo estrazione, il salvataggio resta lato client dopo conferma esplicita); nessuna registrazione automatica di pagamenti (ogni riga richiede paziente confermato, e piano se ambiguo); nessuna nuova formula finanziaria; non toccati i file della PR #74; sezione Incassi estesa, non duplicata.
- EXACT NEXT ACTION: Product Owner testa dal vivo "Leggi estratto conto" in Incassi con un vero estratto conto (immagine o PDF) — è la prima verifica end-to-end reale di questa funzione, non ancora fatta da nessuno. Nessun altro lavoro in corso su questo task.

---

# Previous current task

- TASK: POL-FIN-003
- TITLE: Collegamento esplicito pagamento→piano (`payments.piano_id`), sostituisce l'allocazione FIFO di POL-FIN-002
- OWNER: CLAUDE, su richiesta diretta Product Owner. Piano doc committato su questo stesso branch: `claude/piano-collegamento-pagamenti-piano.md`.
- BRANCH: `feature/pagamenti-piano-esplicito` (PR #78, mergiata) — merge commit `1061f9d`.
- STATUS: MERGED — Product Owner ha dato via libera esplicito in chat ad applicare la migration e mergiare ("no vasi e mergia", dopo aver chiesto conferma su una eventuale preview/branch di test). Migration applicata in produzione, `get_advisors(security)` rieseguito, confronto before/after su dati reali eseguito, PR #78 creata e mergiata su `master`. Vedi punto 9 sotto e l'handoff per i dettagli del post-merge.
- CONTESTO: POL-FIN-002 (PR #75) aveva introdotto `get_saldo_piano`/`get_saldi_aperti_studio` con un'allocazione **FIFO per data piano** dei pagamenti di un paziente sui suoi piani, quando `payments` non aveva (e non ha mai avuto) un collegamento esplicito al piano — solo a `paziente_id`. Quella logica era stata validata solo su dati sintetici (`@electric-sql/pglite`), mai su un caso reale di paziente multi-piano parzialmente pagato. Questo task la sostituisce con un collegamento esplicito, eliminando ogni inferenza.
- COSA È STATO FATTO (tutto commit sul branch, non pushato in produzione):
  1. **Migration** `supabase/migrations/20260901120000_pol_fin_003_payments_plan_link.sql` — additiva: `ALTER TABLE public.payments ADD COLUMN piano_id bigint REFERENCES public.plans(id)` (nullable) + indice; backfill automatico solo per pazienti con un unico piano (qualunque stato); ridefinisce `private.incassi_plan_saldo_v1` a somma diretta (`SUM(payments.importo) WHERE piano_id = plan.id AND stato = 'pagato'`) invece della FIFO — `get_saldo_piano`/`get_saldi_aperti_studio` (POL-FIN-002) restano stessa firma/corpo, cambia solo la view sottostante; elimina `private.incassi_patient_paid_v1` (morta, era l'input della FIFO). **Correzione rispetto al doc**: il doc §3 scriveva `piano_id uuid REFERENCES plans(id)` — verificato via `information_schema.columns` su `idklxdqebfceplrualgh` che `plans.id` è `bigint`, non `uuid` (probabile refuso nel doc); la migration usa `bigint`, coerente con le firme esistenti `get_saldo_piano(bigint)`. Nessuna nuova RPC per "pagamenti da assegnare": calcolata client-side (vedi sotto) per non aggiungere superficie server inutile.
  2. **Validazione locale** (Supabase branching risulta disponibile su questo progetto ora, costo ~0.013 $/h, ma il Product Owner ha scelto la stessa via della sessione POL-FIN-002: validazione locale, non un branch a pagamento) — harness `@electric-sql/pglite` in scratchpad (non nel repo) con 5 scenari sintetici (paziente singolo-piano backfillato, paziente multi-piano con pagamento ambiguo che **non** viene assegnato a nessuno dei due piani — a differenza della vecchia FIFO che lo avrebbe dato tutto al piano più vecchio —, paziente multi-piano senza pagamenti, pagamento già esplicito scritto dopo la migration non toccato dal backfill, vincolo FK reale). Tutti gli assert passano.
  3. **RPC/SQL FIFO rimossa** — nessun riferimento residuo alla FIFO in SQL.
  4. **`src/lib/domain/planPaymentAllocation.js` eliminato** (con il suo test `tests/planPaymentAllocation.test.mjs`). `Piani.jsx`'s `removeItemFromPlan` non usa più l'allocazione per-item: ora calcola il totale pagato **a livello di piano** (`payments` con `pianoId` = il piano, `stato='pagato'`) e avvisa solo se rimuovendo la prestazione il nuovo totale del piano scende sotto quanto già incassato (l'eccedenza diventa "acconto libero" — stesso concetto della sezione 2 del doc, a livello di piano non di prestazione).
  5. **Punti di scrittura pagamento** — tutti aggiornati per valorizzare `pianoId` (mappato a `piano_id` in `src/lib/supabase.js`, `FIELD_MAP.payments`):
     - `Piani.jsx`/`SchedaPaz.jsx` "Registra pagamento adesso" su completamento prestazione → `pianoId` = piano già noto dal contesto, automatico.
     - `Incassi.jsx` "Aggiungi da incassare" → `addReceivableToLatestPlan` ora ritorna `{ plans, planId }` (non solo l'array) così il pagamento contestuale eventuale porta il `planId` giusto.
     - `PatientQuickActions.jsx` "Registra pagamento" (dalla scheda paziente, azione generica) e `Pagamenti.jsx` "Registra pagamento studio" (pagina Pagamenti generale) → entrambi generici, nessun contesto prestazione: se il paziente ha **un solo piano attivo** (stato non `concluso`/`rifiutato`, stessa convenzione già usata da `patientWorkspaceRealAdapter.js`/`PatientWorkspaceV2.jsx`) assegnazione automatica; se ne ha **più di uno**, selettore piano obbligatorio (bottone Salva/Registra disabilitato finché non scelto). `PatientQuickActions.jsx` ora riceve `plans={patPlans}` da `SchedaPaz.jsx`.
     - **Fuori scope, deliberatamente**: il flusso AI planner (`ENSURE_PENDING_PAYMENT`/`buildPendingPayment` in `src/lib/poliedron/planner/`) crea pagamenti `stato:'sospeso'` (non `'pagato'`, quindi non entra comunque nel calcolo saldo) senza contesto piano — un singolo importo "pending" può coprire più prestazioni su piani potenzialmente diversi nello stesso comando, quindi non c'è un piano singolo non ambiguo da assegnare automaticamente. Stessa esclusione già applicata dalla sessione POL-FIN-002 all'"AI tool portion". Questi pagamenti, se mai passano a `'pagato'` restando `piano_id NULL` e il paziente ha >1 piano, compariranno comunque in "Pagamenti da assegnare".
  6. **Backfill storico** — nella migration: pazienti con un solo piano → `piano_id` assegnato automaticamente a tutti i loro pagamenti storici; pazienti con più piani → `piano_id` resta `NULL`, esclusi dal saldo, esposti in una nuova sezione "Pagamenti da assegnare" dentro `Incassi.jsx` (KPI contatore N + totale €, lista con selettore piano per riga + bottone "Assegna" che scrive `pianoId` tramite il normale `setPayments` sincronizzato — nessuna nuova RPC, calcolato client-side da `unassignedPaymentsForMultiPlanPatients(payments, plans)` in `incassiActions.js`, sugli stessi array già caricati per studio). Nessuna sezione Incassi duplicata — estesa quella esistente.
  7. **Verifica su dati reali Studio Simondi** (studio_id `00000000-0000-0000-0000-000000000001`, sola lettura, nessuna scrittura): oggi ci sono **2 pazienti multi-piano** — paziente 46 (piani 4/5, "Vaioli"/"Vaioli2", 294€ ciascuno) con 2 pagamenti da 294€ esatti (id 7 e 8, totale 588€ = esattamente la somma di entrambi i piani — sotto la vecchia FIFO risultavano entrambi saldo 0, verificato con `get_saldo_piano` live) — dopo la migration questi 2 pagamenti finiranno in "Pagamenti da assegnare" (nessuna ambiguità di importo, ma nessun modo di sapere quale pagamento fosse per quale piano) finché non assegnati manualmente; paziente 101 (piani 19/20, "Protesi rimovibile"/"Carico immediato", 2000€/3800€) con **zero pagamenti** — nulla da riallocare. **Nessun paziente reale mostra oggi una regressione di saldo** con la nuova logica: il fix è correttivo/preventivo per il caso di pagamento parziale ambiguo multi-piano, che nei dati reali attuali non si presenta ancora.
  8. **Test/build**: 592/592 (nuovi/aggiornati in `tests/incassiActions.test.mjs`: `addReceivableToLatestPlan` ritorna `{plans, planId}`, `buildContextualPayment` porta/non-porta `pianoId`, `isActivePlan`, `unassignedPaymentsForMultiPlanPatients`); `npm run build` pulita (solo warning pre-esistenti su chunk-size); `git diff --check` pulito. `npm ci` è stato necessario per un gap ambientale pre-esistente (node_modules mancante di `jspdf` — già documentato in handoff precedenti, non causato da questo task).
  9. **Apply in produzione + verifica post-merge** (dopo esplicito via libera del Product Owner in chat): `apply_migration` eseguito su `idklxdqebfceplrualgh`. `get_advisors(security)`: **54 finding totali, stesso numero della baseline precedente (52 WARN + 2 INFO), zero nuovi, nessuno relativo a `payments`/`plans`/`piano_id`/`incassi_plan_saldo_v1`/`get_saldo_piano`/`get_saldi_aperti_studio`**. Confronto reale post-migration su Studio Simondi: paziente 46 → entrambi i piani ora mostrano correttamente `totale_pagato: 0`, `saldo_piano: 294` (erano 0/0 sotto la vecchia FIFO) — i 2 pagamenti da 294€ sono `piano_id NULL`, esclusi dal saldo ed esposti in "Pagamenti da assegnare" com'era previsto, nessun pagamento cancellato; paziente 101 invariato (zero pagamenti). **Scoperta aggiuntiva in fase di verifica** (non un difetto introdotto da questo task, comportamento identico a prima): 6 pazienti di Studio Simondi (id 1, 20, 45, 70, 73, 76) hanno pagamenti registrati ma **zero piani** — questi pagamenti erano già esclusi da ogni saldo per-piano sotto la vecchia FIFO (che operava comunque per piano, via `incassi_plan_totals_v1`) e restano esclusi ora; correttamente **non** compaiono in "Pagamenti da assegnare" (quel worklist è per pazienti con **più** di un piano — con zero piani non c'è nulla a cui assegnare il pagamento, non è un caso di ambiguità ma di assenza di piano). Sanity check integrità dati: 18 pagamenti totali in produzione, 8 assegnati dal backfill automatico, 10 rimasti `piano_id NULL` (2 del paziente 46 + 8 dei 6 pazienti senza piani) — nessun pagamento perso o duplicato.
  10. **PR #78** aperta e mergiata su `master` (merge commit `1061f9d`) su istruzione diretta del Product Owner.
- VINCOLI RISPETTATI: nessuna cancellazione di pagamenti in nessun flusso; non toccati i file della PR #74 (`src/lib/quickActionsCatalog.js`, parte "azioni rapide" di `Impostazioni.jsx`); sezione Incassi estesa, non duplicata; niente lavoro sul branch/task di un altro agente.
- EXACT NEXT ACTION: Product Owner verifica in produzione la nuova sezione "Pagamenti da assegnare" in Incassi (in particolare i 2 pagamenti del paziente 46) e, quando comodo, i 6 pazienti con pagamenti-ma-zero-piani emersi durante la verifica (comportamento pre-esistente, segnalato qui per trasparenza, non un'azione bloccante). Nessun ulteriore lavoro in corso su questo task.

---

# Previous current task

- TASK: POL-FIN-002 (+ follow-up fix)
- TITLE: Modulo Incassi / Da incassare — MERGED, plus a Product-Owner-reported follow-up fix
- OWNER: CLAUDE. POL-FIN-002 itself was implemented by a prior Claude session that handed off to CODEX (see the full detailed record preserved below, unedited); this Claude session independently re-verified it end to end before merging, then fixed a Product Owner bug report on top.
- STATUS: MERGED
  1. **PR #75** ("POL-FIN-002 — Modulo Incassi e gestione Da incassare", branch `feature/modulo-incassi`) — merged to `master` by explicit Product Owner instruction, merge commit `6c76cf0`. Before merging, this session independently re-verified everything rather than trusting the handoff record alone: confirmed the migration (`pol_fin_002_incassi_saldo_piano`) is genuinely applied in production (`list_migrations` on `idklxdqebfceplrualgh`); read the full SQL and confirmed it's additive-only with a preflight guard, `security_invoker=true` views, `REVOKE ALL FROM PUBLIC,anon` + `GRANT` to `authenticated` only; confirmed both new RPCs are `SECURITY INVOKER` (`prosecdef=false`, queried directly) and that `public.plans`/`public.payments` both have RLS enabled with a studio-scoped policy — so `get_saldo_piano` is safe even without an explicit per-call tenant check, since it inherits the underlying tables' RLS; re-ran `get_advisors(security)` and confirmed zero new findings on any `incassi`/`saldo_piano`/`saldi_aperti` object; independently ran the full suite (589/589, matching the Product Owner's own report, not the PR body's stale "538") and a clean production build. One non-blocking observation recorded: `src/lib/domain/planPaymentAllocation.js` (used only for the plan-item removal warning text, never mutates data) reimplements the same patient→plan FIFO allocation client-side to get item-level granularity the RPC doesn't expose — if the SQL formula ever changes this needs a matching manual update. The AI tool portion (`agente-assistente` `segna_prestazione_eseguita`) correctly stayed out of scope — its edge-function source is not in this repository.
  2. **PR #76** ("Fix: checkbox 'Registra pagamento adesso' mancante in Scheda Paziente", branch `fix/scheda-paz-quick-payment-checkbox`) — merged to `master` by explicit Product Owner instruction, merge commit `a041dc9`. Product Owner reported the quick-payment checkbox never appeared when completing a treatment from the patient record. Root cause: that UI was only wired into `Piani.jsx`'s plan-item rendering; `SchedaPaz.jsx` has its own separate, older rendering of the same plan items (kept distinct because it also runs a richiamo auto-detection side effect `Piani.jsx`'s flow doesn't have) and never received the same checkbox. Fixed by adding the same quickOffer/quickPayment UI to `SchedaPaz.jsx`, reusing its existing `setPayments` prop, preserving the richiamo auto-detection untouched, and fixing a real timing bug along the way (the "just executed" flag is now computed from the current render's own state via a `wasEseguita` argument, not as a side effect written inside `setPlans`'s updater, which React does not guarantee runs synchronously). 591/591 tests (2 new), build and `git diff --check` clean.
- EXACT NEXT ACTION: Product Owner QAs both fixes live (production, since both are merged) — the checklist given in chat covers the three-value saldo model, the Incassi worklist, "Aggiungi da incassare", editable plans with safe removal, and now the "Registra pagamento adesso" checkbox from the patient record specifically. No further work in flight on this task; do not start unprompted follow-ups.

---

# Historical record: POL-FIN-002 original implementation (see STATUS above — merged as PR #75)

- TASK: POL-FIN-002
- TITLE: Modulo Incassi / Da incassare (saldo piano, eseguito, acconto)
- OWNER: CLAUDE (handing off to CODEX — session token budget reached). Direct Product Owner request in-session; plan doc committed at `claude/piano-modulo-incassi-da-incassare.md` on this branch.
- BRANCH: `feature/modulo-incassi`
- BASE: `origin/master@05ee761` (merge PR #73)
- STATUS: IN_PROGRESS — steps 1/8 through 5/8 DONE; step 6 UI and step 7 quick payment DONE; live AI tool portion of step 6 BLOCKED by absent authoritative edge-function source/contract; final preview validation remains.
- OBJECTIVE: fix "da incassare" showing a plan's executed total without subtracting payments already received (reported real case: patient Lauretti Giacomo, plan 1.400€, 700€ eseguito shown as owed while 900€ was already paid — real saldo is 500€). Implement the three-value model (saldo_piano / eseguito_non_pagato / acconto) end to end per `claude/piano-modulo-incassi-da-incassare.md` sections 2-9.

## Completed so far

1. **Migration** `supabase/migrations/20260829180000_pol_fin_002_incassi_saldo_piano.sql` — additive only (new `private.incassi_plan_totals_v1`/`incassi_patient_paid_v1`/`incassi_plan_saldo_v1` views + `public.get_saldo_piano(bigint)`/`public.get_saldi_aperti_studio(uuid)` RPCs). Does NOT touch the existing POL-003 canonical financial engine (`financial_*_v1`, `get_financial_snapshot_v1`) — that engine is a studio-period P&L/KPI snapshot at a different granularity, confirmed dormant (its legacy adapter has never been run in production), so nothing collides.
   - **Design decision (confirmed with Product Owner in-session, see chat transcript)**: `public.payments` has no plan/piano FK (only `paziente_id`) — a payment is not tied to one specific plan. When a patient has more than one plan, that patient's paid total is allocated to their plans **FIFO by plan date, oldest first**. Reduces exactly to `totale_piano - totale_pagato` for the single-plan case. Sum of `saldo_piano` across a patient's plans always reconciles to the patient aggregate.
   - `totale_piano`/`totale_eseguito` reuse `Piani.jsx`'s exact discount formula (`sub`, `scontato = pct ? sub*sc/100 : LEAST(sc,sub)`, `finale = GREATEST(0, sub-scontato)`), applied proportionally to the executed-only subtotal too.
   - Only `payments.stato='pagato'` counts as collected (`'sospeso'` = owed-not-collected, per `src/lib/domain/paymentService.js`'s existing convention) — this is a deliberate, documented divergence from `Pagamenti.jsx`'s/old `SchedaPaz.jsx`'s legacy `saldoPaz` formula (which summed all payments regardless of `stato`); on Studio Simondi's real current data the two happen to coincide (no non-`pagato` rows exist there today), verified below.
   - **Applied directly to production** (`idklxdqebfceplrualgh`) via `apply_migration` — Supabase branching is NOT available on this project's plan (`create_branch` returns `PaymentRequiredException: Branching is supported only on the Pro plan or above`), so the "test on a Supabase branch first" step from the runbook could not literally happen. Instead: validated with 19 synthetic assertions against an isolated local Postgres (`@electric-sql/pglite`, zero contact with production) covering the exact Lauretti case, multi-plan FIFO, both discount types, `sospeso`-payment exclusion, malformed/empty `voci`, and cross-studio isolation — all passed. Then applied to production only after explicit Product Owner go-ahead (`AskUserQuestion`, answer: "Applica ora in produzione"). `get_advisors(security)` run immediately after: 52 WARN + 2 INFO, zero mentioning any `incassi`/`saldo_piano`/`saldi_aperti` object — no new security findings.
   - **Old-vs-new comparison on Studio Simondi's real active plans** (studio_id `00000000-0000-0000-0000-000000000001`, "Dott. Luca Simondi") run directly via `execute_sql`: all 11 patients with plans reconcile exactly between the legacy patient-level aggregate and the new per-plan-summed `saldo_piano`, including patient 12 — the real production analogue of the Lauretti case (dovuto 1400, pagato 900, saldo 500, matches the plan doc's worked example exactly). Only one patient (46) has 2 plans in this real dataset, both fully paid — FIFO correctness for a genuinely partial multi-plan case is only proven by the synthetic PGlite tests, not by real data (there wasn't a real example of it).
   - Local-only test harness used for validation lives at `/tmp/.../scratchpad/pgtest/test.mjs` (NOT in the repo — session scratchpad, will not survive; re-derive from the migration file + the assertions described above if you want to re-run it).
2. **Scheda paziente widget** (`src/components/SchedaPaz.jsx`, `tab === 'paga'`): "Situazione finanziaria" card redesigned to the three-value model (red "Da incassare" primary number, "Eseguito non pagato"/"Acconto" secondary tiles, raw eseguito+pagato footer); "Dettaglio per piano" now shows each plan's own `saldo_piano`/`eseguito_non_pagato`/`acconto` instead of the old un-netted `plEseg`/`plDaFare`. Header stat badges ("Pagato"/"Da pagare") also switched to the new aggregate.
   - **Important architectural constraint discovered and respected**: `tests/patientRecordRecovery.test.mjs` asserts `SchedaPaz.jsx`'s source text does NOT match `/useEffect|supabase\.|Promise\.all/` and does NOT import from `../lib/supabase` — a regression guard from the POL-UI-PATIENT-FREEZE-PROD incident (patient record hanging indefinitely on PWA clients when this component did async work itself). So `SchedaPaz.jsx` receives a `saldiPiani` PROP (a plain `{[pianoId]: get_saldo_piano row}` map) — it does no fetching itself. `src/App.jsx` does the actual fetch (new `useEffect` keyed on `[schedaDashPaz?.paz?.id, plans, payments]`, calling `fetchSaldiPiani` from the new `src/lib/domain/incassiService.js`) and passes `saldiPiani={saldiPiani}` down through `PatientWorkspaceBoundary` (which already spreads `{...props}` to `SchedaPaz`, no change needed there).
   - New files: `src/lib/domain/incassiService.js` (I/O: `fetchSaldoPiano`/`fetchSaldiPiani`/`fetchSaldiApertiStudio`, imports `supabase`) and `src/lib/domain/incassiMath.js` (pure: `aggregateSaldi`, NO imports — this is what `SchedaPaz.jsx` imports, to respect the regression guard both in letter and spirit).
   - Full test suite 526/526 passing, production build clean (`npm run build`).

3. **"Incassi" section** (§4): implemented once in `src/components/Incassi.jsx` and exposed both as the `incassi` app page/navigation entry and as the sixth tab in `ControlloGestione.jsx`. It reads only `get_saldi_aperti_studio`, shows Incassato for month/year and the canonical total open balance, persists the studio-scoped sort preference, and opens the selected patient's Pagamenti tab. Dedicated tests 5/5; full suite 531/531; build passed.

4. **"Aggiungi da incassare" form** (§5): added to the shared Incassi surface with patient search, already-loaded pricelist/free-item toggle, description/amount, "Già eseguita" default-on, optional contextual collected payment and live remaining balance. A pure `incassiActions.js` helper appends to the patient's most recent plan or creates a normal "Prestazioni occasionali" plan through `buildNewPlan`; it deliberately does not change the AI planner's separate ambiguity-safe `pickTargetPlanForNewItem` contract. The form writes only through App's existing sync setters. Full suite 534/534; production build passed with the pre-existing duplicate `chat` icon warning.
5. **Piani always editable + removal warning** (§6): every saved plan now exposes "+ Aggiungi prestazione" with free/listino entry and a touch-sized removal control on each item. Removal computes the explanatory collected quota with the canonical patient-to-plan FIFO allocation and proportional plan discount, then item order; if positive it warns that the amount becomes a free advance and explicitly states the payment will not be deleted. Payments are read-only in this flow. Full suite 536/536; build passed.
6. **Execution UI + quick payment** (§7-8 UI): each treatment row now has an inline Da eseguire/Eseguita selector. Completion calls the existing shared `markTreatmentItemCompleted` domain action. After completion an optional "Registra pagamento adesso" checkbox opens a compact form with editable amount, date and method and writes a normal paid payment through App's existing sync setter. Full suite 538/538; build passed.

## NOT started (remaining sections of `claude/piano-modulo-incassi-da-incassare.md`)

6. **AI tool only** (§7): new live `agente-assistente` tool `segna_prestazione_eseguita`. The edge function's server-side source is not in this repository, so its schema/deployment cannot safely be authored here or guessed. Requires the authoritative live function project/contract and separate production deployment authority.
8. **Final validation**: re-run `get_advisors(security)` after any further migration; Vercel preview manual QA (golden path + edge cases in an actual browser — not done yet, no preview deployed); final `npm test`/`npm run build`; update this file + append a handoff entry per section below when each remaining piece lands.

## Explicit constraints (unchanged, still binding)

- Do NOT touch PR #74's files: `src/lib/quickActionsCatalog.js`, the "azioni rapide" part of `src/components/Impostazioni.jsx` — separate branch/task in flight.
- No silent deletion of already-registered payments in any flow.
- No regression on Studio Simondi — re-verify against real active plans before any merge to `master`.
- Do not merge without Product Owner approval. Do not open a PR unless explicitly asked (not asked yet).
- Runbooks `runbook-sviluppo-sicuro.md`/`runbook-rls-nuove-tabelle.md` referenced by the plan doc do **not exist in this repository** (confirmed via `find`/`Glob`) — they live only in the Product Owner's external "Poliedra Soft" Claude Project. This session followed `AGENTS.md`'s own embedded safety rules plus this repo's actual `docs/runbooks/*.md` and existing migration house style instead of inventing their content.

## Exact next action

Push the completed UI workflow, then perform final preview validation. The AI tool remains an explicit external blocker; do not guess its live schema. Do not merge without Product Owner approval.
---

# Integrated master task (PR #74, preserved)
- TASK: POL-UI-017 — ROUND 6
- TITLE: Product Owner follow-up on Round 5 — Ricetta module must open above the dock, plus inline "create new patient" in the Ricetta picker
- OWNER: CLAUDE, on direct Product Owner feedback
- BRANCH: `claude/pol-ui-017-mobile-home-r2-3pizhn` (same branch/PR as Rounds 2-5 — PR #74, no new PR opened)
- BASE: Round 5's own commit `7acd92a` on this branch
- STATUS: MERGED — PR #74 merged to `master` by explicit Product Owner instruction ("mergia in master"), merge commit `bbae1226`. `master` is now at `bbae1226`, containing all of POL-UI-017 Rounds 1-6.
- OBJECTIVE: two asks in one message. (1) "il modulo ricetta deve essere aperto piu in alto del dock" — the floating Poliedron dock/orb (z-index 1100/1200) was rendering ABOVE DocMedico (z-index 500), covering its content; Round 5's scroll-position fix didn't address this, it's a stacking-order bug, not a scroll one. (2) The Ricetta patient picker (Round 4) needs a free-text field to create a brand-new patient (name/surname) on the spot, which then creates the patient and opens Ricetta for them immediately.
- WHAT SHIPPED:
  - §1 z-index fix — `DocMedico.jsx`'s root overlay raised from `zIndex: 500` to `9999`, the same tier this app's own `Modal.jsx` already uses for a real full-screen takeover — clears the dock (1100), the orb/edge-dock (1200) and the Poliedron command panel (1300/1301). `SchedaPaz.jsx`'s matching Suspense loading fallback ("Caricamento editor ricetta…") raised the same way, so there's no flash of the spinner appearing under the dock before the real screen appears above it.
  - §2 inline patient creation — the Ricetta picker's `SelettorePaziente` now also receives `onCreaPaziente`, wired to a new `creaPazienteRapidoRicetta(nome, cognome)` in `Dashboard.jsx` that is a straight port of `Agenda.jsx`'s own existing `creaPazienteRapido` (same `uid()`-based optimistic local record, same `features.max_pazienti` plan-limit fail-closed guard, same "no results while typing → inline Nome/Cognome create form" UX `SelettorePaziente` already ships for Agenda/Piani/ArchivioDocs) — no new patient-creation logic invented. Handles the one real subtlety: `SelettorePaziente` calls `onChange(id)` synchronously right after `onCreaPaziente` returns, before the `setPatients` update has flushed into a re-render, so a plain `patients.find(...)` would miss the brand-new record — closed with a `ricettaJustCreatedRef` holding the just-created object for that one call. `App.jsx` now passes `setPatients={setPatientsSync}` into `Dashboard` (previously read-only there) — Dashboard's own toast state was renamed `comingSoonMsg`→`homeToastMsg` since it now also confirms "Paziente ... creato ✓", not only the round-3 "Da incassare" placeholder.
- FILES CHANGED (round 6): `src/App.jsx`, `src/components/Dashboard.jsx`, `src/components/DocMedico.jsx`, `src/components/SchedaPaz.jsx`, `tests/mobileHomeRound2.test.mjs`, this file, `docs/coordination/handoffs.md`.
- VALIDATION: full `npm test` 577/577 (3 new assertions); `npm run build` clean; `git diff --check` clean.
- NOT VERIFIABLE: authenticated runtime/visual QA — same constraint as prior rounds.
- EXACT NEXT ACTION: PR #74 is merged. Product Owner verifies the live behavior in production (or the next preview) at their convenience — confirms Ricetta opens fully above the dock, and that typing a not-yet-existing patient's name/surname in the picker creates them and opens Ricetta immediately. No further POL-UI-017 work is in flight; do not start a Round 7 or any new work on this branch unless explicitly instructed — the branch is merged and its purpose is complete.
- MERGE NOTE: this session did not independently trigger a production deployment — merging to `master` was performed via explicit Product Owner instruction. Whether Vercel's own GitHub integration auto-deploys `master` to production is a pre-existing project configuration outside this session's control; not separately verified here.

---

# Previous current task

- TASK: POL-UI-017 — ROUND 5
- TITLE: Product Owner follow-up on Round 4 — "il tab ricetta deve essere aperto più in alto"
- OWNER: CLAUDE, on direct Product Owner feedback
- BRANCH: `claude/pol-ui-017-mobile-home-r2-3pizhn` (same branch/PR as Rounds 2-4 — PR #74, no new PR opened)
- BASE: Round 4's own commit `0d5a6e8` on this branch
- STATUS: SUPERSEDED BY ROUND 6 ABOVE — round 5's own record kept verbatim below for audit history.
- OBJECTIVE: Round 4 made "Ricetta" open DocMedico's Ricetta tab directly, but on a phone the actual "Farmaci prescritti" fields sit below two full cards (the 6-option "Tipo documento" selector + "Data documento"), i.e. below the fold — the Product Owner asked for it to open "more toward the top".
- WHAT SHIPPED: `src/components/DocMedico.jsx` — when it opens with `initialType === 'ricetta'` (true for the Home quick action, the pre-existing "Nuova ricetta" button inside the patient's Doc tab, and the Poliedron prescription workflow — all three set it identically, so all three benefit), a mount-only effect scrolls the "Farmaci prescritti" section into view immediately, so it is the first thing visible under the header instead of requiring a scroll past the type selector. The type selector itself is not hidden or removed — scrolling up still reaches it to change type. No change to any other document type's behavior, no change to persistence/`useFormPersistente`, no change to `puoiPrescrivere` gating.
- FILES CHANGED (round 5): `src/components/DocMedico.jsx`, `tests/mobileHomeRound2.test.mjs`, this file, `docs/coordination/handoffs.md`.
- VALIDATION: full `npm test` 574/574 (1 new source-level regression test); `npm run build` clean; `git diff --check` clean.
- NOT VERIFIABLE: authenticated runtime/visual QA — same constraint as prior rounds; the exact scroll offset/feel on a real phone still needs the Product Owner's own device.
- EXACT NEXT ACTION: Product Owner re-tests the redeployed PR #74 preview — confirms the Ricetta fields appear near the top on open. Do NOT merge/deploy without approval. Do not start Round 6 unprompted.

---

# Previous current task

- TASK: POL-UI-017 — ROUND 4
- TITLE: Product Owner follow-up on Round 3 — "Ricetta deve aprire il tab ricetta, non paziente"
- OWNER: CLAUDE, on direct Product Owner feedback
- BRANCH: `claude/pol-ui-017-mobile-home-r2-3pizhn` (same branch/PR as Rounds 2-3 — PR #74, no new PR opened)
- BASE: Round 3's own commit `8cb70f0` on this branch
- STATUS: SUPERSEDED BY ROUND 5 ABOVE — round 4's own record kept verbatim below for audit history.
- OBJECTIVE: the Ricetta quick action landed only on the Pazienti list (Round 3), leaving the user to find the patient, then the Doc tab, then the Ricetta type manually. Make it land directly on DocMedico's Ricetta tab for the picked patient.
- WHAT SHIPPED: Home has no current patient, so a pick is still required — but it now goes straight to the target instead of a dead-end list. New inline patient picker (`SelettorePaziente` in a `Modal`, same pattern the existing "Nuova attività" modal already uses), opened via a new `openRicettaPicker` context hook on the Ricetta quick action; on selection it calls `onOpenPaz(paz, 'doc', { type: 'ricetta' })`. `App.jsx`'s `goSchedaPaz` gained an optional 3rd `documentRequest` argument (default `null`, every existing 2-arg call site unaffected) forwarded into the SAME `initialDocumentRequest` prop `SchedaPaz.jsx` already consumes for the Poliedron prescription workflow — this is a second caller into existing, unmodified `SchedaPaz`/`DocMedico` plumbing (including `DocMedico`'s own unchanged `puoiPrescrivere` licensing gate), nothing new was built. Consenso was left unchanged (still navigates to Pazienti) — not raised in this feedback round; same underlying limitation, noted rather than silently changed.
- FILES CHANGED (round 4): `src/App.jsx`, `src/components/Dashboard.jsx`, `src/lib/quickActionsCatalog.js`, `tests/mobileHomeRound2.test.mjs`, `tests/quickActionsCatalog.test.mjs`, this file, `docs/coordination/handoffs.md`.
- VALIDATION: full `npm test` 573/573 (4 new assertions); `npm run build` clean; `git diff --check` clean.
- NOT VERIFIABLE: authenticated runtime/visual QA — same constraint as prior rounds.
- EXACT NEXT ACTION: Product Owner re-tests the same PR #74 preview once Vercel redeploys — confirms tapping Ricetta, picking a patient, lands directly on the Ricetta form. Do NOT merge/deploy without approval. Do not start Round 5 unprompted.

---

# Previous current task

- TASK: POL-UI-017 — ROUND 3
- TITLE: Product Owner live-preview feedback on Round 2 — Setup dock clearance hardening, quick-action icon/label fixes, three new quick actions
- OWNER: CLAUDE, on direct Product Owner feedback after testing the R2 preview
- BRANCH: `claude/pol-ui-017-mobile-home-r2-3pizhn` (same branch/PR as Round 2 — PR #74, no new PR opened)
- BASE: Round 2's own commit `94bc651` on this branch
- STATUS: SUPERSEDED BY ROUND 4 ABOVE — round 3's own record kept verbatim below for audit history.
- OBJECTIVE: a fourth round of Product Owner feedback on the same live PR #74 preview, addressing four points: (1) harden the `.page-dock-clearance` pattern Round 2 already introduced for Impostazioni so it is byte-parallel to `.home-dock-clearance` in both mobile media queries, closing any doubt that a long Setup section could end up under the floating dock; (2) fix the "Documento" quick action rendering with no icon; (3) remove a literal "+" prefix baked into several quick-action labels; (4) add three new quick actions (Ricetta, Consenso, Da incassare) on the same catalog infrastructure.
- WHAT SHIPPED:
  - §1 Dock clearance hardening — `.page-dock-clearance` was already added in Round 2's own last commit (`94bc651`) and applies unconditionally to Impostazioni (rendered once, outside every `sezione`-gated block, so it covers every Setup tab, not only the new "Azioni rapide" one). Re-verified structurally correct (base `display:none`, `display:block` inside the canonical `(max-width:719px), (pointer:coarse)…` query, no later override resets it) and hardened for full parity: it is now ALSO declared `display:block` inside the legacy `@media (max-width:600px)` block, exactly mirroring `.home-dock-clearance`'s own dual declaration, removing any remaining doubt.
  - §2 Icon fix — `Ic.jsx`'s `ICONS` map has no `doc` key, so the "Documento" quick action (`ic: 'doc'`) silently rendered nothing (not a "+" fallback — `Ic` returns `null` for an unknown key). Changed to `ic: 'file'`, the same generic-document icon `DocMedico.jsx`'s own "Foglio bianco intestato" type already uses for the identical concept. New regression test reads the real `Ic.jsx` icon registry and asserts every catalog `ic` id is a real key, so a future typo'd icon id fails the suite instead of rendering blank.
  - §3 "+" removed — the "+" the Product Owner saw was NOT an icon-missing fallback (confirmed distinct from §2 by reading the code): it was a literal `'+ '` text prefix baked into several `QUICK_ACTIONS_CATALOG` labels (Nuovo appuntamento, Nuovo paziente, Paziente e appuntamento, Nuovo preventivo, Nuova spesa, Documento, Task). Removed from all of them; the actions/ids/gates/`run()` handlers are unchanged, only the display string.
  - §4 Three new quick actions, same infrastructure, nothing invented: **Ricetta** (`ic:'pill'`, the exact icon `DocMedico.jsx`'s own TIPI list already uses for `id:'ricetta'`) and **Consenso** (`ic:'edit'`) both land on Pazienti first (`run: (ctx) => ctx.onNavigate('paz')`), the same "patient-scoped, no target patient from Home" fallback `nuovo_paziente_appuntamento`/`nuova_seduta_fisio` already use — from there the existing, unmodified SchedaPaz "Doc" tab (DocMedico for Ricetta, its own `puoiPrescrivere` gate untouched; `consenso_modelli`/`PannelloInvioDocumento` for Consenso) takes over unchanged. **Da incassare** (`ic:'eur'`, the same icon this file's own "Eseguito da incassare" modal already uses for the identical concept) is an explicit, honest placeholder per Product Owner instruction — the real receivables module is separate, still in development, and a doc named `piano-modulo-incassi-da-incassare.md` referenced in the feedback was searched for and does NOT exist in this repository (recorded here for transparency; the Product Owner's own instruction to build a placeholder now stood regardless and did not require that doc). The placeholder calls a new `openComingSoon(msg)` hook on the quick-action context — wired in `Dashboard.jsx` as a small `comingSoonMsg` state rendering the SAME shared `Toast` component `Impostazioni.jsx` already uses (no new UI primitive) — never a fake navigation. None of the three new actions were added to `DEFAULT_QUICK_ACTION_IDS`: they appear in "Personalizza azioni rapide" as addable, exactly like `documento`/`nuova_spesa`/`controllo_gestione` already do, with no change to what shows without configuration.
- SAFETY BOUNDARIES HONOURED: same as Round 2 (see below) — no schema/RLS/financial-formula/business-logic/Chat-persistence change; `git diff` shows zero changes to the Poliedron engine/dock-geometry files; no widget id added or removed; Home's personalization save/load path untouched. The three new quick actions reuse existing pages/tabs/gates (Pazienti, DocMedico, consenso_modelli) — no new route, no new table, no new RPC.
- FILES CHANGED (round 3, in addition to round 2's own list below): `src/lib/quickActionsCatalog.js`, `src/components/Dashboard.jsx`, `src/components/PremiumVisualSystem.css`, `tests/mobileHomeRound2.test.mjs`, `tests/quickActionsCatalog.test.mjs`, this file, `docs/coordination/handoffs.md`.
- VALIDATION: full `npm test` 570/570 (6 new assertions in `quickActionsCatalog.test.mjs`, 4 new in `mobileHomeRound2.test.mjs`); `npm run build` clean; `git diff --check` clean.
- NOT VERIFIABLE: authenticated runtime/visual QA on a real device or preview — same constraint as Round 2, no authenticated session available here. The dock-clearance hardening and icon fix are argued from source/stylesheet-level regression tests, not a live rendering.
- EXACT NEXT ACTION: Product Owner re-tests the same PR #74 preview (new commit on the same branch, same URL once Vercel redeploys) — confirms Setup no longer clips under the dock on a real phone, "Documento" shows its icon, no quick action shows a "+", and Ricetta/Consenso/Da incassare appear correctly in "Personalizza azioni rapide". Do NOT merge and do NOT deploy without explicit Product Owner approval. Do not start Round 4 unprompted.

---

# Previous current task

- TASK: POL-UI-017 — ROUND 2
- TITLE: Mobile Home and navigation refresh (action-first Home, priority area, progressive-disclosure quick actions, dock/bell audit)
- OWNER: CLAUDE
- BRANCH: `claude/pol-ui-017-mobile-home-r2-3pizhn`
- BASE: `origin/master@05ee761` (merge PR #73, POL-UI-017 R1 — mobile foundation and shell)
- STATUS: SUPERSEDED BY ROUND 3 ABOVE — round 2's own record kept verbatim below for audit history.
- OBJECTIVE: make the mobile Home an OPERATIONAL HOME rather than a stack of boxes — a compact branded hero, a real "Richiede attenzione" priority area built only from data the Home already holds, quick actions with the most frequent at the first level and the rest behind "Altro", a today-oriented band, and the existing informational/financial widgets demoted to a hierarchically secondary position. Scope is strictly mobile Home + mobile navigation + the visual integration between Home and the dock, built ON TOP of the Round 1 foundation (`MobilePageShell`, `mobileShell.js`, `designTokens.css`) rather than replacing it.
- WHAT SHIPPED:
  - §1 Hero — one compact sticky row on mobile (brand gem + greeting + date/time/appointment count) instead of three stacked lines with clamp(25px,3vw,32px) display type.
  - §2 Priority area — new `.home-attention` page chrome above the widget workspace, driven by the new pure selector `src/lib/homeAttention.js`. Sources, all pre-existing: open/overdue `richiami` (same `stato === 'da_fare'` + `dataScadenza` rule the Richiami widget uses), overdue payment deadlines from `useControlloDati` (only when `homePermissions.managementControl` is true), overdue patient-annotation promemoria, the next not-yet-passed appointment from today's list, and unread Poliedron advice. Capped at 4 rows; empty state is ONE compact "Tutto sotto controllo" line, never a large empty box.
  - §3 Quick actions — `partitionQuickActionsForMobile()` in `quickActionsCatalog.js` surfaces Nuovo appuntamento / Nuovo paziente / Pagamento / Richiamo first and moves the rest behind an "Altro (N)" toggle, mobile-only. A user who set their own order in Personalizza Home keeps it verbatim.
  - §4/§5 Hierarchy — mobile-only CSS priority banding on `.home-workspace .home-widget-frame[data-widget-id=…]`: actions (10) → today (20) → operational (30) → overview (40) → deeper detail (50). The persisted layout is untouched; DOM order remains the user's saved order and still decides within each band.
  - §7 Dock — the active slot's contrast was raised (11%→18% wash, 18%→34% border, plus a small ink bar). BUG FIXED: `.home-dock-clearance`, `.home-page` padding and the compact hero were gated on `@media (max-width: 600px)`, so every coarse-pointer landscape phone (844x390, 852x393, 932x430) and every 601–719px viewport — all of which the React shell already treats as mobile and therefore still shows the floating dock — lost the clearance entirely and rendered the last widget underneath the dock. Home now uses the Round 1 canonical mobile media query.
  - §8 Bell — was a 40x40 target, below the Round 1 44px touch floor; raised to `var(--pol-touch-min)`. Position, destination, unread architecture and the "no duplicate badge on the dock's Chat slot" rule are unchanged.
  - §9 Personalizza Home — a discreet 44x44 icon button on mobile (label visually hidden, aria-label/title kept). Save/load logic untouched.
- SAFETY BOUNDARIES HONOURED: no schema, migration, RLS, RBAC, financial-formula, business-logic or Chat-persistence change. `git diff` shows ZERO changes to `PoliedronOrb.jsx`, `usePoliedronPosition.js`, `usePoliedronEdgePosition.js`, `poliedronDragMath.js`, `poliedronSafeBounds.js`, `poliedronOrbSize.js`, `poliedronMobileDock.js`, `PoliedronMobileDock.jsx` and `PoliedronBell.jsx` — the Poliedron engine, the orb's size/position/drag and the dock's structure/slots/destinations/geometry are all untouched. No new quick action, no new widget id, no new alert for data that does not already exist, no second AI panel. Home's personalization save/load path (`homeLayoutPersistence.js`, the `layoutSaveEpochRef` stale-write guard, `draftInherits` semantics) is byte-for-byte unchanged. Desktop Home is not redesigned: every added surface is `display: none` outside the mobile media query.
- FILES CHANGED: `src/components/Dashboard.jsx`, `src/components/PremiumVisualSystem.css`, `src/lib/quickActionsCatalog.js`, new `src/lib/homeAttention.js`, new `tests/mobileHomeRound2.test.mjs`, `docs/coordination/current-task.md`, `docs/coordination/handoffs.md`.
- VALIDATION: new dedicated suite 38/38; full `npm test` 564/564; `npm run build` clean (only the pre-existing chunk-size warnings); `git diff --check` clean.
- NOT VERIFIABLE: authenticated runtime/visual QA on a real device or preview — no authenticated session is available in this environment and none was requested or used. Responsive behaviour is argued from the stylesheet and the Round 1 shell contract, not from a live rendering.
- EXACT NEXT ACTION: Product Owner reviews the PR ("POL-UI-017 R2: mobile Home and navigation refresh") and QAs the mobile Home on a real phone at 375x667, 390x844 and 430x932 portrait plus 844x390 landscape. Do NOT merge and do NOT deploy without explicit Product Owner approval.

---

# Previous current task

- TASK: POL-DOC-ARCHIVE-MOBILE-OPEN-FIX
- TITLE: Patient record Documenti/Ricette — Apri/Stampa still didn't open on mobile after POL-DOC-ARCHIVE-OPEN-FIX
- OWNER: CLAUDE, on direct Product Owner report: in the patient record's Documenti tab, archived documents and ricette list correctly and open/download fine in the general Documenti (archivio) section, but on mobile specifically, opening/printing one from inside the patient record still shows nothing. Desktop works.
- BRANCH: `claude/mobile-recipes-docs-visibility-v9hk10`
- BASE: `origin/master@a34b4a0` (merge PR #70, which shipped POL-DOC-ARCHIVE-OPEN-FIX)
- STATUS: MERGED (PR #71, merge commit `070b28f`) — this file still recorded it as `IMPLEMENTED_AWAITING_PRODUCT_OWNER_QA` long after the merge landed; corrected during POL-UI-017 R2, see the handoff entry for the audit note.
- OBJECTIVE: make Apri/Stampa in `PatientWorkspaceDocuments.jsx` (the patient record's Documenti/Ricette tab, mounted by `SchedaPaz.jsx`) actually display the archived PDF on mobile, without touching the archive list/metadata loading, RLS, schema, or the working `ArchivioDocs.jsx` (general Documenti page) behavior.
- ROOT CAUSE: PR #70's fix made `apriPdf()` convert the `data:` URI to a `blob:` URL before `window.open()`, which fixed the previous data-URI-blocking bug, but `PatientWorkspaceDocuments.jsx` calls it from inside `withPdf()` — an `async` handler that `await`s a Supabase fetch (`loadPatientDocumentPdf`) before ever calling `apriPdf`/`window.open`. Desktop browsers tolerate `window.open()` shortly after an awaited gap tied to a click; mobile Safari/Chrome do not — they require the new-tab open to happen synchronously inside the original tap's call stack, otherwise it is silently blocked with no error and no fallback (`apriPdf`'s null-popup fallback never fires because mobile browsers return a non-null, permanently blank window instead of `null`). This is exactly why the general Documenti page (`ArchivioDocs.jsx`) already worked fine on mobile: its `visualizzaDoc()` also awaits the PDF fetch, but instead of `window.open` it opens the in-app `PdfViewerModal` (a `pdf.js`-based full-screen viewer, no new tab/window involved at all) — the same component `PannelloInvioDocumento.jsx` already uses for the fresh "Genera PDF" preview.
- FIX: `PatientWorkspaceDocuments.jsx` no longer imports/calls `apriPdf`/`window.open`. Both "Apri" and "Stampa / PDF" now call one `viewPdf(document)` that, once the PDF is fetched, opens the same lazy-loaded `PdfViewerModal` (with its existing Condividi/Scarica actions) used by `ArchivioDocs.jsx` and `PannelloInvioDocumento.jsx` — no new PDF viewer/backend was invented.
- SAFETY: no migration, database, RLS, Storage, dependency or financial formula change. Document/prescription list, metadata loading, and the general Documenti (`ArchivioDocs.jsx`) page are untouched. `src/lib/condivisionePdf.js`'s `apriPdf`/`scaricaPdf` are untouched and still used elsewhere.
- VALIDATION: dedicated test 11/11 (`tests/patientWorkspaceDocuments.test.mjs`, new regression test added); full suite 516/516; production build passed; `git diff --check` clean.
- EXACT NEXT ACTION: push the branch, then Product Owner confirms on an actual phone that Apri/Stampa in the patient record's Documenti tab display an archived document/ricetta. Do not merge without Product Owner approval.

---

# Previous current task

- TASK: POL-DOC-ARCHIVE-OPEN-FIX
- TITLE: Patient document archive — fix Apri/Stampa showing no document
- OWNER: CLAUDE, on direct Product Owner report after PR #69 merged (`281f2da`): archived documents now list correctly, but opening/printing one shows no document.
- BRANCH: `claude/merge-pr-69-master-u1o2fn`
- BASE: `origin/master@281f2da` (merge PR #69)
- STATUS: MERGED (PR #70, merge commit `a34b4a0`) — fix was real but incomplete: it resolved the desktop `data:` URI blocking, but not the mobile popup-blocking-after-await case. See POL-DOC-ARCHIVE-MOBILE-OPEN-FIX above.
- OBJECTIVE: make Apri/Stampa on `PatientWorkspaceDocuments` actually display the archived PDF, without changing the archive list, RLS, schema or lazy-load contract from PR #69.
- ROOT CAUSE: `openPdf`/`printPdf` called `window.open(dataUrl, …)` directly on the raw `data:` URI returned by `loadPatientDocumentPdf`. Modern Chrome/Edge/Android block top-level navigation to a `data:` URI (anti-phishing measure): the new tab opens but stays blank, with no visible error — exactly "non c'è nessun documento". `openPdf` additionally passed `noopener`, which per spec makes `window.open` always return `null`, so it silently fell back to a download every time instead of showing the PDF.
- VERIFIED IN PRODUCTION DB (read-only, no data exposed): `documenti_medici`/`documenti_fiscali` both have `pdf_base64` populated on every row (15/15, 7/7) and RLS (`documenti_medici_studio` / `documenti_fiscali_studio`, studio-scoped) is unchanged — the failure is client-side rendering, not missing data or access.
- FIX: added `apriPdf(dataUrl, filename, { print })` to `src/lib/condivisionePdf.js`, converting the data URI to a `blob:` object URL (the pattern this file and `PdfView.jsx` already use elsewhere for the same class of bug) before calling `window.open`, with a `scaricaPdf` download fallback if the popup is blocked. `PatientWorkspaceDocuments.jsx`'s `openPdf`/`printPdf` now call it instead of using `window.open` directly.
- SAFETY: no migration, database, RLS, Storage, dependency or financial formula change. Document list/metadata loading (PR #69) untouched.
- VALIDATION: full suite 515/515; production build passed.

---

# Previous current task

- TASK: POL-DOC-ARCHIVE
- TITLE: Patient document archive visibility
- OWNER: CODEX
- BRANCH: `fix/POL-DOC-ARCHIVE-patient-documents`
- BASE: `origin/master@36faf3f`
- STATUS: MERGED (PR #69, merge commit `281f2da`)
- OBJECTIVE: show the current patient's archived medical and fiscal documents in the stable patient record without loading PDF payloads until requested.
- ROOT CAUSE: the optional `onDocumentsChange` default was a new function on every render, retriggering the loading effect after every state update. A failure from either archive table also discarded the successful source.
- SAFETY: no migration, database, RLS, Storage, dependency, financial formula or production-data change.
- VALIDATION: dedicated document tests 26/26; full suite 515/515; production build passed.
- FOLLOW-UP: merging surfaced a pre-existing, separate bug in Apri/Stampa (see POL-DOC-ARCHIVE-OPEN-FIX above) — not a regression from this task, the `window.open` code path predates it.

- TASK: POL-UI-005C
- TITLE: Patient Workspace documents, prescriptions and consent adapters
- OWNER: CODEX
- BRANCH: `ui/POL-UI-005C-patient-docs-prescriptions-consents`
- BASE: `origin/master` at `6de2050` (merged PR #59)
- STATUS: PR_61_REALIGNED_AND_VALIDATED
- OBJECTIVE: connect the isolated Patient Workspace 2.0 to the existing patient document sources, real `DocMedico` prescription workflow, verified consent templates, structured context and read-aggregated timeline without changing the stable production patient route or creating schema.
- SAFETY: no migration, RLS, Storage, dependency, production route or stable `SchedaPaz.jsx`/`App.jsx` change. Document metadata is loaded only when the Documenti tab opens; PDF/base64 is fetched per click.
- GAP: signed-consent persistence/link creation is not verifiable from repository migrations or authenticated client code. The template/preview adapter is real, but signing remains disabled and clearly labelled; no backend was invented.
- REALIGNMENT: fetched and verified `origin/master@6de2050`; the PR branch already had that exact commit as its direct parent, so `git merge origin/master` was a clean no-op with no conflicts. Dedicated tests 23/23, full suite 458/458, build and `git diff --check` passed after verification.
- NEXT_ACTION: push the validation commit, wait for PR #61 previews/checks, verify the isolated demo and mergeability, then stop. Do not merge.

## Superseded task record

- TASK: POL-UI-005B
- TITLE: Patient Workspace 2.0 isolated visual foundation
- OWNER: CLAUDE (Round 6 + Round 6 recovery, direct Product Owner request; previous rounds by CODEX — see handoff below)
- BRANCH: `ui/POL-UI-005B-patient-workspace-v2`
- BASE: `origin/master` at `981724e` (merged PR #58 stable patient record recovery)
- STATUS: READY_FOR_PR_UPDATE
- OBJECTIVE: Round 6 recovery — commit `67fe427` introduced unauthorized CSS layout side-effects (flex-wrap on the Situazione economica bar, left-align + padding on the economy grid buttons, a margin-top on its `strong`, and a new border on installment chips) alongside the two authorized changes. Reverted every layout side-effect to `67fe427`'s parent (`c5edc7b`) while keeping only the quadrant tooth selector and the canonical economic color scheme.
- SCOPE (Round 6 recovery): `src/components/PatientWorkspaceV2.css` (surgical revert of the 5 non-color properties listed above) and `tests/patientWorkspaceV2.test.mjs` (updated + added guard assertions) only. No JSX change was needed — the regression was CSS-only.
- SAFETY: `SchedaPaz.jsx` and `App.jsx` remain byte-for-byte unchanged from `origin/master`; no Supabase, Storage, migration, dependency, effect, fetch, or production-route change. Demo stays isolated on `/patient-workspace-v2-demo`.
- NEXT_ACTION: commit and push the recovery to the existing PR #59, wait for Vercel/Netlify Ready, then stop for Product Owner review. Do not implement the audit proposal or merge.

## Previous incident record

- TASK: POL-UI-PATIENT-FREEZE-PROD
- TITLE: Production patient record loading hotfix
- OWNER: CODEX
- BRANCH: `hotfix/POL-UI-patient-freeze-prod`
- BASE: `origin/master` at `96b01c6`
- STATUS: READY_FOR_PR
- OBJECTIVE: remove the asynchronous patient-record chunk boundary that can leave PWA clients suspended indefinitely when opening a patient.
- SCOPE: `src/App.jsx`, one regression assertion, and coordination records only. No database, Dashboard, Agenda, dock, Polyedron, Chat, or Patient Workspace 2.0 changes.
- NEXT_ACTION: push the branch, open a PR to `master`, and perform authenticated preview smoke QA. Do not merge automatically.

## Previous task record

- TASK: CHAT-POLYEDRON
- TITLE: Persistent Chat Polyedron
- OWNER: COPILOT
- BRANCH: `lucasimondi-chat-polyedron`
- BASE: `master` — PR #51 (POL-UI-015 Dashboard Premium V2) merged as
  `36a149759b7d1cf7827d17d4a8648fdb1f999570`, integrated into this branch by
  a merge commit (POL-CHAT-001 integration).
- PR: `#53`
- STATUS: `WAITING_PRODUCT_OWNER_FINAL_QA` — implementation complete, merged
  onto the POL-UI-015 master, and the single authorized migration
  `20260824030000_chat_polyedron.sql` is now APPLIED to project
  `idklxdqebfceplrualgh` and verified with 26 real-database assertions
  (all rolled back, no residual test data). FASE 4-13 completed: the quick
  panel no longer carries any Chat history or history banner and no longer
  depends on the Chat backend; the Chat page is the one persistent-history
  surface, with classified error states (loading / empty / schema /
  permission / network / generic) and initialization-error precedence; the
  unread badge exists only on the bell; the temporary POL-UI-015 on-screen
  save diagnostics are removed. Not merged, not deployed to production; no
  other migration was applied. See the POL-CHAT-001 FASE 1-17 handoff entry
  for the full evidence and for what remains NOT VERIFIABLE (authenticated
  browser QA on the preview).

## Objective

Implement Chat as the persistent conversational interface for the one existing
Polyedron. Reuse the singleton Poliedron orchestration, provider/model gateway,
context, permission, action, and memory path; persist one continuous primary
thread per active studio user with fail-closed RLS; expose the same conversation
through mobile Chat, desktop navigation, and a real unread bell.

## Completed scope

- Persistent recent history with bounded upward pagination.
- Studio + user isolation, active-membership enforcement, RLS, indexes, and
  synthetic cross-user/cross-tenant tests in one additive migration.
- Same `processQuery` / Model Gateway / `agente-assistente` path as the existing
  Polyedron; no second chatbot, provider, prompt stack, or orchestration layer.
- Mobile-first dynamic-viewport Chat, desktop long-conversation layout,
  keyboard-safe composer, retry/double-submit/slow-response handling, and
  near-bottom conditional auto-scroll.
- Real unread/read semantics (`read` never means task completion).
- Mobile Chat replaces Setup in the five-slot dock. Setup remains explicitly
  available in the Poliedron navigation menu, per Product Owner decision.
- Desktop Chat navigation and a global bell open the same primary conversation.

## Safety boundaries

- Do not modify Agenda's unrelated booking-request bell semantics.
- Do not implement reminders, scheduler/cron, proactive message generation,
  autonomous loops, task completion/snooze, push, email, or SMS.
- Do not weaken RLS, add tenant fallback, expose provider secrets, duplicate
  Polyedron, or invent production state.
- Do not apply migrations remotely, deploy, merge, or use production data.

## Exact next action

Product Owner reviews PR #53, including mobile/desktop
conversation UX and the additive migration/RLS contract. Do not merge, deploy,
or apply `20260824030000_chat_polyedron.sql` remotely without explicit Product
Owner approval.

## POL-CHAT-001 — integration of the merged POL-UI-015 master

The new `master` (merge commit `36a1497`) is the source of truth for Dashboard
Premium V2, persistent Home personalization, the Richiami widget, mobile
fullscreen Home, the floating hero, dock clearance, the Consigli Poliedron
carousel, and the STRUCTURE of both the notification bell and the mobile dock.
This branch remains the source of truth for the persistent Chat itself:
conversations/messages, unread/read state, the Chat route, the Chat entry in
the dock, the bell wired to Chat, Chat persistence/Realtime, and the Chat
migration.

Where the two overlapped, POL-UI-015's approved UI was kept and POL-CHAT-001's
real behaviour was wired into it:

- **Bell** — POL-UI-015 shipped `PoliedronBell.jsx` as a UI-only placeholder
  (badge with no producer, click reopened the quick panel). The component, its
  look and its approved mobile/desktop positioning are kept unchanged; it now
  receives the real `unreadCount` from `usePoliedronConversation()` and opens
  the persistent Chat page. PR #53's own separately positioned
  `.poliedron-notification-bell` markup/CSS was dropped as a duplicate. The
  bell is hidden while already on Chat.
- **Mobile dock** — Chat replaces Impostazioni in the five slots (POL-UI-015
  structure), but the Chat slot no longer calls `onToggle` on the quick panel:
  it navigates to the real Chat route and carries the unread badge.
  Impostazioni stays reachable from the central Poliedron panel's default
  suggestions (`searchEngine.js` preferred sections, from master).
- **One Poliedron** — the Chat page is the single `Poliedron` instance
  portalled into `App.jsx`'s `poliedronChatHost`. No second agent, no second
  open state, no second orchestration path.
- **App shell padding** — the merged `App.jsx` keeps master's mobile
  fullscreen rules for Home/Agenda and adds the zero-padding Chat page.
- **Dashboard persistence** — the new Home persistence and its
  (still temporary) `HOME_SAVE_*` preview instrumentation from round 4 of
  POL-UI-015 were NOT modified by this integration; removing or downgrading
  that instrumentation remains an open POL-UI-015 debt on master.


---

# Historical record: POL-UI-015 / Dashboard Premium V2 (merged to master as `36a1497`)

- TITLE: Dashboard premium v2 — personalization persistence root cause,
  Richiami widget, mobile fullscreen, floating dock/hero, Consigli
  carousel, Poliedron bell + Chat entry point, Impostazioni relocation
- OWNER: CLAUDE
- BRANCH: `feature/POL-UI-015-dashboard-premium-v2`
- BASE: `master` (POL-UI-004-AGENDA-QUICK-HUB/Agenda Mobile V2 merged as
  `b65cdba`, PR #50)
- STATUS: `WAITING_PRODUCT_OWNER_REAL_QA` — PR #51 open, not merged, not
  deployed. Rounds 1 (`c4df202`), 2 (`77d64d5`) and 3 (`1a82027`) were all
  rejected. On `1a82027` the Product Owner verified the preview personally:
  **Richiami OK, Dashboard OK, Personalizza Home STILL DOES NOT SAVE.**
  BUG A is therefore CLOSED; round 4 touched BUG B only — Richiami, the
  visual Dashboard, Richiami CSS, fullscreen and Poliedron were not
  modified.

  Round 4 found that round 3's own fix was the blocker:

  - The verified read-back compared `JSON.stringify` of the layout sent with
    `JSON.stringify` of the layout read back. Postgres `jsonb` stores object
    keys sorted by length then bytewise, so the two strings could never be
    equal for ANY layout on ANY account. Every save therefore threw
    "il layout Home persistito non corrisponde a quello inviato" AFTER the
    write had landed, the modal stayed open and nothing was committed to
    state. Fixed with a canonical fingerprint that ignores key ORDER while
    still comparing array order, ids, `visible`, `size`, `config` and
    length. The UPSERT → READ-BACK → compare → THROW contract is preserved.
  - `homeLayoutDiagnostics` was gated on `import.meta.env.DEV`, and a
    Netlify deploy preview is a production build — so the entire diagnostic
    trail was compiled away in the only environment where the bug
    reproduces. It is now enabled on deploy-preview/localhost hostnames too,
    never on production hostnames.
  - `draftInherits` was audited and is NOT the cause: all five editing
    handlers clear it, and for the reporting account it is already `false`
    on open. There is no second, divergent Salva button and no overlay
    intercepting the click.
  - The Product Owner's device is an **iPhone** (verified from edge logs).
    The footer action row now wraps and the primary Salva button is
    non-shrinking with a 44px touch target; the Azioni rapide tab gained the
    error alert it was missing.

  STILL OPEN: the edge logs show ZERO write requests on
  `user_home_layouts` in the test window, so it is not proven that the click
  reaches `saveHomeCustomization` on iOS Safari at all. Temporary
  preview-only instrumentation (`HOME_SAVE_*` events plus an on-screen
  "DEV/PREVIEW · save state" badge under both Salva buttons, no secrets and
  no identifiers) was added to settle exactly that on the next real QA. It
  must be removed or downgraded before merge.

  See "POL-UI-015 handoff round 4" in `handoffs.md` for the full evidence
  and the VERIFIED / NOT VERIFIABLE split. Same branch, same PR #51 — no new
  branch, no new PR, no merge, no deploy.

  NOT VERIFIABLE in round 4: authenticated preview QA, iPhone QA and desktop
  QA — no browser with the Product Owner's session is available here and no
  credentials were requested or used. `npm test` 410/410, build clean.

## Objective

Fix the real Dashboard personalization persistence bug at its root cause,
build a premium operational Richiami widget, bring mobile Dashboard to the
same fullscreen principle Agenda already has, turn the greeting block into
a compact sticky/floating bar with date/time, guarantee the last widget
always clears the floating dock, redesign Consigli Poliedron as a mobile
one-card-at-a-time carousel, prepare (UI-only) the Poliedron bell and a
Chat dock entry point — both reusing the single existing Poliedron agent,
never a second one — and move Impostazioni out of the mobile dock into the
central Poliedron panel's default suggestions. Explicitly out of scope:
any real AI/reminder/notification engine, a second Poliedron, or a real
Chat implementation — those are future tasks this one only prepares UI/
navigation for.

## Safety boundaries

- No schema, RLS, dependency, or production change of any kind.
- No new AI engine, reminder engine, notification polling, or second
  Poliedron/chat agent — the bell and dock Chat button are UI-only
  placeholders that open the SAME existing Poliedron conversation.
- Agenda, Pazienti, Poliedron's own size/behavior, and the global design
  system are untouched except where this task explicitly required a
  shared-rule fix (the mobile Home `!important` padding override).
- No merge or deploy without explicit Product Owner approval.

## Exact next action

Product Owner re-tests preview #51 once it rebuilds from the round-3 commit:
confirm the Richiami widget now appears in the Dashboard without any other
personalization changing, and that Personalizza Home either really persists
(verifiable with a page reload) or fails with a visible error while staying
open with the draft intact. Do not merge, do not deploy to production, do
not open a new PR.

Open decision (`PRODUCT_OWNER_DECISION_REQUIRED` if the answer is no): the
round-3 Richiami fix treats a pre-POL-UI-015 `richiami: visible:false` as a
stale default rather than a deliberate user choice, per the explicit
requirement "visibile di default per owner/admin" combined with "non
resettare tutte le personalizzazioni". If that reading is wrong, the
migration must be reverted.

---

# Historical record: POL-UI-004-AGENDA-QUICK-HUB / Agenda Mobile V2 (merged to master)

- Branch: `lucasimondi-agenda-mobile-fullscreen` — PR #50, merged to
  `master` as `b65cdba`.
- Objective: mobile Agenda fullscreen shell, floating overlay controls,
  dynamic day strip, dock-aware appointment action sheet, and the
  Appointment Quick Action Hub (call/patient/recall/activity/contextual
  Poliedron mini-input).
- Full detail: see `docs/coordination/handoffs.md` ("POL-UI-004-AGENDA..."
  entries).

---

# Historical record: POL-AI-005A (merged to master)

- Branch: `feature/POL-AI-005-transactional-action-planner` — PR #46, merged
  to `master` as `c442c6f`.
- Objective: Phase A (READ + PLAN only) foundation for the transactional
  action planner — deterministic command parsing, patient/procedure
  resolution contracts, a tooth model for incomplete-but-valid clinical
  data, and non-executing Action Plans for representative workflows. No
  writes, no CONFIRM/ACT/VERIFY — that became POL-AI-005B (see "Current
  task" above).
- Full detail: `docs/architecture/POL-AI-005A-domain-audit.md`,
  `docs/architecture/POL-AI-005A-planner-foundation.md`, and
  `docs/coordination/handoffs.md` ("POL-AI-005A..." entries).

---

# Historical record: POL-AI-004 (merged to master)

- Branch: `lucasimondi-feature-pol-ai-004-proactive-intelligenc` — PR #45,
  squash-merged to `master` as `ab1bd27`.
- Objective: deterministic, explainable, permission-aware, tenant-safe
  Poliedron proactive intelligence layer — canonical source adapters,
  transparent scoring/confidence, Studio Data Health, bounded cache,
  semantic query routing, grouped approved-panel renderer. Zero Model
  Gateway calls for discovery; no writes.
- Full detail: see `docs/coordination/handoffs.md` ("POL-AI-004..." entries)
  and `docs/architecture/POL-AI-004-proactive-intelligence.md`.

---

# Historical record: POL-UI-013 (merged to master)

- Branch: `feature/POL-UI-013-dashboard-modular-workspace` — PR #44, merged to
  `master` as `590b8ca`.
- Objective: Dashboard modular workspace, `Consigli Poliedron`, touch/mouse
  drag-and-drop, widget resize and the personalization load/save race fix.
- Full detail: see `docs/coordination/handoffs.md` ("POL-UI-013 Dashboard
  modular workspace + Poliedron centrality" and subsequent audit/race entries).

---

# Historical record: POL-UI-012 (merged to master)

- Branch: `lucasimondi-pol-ui-012-mobile-document-kpis` — PR #42, merged to `master` as `93dfe6a`.
- Objective: correct the top Documenti KPI cards on mobile so their values remain proportionate and contained at 375px, 390px, and 430px widths, without changing desktop/tablet presentation or shared `StatCard` behavior elsewhere.
- Full detail: see `docs/coordination/handoffs.md` ("POL-UI-012 Mobile Document KPI sizing").

---

# Historical record: POL-AI-002B (merged to master)

- Branch: `lucasimondi-pol-ai-002b-workflows` — PR #41, merged to `master` as `c82b69a`.
- Objective: restore Poliedron as the application's single conversational AI and action surface, including Product Owner-approved suggest-first input semantics.
- Full detail: see `docs/coordination/handoffs.md` ("POL-AI-002B Poliedron Conversational Actions & Workflows" and subsequent reconciliation/revision entries).

---

# Historical record: POL-AGD-WA-001 (merged to master)

- Branch: `claude/whatsapp-agenda-cancel-rql7fg` — PR #39, merged to `master` as `e5b24d4`.
- Objective: allow an in-progress Agenda WhatsApp bulk send to be cancelled before all scheduled windows open.
- Full detail: see `docs/coordination/handoffs.md` ("POL-AGD-WA-001 Agenda — allow cancelling a WhatsApp send").

---

# Historical record: POL-AI-002A (merged to master)

- Branch: `fix/POL-AI-002A-adaptive-poliedron` — PR #36, merged to `master` as `1faa9bb`.
- Objective: Poliedron adaptive interface — compact mobile dock, desktop edge dock, precise drag, prefix navigation. Full detail in `docs/coordination/handoffs.md`.

---

# Historical record: POL-AI-001 (merged to master)

- Branch: `feature/POL-AI-001-poliedron-universal-interface` — PR #35, squash-merged to `master` as `e504e52`.
- Objective: first architecture of Poliedron — global Orb, Spotlight-style command panel, provider-independent Model Gateway, deterministic-first intent/search, Action Registry reusing existing workflows, Permission Engine reusing existing RBAC. Revised once more to make Poliedron the app's single AI entry point (AssistenteAI's floating widget unmounted, kept internal for future convergence).
- Full detail: `docs/coordination/handoffs.md` ("POL-AI-001 Poliedron Universal Operating Interface (Phase 1)" and the two review-round entries that follow it).

---

# Historical record: POL-UI-011 (merged to master)

- Branch: `lucasimondi-hotfix-pol-ui-011-mobile-edge-to-edge-sh` — PR #37, merged to `master` as `d95af43`.
- Objective: establish the mobile `100dvh` edge-to-edge flex shell and remove the retired dock's global bottom reservation while keeping fixed controls as overlays.
- Full detail: see `docs/coordination/handoffs.md` ("POL-UI-011 mobile edge-to-edge shell").

---

# Historical record: POL-UX-001 (draft PR open, awaiting Product Owner review)

- Branch: `ui/POL-UX-001-visual-system-dashboard-experience`, based on `master@7a0c490` (POL-UI-003 already merged).
- Objective: complete the Poliedra UI/UX as one organic design-system mission — shared tokens, header/Home visual integration, real Quick Booking with authoritative free-slot computation, customizable quick actions with a workflow contract, a unified Pannello Economico on the canonical contract only, and app-wide propagation of shared card/button primitives — without touching clinical/financial logic, RLS, or migrations.
- Full detail: see `docs/coordination/handoffs.md` ("POL-UX-001 Poliedra Visual System & Dashboard Experience" entry) for the complete audit, files changed, database impact (none), and test results.
- Status when superseded as the active task: `WAITING_PRODUCT_OWNER` — draft PR open, not merged. Exact next action unchanged: Product Owner reviews the draft PR; do not deploy or merge without explicit approval.

---

# Historical record: POL-UI-003 (completed, merged to master)

Apply the Product Owner-approved premium visual direction to the Poliedra Home (desktop/tablet sidebar, hero, quick actions, canonical KPI card styling) while preserving POL-UI-001/POL-UI-002 personalization behavior, POL-RBAC-001/POL-RBAC-001A's capability-based permission model, and all canonical financial contracts unchanged. Also fixed a Product Owner-flagged mobile layout defect in the Agenda widget and audited touch targets across Home. Merged to `master` as `7a0c490`; PR #17 closed.

---

# Historical record: POL-RBAC-001A (completed, merged to master)

Close the residual risk the Product Owner identified in POL-RBAC-001: a
`clinical.personal_trainer`/`clinical.massage_therapist` capability alone let
a user read every Fisio patient in the tenant. Separate CAPABILITY ("may act
as X") from ASSIGNMENT ("may act on THIS patient"), add a tenant-safe
`patient_care_assignments` table, and make PT/massage_therapist Fisio RLS
require an active assignment. Physiotherapist access stays tenant-wide
per the already-approved contract. Add a minimal "Team del percorso"
UI to view/manage a patient's assigned professionals.

## Product Owner decisions (recorded verbatim)

Two open decisions were resolved by the Product Owner and applied in full:

> 1. APPROVATO `episode_id → physio_piani` esclusivamente come adapter
>    transitorio fino alla stabilizzazione del canonical episode di
>    POL-FIS-001. Documentalo esplicitamente come transitional compatibility
>    layer. Non creare un secondo modello episodio e non eseguire backfill
>    inventati.
> 2. Per PT e massage therapist approvo la visibilità del roster
>    esclusivamente sul percorso al quale sono attivamente assegnati,
>    applicando data minimization: possono vedere nome/identità
>    professionale, ruolo nel percorso e stato dei membri attivi del team.
>    Non devono poter derivare capability globali, altri assignment, altri
>    pazienti o contenuti clinici aggiuntivi tramite il roster. Il
>    fisioterapista autorizzato può avere la vista completa del team
>    prevista dal contratto.

**Decision 1 — already satisfied, documentation-only change.** The
implementation already matched exactly: nullable `episode_id`, patient-level
RLS gating only, no second episode model, no backfill anywhere. The
migration's table/column comments, header, and the architecture doc now say
"TRANSITIONAL COMPATIBILITY LAYER" explicitly, per instruction.

**Decision 2 — did not match, real fix applied (checked before assuming).**
Two gaps found and closed:

1. `patient_care_assignments_select`'s "shared teammate" branch granted
   **full-row** SELECT (including `created_by`, timestamps, `ended_by`,
   `reason`) to any active teammate on the same patient — exceeding
   "identità, ruolo, stato". Fixed by removing that branch from the base
   table policy entirely and adding `patient_care_team_roster_v1(studio_id,
   patient_id)`, a `SECURITY DEFINER` function returning only `id, user_id,
   assignment_type, active` — a structural column restriction, not a
   convention. `PhysioCartella.jsx` now reads the roster exclusively through
   this RPC; a direct API call gets the same four columns regardless of
   client code.
2. While rebuilding this, found `caller_has_active_patient_assignment_v1`
   never re-checked the caller's own `studio_users.stato = 'attivo'` — a
   suspended user with a still-`active=true` assignment row could still pass
   it. Fixed with a `studio_users` join; the same membership check now also
   applies to the *listed* rows in the roster (a suspended member's
   still-active assignment no longer counts as part of "the active team").

Full detail: `docs/architecture/pol-rbac-001a-patient-care-assignment.md`
("Authorization" section) and `docs/architecture/pol-rbac-001a-local-validation.md`.

## Rebase onto master (PR #15 squash-merged)

PR #15 (POL-UI-002) was squash-merged to `master` as
`1348dd9801dad882ad0a370cbb08e89066af7c31`. GitHub then retargeted PR #16
onto `master`, but its branch still carried the old, now-duplicate
stacked history (the individual POL-UI-002 commits plus everything
before them), making it unmergeable against the new `master`.

Before touching anything, confirmed the trees were byte-identical:
`git diff b9370ad 1348dd9` (old POL-UI-002 branch tip vs. the new squash
commit on master) produced **zero** output — the squash preserved the
content exactly. This meant the seven POL-RBAC-001/POL-RBAC-001A commits
(`b9370ad..0c675e9` on the old history) could be replayed verbatim onto the
new master with `git rebase --onto origin/master b9370ad
security/POL-RBAC-001-authoritative-capabilities` — and they applied with
**zero conflicts**, confirming the prediction.

Verified before pushing:
- `git diff <pre-rebase-tip> <post-rebase-tip>` — empty. The resulting tree
  is byte-for-byte identical to before the rebase; nothing was lost,
  changed, or duplicated by the history rewrite itself.
- `git merge-base --is-ancestor origin/master HEAD` — true. The branch is
  now a direct, clean, fast-forwardable stack on `master`.
- `git diff origin/master..HEAD --stat` — 24 files, all POL-RBAC-001/
  POL-RBAC-001A-owned (migrations, RLS tests, `PhysioCartella.jsx`,
  `SchedaPaz.jsx`, docs) plus exactly two pre-existing, intentional
  touch-ups to POL-UI-002's own files that predate this session (part of
  the original POL-RBAC-001 commit, not introduced by the rebase):
  `tests/homeFinancialWidgets.test.mjs` (updated to the capability-array
  contract `createRolePresetLayout([...])` replaced the old
  `(ruolo, vertical)` signature) and
  `docs/architecture/pol-ui-002-implementation-validation.md` (updated
  prose to describe the capability-based preset resolution). No
  `CanonicalFinancialWidget`/`homeWidgetRegistry`/`homeLayoutPersistence`
  or other POL-UI-002 feature file appears in the diff — no duplication.
- Full required checklist re-run after the rebase, before pushing: 30/30
  Node tests (20 original POL-UI-002 + 10 POL-RBAC-001/POL-RBAC-001A);
  PostgreSQL 16 (dev) full migration/regression chain; `supabase db lint`
  (PG16, no schema errors); **PostgreSQL 17.5 final gate** (PGlite,
  complete chain incl. the two-tenant/assignment/suspension/roster
  assertions) — all green; `npm run build` clean; `git diff --check`
  clean; secret-pattern scan over the full `origin/master..HEAD` diff — no
  matches.

A local tag `backup/pol-rbac-001a-pre-rebase-0c675e9` was created before
rewriting, pointing at the pre-rebase tip, purely as a local safety net —
not pushed, not part of the repository's tracked history.

The push to `origin/security/POL-RBAC-001-authoritative-capabilities` after
this rebase is **non-fast-forward** (history was rewritten) and uses
`--force-with-lease`, per explicit Product Owner instruction to realign the
branch. No merge, deploy, or remote migration was performed.

## Safety boundaries

- No automatic patient/professional assignments are inferred or seeded in
  any migration; only synthetic test fixtures create assignment rows.
- Assignment authorization requires active membership on both caller and
  target, in the same tenant; suspended membership denies access even with
  a matching capability and an active assignment — now enforced on every
  read path, including the team roster (see decision 2 above).
- Physiotherapist Fisio access is unchanged (tenant-wide by capability) —
  not accidentally narrowed by this task.
- No production access, remote migration, backfill, deployment or merge is
  authorized or performed.

## Completion state

`patient_care_assignments` (additive table), its authorization/eligibility
helper functions, author-enforcement/immutability trigger and RLS are
implemented in one migration stacked after POL-RBAC-001's. Redefining
`physio_patient_in_studio_v1` in place tightens all its existing callers;
the three Fisio READ policies that previously granted tenant-wide access on
capability alone are re-scoped to patient level; `physio_esecuzioni` gains
server-enforced authorship so PT/massage_therapist can record and read their
own execution log. `studio_user_capabilities` SELECT is extended (clinical.*
rows only) so a physiotherapist can browse teammate capabilities for the
"Assegna professionista" picker. `PhysioCartella.jsx` gains a "Team del
percorso" section and management modal, gated client-side by capability
(`canManageTeam`) purely for UX — RLS/the roster RPC's own authorization
check is authoritative. `episode_id` is a nullable, Product-Owner-approved
transitional compatibility layer onto the existing `physio_piani` table,
pending POL-FIS-001 convergence — this did not block the tenant/RLS/
assignment work.

Validation passed locally: original 20 POL-UI-002 + 6 POL-RBAC-001 Node/SQL
regressions (with the RBAC fixture updated for the new assignment-gated
contract), all POL-RBAC-001A SQL assertions — including nine new assertions
for the decision-2 roster/suspension fix — (Studio A/B, Patient A/B, PT1/
PT2/Massage1/multi-role/suspended/cross-tenant/revocation/author-spoofing/
assignment-management-authorization/roster-data-minimization), 4 POL-RBAC-001A
Node tests (one updated this round for the roster RPC change), and a clean
Vite production build. See
`docs/architecture/pol-rbac-001a-local-validation.md`.

**PostgreSQL 16 was preliminary development only.** Per explicit Product
Owner instruction, the full required checklist (migration chain, POL-RBAC-001
regression, POL-RBAC-001A assignment regression, RLS two-tenant, assignment/
revoke, suspended user, author spoofing, cross-tenant, unassigned PT,
unassigned massage therapist, physiotherapist flow, build, Node test,
secret/diff/scope check) was re-run unmodified — including after the
decision-2 fix above — against a genuine **PostgreSQL 17.5** engine. Docker
and `apt.postgresql.org` are both denied by this sandbox's network policy
(confirmed with concrete 403s against three independent hosts: PGDG apt,
Supabase's own Docker image blob storage, and plain Docker Hub's blob
storage), so PostgreSQL 17.5 was obtained via `@electric-sql/pglite` — a
real Postgres compiled from unmodified source to WASM, distributed on the
(allowlisted) npm registry — after an RLS smoke test confirmed it enforces
roles/policies/`set_config` correctly, not a stub. Every item on the list
passed on PostgreSQL 17.5 except `supabase db lint`, which ran for real but
against PostgreSQL 16 (the TCP adapter needed to expose PGlite over the wire
protocol only supports the PostgreSQL 18 PGlite line, confirmed by a hung
handshake when forced against 17.5) — see "Residual risks" below. Full
engine-by-engine breakdown, transcripts and exact hosts/errors:
`docs/architecture/pol-rbac-001a-local-validation.md`.

Two self-review passes after the initial push (a code-review pass and a
dedicated security-review pass) each found and fixed one real least-privilege
issue, both since regression-tested: (1) the `studio_user_capabilities`
extension for physiotherapists originally exposed every capability row in
the studio, not just `clinical.*` ones — narrowed with
`capability LIKE 'clinical.%'`; (2) `patient_care_assignments_select`'s
"shared patient" branch checked the caller's active assignment but not
whether the row being read was itself active — this branch was since removed
entirely per Product Owner decision 2 above, superseding that earlier fix.
The responsive "Team del percorso" UI (375/768/1024/1440px) was verified by
screenshotting the shipped component's exact markup/styles headlessly (the
live app cannot be driven in this sandbox without touching the real
production Supabase project it's hardcoded to, which the safety rules
forbid) — see the local-validation doc for details and results.

## Residual risks

- `supabase db lint` ran against PostgreSQL 16, not PostgreSQL 17 (see
  above) — the schema/policy checks it performs are static, not
  version-dependent, and it reported no errors both before and after the
  decision-2 fix, but a literal PG17 CLI-lint run needs Docker or PGDG apt
  access this sandbox's network policy does not grant.
  `PRODUCT_OWNER_DECISION_REQUIRED` if that's required before merge.
  Security/performance advisors (Supabase-hosted) remain unavailable in this
  sandbox for the same reason on either engine.
- Physiotherapist Fisio access remains tenant-wide (unchanged from
  POL-RBAC-001); the model supports but does not yet implement per-patient
  restriction for physiotherapists, as the mission anticipated as future
  work. Not requested by either Product Owner decision in this round.
- `episode_id`/POL-FIS-001 convergence and the roster visibility tier are
  now **decided**, not open — removed from this list. When POL-FIS-001
  merges and stabilizes, a follow-up migration must repoint/rename
  `episode_id`; that follow-up's exact mechanics remain to be designed then,
  not a decision blocking this task.
- Existing dependency advisories (`npm audit`) and pre-existing build
  warnings remain outside this task's scope, unchanged from prior handoffs.

## Exact next action

Product Owner and Tech Lead review the stacked POL-RBAC-001 + POL-RBAC-001A
commits together on PR #16, now incorporating both recorded decisions. Do
not apply remotely, deploy, merge POL-RBAC-001A/POL-RBAC-001, or merge PR
#15/#16 without explicit Product Owner approval.

(POL-RBAC-001/POL-RBAC-001A have since merged to `master`; PR #16 is closed. This record is kept for audit history — see "Current task" above for the active task.)
