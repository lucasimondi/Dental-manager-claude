import { useEffect, useLayoutEffect, useRef } from 'react';
import { usePinchZoom, scrollAncorato } from './pinchZoom.js';
import { useSwipeAgenda } from './swipeAgenda.js';
import { useSlotHeight } from './AgendaPresentation.jsx';

// Personal's timeline behavior, shared by both applications. Never reset a user's
// scroll because data, the keyboard, the dock, or a ResizeObserver refreshed.
export function useTimeline({ containerRef, mobile, slots, slotH, day, view, nowMinutes, onNavigate, enabled = true }) {
  const [pinch, anchor] = usePinchZoom(containerRef, mobile && enabled);
  const height = Math.round((mobile ? Math.max(24, slotH) : slotH) * (mobile ? pinch : 1));
  const effectiveSlotH = useSlotHeight(containerRef, mobile, slots, height, view);
  const previous = useRef(effectiveSlotH);
  useLayoutEffect(() => {
    const el = containerRef.current, a = anchor.current;
    anchor.current = null;
    if (el && a && previous.current !== effectiveSlotH) {
      const grid = el.querySelector('.agenda-time-grid');
      const gridTop = grid ? grid.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop : 0;
      el.scrollTop = scrollAncorato({ scrollTop: a.scrollTop, y: a.y, gridTop, oldSlotH: previous.current, newSlotH: effectiveSlotH });
    }
    previous.current = effectiveSlotH;
  }, [effectiveSlotH]);
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current || !containerRef.current) return;
    initialized.current = true;
    const nowTop = nowMinutes * effectiveSlotH;
    containerRef.current.scrollTop = nowTop >= 0 && nowTop < slots.length * effectiveSlotH ? Math.max(0, nowTop - effectiveSlotH * 2) : 0;
  }, [day, view, effectiveSlotH, slots.length, nowMinutes]);
  const swipe = useSwipeAgenda(containerRef, onNavigate, mobile && enabled);
  return { effectiveSlotH, swipe };
}
