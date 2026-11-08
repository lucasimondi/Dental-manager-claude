# Current task — APP-UNICA passo 1 (2026-11-08)
- OWNER Claude Code; branch ccr-4fbd3db0-8ou289 from master 2e610ed (PR276 merged).
- AUTHORIZATION PO 2026-11-08 after the preview artifact "Poliedron app unica": "Ok per poliedron, tema win togliamo, il più ok cerca solo di farlo più pro e immediato e bello vai"; then "Arriva fino dove puoi però registra le cose da fare ancora".
- SCOPE (phone only, desktop unchanged): + next to the agenda search opens the shared «Crea» sheet in Studio and Personal; one dock Agenda · Note · Poliedron · Documenti · Altro in both parts; shared «Altro» page (Lavoro · Studio, Vita · Personale) with direct cross-links (`?sezione=`); Windows 95 theme removed from Personal; Studio PWA named Poliedron. No schema, RLS or data change.
- REMAINING WORK: docs/coordination/app-unica-da-fare.md (step 2: Personal inside the Poliedron app with one login; step 3: unified Documenti; real-iPhone checks).
- VALIDATION 1593/1593 Node tests; Studio and Personal builds; Chromium visual: agenda.compare, agenda.reliability, agenda.sharing, agenda.ricerca, appointment-workspace; renders of the Crea sheet (Studio and Personal) and Altro page.
- STATUS PR open; task-specific "Mergia" required.

# Current task — POLIEDRON-COMANDI-SENZA-AI (2026-11-08)
- OWNER Claude Code; branch ccr-873bf8b7-n86ati from master b62e2eb (PR273 merged); master 2e610ed (PR274–276, incl. RICERCA-AGENDA search bar) merged in.
- AUTHORIZATION PO: "devi renderlo indipendente da AI esterna perché altrimenti dobbiamo sempre sentirci dire AI non in funzione, deve essere in grado di eseguire comandi semplici"; PO chose both Personal and Studio, and "Esegue subito" (immediate execution with Annulla) for complete commands.
- SCOPE Personal: new lib/comandi.js (pure Italian parser: promemoria/pagamenti with date, time, amount; apri sezione; aiuto), executed by the chat before any AI call through the existing aggiungiPromemoria (Annulla via annullaPromemoria); incomplete commands show the existing filled card; AI failure falls back to the local search without the error sentence. Studio: agente-assistente emergency core (LLM down) reads any day (parseDay/resolveDay), answers with formatCoreRead text (previously only "Modalità essenziale attiva…" with data the client never showed) and lists direct no-LLM commands instead of "servizi AI temporaneamente indisponibili". No schema, RLS, tenancy or financial change; writes use existing functions/tables.
- STATUS implementation + local checks complete; PR277 opened on PO request. Task-specific "Mergia" required; agente-assistente is deployed by its workflow only after merge.
- VALIDATION 1560/1560 Node tests; Studio and Personal builds pass.

# Current task — DOCUMENTI-STUDIO (2026-11-08)
- OWNER Claude Code; branch ccr-4fbd3db0-8ou289 (continues AGENDA-UNICA-RICERCA, commit 14d1bce).
- AUTHORIZATION PO 2026-11-08: "Fai ancora la modifica del db in modo che si possano cercare documenti anche in studio e crearli e mergia" = approval of this database change and merge of the branch PR once all checks are green, then controlled application of migrations 20261108120000 (password_personali) and 20261108130000 (documenti_studio).
- SCOPE: new table documenti_studio (acquired photos/files, studio-scoped RLS like the other studio documents, optional patient of the same studio, fixed file path inside the studio folder) + private bucket documenti-studio (folder = JWT studio_id) + SECURITY INVOKER RPC cerca_documenti_studio over acquired, medical and fiscal documents (titles, type, number, patient name only; file contents never read). Studio: "Acquisisci documento" modal (camera or file, title, type, optional patient) from the agenda bar and the Documenti page; acquired documents listed, opened (5-minute signed URL) and deleted in Documenti; agenda bar shows document results.
- VALIDATION 1581/1581 Node tests (PGlite with stub Storage for the new migration); Studio and Personal builds; Chromium render of the acquisition modal (no overflow, upload then insert).
- STATUS MERGED 2026-11-08: PR275 squash-merged after PO "mergia" with all checks green (iphone-agenda Chromium/WebKit included); merge commit 0fdb64f. Vercel production deployment dpl_FASudZJgb9dCMYyuTRrKqA9L33ia READY. Migrations password_personali and documenti_studio applied to Supabase DentalManager (idklxdqebfceplrualgh) via apply_migration; bucket documenti-studio private; security advisors show no finding on the new tables, bucket or function (remaining findings pre-existing).

# Current task — AGENDA-UNICA-RICERCA (2026-11-08)
- OWNER Claude Code; branch ccr-4fbd3db0-8ou289 (continues AGENDA-PHONE-FIXES, commit 07f9197; not merged yet).
- AUTHORIZATION PO 2026-11-08, answers to the proposal: "Tutto di partenza" (one agenda, Studio and Personal together, in both apps); "password deve essere un registro su cui registro e devono vedersi". Earlier in the same message: inline search that searches directly and acts (create, move, delete appointments; documents, notes, passwords, document acquisition, quick actions); chat must have an exit.
- SCOPE: (1) both agendas start with "Tutto (Studio e Personal)" (former "Eventi nascosti" toggle, now on by default). (2) New table `password_personali` (migration 20261108120000, owner-only RLS like note_personali, PGlite test) + shared PasswordPage (Studio page `password`, Personal section in Altro); passwords shown with the eye button and copyable; never searched or shown in search results (title/user/site only), never sent to Poliedron/models. (3) shared/ricerca: deterministic Italian command engine (no model) + RicercaAgenda bar in the agenda chrome of both apps: results under the bar (agenda, patients in Studio, notes, password titles, Personal documents), quick actions, "sposta/cancella" only after Conferma/Elimina, new appointment/impegno open the prefilled form, "nota:" saves a note, "Chiedi a Poliedron" passes the sentence; "Chiudi" always visible. (4) Personal Poliedron chat: "Chiudi" button back to the agenda; question from the bar arrives prefilled.
- DATABASE: migration 20261108120000_password_personali.sql NOT applied; apply to production only after task-specific "Mergia" (controlled release). Until then the Password page shows "disponibile dopo l'aggiornamento del database".
- VALIDATION 1576/1576 Node tests; Studio and Personal builds; Chromium visual: agenda.compare, agenda.reliability, agenda.sharing (updated for "Tutto"), appointment-workspace, new agenda.ricerca (added to CI workflow; WebKit only in CI).
- OPEN: real-iPhone check; Studio "Acquisisci" opens Documenti (no direct camera flow in Studio yet); Studio has no global document search (per-patient archive).
- STATUS branch pushed; PR only on request; task-specific "Mergia" required.

# Current task — AGENDA-PHONE-FIXES (2026-11-08)
- OWNER Claude Code; branch ccr-4fbd3db0-8ou289 from master f16db79 (PR274 merged).
- AUTHORIZATION PO 2026-11-08: "inserimento appuntamento studio non scrolla fino in fondo e metti etichette come in impegni ovviamente con colori predesignati e pieni. La vista deve iniziare sempre in settimana, inoltre il menù a tendina della vista deve sovrapporsi quando compare a tutto, adesso viene coperto da impegni flottanti".
- SCOPE presentation only: Studio <-> Personal links open the week view; phone agenda bar (search, month, view menu) stacks above floating day events; Modal backdrop follows visualViewport so the keyboard never hides the end of the form; Studio appointment form: "Etichetta" chips like Personal impegni (filled when active) + palette swatches (no custom picker). No schema, RLS or data change.
- OPEN (PO decision required before building): inline Poliedron search that acts (create/move/delete appointments with confirmation, documents, notes, quick actions, acquisition), single shared agenda as start in both apps, password search (security decision), chat exit controls.
- VALIDATION 1564/1564 Node tests; Studio and Personal builds; Chromium visual: appointment-workspace (375-1440), agenda.compare (375/390/430), agenda.reliability; screenshots of form labels/bottom and open view menu.
- STATUS branch pushed; PR only on request; task-specific "Mergia" required.

# Current task — AGENDA-CENTRIC-PHONE (2026-11-08)
- OWNER Claude Code; branch ccr-4fbd3db0-8ou289 from master b62e2eb (PR273). Supersedes HOME-AGENDA-CENTRIC, AGENDA-MOBILE-SEARCH, AGENDA-MOBILE-IOS-STYLE, AGENDA-MOBILE-POLISH records below.
- AUTHORIZATION PO 2026-11-07: "Ok sulle raccomandazioni, procedi con l'implementazione, mantieni impegni giornalieri flottanti, crea [la PR] per poi mergiare". Recommendations accepted: Poliedron at the dock centre, agenda is the Home, Note with a new table (simple first version); phone first, desktop as before.
- SCOPE: phone agenda identical in Studio and Personal (search, month/year, days; iOS material bar; soft appointment blocks; now pill; week strip also in day view; floating day events, week one-line chips max 2 + "+N"; no + button, tap a free slot to create). Studio dock Agenda · Note · Poliedron · Documenti (Pazienti without archive plan) · Personal; Personal dock Agenda · Note · Poliedron · Documenti · Studio · Altro (Oggi moved to Altro). New `note_personali` table (migration + RLS + PGlite test) and shared Note page in both apps. Previous Home restored exactly (desktop and phone).
- DATABASE: migration supabase/migrations/20261107120000_note_personali.sql applied to production after merge (2026-11-08). Until it is applied, the Note page shows "Le note saranno disponibili dopo l'aggiornamento del database." Application belongs to the controlled release after "Mergia".
- STATUS MERGED 2026-11-08: PR274 squash-merged after PO "Mergia" with all checks green (iphone-agenda included); merge commit 1dc7bbf. Vercel production deployment dpl_G9YGSrD8tzfHu3WcyYMvgi3hqiVL READY for that commit. Migration note_personali applied to Supabase project DentalManager (idklxdqebfceplrualgh) via apply_migration; security advisors show no finding on the new table.
- VALIDATION 1560/1560 Node tests; Studio and Personal builds; diff check; synthetic Chromium phone renders of agenda (Studio/Personal, day/week), Note page flow (add, area, pin) and Studio dock.
- OPEN: Poliedron voice-first on the dock centre (no dictation in the panel yet); agenda visual baselines need refresh; green brand across the app; Documenti section redesign.
- Previous operational record preserved below.

# Current task — AGENDA-MOBILE-SEARCH (2026-11-07)
- OWNER Claude Code; branch ccr-4fbd3db0-8ou289 (continues HOME-AGENDA-CENTRIC, commit 9f2a9b4).
- AUTHORIZATION PO, after reviewing the phone proposal (artifact "Poliedra Vita"): "prendi agenda di Poliedron e rendila come mi hai proposto ma solo metti la barra ricerca in alto poi sotto i giorni"; earlier: remove "Vai a Personal"/"Vai a Studio", Studio icon in the Personal dock, same agenda in both apps, daily events stay floating as today, phone first (desktop unchanged).
- SCOPE presentation only, phone: shared AgendaSearchBar rendered first in DayStrip/MonthToolbar floating controls (search, then month/view, then days, then the existing floating day events). Studio search opens the existing Poliedron panel (searchRequest); a small Personal icon sits next to it; the "Vai a Personal" pill stays only when no search bar (desktop). Personal search opens the Poliedron assistant section; "Vai a Studio" removed from the agenda; Studio link added to the Personal dock (6 columns). No data, schema, RLS or behavior change beyond navigation entry points.
- STATUS implementation + local checks complete; branch pushed, no PR (not requested). Task-specific "Mergia" required.
- OPEN (PO): desktop Home must stay as before — the HOME-AGENDA-CENTRIC Home commit still applies on desktop and must be limited to phone in a follow-up; proposal items not yet built (patient blocks restyle, reminders, Da fare/Progetti, Studio dock "Personal").
- VALIDATION 1559/1559 Node tests; Studio and Personal builds; synthetic Chromium render of tests/visual/agenda.html (studio/personal × giorno/settimana, 390px): search at top (16px), days strip below (110px), no app-switch pill, search tap reaches the handler, no page errors.
- Previous operational record preserved below.

# Current task — HOME-AGENDA-CENTRIC (2026-11-06)
- OWNER Claude Code; branch ccr-4fbd3db0-8ou289 from master b62e2eb (PR273 merged); master 2e610ed (PR274–276, incl. RICERCA-AGENDA search bar) merged in.
- AUTHORIZATION PO reviewed two design proposals (artifacts "Poliedra Nitido" and "Poliedra Oggi") and asked: green as leading color, Home with only essentials (no management control), agenda-centric software, one Poliedron search bar from which everything starts, plus an Agenda button in the header; "restyling home poi passiamo al resto".
- SCOPE presentation only, Home first: header with Poliedron search launcher (opens the existing Poliedron panel, same engine/permissions), Agenda button, + Appuntamento; HomeToday day grid (per chair when active chairs exist, read with the same query as Agenda) with now line; "In poltrona ora" card with the existing four appointment actions; "Richiede attenzione" now also on desktop in the side column. Home no longer renders/offers agenda list, quick actions and management_control widgets (saved layout untouched). Green tokens scoped to `.home-oggi`. No schema, RLS, tenancy, financial formula or deployment change.
- STATUS implementation + local checks complete; branch pushed, no PR (not requested). Task-specific "Mergia" required before merge. Next PO step: green and new header across the rest of the app.
- VALIDATION 1558/1558 Node tests; Studio and Personal builds; tests/visual/home.mjs (Chromium, synthetic data, 375/768/1024/1440, light/dark, no horizontal overflow, no page errors).
- Previous operational record preserved below.

# Current task — AGENDA-RESTYLING-PALETTE (2026-11-04)
- OWNER Claude Code; branch ccr-4ae14be0-vbbibl from master 602c887 (PR270 merged).
- AUTHORIZATION PO asked a professional restyling of agenda label colors and grid for Studio and Personal ("all'altezza di Google calendar"), proposal first; PO answered the proposal with "Mergia" = approval of the recommended options (mixed blocks, display mapping of saved colors, swatch picker + custom, Win95 unchanged except palette). No PR existed at that time, so merge needs confirmation on the specific PR (AGENTS.md).
- SCOPE presentation only: shared/agenda labelPalette (15 colors, display-only nearest mapping), tonal events without dashes, filled appointments with contrast-checked text, light grid (hour lines only, labels on the line, 1px borders, no today column fill), now line with dot, month marks/cards, all-day strip; Studio COLORI_DISPONIBILI = palette; Personal swatch picker in event editor and new label form; Android snapshot sends mapped color. No data, schema, RLS or behavior change; stored colors untouched.
- STATUS implementation + local checks complete; PR opened; waiting for green checks and PO confirmation of "Mergia" on that PR.
- VALIDATION 1545/1545 Node tests; Studio and Personal builds; agenda visual regression (Chromium, 375/390/430) pass locally. WebKit, motion/reliability and Android run in PR CI.

# Current task — PATIENT-ODONTOGRAM-MULTISELECT (2026-11-04)
- OWNER Claude Code; branch ccr-1dfa37b3-goptz7 from master 602c887 (PR270 merged).
- AUTHORIZATION PO: "Integra flusso workflow per scheda paziente con odontogramma... inserimenti prestazione con odontogramma con denti selezionabili anche multipli", then "Selezione multipla di denti e anche più prestazioni per ogni dente".
- SCOPE presentation/entry flow only: landing odontogram multi-selection with quick groups and action bar; editor applies several procedures to every selected tooth, per-tooth expansion (default) or single combined row. No schema, RLS, tenancy, financial formula or deployment change.
- STATUS implementation + local checks complete; branch pushed, no PR (not requested). Task-specific "Mergia" required before merge.
- VALIDATION see handoff 2026-11-04.
- Previous operational record preserved below.

# Current task — AGENDA-LABEL-TONE (2026-11-03)
- OWNER Claude Code; branch ccr-7598f13b-4r75dz from master 3bb6696 (PR269 merged).
- AUTHORIZATION PO: "I colori etichette di agenda sia personale che poliedra devono essere anche meno opachi, rendila ancora più pro".
- SCOPE presentation only in shared/agenda (used by Studio and Personal): event blocks, all-day ribbon, month card badge and appointment accent. PO follow-up "Anche su android": Android widget rows show the same label color (bar + tint + colored source text), snapshot gains validated `color`; APK 0.3.0 (code 3). No data, label colors, RLS or behavior change.
- STATUS implementation + local checks complete; PO said "Mergia"; dedicated PR, merge after green checks.
- VALIDATION 1543/1543 Node tests; Android compile/lint via PR Android CI; Studio and Personal builds pass; diff check clean. Synthetic before/after swatch render only; no device test.
- Previous operational record preserved below.

# Current task — ANDROID-APK-DIRECT-DOWNLOAD (2026-11-03)
- OWNER Claude Code; branch ccr-f990cd9d-apk-diretto from master cc5664d (PR268 merged; PO chose a new branch).
- AUTHORIZATION PO could not install the zipped CI artifact ("App non installata" while opened inside the zip viewer) and authorized the needed corrections.
- SCOPE CI only: Verify APK step (apksigner/aapt2) and, on master push/dispatch, publish the tested APK as plain `poliedra-agenda.apk` in fixed pre-release `agenda-android`. No app code, database or Vercel change.
- STATUS PR pending; release appears after merge. Fixed signing key not added (needs PO-created secret).
- Previous operational record preserved below.

# Current task — ANDROID-PERSONAL-WIDGET-ACTIONS (2026-11-03)
- OWNER Claude Code; branch ccr-f990cd9d-zhvxio from master ea408c3 (ANDROID-AGENDA-WIDGETS merged as PR267).
- AUTHORIZATION PO request: "Crea widget android per poliedron personal, iniziamo da agenda e varie azioni su agenda".
- SCOPE additive: quick-actions widget (next item + new event/appointment, today, week), row tap opens exact item, "Domani" postpone proposal for personal events, separate + Impegno / + Appunt. buttons. Widget still never writes and holds no credentials; Personal reads rows by id with existing Studio session/RLS and only opens existing editors.
- STATUS implementation + local checks complete; branch pushed, no PR opened (PO did not request one). No merge/deployment/database mutation.
- VALIDATION 1541/1541 Node tests; Studio+Personal and standalone Personal builds pass; diff check clean. Android: Gradle/SDK unavailable here (dl.google.com and Google Maven blocked), so Java compiled with javac against Robolectric android-all 15 framework jar plus generated R and androidx.webkit stubs: pass; all R/@ references resolve, XML well-formed. Full assembleDebug/lintDebug must run in the existing Android CI. No device/launcher test.
- Previous operational record preserved below.

# Current task — ANDROID-AGENDA-WIDGETS (2026-11-03)
- OWNER Codex; branch codex/android-agenda-widgets from master d87bc958.
- AUTHORIZATION PO requests Android day and week widgets with Studio and Personal events, navigation across dates.
- SCOPE additive Android companion, origin-scoped web message snapshot adapter, no credentials in widget storage; native horizontal navigation uses arrows (Android reserves horizontal swipe for launcher).
- STATUS PR267 published; exact-head CI pending after SDK setup fix. No merge/deployment/database mutation performed.
- VALIDATION1534/1534 Node tests, Studio+Personal combined and standalone Personal builds; Android assembleDebug/lintDebug pass (0 errors,18 warnings: Italian-only strings, fallback API31 widget sizing and reviewed trusted-origin JavaScript). APK signature verifies. No physical launcher/WebView/touch test.
- RELEASE web adapter must be reviewed/merged/deployed before the production-origin APK can sync. Snapshot updates on app foreground, not background live sync. Existing immutable stable070b28fd checkpoint untouched.
- Previous operational record preserved below.

# Current task — PREVENTIVI-RAPIDI (2026-11-03)
- OWNER Codex; branch codex/preventivi-rapidi from master cab3206a.
- AUTHORIZATION PO approved one-screen quotes, direct PDF/JPG file delivery and dedicated persistent quote archive with "Vai".
- SCOPE patient/agenda quote composer, file-only sharing, immutable document snapshots and Preventivi section; retain canonical plans/financial formulas.
- CHECKPOINT stable/2026-08-27-full-recovery at070b28fd4eae4e2cc397584201d0bb149468fae7 preserved.
- STATUS WAITING_PRODUCT_OWNER. Implementation and local verification complete; dedicated PR before task-specific Mergia, no manual production deploy.
- DATABASE new migration with tenant RLS; production metadata inspection only, no patient reads or writes. Remote application reserved for controlled release.
- VALIDATION1528/1528 Node tests incl isolated two-tenant SQL, Studio/Personal builds, startup and diff check pass. Synthetic PDF/JPG shares and immutable revision verified;375/768/1024/1440 no horizontal overflow. Physical phone/native WhatsApp unverified. ROLLBACK revert UI; retain document records.

- PR266 published at c612a3eb; Vercel preview and three verify jobs passed. iPhone visual regression initially stopped on its old expectation that + Preventivo expands inline title. Updated that scenario to assert direct PDF/JPG editor and close/return; updated synthetic document client and legacy-plan preview scenario for archival delivery. Remote rerun required; no production change.
- Mobile CI then caught quote PDF viewer below the appointment backdrop. PdfView now accepts parent overlay depth; appointment uses11000 and its body-portal PDF viewer uses11100. This fixes the actual inaccessible close/share controls, without test force-clicks or bypasses. Rerun pending.

- PR267 first Android CI stopped before compilation because setup-android@v3 defaults to removed SDK package tools. Explicit packages:platform-tools fixes setup without weakening checks; local APK remains verified. Vercel preview succeeded, remaining PR checks pending.
