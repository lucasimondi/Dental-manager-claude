# Current task — ICLOUD-PHOTOS-DRIVE (2026-11-06)
- OWNER Claude Code; branch ccr-9ca04a6e-v4ycz4 from master b62e2eb (PR273 merged).
- AUTHORIZATION PO: "Crea un tool per scaricare automaticamente 1000 a volta le foto da iCloud e metterle su drive".
- SCOPE additive standalone local tool in poliedron/foto-icloud/ (Python + pyicloud, upload with rclone or a Google Drive for desktop folder), batches of 1000 with SQLite resume state. Never deletes from iCloud; no secrets in repo (password from system keyring or prompt, session cookies in ~/.icloud-drive-foto). No app, schema, RLS, Vercel or Supabase change.
- STATUS implementation + local checks complete; branch pushed, no PR (not requested). Real iCloud login/upload not testable here (needs PO Apple ID + 2FA on his computer).
- VALIDATION 11/11 Python unittest with fake library (batching, resume, name collisions, video/Live, network errors, low disk, fake rclone); API surface checked against pyicloud 2026.10.1.

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
