# Local development runbook

POL-001 does not establish a working local Supabase environment because the production backend is incomplete in the repository.

## Current frontend

Required: a Product Owner-approved Node.js version, npm, and a non-production Supabase environment. Commands currently exposed by the project are `npm install`, `npm run dev`, `npm run build`, and `npm run preview`.

## Safety

- Never place secrets in source or committed files.
- Never point experiments, tests, or seed scripts at production.
- Use ignored local environment files once environment configuration is introduced.
- Use only synthetic data.
- Do not run destructive Supabase commands against any remote project.
- Do not assume the hardcoded current URL is appropriate for local work.

A complete local setup can be finalized only after approved read-only capture and sanitization of the backend definitions.
