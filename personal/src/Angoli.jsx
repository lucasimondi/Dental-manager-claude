// SCAN-PDF-MANAGER (PO 2026-11-11: «Raddrizza automatico») — i quattro angoli del foglio sopra
// la foto: trovati da soli, spostabili con il dito. «Fatto» raddrizza la pagina su quegli angoli.
import { useRef, useState } from 'react';
import { ANGOLI_INTERI, angoliValidi, muoviAngolo } from './lib/prospettiva.js';
import { IconaChiudi } from './Icone.jsx';

const CHIAVI = ['tl', 'tr', 'br', 'bl'];
const NOMI = { tl: 'in alto a sinistra', tr: 'in alto a destra', br: 'in basso a destra', bl: 'in basso a sinistra' };

export function Angoli({ src, iniziale, automatici, onFatto, onAnnulla }) {
  const [q, setQ] = useState(iniziale || automatici || ANGOLI_INTERI);
  const quadro = useRef(null);
  const attivo = useRef(null);
  const valido = angoliValidi(q);
  const inizia = (k) => (e) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); attivo.current = k; };
  const muovi = (e) => {
    const k = attivo.current;
    if (!k || !quadro.current) return;
    const box = quadro.current.getBoundingClientRect();
    setQ((v) => muoviAngolo(v, k, (e.clientX - box.left) / box.width, (e.clientY - box.top) / box.height));
  };
  const fine = () => { attivo.current = null; };
  const tasti = (k) => (e) => {
    const passo = e.shiftKey ? 0.05 : 0.01;
    const d = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }[e.key];
    if (!d) return;
    e.preventDefault();
    setQ((v) => muoviAngolo(v, k, v[k].x + d[0], v[k].y + d[1]));
  };
  const punti = CHIAVI.map((k) => `${q[k].x * 100},${q[k].y * 100}`).join(' ');
  return (
    <div className="pp-ritaglio" role="dialog" aria-label="Raddrizza il foglio">
      <div className="pp-ritaglio-testa">
        <button className="pp-icona-bottone pp-piccolo" onClick={onAnnulla} aria-label="Annulla"><IconaChiudi size={18} /></button>
        <span>Sposta i 4 angoli sul foglio</span>
        <span className="pp-angoli-scelte">
          {automatici && <button className="pp-testo-link" onClick={() => setQ(automatici)}>Auto</button>}
          <button className="pp-testo-link" onClick={() => setQ(ANGOLI_INTERI)}>Tutta</button>
        </span>
      </div>
      <div className="pp-ritaglio-area" onPointerMove={muovi} onPointerUp={fine} onPointerCancel={fine}>
        <div className="pp-ritaglio-quadro" ref={quadro}>
          <img src={src} alt="" draggable={false} />
          <svg className="pp-angoli-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d={`M0,0H100V100H0Z M${punti.split(' ').join(' L')} Z`} fillRule="evenodd" className="pp-angoli-ombra" />
            <polygon points={punti} className={valido ? 'pp-angoli-bordo' : 'pp-angoli-bordo pp-angoli-errore'} vectorEffect="non-scaling-stroke" />
          </svg>
          {CHIAVI.map((k) => (
            <button key={k} type="button" className="pp-angoli-maniglia" style={{ left: `${q[k].x * 100}%`, top: `${q[k].y * 100}%` }}
              aria-label={`Angolo ${NOMI[k]}`} onPointerDown={inizia(k)} onKeyDown={tasti(k)} />
          ))}
        </div>
      </div>
      {!valido && <p className="pp-angoli-avviso" role="alert">Gli angoli si incrociano: sistemali prima di continuare.</p>}
      <button className="pp-bottone pp-bottone-largo" disabled={!valido} onClick={() => onFatto(q)}>Raddrizza</button>
    </div>
  );
}
