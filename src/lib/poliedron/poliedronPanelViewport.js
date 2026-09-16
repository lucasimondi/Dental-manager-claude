// POL-UI-041: on mobile the Poliedron panel's keyboard opens as soon as it
// mounts (the query input auto-focuses). A `position: fixed; inset: 0`
// container sizes itself to the full LAYOUT viewport, which iOS Safari
// never shrinks for an on-screen keyboard — the keyboard simply overlaps
// the bottom of that fixed box, and the scrollable content inside has no
// awareness that part of its space is covered, so no amount of scrolling
// can bring the last quick actions into view. `window.visualViewport`
// reports the real visible height/offset, shrinking live as the keyboard
// opens, including on iOS Safari — unlike `env(keyboard-inset-height)`
// (used elsewhere in this codebase), which is a Chromium/VirtualKeyboard-
// API-only feature always 0px on iOS.
export function computeMobilePanelViewportRect(visualViewport) {
  if (!visualViewport) return null;
  return { top: visualViewport.offsetTop || 0, height: visualViewport.height };
}
