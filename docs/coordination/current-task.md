# Current task

- TASK: POL-002A
- TITLE: Critical Security Hardening
- OWNER: CODEX
- BRANCH: `security/POL-002A-critical-hardening`
- STATUS: `WAITING_PRODUCT_OWNER`

## Objective

Prepare a minimal, versioned hardening patch for confirmed Supabase authorization issues without modifying production.

## Result

Repository and client usage were inspected. The authoritative function signatures, return types, bodies, grants, policy definitions, trigger bindings, and Storage policies required for a safe migration are not versioned and no metadata-only production access is available.

Creating `CREATE OR REPLACE FUNCTION`, `REVOKE/GRANT`, policy, or regression-test SQL without those definitions would violate the prohibition on inventing database objects and could break public or privileged flows. No migration was created.

A verified assessment, patient-files dependency analysis, required test matrix, and exact unblock requirements are documented in `docs/security/pol-002a-hardening-assessment.md`.

## Product Owner action required

Provide sanitized metadata-only definitions enumerated in the assessment, then authorize POL-002A to resume. Do not merge, deploy, apply remote migrations, or begin the next task.
