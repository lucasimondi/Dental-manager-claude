# POL-VITA-010 — One original agenda presentation, two application adapters

The original Studio agenda presentation now lives in `shared/agenda`. Studio and Personal import the same DayStrip, view picker, month toolbar/calendar/details, time grid, appointment/event blocks, slot-height measurement and swipe handlers. Visible weekdays, original interval packing and the light palette are also single sources. `src/lib/agendaVisibleDays.js` and `src/lib/utils.js` retain their existing public exports.

The shared module imports no Studio component, authentication client, WhatsApp service, patient store or database. It receives values, render slots and callbacks. Studio retains its existing clinical actions, booking, overlap behavior, resource filters, WhatsApp, drag, resize, menus and persistence. Personal retains its authenticated Studio read adapter and its existing personal-event writes; clinical appointments remain read-only there.

Personal reads only `studio_info.agenda_settings`, scoped to the validated `app_metadata.studio_id`, to match Studio hours, slot duration, zoom and hidden weekdays. No migration, RLS, patient mutation, financial change, Edge Function or production-data operation is included. Existing defaults are used only when an authorized Studio has no saved agenda settings.

Conflicting Personal `.ag-*` CSS is removed. Its agenda uses the same flex/scroll chain, original floating chrome and spacers. Application-specific actions and personal deadline/all-day-event ribbons remain adapter-owned. The Studio and Personal docks retain their own actions; sharing the agenda does not make Personal a clinical client.

## Bidirectional switch (additional Product Owner request)

`Vai a Personal` and `Vai a Studio` carry only validated calendar UI state: selected day, view and, for Month, the independently displayed month. Both composition roots recognize the calendar entry request after their existing authentication gates. No access token, patient identifier, tenant identifier or clinical content is placed in a URL.

The existing production Studio URL and Personal custom domain are used for that pair; local development and branch previews stay on their current origin. Existing sessions are reused only by each application on its own origin. No authentication or role checks are bypassed.

## Reproduction and rollback

`npm ci`, `npx playwright install --with-deps chromium webkit`, `npm test`, `npm run build`, `npm run build:personal`, `npm run test:agenda:visual`.

The visual runner starts its own local Vite server, blocks all external requests, mounts the real components with synthetic data, and generates a temporary original Studio component from the PR base commit. It deletes that temporary file on exit; no duplicate implementation is shipped. Set `AGENDA_BASE_REF` to choose an explicit baseline. GitHub Actions uses the PR base SHA and uploads screenshots even on failure.

Rollback: revert the dedicated PR. No database or backend rollback is required. The immutable checkpoint `stable/2026-08-27-full-recovery` remains at `070b28fd4eae4e2cc397584201d0bb149468fae7` and was not modified.
