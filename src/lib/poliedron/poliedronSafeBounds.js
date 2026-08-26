/* POL-AI-002A §4 — unified safe-operating-area model for the mobile
   Poliedron Orb. Pure and DOM-free (`viewportWidth`/`viewportHeight`/
   `safeAreaInsets` are plain numbers the caller resolves separately), so
   it's directly unit-testable without a browser.

   The returned box is where the orb's top-left corner (`x`/`y`) may
   legally sit so that its ENTIRE bounding box — not just its center —
   stays inside the safe area: viewport minus safe-area insets minus an
   additional visual safety margin and, when supplied, a protected bottom
   zone such as the compact mobile navigation dock. */

export const DEFAULT_SAFETY_MARGIN = 20; // §4 target: 16-24px

export function getPoliedronSafeBounds({
  viewportWidth,
  viewportHeight,
  orbWidth,
  orbHeight,
  safeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 },
  additionalSafetyMargin = DEFAULT_SAFETY_MARGIN,
  bottomReservedExtra = 0,
  protectedBottomZone = null,
}) {
  const insets = {
    top: safeAreaInsets.top || 0,
    right: safeAreaInsets.right || 0,
    bottom: safeAreaInsets.bottom || 0,
    left: safeAreaInsets.left || 0,
  };

  const minX = insets.left + additionalSafetyMargin;
  const minY = insets.top + additionalSafetyMargin;
  // Math.max below: on a viewport too small to fit orb + both margins,
  // fail toward "pinned at the safe minimum" rather than a negative/
  // inverted range that would make every clamp() call misbehave.
  const maxX = Math.max(minX, viewportWidth - orbWidth - insets.right - additionalSafetyMargin);
  const naturalMaxY = Math.max(
    minY,
    viewportHeight - orbHeight - insets.bottom - additionalSafetyMargin - bottomReservedExtra
  );
  const protectedMaxY = protectedBottomZone
    ? protectedBottomZone.top - orbHeight - (protectedBottomZone.gap || 0)
    : naturalMaxY;
  const maxY = Math.max(minY, Math.min(naturalMaxY, protectedMaxY));

  return { minX, maxX, minY, maxY };
}

export const clampToBounds = (value, min, max) => Math.min(max, Math.max(min, value));

/* Sorgente stabile per le dimensioni del viewport da usare nel posizionamento
   dell'Orb. `window.innerWidth/innerHeight` su mobile Safari (e diverse
   WebView Android) cambiano quando la barra degli indirizzi si nasconde o
   riappare — cosa che un overlay a schermo intero come la Scheda Paziente
   tende a innescare aprendosi/chiudendosi. Se il calcolo della posizione
   "agganciata" (docked) usa quei valori grezzi, la stessa identica
   posizione logica risulta in coordinate diverse prima/dopo l'apertura,
   percepito dall'utente come "Polyedron continua a spostarsi" a ogni
   ciclo apri/chiudi. `window.visualViewport` è pensato apposta per non
   seguire quelle fluttuazioni di chrome del browser ed è la fonte
   raccomandata per un posizionamento stabile di elementi fixed; ricade su
   `window.innerWidth/innerHeight` solo dove `visualViewport` non esiste. */
export function getStableViewportSize() {
  if (typeof window === 'undefined') return { width: 0, height: 0 };
  const vv = window.visualViewport;
  return {
    width: vv?.width || window.innerWidth,
    height: vv?.height || window.innerHeight,
  };
}

/* Reads real safe-area-inset-* values into plain numbers. Uses the
   standard "probe element" technique (env() is a CSS-time-only value —
   there is no direct JS API for it): a zero-size, aria-hidden, non-
   interactive element with `padding: env(safe-area-inset-*)`, whose
   computed padding IS the inset in px once the browser resolves it.
   NOT unit-tested here (requires a real DOM/browser with actual device
   insets) — this sandbox's headless Chromium has no physical notch and
   always resolves these to 0px, so a passing structural check here would
   not prove correctness on a real iPhone; see the final report. */
export function readSafeAreaInsets() {
  if (typeof document === 'undefined') return { top: 0, right: 0, bottom: 0, left: 0 };
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText =
    'position:fixed;inset:0;width:0;height:0;overflow:hidden;pointer-events:none;visibility:hidden;' +
    'padding-top:env(safe-area-inset-top,0px);padding-right:env(safe-area-inset-right,0px);' +
    'padding-bottom:env(safe-area-inset-bottom,0px);padding-left:env(safe-area-inset-left,0px);';
  document.body.appendChild(probe);
  const cs = window.getComputedStyle(probe);
  const insets = {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
  document.body.removeChild(probe);
  return insets;
}
