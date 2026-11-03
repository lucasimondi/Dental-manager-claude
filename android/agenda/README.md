# Poliedra Agenda — Android companion (initial version)

Two real Android AppWidgets: **Giorno** (4×3 default) and **Settimana** (4×4), resizable. Both combine the existing Studio appointments and personal events visible in Personal. The week selector includes Saturday/Sunday, counts and a selectable day. Vertical ListView scrolling, previous/next period, Today, per-widget source filter and details toggle. Horizontal swiping remains the Android launcher's gesture; it is not advertised as supported. **+ Nuovo** opens the existing Personal event/patient appointment editor on the selected date, without saving anything automatically.

## Build and install

Use JDK 17, Android SDK platform 35/build-tools 35.0.0 and Gradle 8.11.1:

```
gradle -p android/agenda :app:assembleDebug :app:lintDebug
```

The PR's `Android agenda widgets` check creates a debug APK artifact. A debug APK is for evaluation, not a signed Play Store release. A production signing key and distribution channel are not added by this change.

After the web adapter has been released, install the APK, open **Poliedra Agenda**, sign into Personal and connect the Studio agenda with the existing login. Android WebView sessions are independent from Chrome/PWA sessions. In the Android launcher hold an empty Home area, open Widgets and choose either Poliedra Agenda widget. Menu wording varies by launcher. Keep Android System WebView current.

The approved web origin is `https://personal.poliedrasoft.it`. The APK uses production; it does not read PR previews. **Until this PR's web change is merged and deployed, widgets remain unconnected.** This is an agenda companion, not a native replacement for all Personal document/upload/voice features.

## Refresh and privacy

Snapshot refresh happens on app mount, foreground focus/visibility and each foreground minute, using the existing Studio session and RLS. Data coverage: previous seven through next 28 local calendar days. Queries page by 500 rows; over 5,000 rows fails closed. No second backend, tenant fallback, schema change or native copy of credentials. Patients are not queried; patient names/IDs/notes and event notes never enter the native payload.

The bridge is AndroidX WebKit's origin-scoped WebMessage listener, exact HTTPS origin, main frame only; there is no addJavascriptInterface/wildcard origin. Foreign navigations open outside the WebView; SSL errors cancel and cleartext/file/content access are disabled. The app's native private preferences hold only a bounded display snapshot. Backup is disabled. Widget details are initially hidden and explicitly revealed per widget; revealed titles are visible on Home.

**No background live synchronization is claimed.** The update timestamp is always shown. Android redraws periodically (30 minutes; scheduling is approximate); snapshots older than 24 hours are hidden on the next render. An unavailable/uncovered day asks to open the app, never reports a free day. Logout/unmount/auth changes clear native data; changes to accounts or permissions made elsewhere cannot revoke an offline snapshot instantly. Use Scollega e svuota widget in the app to pause updates and remove the snapshot, or uninstall; Collega widget resumes explicit synchronization. Foreground refresh failures clear the cache. Opening the app is required to see subsequent changes made elsewhere.

## Validation and release

Use synthetic data for tests. `node --test tests/androidAgendaWidget.test.mjs`, full Node suite, both Vite builds, Android assemble/lint. Physical OPPO launcher/touch/WebView/login and row opening remain manual acceptance checks, not covered by compilation. Never claim an image mockup is a native screenshot. No manual production deploy or database operation; normal dedicated PR review/merge/release applies. Revert the web adapter and uninstall the companion for rollback; no records are changed.
