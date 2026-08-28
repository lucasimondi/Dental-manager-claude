# Rollback runbook — policy

Every change must define a reversal before deployment.

Application rollback should identify the last known-good commit and hosting deployment, verify database compatibility, and preserve evidence. Database rollback must never default to destructive down migrations: prefer forward corrective migrations, backups, feature disabling, or compatibility changes approved by the Product Owner and database owner.

## Golden rollback checkpoints

Poliedra preserves manually verified application states as immutable `stable/*` branches.

Current Golden Rollback Point:
- branch: `stable/2026-08-27-full-recovery`
- commit: `070b28fd4eae4e2cc397584201d0bb149468fae7`
- meaning: Product Owner verified the recovered patient/document/mobile flows as the known-good application state after the recovery sequence.

Rules:
- `stable/*` branches are disaster-recovery references only and must never be used for normal development.
- Never commit to, rebase, rename, delete, force-push, or move an existing `stable/*` checkpoint.
- A newer stable version creates a new checkpoint; it never replaces or advances an older checkpoint.
- Before a high-risk intervention, preserve the latest Product-Owner-verified stable state as a new checkpoint when one does not already represent that state.
- Returning application code to a checkpoint requires explicit Product Owner authorization.
- Do not assume database compatibility from application code alone. Verify migrations, schema compatibility, RLS, and data implications before rollback.

## Rollback procedure

Before any rollback:
- stop and identify impact;
- preserve logs and deployment identifiers;
- identify the intended `stable/*` checkpoint and verify its exact commit SHA;
- confirm tenant/data implications;
- confirm application/database version compatibility;
- obtain the required Product Owner gate;
- execute through the authorized operator;
- validate with smoke and integrity checks;
- document the result, including the checkpoint, previous production SHA, restored deployment, tests, and any data-impact assessment.

Prefer a controlled deployment of the known-good application commit or an explicitly reviewed recovery branch. Do not rewrite `master` history or force-move a golden checkpoint as a shortcut.

POL-001 performs no deployment and needs no runtime rollback.
