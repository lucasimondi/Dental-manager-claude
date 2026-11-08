import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './crea.css';

// CREA (PO 2026-11-08): "il più ok, cerca solo di farlo più pro e immediato e bello".
// Un tocco sul + in agenda apre questo foglio; un tocco su una voce apre SUBITO il suo modulo.
// Uguale in Studio e in Personal: ogni app passa le sue voci (gruppi → voci con `fai`).
const ICONE = {
  appuntamento: 'M5 5h14v15H5zM8 3v4M16 3v4M5 10h14M12 13v5M9.5 15.5h5',
  paziente: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  incasso: 'M17.5 6.5A7 7 0 1 0 17.5 17.5M4 10.5h9M4 13.5h9',
  spesa: 'M3 4h2l2.5 11h11L21 7H7M9 20h.01M18 20h.01',
  pagamento: 'M3 6h18v12H3zM3 10h18M7 15h4',
  impegno: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  nota: 'M5 4h10l4 4v12H5zM15 4v4h4M8.5 12.5h7M8.5 16h5',
  documento: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  password: 'M7 10.5V7.5a5 5 0 0 1 10 0v3M5 10.5h14v10H5zM12 14.5v2.5',
};
export const IconaCrea = ({ n }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONE[n] || ICONE.nota} /></svg>;

export function CreaButton({ onClick, className = '' }) {
  return <button type="button" className={`crea-bottone agenda-floating-interactive ${className}`} aria-label="Crea" aria-haspopup="dialog" onClick={onClick}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
  </button>;
}

export default function CreaSheet({ aperto, onClose, gruppi = [], suggerimento = 'Più veloce: tocca un orario libero in agenda, oppure scrivi nella barra «appuntamento Rossi domani alle 10».' }) {
  const [trascina, setTrascina] = useState(0);
  const inizio = useRef(null), primo = useRef(null);
  useEffect(() => {
    if (!aperto) return undefined;
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    const t = setTimeout(() => primo.current?.focus({ preventScroll: true }), 60);
    return () => { document.removeEventListener('keydown', esc); clearTimeout(t); };
  }, [aperto, onClose]);
  useEffect(() => { if (!aperto) setTrascina(0); }, [aperto]);
  if (!aperto) return null;
  const scegli = (voce) => { onClose(); voce.fai(); };
  // Trascinare la maniglia verso il basso chiude il foglio, come in iOS.
  const giu = (e) => { inizio.current = e.clientY; e.currentTarget.setPointerCapture?.(e.pointerId); };
  const muovi = (e) => { if (inizio.current != null) setTrascina(Math.max(0, e.clientY - inizio.current)); };
  const su = () => { if (inizio.current == null) return; inizio.current = null; if (trascina > 90) onClose(); else setTrascina(0); };
  let indice = 0;
  return createPortal(<div className="crea-strato">
    <div className="crea-velo" onClick={onClose} aria-hidden="true" />
    <section className="crea-foglio" role="dialog" aria-modal="true" aria-label="Crea" style={trascina ? { transform: `translateY(${trascina}px)`, transition: 'none' } : undefined}>
      <div className="crea-testa" onPointerDown={giu} onPointerMove={muovi} onPointerUp={su} onPointerCancel={su}>
        <span className="crea-maniglia" aria-hidden="true" />
        <h2>Crea</h2>
        <button type="button" className="crea-chiudi" aria-label="Chiudi" onClick={onClose}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
      </div>
      {gruppi.filter((g) => g.voci?.length).map((g) => <div key={g.nome} className={`crea-gruppo${g.principale ? ' crea-principali' : ''}`} role="group" aria-label={g.nome}>
        {!g.principale && <h3>{g.nome}</h3>}
        {g.principale ? g.voci.map((v) => { const ref = indice++ === 0 ? primo : undefined; return <button key={v.id} ref={ref} type="button" className="crea-voce" style={{ '--c': v.colore }} onClick={() => scegli(v)}><span className="crea-icona"><IconaCrea n={v.icona || v.id} /></span><span className="crea-nome">{v.nome}</span></button>; }) : <div className="crea-griglia">
          {g.voci.map((v) => {
            const ref = indice++ === 0 ? primo : undefined;
            return <button key={v.id} ref={ref} type="button" className="crea-voce" style={{ '--c': v.colore }} onClick={() => scegli(v)}>
              <span className="crea-icona"><IconaCrea n={v.icona || v.id} /></span>
              <span className="crea-nome">{v.nome}</span>
            </button>;
          })}
        </div>}
      </div>)}
      {suggerimento && <p className="crea-suggerimento">{suggerimento}</p>}
    </section>
  </div>, document.body);
}
