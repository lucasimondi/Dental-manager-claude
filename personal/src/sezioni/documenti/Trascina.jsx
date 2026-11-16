// POL-VITA-033 — trascinare icone col dito (e col mouse), come sulla schermata Home del telefono.
// Tieni premuto ~0,4 s: l'icona si stacca e segue il dito; il punto sotto il dito viene evidenziato
// se è un posto dove lasciarla ([data-bersaglio="tipo:id"]). Se lasci senza esserti mosso,
// l'icona viene scelta (selezione). Se sposti il dito prima del tempo, la pagina scorre normalmente.
// Vicino ai bordi la pagina scorre da sola.
import { useCallback, useEffect, useRef, useState } from 'react';

const ATTESA_MS = 380;
const TOLLERANZA = 10; // px di movimento prima della presa = è uno scorrimento
const BORDO = 90;

const leggiBersaglio = (x, y) => {
  const el = document.elementFromPoint(x, y)?.closest?.('[data-bersaglio]');
  if (!el) return null;
  const [tipo, ...resto] = el.dataset.bersaglio.split(':');
  const id = resto.join(':');
  return { tipo, id: id === '' || id === 'radice' ? null : id, chiave: el.dataset.bersaglio };
};

/**
 * @param {{ onLascia:(sorgente:object, bersaglio:object)=>void, onPresa?:(sorgente:object)=>void, onFermo?:(sorgente:object)=>void, valido?:(sorgente:object, bersaglio:object)=>boolean }} opz
 */
export function useTrascina({ onLascia, onFermo, valido = () => true }) {
  const [presa, setPresa] = useState(null); // { sorgente, x, y, bersaglio }
  const stato = useRef({ timer: null, inizio: null, sorgente: null, attivo: false, mosso: false, appenaTrascinato: false });
  const richiami = useRef({ onLascia, onFermo, valido });
  richiami.current = { onLascia, onFermo, valido };

  const annullaAttesa = () => { clearTimeout(stato.current.timer); stato.current.timer = null; };

  const muovi = useCallback((x, y) => {
    const s = stato.current;
    if (!s.attivo) return;
    if (Math.hypot(x - s.inizio.x, y - s.inizio.y) > TOLLERANZA) s.mosso = true;
    let b = leggiBersaglio(x, y);
    if (b && !richiami.current.valido(s.sorgente, b)) b = null;
    setPresa((p) => (p ? { ...p, x, y, bersaglio: b } : p));
    if (y < BORDO) window.scrollBy(0, -14); else if (y > window.innerHeight - BORDO) window.scrollBy(0, 14);
  }, []);

  const fine = useCallback((x, y) => {
    const s = stato.current;
    annullaAttesa();
    if (!s.attivo) { s.sorgente = null; return; }
    s.attivo = false;
    s.appenaTrascinato = true;
    setTimeout(() => { s.appenaTrascinato = false; }, 250);
    let b = x != null ? leggiBersaglio(x, y) : null;
    if (b && !richiami.current.valido(s.sorgente, b)) b = null;
    const sorgente = s.sorgente;
    s.sorgente = null;
    setPresa(null);
    if (b) richiami.current.onLascia(sorgente, b);
    else if (!s.mosso) richiami.current.onFermo?.(sorgente);
  }, []);

  // Durante la presa: il dito non fa scorrere la pagina.
  useEffect(() => {
    if (!presa) return undefined;
    const tm = (e) => { e.preventDefault(); const t = e.touches[0]; if (t) muovi(t.clientX, t.clientY); };
    const te = (e) => { const t = e.changedTouches[0]; fine(t?.clientX, t?.clientY); };
    const mm = (e) => muovi(e.clientX, e.clientY);
    const mu = (e) => fine(e.clientX, e.clientY);
    document.addEventListener('touchmove', tm, { passive: false });
    document.addEventListener('touchend', te);
    document.addEventListener('touchcancel', te);
    document.addEventListener('mousemove', mm);
    document.addEventListener('mouseup', mu);
    return () => {
      document.removeEventListener('touchmove', tm);
      document.removeEventListener('touchend', te);
      document.removeEventListener('touchcancel', te);
      document.removeEventListener('mousemove', mm);
      document.removeEventListener('mouseup', mu);
    };
  }, [!!presa, muovi, fine]); // eslint-disable-line react-hooks/exhaustive-deps

  const prendi = (sorgente, x, y) => {
    const s = stato.current;
    s.attivo = true; s.mosso = false; s.sorgente = sorgente; s.inizio = { x, y };
    navigator.vibrate?.(15);
    setPresa({ sorgente, x, y, bersaglio: null });
  };

  // Gestori da mettere su ogni icona trascinabile.
  const gestori = (sorgente) => ({
    onTouchStart: (e) => {
      const t = e.touches[0];
      const s = stato.current;
      s.inizio = { x: t.clientX, y: t.clientY }; s.sorgente = sorgente;
      annullaAttesa();
      s.timer = setTimeout(() => prendi(sorgente, s.inizio.x, s.inizio.y), ATTESA_MS);
    },
    onTouchMove: (e) => {
      const s = stato.current;
      if (s.attivo || !s.timer) return;
      const t = e.touches[0];
      if (Math.hypot(t.clientX - s.inizio.x, t.clientY - s.inizio.y) > TOLLERANZA) annullaAttesa(); // sta scorrendo
    },
    onTouchEnd: () => { if (!stato.current.attivo) annullaAttesa(); },
    onMouseDown: (e) => {
      if (e.button !== 0) return;
      const s = stato.current;
      s.inizio = { x: e.clientX, y: e.clientY }; s.sorgente = sorgente;
      annullaAttesa();
      s.timer = setTimeout(() => prendi(sorgente, s.inizio.x, s.inizio.y), ATTESA_MS);
      const mm = (ev) => {
        if (Math.hypot(ev.clientX - s.inizio.x, ev.clientY - s.inizio.y) > 6 && !s.attivo) { annullaAttesa(); prendi(sorgente, ev.clientX, ev.clientY); s.mosso = true; }
      };
      const mu = () => { annullaAttesa(); document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); };
      document.addEventListener('mousemove', mm);
      document.addEventListener('mouseup', mu);
    },
    onContextMenu: (e) => e.preventDefault(),
    draggable: false,
  });

  // Dopo un trascinamento il "click" che segue va ignorato.
  const eraTrascinamento = () => stato.current.appenaTrascinato;
  return { presa, gestori, eraTrascinamento };
}
