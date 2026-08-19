# Current task

- TASK: POL-FIS-001
- TITLE: Physiotherapy Clinical Core — episode/session vertical slice
- OWNER: CODEX
- BRANCH: `vertical/POL-FIS-001-physio-clinical-core`
- STATUS: `WAITING_PRODUCT_OWNER`

## Objective

Deliver a safe, daily-use foundation for episode-based physiotherapy records without replacing existing Poliedra systems or touching production.

## Completed

- FIS-001A audit retained as baseline.
- Additive episode/RBAC/clinical-history migration, RLS and synthetic tests prepared.
- Existing Fisio tab now exposes episode overview, progressive anamnesis, body-map snapshots, rapid draft/finalized sessions, amendments and timeline while retaining legacy history.
- PostgreSQL 17 migration/RLS/regression, Node tests, build, lint, static analysis and scope checks completed locally.

## Product Owner gate

Review the vertical slice, the six `PRODUCT_OWNER_DECISION_REQUIRED` items and the remaining pilot gaps in `pol-fis-001b-c-vertical-slice.md`. Do not apply the migration remotely, seed permissions, backfill legacy rows, deploy or merge before explicit approval.
