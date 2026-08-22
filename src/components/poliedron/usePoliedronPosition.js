import { useCallback, useEffect, useRef, useState } from 'react';
import { getPoliedronSafeBounds, readSafeAreaInsets, DEFAULT_SAFETY_MARGIN } from '../../lib/poliedron/poliedronSafeBounds.js';
import { computeDragPosition, decideSnapX, fractionFromPosition, positionFromFraction } from '../../lib/poliedron/poliedronDragMath.js';

/* POL-AI-002A §2-6 — mobile drag/position controller, rewritten from
   scratch after a real, verified bug in the previous version: onPointerUp
   ALWAYS snapped horizontally to the nearest edge, on every release, no
   matter where the user actually dropped the orb — every drag ended in a
   visible "teleport" to an edge. Root cause: the release handler computed
   `snappedLeft` unconditionally instead of only within a threshold of an
   edge. Fixed here: `WHERE I DROP IT IS WHERE IT STAYS` (§3) is the
   default; snapping is now the exception, gated by `snapThreshold`.

   Bumped storage key to v2 — v1 stored {xPct, yPct} as a fraction of the
   full viewport; v2 stores {xFrac, yFrac} as a fraction of the current
   *safe bounds* range (see getPoliedronSafeBounds), which is guaranteed
   reconstructible to a valid position on any viewport by construction.
   Silently re-interpreting old v1 values as v2 would place the orb
   somewhere the user never chose, so the key is versioned instead of
   migrated. */

const STORAGE_KEY = 'poliedron_position_v2';
const SNAP_THRESHOLD = 48; // §3 target: 40-56px
const MOVE_THRESHOLD = 4; // px — distinguishes a real drag from a tap, unrelated to snapping

const clamp01 = (v) => Math.min(1, Math.max(0, v));

const loadStoredFraction = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.xFrac === 'number' && typeof parsed?.yFrac === 'number') {
      return { xFrac: clamp01(parsed.xFrac), yFrac: clamp01(parsed.yFrac) };
    }
  } catch { /* corrupt/unavailable storage: fall back to default */ }
  return null;
};

const persistFraction = (frac) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(frac)); } catch { /* storage unavailable: position just won't persist */ }
};

/**
 * usePoliedronPosition({ size, additionalSafetyMargin, onActivate })
 * `size`: orb diameter in px (see computeMobileOrbSize).
 * Returns { style, isDragging, bind, resetPosition }.
 */
export function usePoliedronPosition({ size = 96, additionalSafetyMargin = DEFAULT_SAFETY_MARGIN, onActivate } = {}) {
  const [frac, setFrac] = useState(() => loadStoredFraction()); // null = not yet placed by the user
  const [isDragging, setIsDragging] = useState(false);
  const [livePx, setLivePx] = useState(null); // { x, y } during an active drag only
  const dragState = useRef(null); // { grabOffsetX, grabOffsetY, moved }
  const suppressClickRef = useRef(false); // true right after a real drag, so the trailing synthetic click doesn't also open the panel
  const safeAreaInsetsRef = useRef({ top: 0, right: 0, bottom: 0, left: 0 });

  useEffect(() => {
    safeAreaInsetsRef.current = readSafeAreaInsets();
  }, []);

  const computeBounds = useCallback(() => getPoliedronSafeBounds({
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    orbWidth: size,
    orbHeight: size,
    safeAreaInsets: safeAreaInsetsRef.current,
    additionalSafetyMargin,
  }), [size, additionalSafetyMargin]);

  const onPointerMove = useCallback((e) => {
    const ds = dragState.current;
    if (!ds) return;
    const dx = e.clientX - ds.startClientX;
    const dy = e.clientY - ds.startClientY;
    if (!ds.moved && Math.hypot(dx, dy) < MOVE_THRESHOLD) return; // small-move threshold: distinguishes drag from tap
    ds.moved = true;
    setIsDragging(true);
    // §2 — position = pointer position - original grab offset. The orb's
    // top-left tracks the pointer 1:1 (no delta drift, no scaling), then
    // clamped so the whole bounding box stays in the safe area (§4).
    const bounds = computeBounds();
    setLivePx(computeDragPosition({
      pointerX: e.clientX, pointerY: e.clientY,
      grabOffsetX: ds.grabOffsetX, grabOffsetY: ds.grabOffsetY,
      bounds,
    }));
  }, [computeBounds]);

  const finishDrag = useCallback((applySnap) => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp); // eslint-disable-line no-use-before-define
    window.removeEventListener('pointercancel', onPointerCancel); // eslint-disable-line no-use-before-define
    const ds = dragState.current;
    dragState.current = null;
    if (!ds?.moved) { setIsDragging(false); return; }
    suppressClickRef.current = true;
    setLivePx((current) => {
      if (current) {
        const bounds = computeBounds();
        // §3 — snap is SECONDARY: only when released close to an edge.
        // Never central, never forced, never applied to the vertical axis.
        const x = applySnap ? decideSnapX({ x: current.x, bounds, snapThreshold: SNAP_THRESHOLD }) : current.x;
        const next = fractionFromPosition({ x, y: current.y, bounds });
        persistFraction(next);
        setFrac(next);
      }
      return null;
    });
    setIsDragging(false);
  }, [computeBounds, onPointerMove]);

  const onPointerUp = useCallback(() => {
    finishDrag(true); // a real, deliberate release — snap only if near an edge
  }, [finishDrag]);

  const onPointerCancel = useCallback(() => {
    // §2 — pointercancel is an interrupted gesture (system takes over,
    // incoming call, browser chrome intercept), not a deliberate release:
    // keep the orb exactly where it was, no edge-snap consideration.
    finishDrag(false);
  }, [finishDrag]);

  const onPointerDown = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    dragState.current = {
      // §2 — grabOffset is the pointer's position relative to the orb's
      // own top-left corner at the moment of grab; during the drag the
      // orb's top-left = pointer position - grabOffset, so the orb
      // follows the exact point the user grabbed it by, not its center.
      grabOffsetX: e.clientX - rect.left,
      grabOffsetY: e.clientY - rect.top,
      startClientX: e.clientX,
      startClientY: e.clientY,
      moved: false,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
  }, [onPointerMove, onPointerUp, onPointerCancel]);

  // Reload/resize/orientation-change: reclamp against the CURRENT safe
  // bounds (§6) — a fraction-of-safe-range position is always valid by
  // construction once re-expanded against fresh bounds, so this is a
  // pure re-derivation, not a special case.
  useEffect(() => {
    const reclamp = () => {
      safeAreaInsetsRef.current = readSafeAreaInsets();
      setFrac((f) => {
        if (!f) return f;
        persistFraction(f); // fraction itself never changes — only its px expansion does
        return { ...f };
      });
    };
    window.addEventListener('resize', reclamp);
    window.addEventListener('orientationchange', reclamp);
    return () => {
      window.removeEventListener('resize', reclamp);
      window.removeEventListener('orientationchange', reclamp);
    };
  }, []);

  const resetPosition = useCallback(() => {
    setFrac(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  // A real drag fires pointer events before the browser's own synthetic
  // click on the same element; a plain tap (mouse click or keyboard
  // Enter/Space, which never fires pointer events at all) falls through
  // to onActivate normally.
  const onClick = useCallback(() => {
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    onActivate?.();
  }, [onActivate]);

  const style = (() => {
    if (livePx) return { left: livePx.x, top: livePx.y, right: 'auto', bottom: 'auto' };
    if (frac) {
      const bounds = computeBounds();
      const { x, y } = positionFromFraction({ xFrac: frac.xFrac, yFrac: frac.yFrac, bounds });
      return { left: x, top: y, right: 'auto', bottom: 'auto' };
    }
    // Default: bottom-left, safe-area aware — mirrors the corner the
    // previous MobileDock polyhedron button already occupied.
    return {
      left: `max(${additionalSafetyMargin}px, env(safe-area-inset-left, 0px))`,
      bottom: `calc(${additionalSafetyMargin}px + env(safe-area-inset-bottom, 0px))`,
      right: 'auto', top: 'auto',
    };
  })();

  return {
    style,
    isDragging,
    bind: { onPointerDown, onClick },
    resetPosition,
  };
}
