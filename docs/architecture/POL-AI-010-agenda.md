# POL-AI-010 step 1 — agenda through Poliedron

Status: implementation for review, stacked on PR #118. No production changes.

## User flow

Explicit agenda requests and their conversational follow-ups reach the existing
model gateway only on submission, never on keystrokes. Deterministic clinical,
financial and intelligence commands keep priority. The assistant reads actual
patient/appointment IDs, can inspect availability/operators, and returns a signed,
ten-minute proposal. The same preview component appears in Chat and the compact
panel. Confirmation/cancellation uses the signed token, never client-authored
tool blocks. Successful execution refreshes App's appointments independently of
Realtime and reports history-save failures separately from the operation result.

Creation, rescheduling and cancellation are supported. Cancellation changes
`stato` to `annullato` and retains history; permanent deletion belongs to the
later irreversible-operations step. Overlapping bookings are refused, including
unassigned appointments and personal blocks. No force-overlap escape is exposed.

## Server boundary

- Verified user and active studio membership on every call; current plan and
  autonomy allowlist checked again on confirmation.
- HMAC proposal binds user, studio, action, exact before/after values and expiry.
  Domain-separated HMAC derives from the existing server-only service-role secret;
  rotation invalidates outstanding proposals. Tokens stay in component memory,
  never persisted in chat metadata or localStorage.
- The service-role *client* still only reads four tenant-filtered configuration
  tables. Business reads/writes use the user's client/RLS.
- `poliedron_execute_agenda_v1` is SECURITY INVOKER. A single transaction checks
  stale records and conflicts, consumes the unique claim and writes the appointment.
- Short table locks serialize against legacy UI writers too; `lock_timeout=2s`.
  These locks span tenants briefly: validate contention under production-like load
  before release. No network/model work happens inside the transaction.
- Replay never repeats a write. Lost response means uncertain outcome: refresh
  agenda and inspect before creating a new request. No automatic write retry.
- No raw tool blocks from browser history are accepted. Only reviewed agenda
  writes are exposed by the model in this step. Existing deterministic app
  workflows remain available for other domains; legacy direct AI notes, personal
  commitments and custom actions are intentionally not exposed pending their
  reviewed implementation. Do not describe this step as “all software in chat”.

## Schema evidence (read-only, 2026-10-04)

Project `idklxdqebfceplrualgh`: inspected information_schema and pg_policies only,
no patient records. `appointments.id` is bigint without a default; RPC derives a
safe 52-bit ID from the proposal UUID, with PK conflict aborting atomically.
Appointment date is date, time is text, operator/patient IDs bigint. Personal
commitment boundaries are date/time. Existing core RLS compares studio_id against
JWT app_metadata; membership RLS exposes only the claimed studio. Authenticated
already has SELECT/INSERT/UPDATE/DELETE on appointments and personal commitments.
Existing policies and grants are unchanged. New claims table permits only own,
active-member INSERT; no client SELECT/UPDATE/DELETE, no patient payloads.

## Validation

- Initial full existing suite: 871/871 and production build passed.
- Added 9 behavioural tests (signature tampering, wrong user/studio, expiry,
  downgrade, duplicate claim, Rome dates, conflicts, validation, ID provenance,
  RPC delegation and gateway routing); pass.
- Added 4 tests of the actual bundled Edge handler with synthetic services:
  lookup/preview/confirm, cancel/replay, downgrade/suspension/forged confirmation,
  real appointment IDs/disallowed tools; 4/4 passed.
- Subsequent full run: 883/884; sole failure was the obsolete byte-copy assertion
  after moving slots into `_shared`. Replaced with function identity assertion;
  targeted 30/30 and final non-bundler suite 861/861 passed.
- Latest successful production build includes the shared calculator and new UI.
  Final small changes after that build (shared input bounds, safe autonomy enum,
  WhatsApp re-export) require CI verification on the final head.
- Synthetic SQL fixture/migration/tests PASS on PostgreSQL 17.4 (PGlite 0.3.0).
  Covers active/suspended/anonymous/two-tenant access, patient isolation, duplicate
  claim, competing slot, different operators, stale update, soft cancellation,
  personal block, rollback after failed write and invoker role. Also passed on
  PostgreSQL 16.4/18.3 during runtime setup. Single-engine PGlite tests do not
  constitute a real multi-connection concurrency/load test.
- Browser harness prepared for 375/768/1024/1440, but NOT run successfully:
  bundled browser executable absent; attempt to use installed Chrome was blocked
  because automatic approval review exhausted its usage limit. No visual-QA claim.
- No live provider call, remote migration/deploy or authenticated production smoke.

## Release order and rollback

Keep draft until CI, visual QA, multi-connection contention test and staging
end-to-end confirmation pass. Step 0 (#118) must land first; retarget this PR to
master afterwards. Product Owner approves production migration and Edge release.
Apply migration, deploy `agente-assistente` including agenda.js, confirmation.js
and `_shared/agendaSlots.js`, then release the frontend. The WhatsApp slot file is
now a re-export of `_shared`; its next approved deployment must bundle that file.
No WhatsApp deployment is required for this agenda feature.

Rollback frontend and Edge together to step 0. Then drop function
`poliedron_execute_agenda_v1(uuid,uuid,jsonb,jsonb)` before dropping
`poliedron_action_claims`. Do not delete existing appointments or undo users'
confirmed operations. Claims contain only IDs/time; define maintenance retention
before sustained rollout, always longer than maximum token lifetime.

Reproduce SQL in an empty database: run `supabase/tests/pol_ai_010_fixture.sql`,
the new migration, then `supabase/tests/pol_ai_010_agenda.sql`. The fixture is
destructive by context (creates core schema) and must never target a real project.
