# Poliedra Agenda — Android companion (initial version)

Two real Android AppWidgets: **Giorno** (4×3 default) and **Settimana** (4×4), resizable. Both combine the existing Studio appointments and personal events visible in Personal. The week selector includes Saturday/Sunday, counts and a selectable day. Vertical ListView scrolling, previous/next period, Today, per-widget source filter and details toggle. Horizontal swiping remains the Android launcher's gesture; it is not advertised as supported. **+ Nuovo** opens the existing Personal event/patient appointment editor on the selected date, without saving anything automatically.

## Agenda actions (ANDROID-PERSONAL-WIDGET-ACTIONS, v0.2.0)

Third widget **Agenda · Azioni rapide** (4×2, resizable): next item still to come (today from the current time, then following days within the snapshot), with **+ Impegno**, **+ Appunt.**, **Oggi**, **Settim.** and a per-widget Dettagli/Nascondi toggle. Day and week widgets now offer **+ Impegno** (personal event) and **+ Appunt.** (Studio appointment) on the selected date, **Agenda ↗**, and a tappable update line that opens the app to refresh.

- **Tap on a row** opens that exact personal event or Studio appointment in the existing Personal editor (rows without a reference open the day as before).
- **Domani ›** on personal events opens the event's editor with dates proposed one day later and a visible notice; nothing changes until **Salva** (recurring events still ask which occurrences to change).
- The widget never writes and holds no credentials. Rows carry only an opaque `ref` (record id, `[A-Za-z0-9-]{1,64}`), validated by the native host and again by the web app; patient names/IDs/notes still never enter the payload. Personal re-reads the row with the existing Studio session and RLS and refuses rows that are missing, cancelled, hidden from Personal, or unreadable without a Studio session (it shows a notice, never an empty editor posing as the row). Action parameters are removed from the address after use.
- Without the released web change, a new APK still shows the agenda; row actions open the selected day only.
- The quick widget's "next" item is computed at render time (app sync or the approximate 30-minute redraw), so it can lag a few minutes behind the clock.

## Patient names, screenshots and full-screen app (v0.3.0)

- The app opens straight onto the Poliedron agenda (no native header or button); screenshots are allowed (FLAG_SECURE removed on PO request).
- Widget settings moved to **Personal › Impostazioni › Widget Android**, shown only inside the Android app: *Aggiorna i widget sulla Home* (off = disconnect and clear the snapshot) and *Mostra nome e cognome dei pazienti* (**off by default**, device-local preference).
- With names on, Personal reads only `id, nome, cognome` of the patients of visible, non-cancelled appointments in the snapshot window (existing Studio session/RLS, chunks of 100) and titles become `Cognome Nome · Tipo`. Notes are never sent. Names still show only on widgets where Dettagli is toggled. They live in the app-private snapshot (no backup) until disconnect, logout or the 24 h expiry. This is a PO decision on health data shown on the Home screen.

## Build and install

Use JDK 17, Android SDK platform 35/build-tools 35.0.0 and Gradle 8.11.1:

```
gradle -p android/agenda :app:assembleDebug :app:lintDebug
```

The PR's `Android agenda widgets` check creates a debug APK artifact (zipped by GitHub: extract it first, never install from inside the zip viewer — ColorOS reports only "App non installata"). After each Android change merged to master the same workflow publishes the tested APK as a plain file, `poliedra-agenda.apk`, in the fixed pre-release `agenda-android` (Releases page): download and open it directly. The log's **Verify APK** step prints signature schemes and manifest data. Each CI build still uses a fresh debug key, so an update may require uninstalling the previous copy until a fixed signing key is configured as a repository secret (Product Owner decision). A debug APK is for evaluation, not a signed Play Store release. A production signing key and distribution channel are not added by this change.

After the web adapter has been released, install the APK, open **Poliedra Agenda**, sign into Personal and connect the Studio agenda with the existing login. Android WebView sessions are independent from Chrome/PWA sessions. In the Android launcher hold an empty Home area, open Widgets and choose either Poliedra Agenda widget. Menu wording varies by launcher. Keep Android System WebView current.

The approved web origin is `https://personal.poliedrasoft.it`. The APK uses production; it does not read PR previews. **Until this PR's web change is merged and deployed, widgets remain unconnected.** This is an agenda companion, not a native replacement for all Personal document/upload/voice features.

## Refresh and privacy

Snapshot refresh happens on app mount, foreground focus/visibility and each foreground minute, using the existing Studio session and RLS. Data coverage: previous seven through next 28 local calendar days. Queries page by 500 rows; over 5,000 rows fails closed. No second backend, tenant fallback, schema change or native copy of credentials. Patients are not queried; patient names/IDs/notes and event notes never enter the native payload.

The bridge is AndroidX WebKit's origin-scoped WebMessage listener, exact HTTPS origin, main frame only; there is no addJavascriptInterface/wildcard origin. Foreign navigations open outside the WebView; SSL errors cancel and cleartext/file/content access are disabled. The app's native private preferences hold only a bounded display snapshot. Backup is disabled. Widget details are initially hidden and explicitly revealed per widget; revealed titles are visible on Home.

**No background live synchronization is claimed.** The update timestamp is always shown. Android redraws periodically (30 minutes; scheduling is approximate); snapshots older than 24 hours are hidden on the next render. An unavailable/uncovered day asks to open the app, never reports a free day. Logout/unmount/auth changes clear native data; changes to accounts or permissions made elsewhere cannot revoke an offline snapshot instantly. Turn off Impostazioni › Widget Android › Aggiorna i widget sulla Home to pause updates and remove the snapshot, or uninstall; turning it on resumes synchronization. Foreground refresh failures clear the cache. Opening the app is required to see subsequent changes made elsewhere.

## Validation and release

Use synthetic data for tests. `node --test tests/androidAgendaWidget.test.mjs tests/widgetAzioni.test.mjs`, full Node suite, both Vite builds, Android assemble/lint. Physical OPPO launcher/touch/WebView/login, row/Domani/quick-widget actions remain manual acceptance checks, not covered by compilation. Never claim an image mockup is a native screenshot. No manual production deploy or database operation; normal dedicated PR review/merge/release applies. Revert the web adapter and uninstall the companion for rollback; no records are changed.
