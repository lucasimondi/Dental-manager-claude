import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { C } from '../../lib/utils';
import Ic from './Ic.jsx';

const ITEM_H = 40; // altezza di ogni riga nella colonna scroll

// Una singola colonna a scorrimento (usata sia per le ore che per i minuti).
// Sfrutta scroll-snap nativo: leggero, fluido, e non richiede drag custom.
function Colonna({ valori, valore, onChange, formato }) {
  const ref = useRef(null);
  const isProgrammatic = useRef(false);

  // Quando il valore cambia da fuori (es. apertura iniziale), scrolla lì senza animare.
  useEffect(() => {
    const idx = valori.indexOf(valore);
    if (idx < 0 || !ref.current) return;
    isProgrammatic.current = true;
    ref.current.scrollTo({ top: idx * ITEM_H, behavior: 'auto' });
    setTimeout(() => { isProgrammatic.current = false; }, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollTimeout = useRef(null);
  const handleScroll = () => {
    if (isProgrammatic.current) return;
    clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      const idx = Math.round(ref.current.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(valori.length - 1, idx));
      // Riallinea esattamente (snap "morbido" già gestito da CSS, questo è solo lo stato)
      if (valori[clamped] !== valore) onChange(valori[clamped]);
    }, 80);
  };

  const selezionaClick = (v, idx) => {
    isProgrammatic.current = true;
    ref.current.scrollTo({ top: idx * ITEM_H, behavior: 'smooth' });
    onChange(v);
    setTimeout(() => { isProgrammatic.current = false; }, 300);
  };

  return (
    <div style={{ position: 'relative', width: 72, height: ITEM_H * 5 }}>
      {/* Fascia centrale evidenziata che indica la riga selezionata */}
      <div style={{
        position: 'absolute', top: ITEM_H * 2, left: 0, right: 0, height: ITEM_H,
        background: C.priL, borderRadius: 10, pointerEvents: 'none', zIndex: 0,
      }} />
      <div
        ref={ref}
        onScroll={handleScroll}
        style={{
          height: '100%', overflowY: 'scroll', scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch', position: 'relative', zIndex: 1,
          paddingTop: ITEM_H * 2, paddingBottom: ITEM_H * 2,
          scrollbarWidth: 'none', msOverflowStyle: 'none',
        }}
        className="tp-col-noscrollbar"
      >
        {valori.map((v, idx) => (
          <div
            key={v}
            onClick={() => selezionaClick(v, idx)}
            style={{
              height: ITEM_H, display: 'flex', alignItems: 'center', justifyContent: 'center',
              scrollSnapAlign: 'center', cursor: 'pointer',
              fontSize: v === valore ? 20 : 16,
              fontWeight: v === valore ? 800 : 500,
              color: v === valore ? C.pri : C.txl,
              transition: 'color 0.15s, font-size 0.15s',
            }}
          >
            {formato(v)}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Campo orario con scroll-picker stile iOS su qualsiasi piattaforma (evita
 * il time-picker "a orologio" che Android mostra di default per <input type="time">).
 * value / onChange usano il formato "HH:MM" come l'input nativo che sostituisce.
 */
export default function TimePicker({ value, onChange, label }) {
  const [open, setOpen] = useState(false);
  const [ore, minutiVal] = (value || '09:00').split(':').map((x) => parseInt(x, 10));
  const minutiArrotondati = Math.round((minutiVal || 0) / 5) * 5 % 60;
  const [tmpOra, setTmpOra] = useState(ore || 9);
  const [tmpMin, setTmpMin] = useState(minutiArrotondati);

  const apri = () => {
    const [h, m] = (value || '09:00').split(':').map((x) => parseInt(x, 10));
    setTmpOra(h || 0);
    setTmpMin(Math.round((m || 0) / 5) * 5 % 60);
    setOpen(true);
  };

  const conferma = () => {
    const hh = String(tmpOra).padStart(2, '0');
    const mm = String(tmpMin).padStart(2, '0');
    onChange(`${hh}:${mm}`);
    setOpen(false);
  };

  const ORE = Array.from({ length: 24 }, (_, i) => i);
  const MINUTI = Array.from({ length: 12 }, (_, i) => i * 5);

  return (
    <>
      <button
        type="button"
        onClick={apri}
        style={{
          width: '100%', padding: '11px 12px', border: `1.5px solid ${C.brd}`, borderRadius: 10,
          fontSize: 16, color: C.txt, background: C.sur, boxSizing: 'border-box', textAlign: 'left',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <span>{value || '—:—'}</span>
        <Ic n="clk" s={13} c={C.txl} />
      </button>

      {open && ReactDOM.createPortal(
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,20,40,0.55)', zIndex: 10000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div style={{ background: C.sur, borderRadius: '18px 18px 0 0', width: '100%', maxWidth: 480 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${C.brd}` }}>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: C.txl, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Annulla</button>
              <span style={{ fontWeight: 700, fontSize: 14, color: C.txt }}>{label || 'Seleziona ora'}</span>
              <button onClick={conferma} style={{ background: 'none', border: 'none', color: C.pri, fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>Fatto</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '16px 0' }}>
              <Colonna valori={ORE} valore={tmpOra} onChange={setTmpOra} formato={(v) => String(v).padStart(2, '0')} />
              <span style={{ fontSize: 20, fontWeight: 800, color: C.txt, marginBottom: 0 }}>:</span>
              <Colonna valori={MINUTI} valore={tmpMin} onChange={setTmpMin} formato={(v) => String(v).padStart(2, '0')} />
            </div>
            <div style={{ height: 'env(safe-area-inset-bottom,12px)' }} />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
