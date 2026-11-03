# Current task — ANDROID-WIDGET-PATIENT-NAMES (2026-11-03)
- OWNER Claude Code; branch ccr-f990cd9d-widget-nomi from master 3bb6696 (PR269 merged; earlier task branches already merged, so a new branch as in PR269).
- AUTHORIZATION PO: show patient names in widgets with a switch off by default; allow screenshots; app must open directly on the real Poliedron agenda without the native header.
- SCOPE Personal androidAgendaWidget.js (device preferences, opt-in names via id/nome/cognome only), Impostazioni "Widget Android" (only inside the app), MainActivity full-screen without FLAG_SECURE, native paused flag retired; APK 0.3.0.
- STATUS implementation + local checks complete; PR pending, no merge/deploy/database change.

# Current task — ANDROID-APK-DIRECT-DOWNLOAD (2026-11-03)
- OWNER Claude Code; branch ccr-f990cd9d-apk-diretto from master cc5664d (PR268 merged; PO chose a new branch).
- AUTHORIZATION PO could not install the zipped CI artifact ("App non installata" while opened inside the zip viewer) and authorized the needed corrections.
- SCOPE CI only: Verify APK step (apksigner/aapt2) and, on master push/dispatch, publish the tested APK as plain `poliedra-agenda.apk` in fixed pre-release `agenda-android`. No app code, database or Vercel change.
- STATUS PR pending; release appears after merge. Fixed signing key not added (needs PO-created secret).

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
