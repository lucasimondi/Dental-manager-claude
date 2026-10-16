import { useRef } from 'react';
import { IconaIndietro, IconaChiudi } from './Icone.jsx';

export function Pagina({ titolo, onIndietro, visibile, children, azione, senzaChiudi }) {
  const corpo = useRef(null);
  const tocco = useRef(null);
  const inizio = (e) => {
    const t = e.touches[0];
    tocco.current = t.clientX < 28 ? { x: t.clientX, y: t.clientY } : null;
  };
  const fine = (e) => {
    const t0 = tocco.current;
    tocco.current = null;
    if (!t0) return;
    const t = e.changedTouches[0];
    if (t.clientX - t0.x > 70 && Math.abs(t.clientY - t0.y) < 60) onIndietro();
  };
  return (
    <div className="pp-pagina" hidden={!visibile} aria-hidden={!visibile} onTouchStart={inizio} onTouchEnd={fine}>
      <div className="pp-pagina-barra">
        <button className="pp-indietro" onClick={onIndietro}><IconaIndietro size={20} /><span>Indietro</span></button>
        <span className="pp-pagina-titolo">{titolo}</span>
        <span className="pp-pagina-azione">{azione}</span>
      </div>
      <div className="pp-pagina-corpo" ref={corpo}>{children}</div>
      {!senzaChiudi && <button className="pp-chiudi-pagina" onClick={onIndietro} aria-label="Chiudi"><IconaChiudi size={22} /></button>}
    </div>
  );
}
