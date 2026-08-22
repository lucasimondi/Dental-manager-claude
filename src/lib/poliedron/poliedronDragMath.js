/* POL-AI-002A §2-3, §10, §25-26 — pure drag/persistence math shared
   by usePoliedronPosition (mobile, free XY) and usePoliedronEdgePosition
   (desktop, vertical-only + side). Extracted out of the hooks so the
   exact release/snap/reclamp behavior is unit-testable without a DOM or
   a React renderer. */

import { clampToBounds } from './poliedronSafeBounds.js';

/**
 * computeDragPosition — §2: "position = pointer position - original grab
 * offset", then clamped so the whole bounding box stays inside `bounds`.
 * Preserving the exact grabOffset (captured once, at pointerdown) is what
 * makes the orb follow the precise point the user grabbed it by, on every
 * subsequent pointermove, however far the drag travels.
 */
export function computeDragPosition({ pointerX, pointerY, grabOffsetX, grabOffsetY, bounds }) {
  return {
    x: clampToBounds(pointerX - grabOffsetX, bounds.minX, bounds.maxX),
    y: clampToBounds(pointerY - grabOffsetY, bounds.minY, bounds.maxY),
  };
}

/** Fraction-of-range persistence (§6, §10): always reconstructible to a
 * valid position on any viewport, because `fractionFromPosition` and
 * `positionFromFraction` are exact inverses of each other for any bounds. */
export function fractionFromPosition({ x, y, bounds }) {
  const rangeX = bounds.maxX - bounds.minX;
  const rangeY = bounds.maxY - bounds.minY;
  return {
    xFrac: rangeX > 0 ? clampToBounds((x - bounds.minX) / rangeX, 0, 1) : 0.5,
    yFrac: rangeY > 0 ? clampToBounds((y - bounds.minY) / rangeY, 0, 1) : 0.5,
  };
}

export function positionFromFraction({ xFrac, yFrac, bounds }) {
  return {
    x: bounds.minX + xFrac * (bounds.maxX - bounds.minX),
    y: bounds.minY + yFrac * (bounds.maxY - bounds.minY),
  };
}

/** §10 — desktop magnetic side switch: only once the drag has clearly
 * gone toward the opposite edge by at least `minDragX`, never on small
 * jitter. `dx` is signed pointer travel (current - start); `side` is the
 * edge being dragged FROM. */
export function decideSideSwitch({ dx, side, minDragX }) {
  const towardOpposite = side === 'right' ? -dx : dx;
  return towardOpposite > minDragX;
}
