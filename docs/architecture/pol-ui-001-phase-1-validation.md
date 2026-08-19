# POL-UI-001 Phase 1 validation

Validation was local-only and used synthetic identities. No production database, deployment or remote migration was touched.

## Results

- PostgreSQL 17 migration: passed in disposable Supabase image `17.6.1.159`.
- RLS regression: user override, admin-owned studio default, member inheritance and reset passed; cross-tenant access, non-admin studio writes and suspended-user access were blocked; all test changes rolled back.
- Supabase database lint: no schema errors. Performance advisor: no issues. Security advisor reported only the deliberately minimal synthetic `studio_users` bootstrap without RLS; `user_home_layouts` itself produced no finding.
- Node tests: 11/11 passed. Coverage includes normalization, user/studio/platform resolution, touch-safe bidirectional reorder, unknown/duplicate IDs, add/remove, supported resize, stable React keys, explicit studio/user persistence and desktop/mobile responsive rules.
- Vite production build: passed. Existing pdfjs `eval` and large-chunk warnings remain unchanged.
- Desktop/mobile contract: desktop 12-column spans and mobile single-column stacking use the same normalized layout and preserve order. Forced Desktop/Mobile preview classes and resize controls are covered by deterministic source/CSS tests.
- Interactive browser attempt: the temporary local harness was served successfully, but the Codex in-app Browser connection failed before page control with an internal `trusted code path` runtime error. No alternative browser-control surface was substituted. The harness was removed and is not part of the diff.
- Final secret scan, diff check, deployment-scope check and worktree review: passed before commit.

## Residual risks

The two pre-merge risks are closed: touch reorder does not depend on HTML5 drag/drop, and reset follows studio then platform inheritance. Interactive browser visual regression remains desirable when the recorded Codex browser trust-path issue is resolved; deterministic DOM/CSS contracts cover the 375/768 touch controls but do not replace a later device pass. Both migrations must precede the client because persistence fails closed when either table is absent.
