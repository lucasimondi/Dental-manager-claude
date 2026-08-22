/* POL-AI-002A §1 — mobile Orb size, ~1.5x the previous 68px, targeting
   96-108px, scaled down automatically on narrow devices (375px) so it
   never looks disproportionate. Pure function — testable without a DOM. */

const MIN_SIZE = 96;
const MAX_SIZE = 108;
const WIDTH_RATIO = 0.26; // 375 * 0.26 ≈ 97.5 (near MIN), 430 * 0.26 ≈ 111.8 (clamped to MAX)

export function computeMobileOrbSize(viewportWidth) {
  const raw = (viewportWidth || MIN_SIZE) * WIDTH_RATIO;
  return Math.round(Math.min(MAX_SIZE, Math.max(MIN_SIZE, raw)));
}
