/* POL-UI-013C: development-only diagnostic trail for Home layout
   load/save, to make the real runtime sequence (source used, success/
   error, race outcomes) observable while debugging personalization
   persistence — without exposing anything to production users. Gated on
   Vite's `import.meta.env.DEV`, which is statically replaced at build
   time, so this is fully stripped from the production bundle's logic
   (always `if (false)`), not just hidden behind a runtime flag. Never
   log patient data, secrets, or raw studio/user identifiers — only
   presentation-only shape info (counts, source labels, booleans). */
const isDev = () => Boolean(import.meta.env?.DEV);

export const logHomeLayoutEvent = (event, detail) => {
  if (!isDev()) return;
  // eslint-disable-next-line no-console
  console.log(`[home-layout] ${event}`, detail === undefined ? '' : detail);
};
