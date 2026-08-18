# Deployment — authoritative model

## Deployment authority

Vercel is the sole authoritative hosting and deployment platform for Poliedra.

- GitHub `master` is the source branch for production promotion.
- Pull-request/branch previews are expected to run on Vercel.
- `vercel.json` is the repository deployment configuration for SPA rewrites and entry-page cache control.
- Netlify is not part of the supported deployment architecture and its repository configuration has been removed under POL-002C.
- Supabase remains the authoritative backend for database, Auth, Storage and Edge Functions.

## Current runtime notes

`api/whatsapp-webhook.js` proxies Meta webhook traffic to a Supabase Edge Function. Vite builds `dist` and the PWA uses automatic update plus manual vendor chunks.

## Promotion model

1. Work happens on a dedicated branch.
2. Vercel preview is used for application-level verification.
3. Required tests/review must pass before merge.
4. Product Owner approval gates production-affecting changes.
5. Merge to `master` is the only supported application promotion path.
6. Supabase migrations remain a separate controlled deployment step and must not be implicitly coupled to frontend deployment.

## Remaining gaps

- no GitHub Actions / required repository status checks yet;
- staging environment model still needs formalization;
- some Supabase URLs/config remain hardcoded and should move to managed environment configuration;
- Edge Functions are not fully versioned in this repository;
- Vercel proxy runtime compatibility requires dedicated verification;
- security headers, monitoring, rollback telemetry and PWA release governance remain to be completed;
- deployment rollback procedure needs an automated release checklist.

POL-002C removes deployment ambiguity only. It does not deploy application code or alter Supabase production.
