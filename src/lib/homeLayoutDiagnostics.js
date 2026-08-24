/* POL-UI-013C / POL-UI-015: diagnostic trail for Home layout load/save, to
   make the real runtime sequence (source used, save branch taken,
   success/error, race outcomes) observable while debugging personalization
   persistence — without ever exposing anything to production users.

   POL-UI-015 round 4 — ROOT CAUSE of "nobody can see where the save stops":
   this used to be gated on `import.meta.env.DEV` alone. A Netlify deploy
   preview is a PRODUCTION build (`vite build`), so `DEV` is `false` there
   and every single one of these events was compiled away. The Product
   Owner tests exclusively on the deploy preview, from an iPhone, so the
   whole diagnostic trail this file exists for was silent in the ONLY
   environment where the bug was reproducible: opening the console showed
   nothing at all, and three rescue rounds had to guess where the save
   stopped instead of reading it.

   The gate is now "dev server OR a Netlify deploy preview / local host",
   evaluated at runtime on the hostname. Production hosts (the custom
   domain and the plain Netlify site name) never match, so production
   users still get nothing. Never log patient data, secrets, tokens,
   emails, or raw studio/user identifiers — only presentation-only shape
   info: counts, source labels, booleans, widget ids. */

const PREVIEW_HOST_PATTERNS = [
  /^deploy-preview-\d+--/i, // Netlify deploy previews (PR previews)
  /^localhost$/i,
  /^127\.0\.0\.1$/,
  /\.local$/i,
];

export const isHomeLayoutDiagnosticsEnabled = () => {
  if (import.meta.env?.DEV) return true;
  const host = typeof window !== 'undefined' ? window.location?.hostname || '' : '';
  return PREVIEW_HOST_PATTERNS.some((pattern) => pattern.test(host));
};

export const logHomeLayoutEvent = (event, detail) => {
  if (!isHomeLayoutDiagnosticsEnabled()) return;
  // eslint-disable-next-line no-console
  console.log(`[home-layout] ${event}`, detail === undefined ? '' : detail);
};
