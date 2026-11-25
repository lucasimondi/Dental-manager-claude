import { useEffect, useRef, useState } from 'react';
import { FinestraCtx } from './lib/portale.js';
import { BARRA_TITOLO } from './lib/finestre.js';
// PERSONAL-FINESTRE (PO 2026-11-24) + PERSONAL-MULTITASK (PO 2026-11-25): finestra stile Windows 11.
// Barra del titolo (icona, titolo, Riduci a icona, Ingrandisci/Ripristina, Chiudi). Trascinando il
// titolo la finestra si sposta; se è ingrandita o agganciata si stacca e torna della sua misura sotto
// il dito; portata a un bordo mostra l'anteprima dell'aggancio e, lasciata, si aggancia (Snap).
// Otto maniglie per ridimensionare (bordi e angoli, più larghe col dito). Pressione prolungata (o
// mouse fermo) su Ingrandisci = schemi di affiancamento. Ridotta resta montata (nessun lavoro perso).
// Il corpo ha una trasformazione: i fogli `position: fixed` dentro la finestra restano nella finestra.
const MANIGLIE = ['n', 's', 'e', 'o', 'ne', 'no', 'se', 'so'];

export function Finestra({ f, titolo, icona, area, attiva, nascosta = false, accetta, onPrimoPiano, onRiduci, onIngrandisci, onChiudi, onSposta, onStacca, onTrascinaTitolo, onLasciaTitolo, onSchemi, senzaChiudi = false, children }) {
  const [corpo, setCorpo] = useState(null);
  const gesto = useRef(null), radice = useRef(null), timerSchemi = useRef(null);
  const libera = f.stato === 'normale';
  const inizia = (modo) => (e) => {
    if (e.button > 0) return;
    onPrimoPiano();
    if (e.target.closest('button')) return;
    if (modo !== 'sposta' && !libera) return;
    e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId);
    gesto.current = { modo, x: e.clientX, y: e.clientY, da: { x: f.x, y: f.y, w: f.w, h: f.h }, staccare: modo === 'sposta' && (!libera || !!f.aggancio), mosso: false };
  };
  const muovi = (e) => {
    const g = gesto.current; if (!g) return;
    let dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.mosso && Math.hypot(dx, dy) < 8) return;
    g.mosso = true;
    if (g.staccare) { g.staccare = false; g.da = onStacca({ x: e.clientX, y: e.clientY }); g.x = e.clientX; g.y = e.clientY; dx = 0; dy = 0; }
    const d = g.da;
    if (g.modo === 'sposta') { onSposta({ x: d.x + dx, y: d.y + dy }); onTrascinaTitolo?.({ x: e.clientX, y: e.clientY }); return; }
    const m = g.modo, r = { x: d.x, y: d.y, w: d.w, h: d.h };
    if (m.includes('e')) r.w = d.w + dx;
    if (m.includes('s')) r.h = d.h + dy;
    if (m.includes('o')) { r.w = d.w - dx; r.x = d.x + dx; if (r.w < 280) { r.x -= 280 - r.w; r.w = 280; } }
    if (m.includes('n')) { r.h = d.h - dy; r.y = d.y + dy; if (r.h < 220) { r.y -= 220 - r.h; r.h = 220; } }
    onSposta(r, true);
  };
  const fine = (e) => { const g = gesto.current; gesto.current = null; if (g?.modo === 'sposta' && g.mosso) onLasciaTitolo?.({ x: e.clientX, y: e.clientY }); };
  const ultimoTocco = useRef(0);
  const doppio = (e) => { if (e.target.closest('button')) return; const t = Date.now(); if (t - ultimoTocco.current < 320) onIngrandisci(); ultimoTocco.current = t; };
  // Schemi di affiancamento: pressione prolungata o mouse fermo 450 ms sul tasto Ingrandisci.
  const apriSchemi = (el) => onSchemi?.(el.getBoundingClientRect());
  const tieni = (e) => { const el = e.currentTarget; clearTimeout(timerSchemi.current); timerSchemi.current = setTimeout(() => { timerSchemi.current = 'aperto'; apriSchemi(el); }, 450); };
  const lascia = () => { if (timerSchemi.current !== 'aperto') clearTimeout(timerSchemi.current); };
  useEffect(() => () => clearTimeout(timerSchemi.current), []);
  const stile = f.stato === 'ingrandita' ? { left: 0, top: 0, width: area.w, height: area.h } : { left: f.x, top: f.y, width: f.w, height: f.h };
  return (
    <section ref={radice} className={`pf-finestra pf-${f.stato}${f.aggancio ? ` pf-agganciata pf-z-${f.aggancio}` : ''}${attiva ? ' pf-attiva' : ''}`} style={{ ...stile, zIndex: 40 + (f.z || 0) }}
      hidden={f.stato === 'ridotta' || nascosta} role="dialog" aria-label={titolo} data-finestra={f.chiave} onPointerDownCapture={() => { if (!attiva) onPrimoPiano(); }}>
      <header className="pf-titolo" style={{ height: BARRA_TITOLO }} onPointerDown={inizia('sposta')} onPointerMove={muovi} onPointerUp={fine} onPointerCancel={fine} onClick={doppio}>
        <span className="pf-icona" aria-hidden="true">{icona}</span>
        <span className="pf-nome">{titolo}</span>
        <span className="pf-comandi">
          <button type="button" className="pf-comando" aria-label={`Riduci a icona ${titolo}`} title="Riduci a icona" onClick={onRiduci}>
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 8.5h10" stroke="currentColor" strokeWidth="1.2" /></svg></button>
          <button type="button" className="pf-comando" aria-label={f.stato === 'ingrandita' ? `Ripristina ${titolo}` : `Ingrandisci ${titolo}`} title={f.stato === 'ingrandita' ? 'Ripristina · tieni premuto per gli schemi' : 'Ingrandisci · tieni premuto per gli schemi'}
            onClick={() => { if (timerSchemi.current === 'aperto') { timerSchemi.current = null; return; } clearTimeout(timerSchemi.current); onIngrandisci(); }}
            onPointerDown={tieni} onPointerUp={lascia} onPointerLeave={lascia} onMouseEnter={(e) => { if (matchMedia?.('(hover: hover)').matches) tieni(e); }}
            onContextMenu={(e) => { e.preventDefault(); apriSchemi(e.currentTarget); }}>
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
      {libera && MANIGLIE.map((m) => <span key={m} className={`pf-bordo pf-bordo-${m}`} aria-hidden="true" onPointerDown={inizia(m)} onPointerMove={muovi} onPointerUp={fine} onPointerCancel={fine} />)}
    </section>
  );
}
