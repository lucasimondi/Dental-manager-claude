# Deployment runbook — current baseline

No deployment is authorized by POL-001.

Current evidence indicates Vercel deployment and a Supabase production backend; Netlify configuration is also present. Before future deployment, the Product Owner must identify the authoritative platform, environments, responsible operator, required checks, secret manager, and rollback owner.

Future minimum flow: approved task branch, reviewed diff, passing quality gates, preview/staging validation with synthetic data, explicit Product Owner gate for database/security/financial/deployment changes, reversible migration plan, deployment record, smoke checks, and rollback readiness.

Never deploy directly from an agent without explicit authorization. Never change production to compensate for missing repository definitions.
