// SFONDI: tasto «Sfondo» delle Home del telefono e foglio con sfondi disegnati e colori. Si vede subito.
import React, { useEffect, useState } from 'react';
import './sceltaSfondo.css';
import { SFONDI, COLORI, leggiSfondo, salvaSfondo, sfondo } from './sfondi.js';

export function useSfondo(spazio) {
  const [id, setId] = useState(() => leggiSfondo(spazio));
  useEffect(() => {
    const f = (e) => { if (!e.key || e.key.includes(`sfondo-${spazio}`)) setId(leggiSfondo(spazio)); };
    window.addEventListener('storage', f);
    return () => window.removeEventListener('storage', f);
  }, [spazio]);
  return [sfondo(id, spazio), (nuovo) => setId(salvaSfondo(spazio, nuovo))];
}

const Pennello = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4l6 6-8.5 8.5a3 3 0 0 1-2 .9L6 20l.6-3.5a3 3 0 0 1 .9-2zM12.5 5.5l6 6" /><path d="M3 21c1.5 0 3-.6 3-2" /></svg>;

export default function SceltaSfondo({ attuale, onScegli, classe = '' }) {
  const [aperto, setAperto] = useState(false);
  useEffect(() => {
    if (!aperto) return undefined;
    const tasto = (e) => { if (e.key === 'Escape') setAperto(false); };
    document.addEventListener('keydown', tasto);
    return () => document.removeEventListener('keydown', tasto);
  }, [aperto]);
  const voce = (s, tipo) => (
    <button key={s.id} type="button" className={`sfd-${tipo}${attuale.id === s.id ? ' sfd-scelto' : ''}`} aria-pressed={attuale.id === s.id} aria-label={s.nome} onClick={() => onScegli(s.id)}>
      <span className="sfd-anteprima" style={{ background: s.css }} aria-hidden="true" />
      {tipo === 'disegno' && <span className="sfd-nome">{s.nome}</span>}
    </button>
  );
  return (
    <>
      <button type="button" className={`sfd-tasto ${classe}`} aria-label="Sfondo" onClick={() => setAperto(true)}><Pennello /></button>
      {aperto && (
        <div className="sfd-velo" onClick={() => setAperto(false)}>
          <div className="sfd-foglio" role="dialog" aria-modal="true" aria-label="Sfondo" onClick={(e) => e.stopPropagation()}>
            <div className="sfd-testa"><strong>Sfondo</strong><button type="button" className="sfd-fatto" onClick={() => setAperto(false)}>Fatto</button></div>
            <h3>Sfondi</h3>
            <div className="sfd-griglia">{SFONDI.map((s) => voce(s, 'disegno'))}</div>
            <h3>Colori</h3>
            <div className="sfd-colori">{COLORI.map((s) => voce(s, 'colore'))}</div>
          </div>
        </div>
      )}
    </>
  );
}
