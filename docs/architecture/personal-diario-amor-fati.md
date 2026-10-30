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
