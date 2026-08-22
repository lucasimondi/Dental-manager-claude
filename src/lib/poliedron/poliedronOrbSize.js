/* Compact-dock hero size: CSS-equivalent clamp(88px, 24vw, 104px). */

const MIN_SIZE = 88;
const MAX_SIZE = 104;
const WIDTH_RATIO = 0.24;

export function computeMobileOrbSize(viewportWidth) {
  const raw = (viewportWidth || MIN_SIZE) * WIDTH_RATIO;
  return Math.round(Math.min(MAX_SIZE, Math.max(MIN_SIZE, raw)));
}
