// STUDIO-TELEFONO (PO 2026-11-27): Start dello Studio sul telefono, a tutto schermo come in Personal: ricerca, tutte
// le app dello studio a gruppi con le icone a colori, Impostazioni. Si apre dalla barra in basso o da «Tutte le app».
// Le voci sono quelle già visibili nel menu (piano, funzioni e ruolo filtrati in App.jsx): nessuna voce nuova.
import React, { useEffect, useMemo, useState } from 'react';
import './StartStudio.css';
import IconaColoreStudio from './IconaColoreStudio.jsx';
import { appDiStart } from '../lib/startStudio.js';

export default function StartStudio({ nav = [], onApri, onChiudi }) {
  const [cerca, setCerca] = useState('');
  const gruppi = useMemo(() => appDiStart(nav, cerca), [nav, cerca]);
  useEffect(() => {
    const tasto = (e) => { if (e.key === 'Escape') onChiudi(); };
    document.addEventListener('keydown', tasto);
    document.body.classList.add('studio-start-aperto');
    return () => { document.removeEventListener('keydown', tasto); document.body.classList.remove('studio-start-aperto'); };
  }, [onChiudi]);
  return (
    <div className="sts" role="dialog" aria-modal="true" aria-label="Start · Tutte le app">
      <div className="sts-testa">
        <label className="sts-cerca">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input type="search" aria-label="Cerca un'app" placeholder="Cerca un'app" value={cerca} onChange={(e) => setCerca(e.target.value)} />
        </label>
        <button type="button" className="sts-chiudi" aria-label="Chiudi Start" onClick={onChiudi}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
      </div>
      <div className="sts-corpo">
        {gruppi.map(([titolo, voci]) => (
          <section key={titolo} aria-label={titolo}>
            <h2>{titolo}</h2>
            <div className="sts-griglia">
              {voci.map((v) => (
                <button key={v.id} type="button" className="sts-app" onClick={() => { onChiudi(); onApri(v.id); }}>
                  <span className="sts-tessera"><IconaColoreStudio id={v.id} size={34} /></span><span>{v.nome}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
        {!gruppi.length && <p className="sts-vuoto">Nessuna app con «{cerca.trim()}».</p>}
      </div>
    </div>
  );
}
