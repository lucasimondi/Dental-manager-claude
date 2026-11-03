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
