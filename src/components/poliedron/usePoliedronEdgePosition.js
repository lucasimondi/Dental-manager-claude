import { useCallback, useEffect, useRef, useState } from 'react';
import { getPoliedronSafeBounds } from '../../lib/poliedron/poliedronSafeBounds.js';
import { decideSideSwitch } from '../../lib/poliedron/poliedronDragMath.js';

/* POL-AI-002A §9-10 — desktop Edge Dock position model. Unlike the mobile
   Orb (freely positionable, §2-6), desktop Poliedron is constrained to
   the LEFT or RIGHT screen edge and only drags vertically (§9: "Non
   coordinate X/Y completamente libere" — this avoids collisions with
   tables/agenda/modals/clinical content). State shape (§10):
   { side: 'right' | 'left', verticalFrac: 0..1 }. verticalFrac is a
   fraction of the vertical safe range, so it's always reconstructible to
   a valid position on any viewport (§10: "Reclamp su resize"), the same
   principle as the mobile hook's fraction-of-safe-bounds persistence. */

const STORAGE_KEY = 'poliedron_edge_position_v1';
const MARGIN = 20;
const SIDE_SWITCH_MIN_DRAG_X = 120; // px of horizontal drag before a side-switch is even considered
const clamp01 = (v) => Math.min(1, Math.max(0, v));

const loadStored = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if ((parsed?.side === 'left' || parsed?.side === 'right') && typeof parsed?.verticalFrac === 'number') {
      return { side: parsed.side, verticalFrac: clamp01(parsed.verticalFrac) };
    }
  } catch { /* corrupt/unavailable storage: fall back to default */ }
  return null;
};

const persist = (state) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage unavailable: position just won't persist */ }
};

/**
 * usePoliedronEdgePosition({ dockWidth, dockHeight, onActivate })
 * Returns { side, top, isDragging, pendingSideSwitch, bind, resetPosition }.
 * `top`: resolved px offset from the viewport top for the collapsed dock.
 */
export function usePoliedronEdgePosition({ dockWidth = 56, dockHeight = 56, onActivate } = {}) {
  const [state, setState] = useState(() => loadStored() || { side: 'right', verticalFrac: 0.6 });
  const [isDragging, setIsDragging] = useState(false);
  const [liveTop, setLiveTop] = useState(null);
  const [pendingSideSwitch, setPendingSideSwitch] = useState(false);
  const dragState = useRef(null);
  const suppressClickRef = useRef(false);

  const verticalBounds = useCallback(() => {
    const b = getPoliedronSafeBounds({
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      orbWidth: dockWidth,
      orbHeight: dockHeight,
      additionalSafetyMargin: MARGIN,
    });
    return { minY: b.minY, maxY: b.maxY };
  }, [dockWidth, dockHeight]);

  const fracToTop = useCallback((frac) => {
    const { minY, maxY } = verticalBounds();
    return minY + frac * (maxY - minY);
  }, [verticalBounds]);

  const topToFrac = useCallback((top) => {
    const { minY, maxY } = verticalBounds();
    const range = maxY - minY;
    return clamp01(range > 0 ? (top - minY) / range : 0.5);
  }, [verticalBounds]);

  const onPointerMove = useCallback((e) => {
    const ds = dragState.current;
    if (!ds) return;
    const dx = e.clientX - ds.startClientX;
    const dy = e.clientY - ds.startClientY;
    if (!ds.moved && Math.hypot(dx, dy) < 4) return;
    ds.moved = true;
    setIsDragging(true);
    const { minY, maxY } = verticalBounds();
    const top = Math.min(maxY, Math.max(minY, ds.startTop + dy));
    setLiveTop(top);
    // §10 — magnetic side switch: only once the user has clearly dragged
    // toward the opposite edge, not on every small horizontal jitter.
    setPendingSideSwitch(decideSideSwitch({ dx, side: ds.side, minDragX: SIDE_SWITCH_MIN_DRAG_X }));
  }, [verticalBounds]);

  const onPointerUp = useCallback(() => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp); // eslint-disable-line no-use-before-define
    window.removeEventListener('pointercancel', onPointerCancel); // eslint-disable-line no-use-before-define
    const ds = dragState.current;
    dragState.current = null;
    if (!ds?.moved) { setIsDragging(false); setPendingSideSwitch(false); return; }
    suppressClickRef.current = true;
    setLiveTop((currentTop) => {
      if (currentTop != null) {
        const side = ds.pendingSwitchAtRelease ? (ds.side === 'right' ? 'left' : 'right') : ds.side;
        const next = { side, verticalFrac: topToFrac(currentTop) };
        persist(next);
        setState(next);
      }
      return null;
    });
    setIsDragging(false);
    setPendingSideSwitch(false);
  }, [onPointerMove, topToFrac]);

  // Keep dragState's own copy of the latest pendingSideSwitch so onPointerUp
  // (a stable-ish callback) can read it without depending on render state.
  useEffect(() => {
    if (dragState.current) dragState.current.pendingSwitchAtRelease = pendingSideSwitch;
  }, [pendingSideSwitch]);

  const onPointerCancel = useCallback(() => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);
    dragState.current = null;
    setLiveTop(null); // interrupted gesture: discard, keep the last committed position
    setIsDragging(false);
    setPendingSideSwitch(false);
  }, [onPointerMove, onPointerUp]);

  const onPointerDown = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    dragState.current = {
      startClientX: e.clientX, startClientY: e.clientY,
      startTop: rect.top, side: state.side, moved: false, pendingSwitchAtRelease: false,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
  }, [onPointerMove, onPointerUp, onPointerCancel, state.side]);

  // Resize: verticalFrac is always re-expandable against fresh bounds.
  useEffect(() => {
    const reclamp = () => setState((s) => ({ ...s }));
    window.addEventListener('resize', reclamp);
    return () => window.removeEventListener('resize', reclamp);
  }, []);

  const resetPosition = useCallback(() => {
    setState({ side: 'right', verticalFrac: 0.6 });
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  const onClick = useCallback(() => {
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    onActivate?.();
  }, [onActivate]);

  const top = liveTop != null ? liveTop : fracToTop(state.verticalFrac);

  return {
    side: state.side,
    top,
    isDragging,
    pendingSideSwitch,
    bind: { onPointerDown, onClick },
    resetPosition,
  };
}
