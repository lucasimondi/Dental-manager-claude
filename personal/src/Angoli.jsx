// SCAN-PDF-MANAGER (PO 2026-11-11: «Raddrizza automatico») — i quattro angoli del foglio sopra
// la foto: trovati da soli, spostabili con il dito. «Fatto» raddrizza la pagina su quegli angoli.
// SCAN-LENTE (PO 2026-11-24: «quando sposto la griglia per ritagliare non vedo dove vado perché è
// coperto dal dito»): l'angolo si sposta di quanto si muove il dito (non salta sotto il polpastrello, si
// può prendere anche di lato) e durante il trascinamento una lente ingrandita 3× con mirino mostra il
// punto esatto, nell'angolo dello schermo lontano dal dito.
import { useRef, useState } from 'react';
import { ANGOLI_INTERI, angoliValidi, muoviAngolo } from './lib/prospettiva.js';
import { IconaChiudi } from './Icone.jsx';
import { useIndietro } from './lib/indietro.js';

const CHIAVI = ['tl', 'tr', 'br', 'bl'];
const NOMI = { tl: 'in alto a sinistra', tr: 'in alto a destra', br: 'in basso a destra', bl: 'in basso a sinistra' };

export function Angoli({ src, iniziale, automatici, onFatto, onAnnulla }) {
  const [q, setQ] = useState(iniziale || automatici || ANGOLI_INTERI);
  const quadro = useRef(null);
  const attivo = useRef(null);
  const [lente, setLente] = useState(null); // chiave dell'angolo che si sta spostando
  const valido = angoliValidi(q);
  useIndietro(true, () => { onAnnulla(); });
  const inizia = (k) => (e) => {
    e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId);
    attivo.current = { k, x: e.clientX, y: e.clientY, da: q[k] }; setLente(k);
  };
  const muovi = (e) => {
    const a = attivo.current;
    if (!a || !quadro.current) return;
    const box = quadro.current.getBoundingClientRect();
    setQ((v) => muoviAngolo(v, a.k, a.da.x + (e.clientX - a.x) / box.width, a.da.y + (e.clientY - a.y) / box.height));
  };
  const fine = () => { attivo.current = null; setLente(null); };
  const ZOOM = 3, W = quadro.current?.clientWidth || 1, H = quadro.current?.clientHeight || 1;
  const lenteSopra = lente && q[lente].y > 0.5;            // dito in basso → lente in alto, e viceversa
  const lenteSinistra = lente && q[lente].x > 0.5;
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
            <button key={k} type="button" className={`pp-angoli-maniglia${lente === k ? ' attiva' : ''}`} style={{ left: `${q[k].x * 100}%`, top: `${q[k].y * 100}%` }}
              aria-label={`Angolo ${NOMI[k]}`} onPointerDown={inizia(k)} onKeyDown={tasti(k)}><span /></button>
          ))}
          {lente && <div className={`pp-lente${lenteSopra ? ' sopra' : ' sotto'}${lenteSinistra ? ' sinistra' : ' destra'}`} aria-hidden="true"
            style={{ backgroundImage: `url(${src})`, backgroundSize: `${W * ZOOM}px ${H * ZOOM}px`,
              backgroundPosition: `${66 - q[lente].x * W * ZOOM}px ${66 - q[lente].y * H * ZOOM}px` }}>
            <svg viewBox="-50 -50 100 100" aria-hidden="true">
              {CHIAVI.filter((k) => k !== lente).filter((k) => k === CHIAVI[(CHIAVI.indexOf(lente) + 1) % 4] || k === CHIAVI[(CHIAVI.indexOf(lente) + 3) % 4]).map((k) => {
                const dx = (q[k].x - q[lente].x) * W, dy = (q[k].y - q[lente].y) * H, l = Math.hypot(dx, dy) || 1;
                return <line key={k} x1="0" y1="0" x2={(dx / l) * 80} y2={(dy / l) * 80} />;
              })}
              <circle r="5" />
              <path d="M-14 0H-7M7 0H14M0-14V-7M0 7V14" />
            </svg>
          </div>}
        </div>
      </div>
      {!valido && <p className="pp-angoli-avviso" role="alert">Gli angoli si incrociano: sistemali prima di continuare.</p>}
      <button className="pp-bottone pp-bottone-largo" disabled={!valido} onClick={() => onFatto(q)}>Raddrizza</button>
    </div>
  );
}
