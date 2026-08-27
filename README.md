# Poliedra

Poliedra is a React/Vite management application for healthcare and professional practices. The current product includes a dental-first core, a concrete Physio vertical, Supabase-backed multi-studio data, scheduling, patient records, documents, payments, management control, and integrations.

## Current architecture

- React 18 SPA built with Vite 5
- Supabase Auth, PostgreSQL, RLS, Realtime, RPC, Storage, and external Edge Functions
- Vercel deployment with a serverless WhatsApp proxy
- PWA support
- JavaScript/JSX; a versioned Node test suite (`npm test`, `tests/*.test.mjs`) and a
  pull-request CI workflow (`.github/workflows/pol003e-ci.yml`, running `npm test` and
  `npm run build`) exist. There is no lint, typecheck or E2E suite yet.

The repository does not yet contain the complete production Supabase backend. Do not reconstruct missing schema or policies by guessing. See `docs/runbooks/migrations.md`.

## Agent workflow

Poliedra is developed concurrently by GitHub Copilot, Claude Code, Codex and Perplexity.
All of them are bound by the same authoritative rules: `AGENTS.md` is the agent
constitution, and every agent must begin there and with `docs/coordination/current-task.md`.
Architecture, decisions, backlog, and handoffs live under `docs/`; the documentation map is
in `docs/README.md`. Poliedron is a single agent — see `docs/architecture/POLIEDRON.md`.

## Local start

Prerequisites and safe setup are documented in `docs/runbooks/local-development.md`. Never point unapproved local work at production.
