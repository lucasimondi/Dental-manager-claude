// ICONE-START (PO 2026-11-26): «App aperte», come «Recenti» del telefono. Si apre tenendo premuto Start (o con il
// tasto destro). Tocco su una scheda = l'app torna davanti; × o scorrere di lato = la chiude. Chiude con Indietro,
// Esc o un tocco fuori.
import { useEffect, useRef, useState } from 'react';
import { IconaFinestra } from './IconeFinestre.jsx';
import { titoloPagina } from './sezioni/index.js';

export function Recenti({ finestre = [], inPrimo = null, onApri, onChiudiFinestra, onEsci }) {
  const [via, setVia] = useState({}); // chiave → spostamento in px durante lo scorrimento
  const tocco = useRef(null);
  useEffect(() => {
    window.history.pushState({ ...(window.history.state || {}), pbRecenti: true }, '');
    const indietro = () => onEsci();
    const tasto = (e) => { if (e.key === 'Escape') esci(); };
    window.addEventListener('popstate', indietro); window.addEventListener('keydown', tasto);
    return () => { window.removeEventListener('popstate', indietro); window.removeEventListener('keydown', tasto); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const esci = () => { if (window.history.state?.pbRecenti) window.history.back(); else onEsci(); };
  const apri = (k) => { if (window.history.state?.pbRecenti) window.history.back(); onApri(k); };
  const elenco = [...finestre].sort((a, b) => b.z - a.z);
  const fine = (k) => {
    const t = tocco.current; tocco.current = null;
    if (!t || t.k !== k) return;
    if (Math.abs(via[k] || 0) > 90) onChiudiFinestra?.(k);
    setVia((v) => ({ ...v, [k]: 0 }));
  };
  return (
    <div className="pr-velo" onClick={esci}>
      <section className="pr-recenti" role="dialog" aria-label="App aperte" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>App aperte</h2>
          {elenco.length > 1 && <button type="button" className="pr-tutte" onClick={() => { elenco.forEach((f) => onChiudiFinestra?.(f.chiave)); }}>Chiudi tutte</button>}
        </header>
        {!elenco.length && <p className="pr-vuoto">Nessuna app aperta.</p>}
        <ul>
          {elenco.map((f) => {
            const nome = titoloPagina(f) || 'Finestra';
            const dx = via[f.chiave] || 0;
            return (
              <li key={f.chiave} className={`pr-scheda${inPrimo === f.chiave ? ' attiva' : ''}`} style={{ transform: dx ? `translateX(${dx}px)` : undefined, opacity: dx ? Math.max(0.3, 1 - Math.abs(dx) / 240) : undefined }}
                onTouchStart={(e) => { tocco.current = { k: f.chiave, x: e.touches[0].clientX }; }}
                onTouchMove={(e) => { const t = tocco.current; if (t?.k === f.chiave) setVia((v) => ({ ...v, [f.chiave]: e.touches[0].clientX - t.x })); }}
                onTouchEnd={() => fine(f.chiave)}>
                <button type="button" className="pr-apri" onClick={() => apri(f.chiave)} aria-label={`${nome}${f.stato === 'ridotta' ? ' (ridotta a icona)' : ''}: apri`}>
                  <IconaFinestra tipo={f.tipo} size={28} />
                  <span><strong>{nome}</strong><small>{inPrimo === f.chiave ? 'In primo piano' : f.stato === 'ridotta' ? 'Ridotta a icona' : 'Aperta'}</small></span>
                </button>
                <button type="button" className="pr-chiudi" onClick={() => onChiudiFinestra?.(f.chiave)} aria-label={`Chiudi ${nome}`}>
                  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="pr-nota">Tocca per tornare a un’app · scorri di lato o × per chiuderla</p>
      </section>
    </div>
  );
}
