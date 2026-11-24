import { useEffect, useRef, useState } from 'react';
import { FinestraCtx } from './lib/portale.js';
import { BARRA_TITOLO } from './lib/finestre.js';
// PERSONAL-FINESTRE (PO 2026-11-24): ogni pagina di Personal è una finestra stile Windows 11 con barra
// del titolo (icona, titolo, Riduci a icona, Ingrandisci/Ripristina, Chiudi). Libera: si sposta dalla
// barra del titolo e si ridimensiona dagli angoli e dai bordi; doppio tocco sul titolo = ingrandisci.
// Ridotta resta montata (nascosta) così non perde il lavoro. Il corpo ha una trasformazione: i fogli
// `position: fixed` dentro la finestra restano nella finestra.
export function Finestra({ f, titolo, icona, area, attiva, accetta, onPrimoPiano, onRiduci, onIngrandisci, onChiudi, onSposta, senzaChiudi = false, children }) {
  const [corpo, setCorpo] = useState(null);
  const gesto = useRef(null);
  const libera = f.stato === 'normale';
  const inizia = (modo) => (e) => {
    if (e.button > 0) return;
    onPrimoPiano();
    if (!libera || e.target.closest('button')) return;
    e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId);
    gesto.current = { modo, x: e.clientX, y: e.clientY, da: { x: f.x, y: f.y, w: f.w, h: f.h } };
  };
  const muovi = (e) => {
    const g = gesto.current; if (!g) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y, d = g.da;
    if (g.modo === 'sposta') onSposta({ x: d.x + dx, y: d.y + dy });
    else onSposta({
      x: g.modo.includes('o') ? Math.min(d.x + dx, d.x + d.w - 200) : d.x,
      w: g.modo.includes('e') ? d.w + dx : g.modo.includes('o') ? d.w - dx : d.w,
      h: g.modo.includes('s') ? d.h + dy : d.h,
    });
  };
  const fine = () => { gesto.current = null; };
  const ultimoTocco = useRef(0);
  const doppio = (e) => { if (e.target.closest('button')) return; const t = Date.now(); if (t - ultimoTocco.current < 320) onIngrandisci(); ultimoTocco.current = t; };
  useEffect(() => { if (attiva && f.stato !== 'ridotta') corpo?.querySelector?.('[autofocus]')?.focus?.(); }, [attiva]); // eslint-disable-line react-hooks/exhaustive-deps
  const stile = f.stato === 'ingrandita' ? { left: 0, top: 0, width: area.w, height: area.h } : { left: f.x, top: f.y, width: f.w, height: f.h };
  return (
    <section className={`pf-finestra pf-${f.stato}${attiva ? ' pf-attiva' : ''}`} style={{ ...stile, zIndex: 40 + (f.z || 0) }} hidden={f.stato === 'ridotta'}
      role="dialog" aria-label={titolo} data-finestra={f.chiave} onPointerDownCapture={() => { if (!attiva) onPrimoPiano(); }}>
      <header className="pf-titolo" style={{ height: BARRA_TITOLO }} onPointerDown={inizia('sposta')} onPointerMove={muovi} onPointerUp={fine} onPointerCancel={fine} onClick={doppio}>
        <span className="pf-icona" aria-hidden="true">{icona}</span>
        <span className="pf-nome">{titolo}</span>
        <span className="pf-comandi">
          <button type="button" className="pf-comando" aria-label={`Riduci a icona ${titolo}`} title="Riduci a icona" onClick={onRiduci}>
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 8.5h10" stroke="currentColor" strokeWidth="1.2" /></svg></button>
          <button type="button" className="pf-comando" aria-label={f.stato === 'ingrandita' ? `Ripristina ${titolo}` : `Ingrandisci ${titolo}`} title={f.stato === 'ingrandita' ? 'Ripristina' : 'Ingrandisci'} onClick={onIngrandisci}>
            {f.stato === 'ingrandita'
              ? <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M5 5V3.5h7.5V11H11M3.5 5h7.5v7.5H3.5z" fill="none" stroke="currentColor" strokeWidth="1.1" /></svg>
              : <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3.5 3.5h9v9h-9z" fill="none" stroke="currentColor" strokeWidth="1.1" /></svg>}</button>
          {!senzaChiudi && <button type="button" className="pf-comando pf-chiudi" aria-label={`Chiudi ${titolo}`} title="Chiudi" onClick={onChiudi}>
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.2" /></svg></button>}
        </span>
      </header>
      <div className="pf-corpo" ref={setCorpo} data-bersaglio={accetta ? `finestra:${f.chiave}` : undefined}>
        <div className="pf-scorre"><FinestraCtx.Provider value={{ chiave: f.chiave, corpo }}>{children}</FinestraCtx.Provider></div>
      </div>
      {libera && ['e', 's', 'se', 'so', 'o'].map((m) => <span key={m} className={`pf-bordo pf-bordo-${m}`} aria-hidden="true" onPointerDown={inizia(m)} onPointerMove={muovi} onPointerUp={fine} onPointerCancel={fine} />)}
    </section>
  );
}
