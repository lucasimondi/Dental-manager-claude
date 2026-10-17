// POL-VITA-009 — scorrimento orizzontale "dal vivo" della griglia dell'agenda (Giorno e
// Settimana): le colonne seguono il dito; lasciando oltre la soglia (o con un colpo veloce)
// scivolano via e arriva il giorno o la settimana dopo/prima, come in Calendario di iPhone.
// Lo scorrimento verticale resta della griglia: si decide la direzione nei primi pixel.
import { useRef } from 'react';

export const SOGLIA_PX = 70;
export const SOGLIA_VELOCITA = 0.45; // px/ms

// Direzione del gesto dai primi movimenti: null finché non è chiara.
export function direzione(dx, dy) {
  if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return null;
  return Math.abs(dx) > Math.abs(dy) * 1.2 ? 'orizzontale' : 'verticale';
}

// Esito del rilascio: +1 (avanti), -1 (indietro) o 0 (torna al suo posto).
export function esito(dx, ms) {
  const veloce = Math.abs(dx) / Math.max(ms, 1) > SOGLIA_VELOCITA && Math.abs(dx) > 24;
  if (Math.abs(dx) < SOGLIA_PX && !veloce) return 0;
  return dx < 0 ? 1 : -1;
}

// Tempo del tocco dall'evento (non dall'orologio): misura la velocità del gesto.
const istante = (e) => (e?.timeStamp > 0 ? e.timeStamp : Date.now());

export function useSwipeAgenda(containerRef, onNavigate, attivo = true) {
  const g = useRef(null);
  const colonne = () => containerRef.current?.querySelector('.agenda-time-grid')?.children?.[1] || null;
  const sposta = (el, x, durata = 0) => {
    if (!el) return;
    el.style.transition = durata ? `transform ${durata}ms cubic-bezier(.2,.8,.2,1)` : 'none';
    el.style.transform = x ? `translateX(${x}px)` : '';
  };
  const onTouchStart = (e) => {
    if (!attivo || e.touches.length !== 1) { g.current = null; return; }
    g.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: istante(e), dir: null, dx: 0 };
  };
  const onTouchMove = (e) => {
    const s = g.current;
    if (!s) return;
    const dx = e.touches[0].clientX - s.x;
    const dy = e.touches[0].clientY - s.y;
    if (!s.dir) s.dir = direzione(dx, dy);
    if (s.dir !== 'orizzontale') return;
    s.dx = dx;
    sposta(colonne(), dx);
  };
  const onTouchEnd = (e) => {
    const s = g.current;
    g.current = null;
    if (!s) return;
    // Posizione finale dal rilascio: un colpo rapidissimo può arrivare senza touchmove.
    const fine = e?.changedTouches?.[0];
    if (fine) {
      const dx = fine.clientX - s.x, dy = fine.clientY - s.y;
      if (!s.dir) s.dir = direzione(dx, dy);
      if (s.dir === 'orizzontale') s.dx = dx;
    }
    if (s.dir !== 'orizzontale') return;
    const el = colonne();
    const verso = esito(s.dx, istante(e) - s.t);
    if (!verso) { sposta(el, 0, 180); return; }
    const larghezza = el?.getBoundingClientRect().width || 320;
    sposta(el, -verso * larghezza, 160);
    setTimeout(() => {
      onNavigate(verso);
      sposta(el, verso * larghezza);
      requestAnimationFrame(() => requestAnimationFrame(() => sposta(el, 0, 200)));
    }, 160);
  };
  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd };
}
