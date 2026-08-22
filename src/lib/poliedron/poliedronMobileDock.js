import { clampToBounds } from './poliedronSafeBounds.js';

export const MOBILE_DOCK_BOTTOM = 16;
export const MOBILE_DOCK_HEIGHT = 64;
export const MOBILE_DOCK_WIDTH_RATIO = 0.84;
export const MOBILE_DOCK_MAX_WIDTH = 390;
export const MOBILE_DOCK_MIN_WIDTH = 292;
export const MOBILE_ORB_CENTER_ELEVATION = 26;
export const MOBILE_DOCK_PROTECTED_GAP = 10;

const rectAround = (centerX, centerY, width, height) => ({
  left: centerX - width / 2,
  right: centerX + width / 2,
  top: centerY - height / 2,
  bottom: centerY + height / 2,
});

export function getPoliedronMobileDockLayout({
  viewportWidth,
  viewportHeight,
  orbSize,
  safeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 },
}) {
  const availableWidth = Math.max(0, viewportWidth - (safeAreaInsets.left || 0) - (safeAreaInsets.right || 0) - 24);
  const minimum = Math.min(MOBILE_DOCK_MIN_WIDTH, availableWidth);
  const dockWidth = clampToBounds(viewportWidth * MOBILE_DOCK_WIDTH_RATIO, minimum, Math.min(MOBILE_DOCK_MAX_WIDTH, availableWidth));
  const dockLeft = (viewportWidth - dockWidth) / 2;
  const dockBottom = (safeAreaInsets.bottom || 0) + MOBILE_DOCK_BOTTOM;
  const dockTop = viewportHeight - dockBottom - MOBILE_DOCK_HEIGHT;
  const centerX = viewportWidth / 2;
  const dockCenterY = dockTop + MOBILE_DOCK_HEIGHT / 2;
  const orbCenterY = dockCenterY - MOBILE_ORB_CENTER_ELEVATION;
  const dockedPosition = { x: centerX - orbSize / 2, y: orbCenterY - orbSize / 2 };

  return {
    dockRect: {
      left: dockLeft,
      right: dockLeft + dockWidth,
      top: dockTop,
      bottom: dockTop + MOBILE_DOCK_HEIGHT,
      width: dockWidth,
      height: MOBILE_DOCK_HEIGHT,
    },
    dockedPosition,
    protectedBottomZone: { top: dockTop, gap: MOBILE_DOCK_PROTECTED_GAP },
    redockZone: rectAround(centerX, orbCenterY, Math.max(orbSize * 1.25, 112), Math.max(orbSize * 1.15, 104)),
    attractionZone: rectAround(centerX, orbCenterY, Math.max(orbSize * 1.8, 158), Math.max(orbSize * 1.65, 146)),
  };
}

export function isPointInRect({ x, y }, rect) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

export function shouldRedock({ pointerX, pointerY, layout }) {
  return isPointInRect({ x: pointerX, y: pointerY }, layout.attractionZone);
}

export function getDockProtectionProgress({ pointerX, pointerY, layout }) {
  const point = { x: pointerX, y: pointerY };
  if (isPointInRect(point, layout.redockZone)) return 0;
  if (!isPointInRect(point, layout.attractionZone)) return 1;

  const axisProgress = (value, innerMin, innerMax, outerMin, outerMax) => {
    if (value < innerMin) return (innerMin - value) / Math.max(1, innerMin - outerMin);
    if (value > innerMax) return (value - innerMax) / Math.max(1, outerMax - innerMax);
    return 0;
  };
  return clampToBounds(Math.max(
    axisProgress(point.x, layout.redockZone.left, layout.redockZone.right, layout.attractionZone.left, layout.attractionZone.right),
    axisProgress(point.y, layout.redockZone.top, layout.redockZone.bottom, layout.attractionZone.top, layout.attractionZone.bottom)
  ), 0, 1);
}

export function applyRedockAttraction({ position, pointerX, pointerY, layout, strength = 0.22 }) {
  if (!isPointInRect({ x: pointerX, y: pointerY }, layout.attractionZone)) return position;
  const effectiveStrength = strength * (1 - getDockProtectionProgress({ pointerX, pointerY, layout }));
  return {
    x: position.x + (layout.dockedPosition.x - position.x) * effectiveStrength,
    y: position.y + (layout.dockedPosition.y - position.y) * effectiveStrength,
  };
}
