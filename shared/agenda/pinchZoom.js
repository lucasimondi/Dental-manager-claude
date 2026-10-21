// PO 2026-10-17 ("ingrandimenti con le dita"): pinch-to-zoom verticale della griglia
// dell'agenda (Giorno e Settimana). Due dita allargano o stringono gli slot; il punto
// sotto le dita resta fermo, come in Calendario di iPhone. A 1 la griglia è quella di sempre.
import { useEffect, useRef, useState } from 'react';

export const PINCH_MIN = 1;
export const PINCH_MAX = 4;
const PINCH_KEY = 'poliedra-personal-agenda-pinch';

export const distanza = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

// Nuovo fattore dal rapporto tra la distanza attuale e quella iniziale delle dita.
export function fattorePinch(iniziale, d0, d) {
  if (!(d0 > 0) || !(d > 0)) return iniziale;
  const f = Math.min(PINCH_MAX, Math.max(PINCH_MIN, iniziale * d / d0));
  return Math.round(f * 100) / 100;
}

// scrollTop che tiene fermo il punto y (px dal bordo del contenitore) quando lo slot
// passa da oldSlotH a newSlotH; gridTop è l'inizio della griglia oraria nel contenuto.
export function scrollAncorato({ scrollTop, y, gridTop = 0, oldSlotH, newSlotH }) {
  if (!(oldSlotH > 0)) return scrollTop;
  const inGriglia = Math.max(0, scrollTop + y - gridTop);
  return Math.max(0, gridTop + inGriglia / oldSlotH * newSlotH - y);
}

const leggi = () => {
  try {
    const v = Number(localStorage.getItem(PINCH_KEY));
    return v >= PINCH_MIN && v <= PINCH_MAX ? v : PINCH_MIN;
  } catch { return PINCH_MIN; }
};

/**
 * [pinch, ancora]: pinch scala l'altezza degli slot; ancora (ref) contiene il punto da
 * tenere fermo finché la griglia non è stata ridisegnata con la nuova altezza.
 */
export function usePinchZoom(containerRef, attivo = true) {
  const [pinch, setPinch] = useState(leggi);
  const pinchRef = useRef(pinch);
  const ancora = useRef(null);
  pinchRef.current = pinch;
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !attivo) return undefined;
    let g = null, frame = 0;
    const start = (e) => {
      if (e.touches.length !== 2) return;
      g = { d0: distanza(e.touches[0], e.touches[1]), iniziale: pinchRef.current };
    };
    const move = (e) => {
      if (!g || e.touches.length !== 2) return;
      e.preventDefault();
      const [a, b] = e.touches;
      const f = fattorePinch(g.iniziale, g.d0, distanza(a, b));
      if (f === pinchRef.current) return;
      const y = (a.clientY + b.clientY) / 2 - el.getBoundingClientRect().top;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { ancora.current = { y, scrollTop: el.scrollTop }; setPinch(f); });
    };
    const end = (e) => {
      if (!g || e.touches.length >= 2) return;
      g = null;
      try { localStorage.setItem(PINCH_KEY, String(pinchRef.current)); } catch { /* facoltativo */ }
    };
    // Safari: senza questo il pinch ingrandirebbe tutta la pagina.
    const blocca = (e) => e.preventDefault();
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    el.addEventListener('gesturestart', blocca);
    el.addEventListener('gesturechange', blocca);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
      el.removeEventListener('gesturestart', blocca);
      el.removeEventListener('gesturechange', blocca);
    };
  }, [containerRef, attivo]);
  return [pinch, ancora];
}
