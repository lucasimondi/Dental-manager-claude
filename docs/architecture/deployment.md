# Deployment — current state

Vercel appears to be the active platform. `vercel.json` defines SPA rewrites and no-cache headers for the entry page. `api/whatsapp-webhook.js` proxies Meta webhook traffic to a hardcoded Supabase Edge Function.

`netlify.toml` is also present, creating hosting ambiguity. Vite builds `dist` and the PWA uses automatic update plus manual vendor chunks.

Known gaps:
- no GitHub Actions;
- no required status checks or documented promotion flow;
- no documented staging/preview environment model;
- Supabase URLs are hardcoded;
- Edge Functions are not versioned;
- Vercel proxy uses CommonJS in a package marked `type: module`, requiring runtime verification;
- Netlify lacks an explicit SPA fallback;
- security headers, monitoring, rollback telemetry, and PWA release governance are undocumented.

Deployment architecture changes require Product Owner approval. POL-001 does not change runtime configuration.
