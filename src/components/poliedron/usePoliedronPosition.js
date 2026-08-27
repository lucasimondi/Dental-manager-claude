import { useCallback, useEffect, useRef, useState } from 'react';
import { getPoliedronSafeBounds, getStableViewportSize, readSafeAreaInsets, DEFAULT_SAFETY_MARGIN } from '../../lib/poliedron/poliedronSafeBounds.js';
import { clampToBounds, computeDragPosition, fractionFromPosition, positionFromFraction } from '../../lib/poliedron/poliedronDragMath.js';
import {
  applyRedockAttraction,
  getDockProtectionProgress,
  getPoliedronMobileDockLayout,
  shouldRedock,
} from '../../lib/poliedron/poliedronMobileDock.js';

const STORAGE_KEY = 'poliedron_mobile_position_v3';
const MOVE_THRESHOLD = 4;
const clamp01 = (value) => Math.min(1, Math.max(0, value));

const loadStoredFraction = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (parsed?.mode === 'detached' && typeof parsed.xFrac === 'number' && typeof parsed.yFrac === 'number') {
      return { xFrac: clamp01(parsed.xFrac), yFrac: clamp01(parsed.yFrac) };
    }
  } catch { /* unavailable or corrupt storage keeps the canonical docked default */ }
  return null;
};

const persistDetached = (fraction) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'detached', ...fraction })); } catch { /* position persistence is optional */ }
};

const persistDocked = () => {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* position persistence is optional */ }
};

export function usePoliedronPosition({ size = 96, additionalSafetyMargin = DEFAULT_SAFETY_MARGIN, onActivate, positionLocked = false } = {}) {
  const [fraction, setFraction] = useState(() => loadStoredFraction());
  const [isDragging, setIsDragging] = useState(false);
  const [livePosition, setLivePosition] = useState(null);
  const [isNearDock, setIsNearDock] = useState(false);
  const [, setLayoutRevision] = useState(0);
  const dragState = useRef(null);
  const suppressClickRef = useRef(false);
  const safeAreaInsetsRef = useRef({ top: 0, right: 0, bottom: 0, left: 0 });
  const lockedPositionRef = useRef(null);
  useEffect(() => {
    if (!positionLocked) lockedPositionRef.current = null;
  }, [positionLocked]);

  useEffect(() => {
    safeAreaInsetsRef.current = readSafeAreaInsets();
    setLayoutRevision((revision) => revision + 1);
  }, []);

  const computeLayout = useCallback(() => {
    const { width, height } = getStableViewportSize();
    return getPoliedronMobileDockLayout({
      viewportWidth: width,
      viewportHeight: height,
      orbSize: size,
      safeAreaInsets: safeAreaInsetsRef.current,
    });
  }, [size]);

  const computeBounds = useCallback((protectionProgress = 1) => {
    const layout = computeLayout();
    const dockedZoneTop = layout.dockedPosition.y + size + layout.protectedBottomZone.gap;
    const effectiveProtectedTop = dockedZoneTop +
      (layout.protectedBottomZone.top - dockedZoneTop) * protectionProgress;
    const { width, height } = getStableViewportSize();
    return getPoliedronSafeBounds({
      viewportWidth: width,
      viewportHeight: height,
      orbWidth: size,
      orbHeight: size,
      safeAreaInsets: safeAreaInsetsRef.current,
      additionalSafetyMargin,
      protectedBottomZone: { ...layout.protectedBottomZone, top: effectiveProtectedTop },
    });
  }, [additionalSafetyMargin, computeLayout, size]);

  const removePointerListeners = useCallback((state = dragState.current) => {
    if (!state?.handlers) return;
    window.removeEventListener('pointermove', state.handlers.move);
    window.removeEventListener('pointerup', state.handlers.up);
    window.removeEventListener('pointercancel', state.handlers.cancel);
  }, []);

  const onPointerMove = useCallback((event) => {
    const state = dragState.current;
    if (!state) return;
    const dx = event.clientX - state.pointerStart.x;
    const dy = event.clientY - state.pointerStart.y;
    if (!state.moved && Math.hypot(dx, dy) < MOVE_THRESHOLD) return;

    state.moved = true;
    state.lastPointer = { x: event.clientX, y: event.clientY };
    setIsDragging(true);

    const layout = computeLayout();
    const protectionProgress = getDockProtectionProgress({
      pointerX: event.clientX,
      pointerY: event.clientY,
      layout,
    });
    const bounds = computeBounds(protectionProgress);
    const rawPosition = computeDragPosition({
      pointerX: event.clientX,
      pointerY: event.clientY,
      grabOffsetX: state.grabOffset.x,
      grabOffsetY: state.grabOffset.y,
      bounds,
    });
    const attracted = applyRedockAttraction({
      position: rawPosition,
      pointerX: event.clientX,
      pointerY: event.clientY,
      layout,
    });
    setIsNearDock(shouldRedock({ pointerX: event.clientX, pointerY: event.clientY, layout }));
    setLivePosition({
      x: clampToBounds(attracted.x, bounds.minX, bounds.maxX),
      y: clampToBounds(attracted.y, bounds.minY, bounds.maxY),
    });
  }, [computeBounds, computeLayout]);

  const finishDrag = useCallback((event, cancelled) => {
    const state = dragState.current;
    removePointerListeners(state);
    dragState.current = null;
    if (state?.target?.hasPointerCapture?.(state.pointerId)) {
      state.target.releasePointerCapture(state.pointerId);
    }

    if (!state?.moved) {
      setIsDragging(false);
      setIsNearDock(false);
      return;
    }

    suppressClickRef.current = true;
    const pointer = cancelled
      ? state.lastPointer
      : { x: event?.clientX ?? state.lastPointer.x, y: event?.clientY ?? state.lastPointer.y };
    const layout = computeLayout();

    if (!cancelled && shouldRedock({ pointerX: pointer.x, pointerY: pointer.y, layout })) {
      persistDocked();
      setFraction(null);
      setLivePosition(null);
    } else {
      setLivePosition((current) => {
        if (current) {
          const next = fractionFromPosition({ x: current.x, y: current.y, bounds: computeBounds() });
          persistDetached(next);
          setFraction(next);
        }
        return null;
      });
    }

    setIsDragging(false);
    setIsNearDock(false);
  }, [computeBounds, computeLayout, removePointerListeners]);

  const onPointerUp = useCallback((event) => finishDrag(event, false), [finishDrag]);
  const onPointerCancel = useCallback((event) => finishDrag(event, true), [finishDrag]);

  const onPointerDown = useCallback((event) => {
    // A locked launcher must be inert, not merely visually frozen. Previously
    // a drag performed while the patient workspace was open updated and
    // persisted an invisible detached position; that position then appeared
    // as a jump as soon as the workspace closed.
    if (positionLocked) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragState.current = {
      pointerId: event.pointerId,
      target: event.currentTarget,
      pointerStart: { x: event.clientX, y: event.clientY },
      orbStart: { x: rect.left, y: rect.top },
      grabOffset: { x: event.clientX - rect.left, y: event.clientY - rect.top },
      lastPointer: { x: event.clientX, y: event.clientY },
      moved: false,
      handlers: { move: onPointerMove, up: onPointerUp, cancel: onPointerCancel },
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
  }, [onPointerCancel, onPointerMove, onPointerUp, positionLocked]);

  useEffect(() => {
    // Forza sempre un nuovo render (anche quando fraction è già null, cioè
    // agganciato/docked): un `setFraction` che ritorna lo stesso `null` non
    // fa ri-renderizzare React, quindi la posizione "docked" restava
    // congelata alle dimensioni viewport della primissima misurazione finché
    // qualcos'altro non causava un render — bug reale distinto dal drift
    // da barra indirizzi (vedi getStableViewportSize), non solo teorico.
    const reclamp = () => {
      safeAreaInsetsRef.current = readSafeAreaInsets();
      setLayoutRevision((revision) => revision + 1);
    };
    window.addEventListener('resize', reclamp);
    window.addEventListener('orientationchange', reclamp);
    return () => {
      window.removeEventListener('resize', reclamp);
      window.removeEventListener('orientationchange', reclamp);
      removePointerListeners();
    };
  }, [removePointerListeners]);

  const resetPosition = useCallback(() => {
    persistDocked();
    setFraction(null);
  }, []);

  const onClick = useCallback(() => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onActivate?.();
  }, [onActivate]);

  let position = computeLayout().dockedPosition;
  if (livePosition) position = livePosition;
  else if (fraction) position = positionFromFraction({ ...fraction, bounds: computeBounds() });
  // Nessun frame intermedio con la posizione bloccata stantia dopo lo
  // sblocco: l'effetto sotto svuota già il ref appena `positionLocked`
  // torna false, quindi qui basta usare quel valore SOLO mentre è
  // effettivamente locked — il render successivo a sblocco deve mostrare
  // subito la posizione fresca, non un frame in più di quella vecchia.
  if (positionLocked) {
    if (!lockedPositionRef.current) lockedPositionRef.current = position;
    position = lockedPositionRef.current;
  }

  return {
    style: { left: position.x, top: position.y, right: 'auto', bottom: 'auto' },
    isDragging,
    isNearDock,
    isDocked: !fraction && !livePosition,
    bind: { onPointerDown, onClick },
    resetPosition,
  };
}
