# POL-UI-001 Phase 1 validation

Validation was local-only and used synthetic identities. No production database, deployment or remote migration was touched.

## Results

- PostgreSQL 17 migration: passed in disposable Supabase image `17.6.1.159`.
- RLS regression: own read/insert/update passed; cross-tenant read/update/insert blocked; suspended membership insert blocked; all changes rolled back.
- Supabase database lint: no schema errors. Performance advisor: no issues. Security advisor reported only the deliberately minimal synthetic `studio_users` bootstrap without RLS; `user_home_layouts` itself produced no finding.
- Node tests: 9/9 passed. Coverage includes normalization, unknown/duplicate IDs, default reset, add/remove, reordering, supported resize, stable React keys, explicit studio/user persistence and desktop/mobile responsive rules.
- Vite production build: passed. Existing pdfjs `eval` and large-chunk warnings remain unchanged.
- Desktop/mobile contract: desktop 12-column spans and mobile single-column stacking use the same normalized layout and preserve order. Forced Desktop/Mobile preview classes and resize controls are covered by deterministic source/CSS tests.
- Interactive browser attempt: the temporary local harness was served successfully, but the Codex in-app Browser connection failed before page control with an internal `trusted code path` runtime error. No alternative browser-control surface was substituted. The harness was removed and is not part of the diff.
- Final secret scan, diff check, deployment-scope check and worktree review: passed before commit.

## Residual risks

Native HTML drag/drop is primarily a pointer/desktop interaction; mobile users can preview the responsive result but touch-first reordering may need an accessible move-up/down control in a later UI refinement. The Phase 1 reset uses the versioned platform registry default; editable studio-owner defaults remain a later capability. Migration and client must be released in the approved order because persistence fails closed when the table is absent.
