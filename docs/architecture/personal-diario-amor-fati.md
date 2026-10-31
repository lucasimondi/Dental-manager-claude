# PERSONAL-DIARIO-AMOR-FATI

Owner-authorized vintage diary inside Poliedron Personal. Open from the Home cover card or the book button in the header, without widening the mobile dock.

## Behavior

Leather cover, gold italic title, ivory ruled paper, animated page leaf, swipe on paper margins and buttons. Reduced-motion support. All writing is plain text rendered through React; clipboard/drop/file-picker images are decoded and re-encoded to JPEG, max 1600px and 25MB input. Captions are editable and searchable. Originals are not retained; screenshots/photos are visual diary copies, not archival originals. HEIC is accepted only if the browser decodes it; otherwise use JPG or a screenshot.

A text block gets Europe/Rome's date at its first nonblank input. Existing text keeps its historical date; appending to a block from a past date starts a new dated block. Explicit edits to old text retain its date. Headings compare with the preceding block across page boundaries and blank pages. Empty pages have no date. Long writing/pasted text splits without dropping characters into fresh pages inserted before any existing next page; approximate 1800 characters per page, so wrapping varies by device. Manual pages append; next beyond the end appends, preserving skipped blank pages. Search locates individual text/caption blocks, selecting the matched text; choosing a date jumps to its first entry. Export contains the complete in-memory JSON and image copies.

## Persistence and security

Only Personal's existing `archivioDb` is used. Repository evidence: `supabase/archivio/migrations/20261015200000_pol_vita_003_personal.sql` defines `impostazioni_app(chiave text primary key, valore jsonb, aggiornato_il timestamptz)` with owner-only `e_proprietario()` RLS and anonymous revocation. A distinct `diario:amor-fati:pagina:<uuid>` row per page, no change to the `personal` settings key or normalizer. No schema migration, policy/auth/grant change, tenant fallback, Studio client, Apps Script publication, AI dispatch or public image URL.

Archive reads paginate 30 rows at a time, then sort by page order. Save uses insert for new IDs and compare-and-swap on `aggiornato_il` for existing pages. A missing/denied/conflicting write never produces “Salvato”; it stops automatic retries, keeps the edited page mounted and offers retry/export. Changes during an in-flight save are drained serially with the returned revision. App navigation is held until pending writes finish. Browser unload warns while dirty. No offline synchronization/background-termination guarantee: a browser killed before network persistence can lose pending edits. Currently the diary loads all page JSON/images for complete text search; very large photo diaries will need lazy image rows/indexing as a separate performance task.

## Validation and release

Synthetic Node coverage for Rome midnight/DST, heading continuity, lossless pagination, caption/text/date search, paginated reads and compare-and-swap conflict safety. Browser fixture injects a synthetic archive adapter, does not authenticate or touch live data; verifies cover, writing, one heading per day, search focus, pasted PNG, reload, blank/skipped pages and 4800-character auto pagination. Mobile cover inspected at 375px in a frame. No real account cross-device or physical phone claim.

Dedicated branch/PR, build both entry points and full Node suite before review. No remote schema setup needed according to repository evidence; live archive compatibility remains a post-merge smoke check. Merge only on explicit PO approval per AGENTS.md. Rollback: revert PR; keep diary-prefixed rows so written entries survive. Immutable stable branches untouched.

## Full-screen presentation — 31 October 2026

The diary now owns the Personal viewport: no surrounding app header/dock/card, with an explicit floating exit to Oggi. Search/export, page navigation, image insertion and manual-page creation float above the scrollable book. Leather cover and ivory pages fill the available screen, with binding/page-edge depth. No Fullscreen browser permission/API is requested.

The cover also rotates open. Page turns use a read-only snapshot of a real page on a two-sided CSS 3D sheet, rotating independently of the editor/binding. Forward turns reveal the target editor underneath the outgoing sheet; backward turns keep the old editor until the incoming sheet lands. Snapshots are aria-hidden and contain React-rendered text/images only. A short lock prevents double turns; an850ms timer clears it independently of animation events, so disabled/reduced-motion animations cannot trap navigation. Reduced motion skips the turn entirely. Existing editor, autosave, page rows, search/selection, photos and dates retained. Manual append and next beyond end animate; automatic text pagination keeps the existing editor workflow.

Browser QA with synthetic archive: 375px full-viewport cover/page, forward and backward turns, commands disabled only during the turn and re-enabled afterward, manual third page with autosave, search jump from page3 to page1 selecting its exact text, exit restores app chrome. Desktop full-viewport cover visually inspected. No real diary content, production data mutation or physical device claim. Page turn animation is CSS-based; no page-flip dependency added. Rollback reverts this presentation PR, preserving diary rows.

## Native scroll follow-up — 31 October 2026

After the full-screen release, the owner reports scrolling still freezes. This follow-up removes the viewport-height/flex/overflow-hidden app shell and the nested scrollport for the diary. HTML owns the vertical document scroll; body remains overflow-visible with normal overscroll chaining. Header/dock remain hidden and floating controls unchanged. Page turns and return-to-cover reset window scroll. The ordinary textarea editor and persistence are retained.

Perspective now exists only on the transient animated sheet layer. Removed perspective from the static desk/book surfaces after a synthetic375px long-page run rendered a blank surface during scrolling although DOM text and geometry remained present; scrolling the final version up/down showed the last lines. Vertical movement over12px cancels page-swipe tracking, touchcancel clears it, and editor/control touches never start a swipe. A deliberate horizontal margin swipe still turns pages.

Browser QA:45-line synthetic page, document scroll measured beyond1080px, bottom lines visible after scrolling on the text, up/down at375px, writing after scroll returns Salvato, search finds/selects long-block text. No physical touch device test or live user diary data used; browser wheel and source gesture-handler inspection do not prove Android hardware behavior. Rollback revert follow-up, keep entries.
