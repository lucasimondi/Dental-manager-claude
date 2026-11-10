// MIA-SALUTE (PO 2026-11-10) — ritaglio di una foto o di una pagina scansionata: si trascinano
// gli angoli (o il riquadro intero) sopra l'immagine; «Fatto» restituisce il ritaglio da 0 a 1.
import { useRef, useState } from 'react';
import { RITAGLIO_INTERO, muoviRitaglio } from './lib/scansione.js';
import { IconaChiudi } from './Icone.jsx';

const MANIGLIE = ['nw', 'ne', 'sw', 'se'];

export function Ritaglio({ src, iniziale, onFatto, onAnnulla }) {
  const [r, setR] = useState(iniziale || RITAGLIO_INTERO);
  const quadro = useRef(null);
  const trascina = useRef(null);
  const inizia = (maniglia) => (e) => {
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    trascina.current = { maniglia, x: e.clientX, y: e.clientY, r };
  };
  const muovi = (e) => {
    const t = trascina.current;
    if (!t || !quadro.current) return;
    const box = quadro.current.getBoundingClientRect();
    setR(muoviRitaglio(t.r, t.maniglia, (e.clientX - t.x) / box.width, (e.clientY - t.y) / box.height));
  };
  const fine = () => { trascina.current = null; };
  const pct = (v) => `${(v * 100).toFixed(2)}%`;
  return (
    <div className="pp-ritaglio" role="dialog" aria-label="Ritaglia">
      <div className="pp-ritaglio-testa">
        <button className="pp-icona-bottone pp-piccolo" onClick={onAnnulla} aria-label="Annulla"><IconaChiudi size={18} /></button>
        <span>Trascina gli angoli</span>
        <button className="pp-testo-link" onClick={() => setR(RITAGLIO_INTERO)}>Tutta</button>
      </div>
      <div className="pp-ritaglio-area" onPointerMove={muovi} onPointerUp={fine} onPointerCancel={fine}>
        <div className="pp-ritaglio-quadro" ref={quadro}>
          <img src={src} alt="" draggable={false} />
          <div className="pp-ritaglio-box" style={{ left: pct(r.x), top: pct(r.y), width: pct(r.w), height: pct(r.h) }} onPointerDown={inizia('centro')}>
            {MANIGLIE.map((m) => <span key={m} className={`pp-ritaglio-maniglia pp-rm-${m}`} onPointerDown={inizia(m)} aria-hidden="true" />)}
          </div>
        </div>
      </div>
      <button className="pp-bottone pp-bottone-largo" onClick={() => onFatto(r)}>Fatto</button>
    </div>
  );
}
