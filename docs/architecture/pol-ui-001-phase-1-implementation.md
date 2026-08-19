# POL-UI-001 Phase 1 implementation

## Boundaries

Phase 1 changes the Home layout shell only. Existing widget rendering and data semantics remain inside `Dashboard.jsx`; the workspace wraps those same rendered components without recalculating their values.

## Registry and layout contract

`homeWidgetRegistry.js` is the presentation registry. Each entry declares stable ID, label/icon, category, default visibility, supported sizes and default size. Persisted JSON is normalized against this registry and contains only `id`, `order`, `visible` and `size`. Unknown/duplicate widgets are discarded; newly registered widgets receive their declared defaults.

Desktop uses a 12-column grid with small, medium and wide spans. Mobile and the forced mobile preview use one-column stacking with the same order and widget definitions. Native HTML drag/drop reorders preview frames; size controls expose only registry-supported values.

## Persistence and security

`user_home_layouts` has primary key `(studio_id,user_id)`. The client always filters and writes both values. RLS additionally requires `user_id=auth.uid()` and an active matching `studio_users` membership for every operation. `anon` has no grants. Configuration has a 32 KiB limit and never stores domain values or sensitive payloads.

Reset restores the versioned registry default in the draft. It becomes persistent only after `Salva Home`; cancelling discards the draft. A save error leaves the active layout unchanged.

## Reversal

Before production use, rollback is removal of the migration table plus reverting the UI files. After use, export presentation JSON if desired before dropping the table. No business data depends on this table.
