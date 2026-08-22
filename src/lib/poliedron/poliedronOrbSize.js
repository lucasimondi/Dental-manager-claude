/* Standalone mobile gem and transparent hit area: clamp(58px, 17vw, 72px). */

const MIN_SIZE = 58;
const MAX_SIZE = 72;
const WIDTH_RATIO = 0.17;

export function computeMobileOrbSize(viewportWidth) {
  const raw = (viewportWidth || MIN_SIZE) * WIDTH_RATIO;
  return Math.round(Math.min(MAX_SIZE, Math.max(MIN_SIZE, raw)));
}
