import { useCallback, useEffect, useRef, useState } from 'react';

/* POL-AI-001 §3, §34 — position controller, separated from the visual
   Orb component per §34 ("separato dal visual component"). Handles drag,
   viewport clamping, edge-snap, safe-area awareness and local persistence.
   No DB migration for position in this task (§3) — localStorage only. */

const STORAGE_KEY = 'poliedron_position_v1';
const EDGE_MARGIN = 18; // matches the floating-button edge margin already used elsewhere in this app

const clampPct = (v) => Math.min(1, Math.max(0, v));

const loadStoredPosition = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.xPct === 'number' && typeof parsed?.yPct === 'number') {
      return { xPct: clampPct(parsed.xPct), yPct: clampPct(parsed.yPct) };
    }
  } catch { /* corrupt/unavailable storage: fall back to default */ }
  return null;
};

const persistPosition = (pos) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)); } catch { /* storage unavailable: position just won't persist */ }
};

/**
 * usePoliedronPosition({ size })
 * `size`: orb diameter in px, used to keep the whole orb inside the
 * viewport (accounting for safe-area insets) rather than just its center.
 * Poliedron is the app's only floating AI button (POL-AI-001 review round
 * 2 — AssistenteAI's own floating widget was unmounted for this reason),
 * so there is no longer a second corner to reserve when edge-snapping.
 * Returns { style, isDragging, bind, resetPosition }.
 */
export function usePoliedronPosition({ size = 68, onActivate } = {}) {
  const [pos, setPos] = useState(() => loadStoredPosition() || { xPct: null, yPct: null }); // null = default corner, resolved in style
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef(null); // { startX, startY, startXPct, startYPct, moved }
  const suppressClickRef = useRef(false); // true right after a real drag, so the trailing synthetic click doesn't also open the panel
  const [livePx, setLivePx] = useState(null); // { left, top } during an active drag only

  const viewport = () => ({ w: window.innerWidth, h: window.innerHeight });

  const clampToViewport = useCallback((left, top) => {
    const { w, h } = viewport();
    const minX = EDGE_MARGIN;
    const maxX = Math.max(minX, w - size - EDGE_MARGIN);
    const minY = EDGE_MARGIN;
    const maxY = Math.max(minY, h - size - EDGE_MARGIN);
    return { left: Math.min(maxX, Math.max(minX, left)), top: Math.min(maxY, Math.max(minY, top)) };
  }, [size]);

  const onPointerMove = useCallback((e) => {
    const ds = dragState.current;
    if (!ds) return;
    const dx = e.clientX - ds.startClientX;
    const dy = e.clientY - ds.startClientY;
    if (!ds.moved && Math.hypot(dx, dy) < 4) return; // small-move threshold: distinguishes drag from tap
    ds.moved = true;
    setIsDragging(true);
    const clamped = clampToViewport(ds.startLeft + dx, ds.startTop + dy);
    setLivePx(clamped);
  }, [clampToViewport]);

  const onPointerUp = useCallback(() => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    const ds = dragState.current;
    dragState.current = null;
    if (!ds?.moved) { setIsDragging(false); return; }
    suppressClickRef.current = true;
    const { w, h } = viewport();
    setLivePx((current) => {
      if (current) {
        // Snap horizontally to the nearest edge (§3: "snap facoltativo/
        // automatico ai lati") — vertical position is kept as dragged.
        const centerX = current.left + size / 2;
        const snappedLeft = centerX < w / 2 ? EDGE_MARGIN : w - size - EDGE_MARGIN;
        const next = { xPct: clampPct(snappedLeft / w), yPct: clampPct(current.top / h) };
        persistPosition(next);
        setPos(next);
      }
      return null;
    });
    setIsDragging(false);
  }, [size, onPointerMove]);

  const onPointerDown = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    dragState.current = {
      startClientX: e.clientX, startClientY: e.clientY,
      startLeft: rect.left, startTop: rect.top, moved: false,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    // Listeners are attached here, on the down event itself, rather than
    // gated behind an `isDragging`-dependent effect: `isDragging` only ever
    // flips to true from inside onPointerMove, so a listener that waits for
    // isDragging to attach onPointerMove would never see the move that was
    // supposed to set it in the first place — dragging could never start.
    // onPointerUp (above) removes both listeners again, drag or plain tap.
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }, [onPointerMove, onPointerUp]);

  // Re-clamp on viewport resize/orientation change so a stored position
  // from a wider screen never leaves the orb off-screen on a narrower one.
  useEffect(() => {
    const onResize = () => {
      setPos((p) => {
        if (p.xPct == null) return p;
        const { w, h } = viewport();
        const clamped = clampToViewport(p.xPct * w, p.yPct * h);
        const next = { xPct: clampPct(clamped.left / w), yPct: clampPct(clamped.top / h) };
        persistPosition(next);
        return next;
      });
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [clampToViewport]);

  const resetPosition = useCallback(() => {
    setPos({ xPct: null, yPct: null });
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  // Pointer events (drag-tracking) fire before the browser's own synthetic
  // click on the same element — a real drag sets suppressClickRef so the
  // trailing click doesn't also toggle the panel; a plain tap (mouse click
  // or keyboard Enter/Space, which never fires pointer events at all) falls
  // through to onActivate normally.
  const onClick = useCallback(() => {
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    onActivate?.();
  }, [onActivate]);

  const style = livePx
    ? { left: livePx.left, top: livePx.top, right: 'auto', bottom: 'auto' }
    : pos.xPct != null
      ? { left: `calc(${pos.xPct * 100}vw)`, top: `calc(${pos.yPct * 100}vh)`, right: 'auto', bottom: 'auto' }
      // Default: bottom-left, safe-area aware — mirrors the corner the
      // previous MobileDock polyhedron button already occupied.
      : { left: `max(${EDGE_MARGIN}px, env(safe-area-inset-left, 0px))`, bottom: `calc(${EDGE_MARGIN}px + env(safe-area-inset-bottom, 0px))`, right: 'auto', top: 'auto' };

  return {
    style,
    isDragging,
    bind: { onPointerDown, onClick },
    resetPosition,
  };
}
