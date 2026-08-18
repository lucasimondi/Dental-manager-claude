# Poliedra

Poliedra is a React/Vite management application for healthcare and professional practices. The current product includes a dental-first core, a concrete Physio vertical, Supabase-backed multi-studio data, scheduling, patient records, documents, payments, management control, and integrations.

## Current architecture

- React 18 SPA built with Vite 5
- Supabase Auth, PostgreSQL, RLS, Realtime, RPC, Storage, and external Edge Functions
- Vercel deployment with a serverless WhatsApp proxy
- PWA support
- JavaScript/JSX; no automated test or CI suite currently versioned

The repository does not yet contain the complete production Supabase backend. Do not reconstruct missing schema or policies by guessing. See `docs/runbooks/migrations.md`.

## Agent workflow

All coding agents must begin with `AGENTS.md` and `docs/coordination/current-task.md`. Architecture, decisions, backlog, and handoffs live under `docs/`.

## Local start

Prerequisites and safe setup are documented in `docs/runbooks/local-development.md`. Never point unapproved local work at production.
