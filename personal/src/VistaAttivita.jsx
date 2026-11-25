// PERSONAL-MULTITASK (PO 2026-11-25: «lavorare multitasking con più finestre … con le scrivanie»):
// Visualizzazione attività come Windows 11. In alto le finestre della scrivania scelta (tocco = va lì
// e la porta avanti, × = chiude, ⋯ = sposta in un'altra scrivania; si possono anche trascinare su una
// scrivania); in basso le scrivanie con il loro sfondo (tocco = mostra le sue finestre, doppio tocco =
// rinomina, × = chiude: le finestre passano a quella accanto) e «Nuovo desktop».
import { useRef, useState } from 'react';
import { IconaFinestra } from './IconeFinestre.jsx';
import { nellaScrivania } from './lib/multitasking.js';

export function VistaAttivita({ fs, titolo, onChiudi }) {
  const { pagine, scrivanie, azioni } = fs;
  const [mostrata, setMostrata] = useState(scrivanie.attiva);
  const [menu, setMenu] = useState(null), [rinomina, setRinomina] = useState(null);
  const [presa, setPresa] = useState(null); // { chiave, x, y, sopra }
  const gesto = useRef(null), ultimoTocco = useRef({});
  const qui = scrivanie.elenco.some((d) => d.id === mostrata) ? mostrata : scrivanie.attiva;
  const finestre = nellaScrivania(pagine, qui);
  const apri = (k) => { azioni.scrivania(qui); azioni.primoPiano(k); onChiudi(); };
  const sottoDito = (x, y) => document.elementFromPoint(x, y)?.closest?.('[data-scrivania]')?.dataset.scrivania;
  // trascinare una scheda su una scrivania (dopo un piccolo spostamento: il tocco semplice apre)
  const giu = (k) => (e) => { if (e.target.closest('.pv-scheda-testa button, .pv-menu')) return; gesto.current = { k, x: e.clientX, y: e.clientY, mosso: false }; e.currentTarget.setPointerCapture?.(e.pointerId); };
  const muovi = (e) => { const g = gesto.current; if (!g) return; if (!g.mosso && Math.hypot(e.clientX - g.x, e.clientY - g.y) < 12) return; g.mosso = true; setPresa({ chiave: g.k, x: e.clientX, y: e.clientY, sopra: sottoDito(e.clientX, e.clientY) }); };
  const su = (e) => { const g = gesto.current; gesto.current = null; setPresa(null); if (!g) return; if (!g.mosso) { apri(g.k); return; } const id = Number(sottoDito(e.clientX, e.clientY)); if (id && id !== qui) azioni.inScrivania(g.k, id); };
  const toccaScrivania = (id) => { const t = Date.now(); if (ultimoTocco.current.id === id && t - ultimoTocco.current.t < 320) setRinomina({ id, nome: scrivanie.elenco.find((d) => d.id === id)?.nome || '' }); ultimoTocco.current = { id, t }; setMostrata(id); azioni.scrivania(id); };
  const trascinata = presa && pagine.find((f) => f.chiave === presa.chiave);
  return (
    <div className={`pv-vista pv-sfondo-${scrivanie.elenco.find((d) => d.id === qui)?.sfondo || 'bloom'}`} role="dialog" aria-modal="true" aria-label="Visualizzazione attività"
      onPointerDown={(e) => { if (e.target === e.currentTarget) onChiudi(); }}>
      <div className="pv-finestre" role="list" aria-label={`Finestre di ${scrivanie.elenco.find((d) => d.id === qui)?.nome}`}>
        {!finestre.length && <p className="pv-vuoto">Nessuna finestra aperta in questa scrivania.</p>}
        {finestre.map((f) => (
          <div key={f.chiave} role="listitem" className={`pv-scheda${f.stato === 'ridotta' ? ' ridotta' : ''}${presa?.chiave === f.chiave ? ' presa' : ''}`}
            onPointerDown={giu(f.chiave)} onPointerMove={muovi} onPointerUp={su} onPointerCancel={() => { gesto.current = null; setPresa(null); }}>
            <div className="pv-scheda-testa"><IconaFinestra tipo={f.tipo} size={16} /><span>{titolo(f) || 'Finestra'}</span>
              <button type="button" className="pv-altro" aria-label={`Sposta ${titolo(f)} in un'altra scrivania`} onClick={() => setMenu(menu === f.chiave ? null : f.chiave)}>⋯</button>
              <button type="button" className="pv-chiudi" aria-label={`Chiudi ${titolo(f)}`} onClick={() => azioni.chiudi(f.chiave)}>×</button></div>
            <button type="button" className="pv-scheda-corpo" aria-label={`Apri ${titolo(f)}`} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') apri(f.chiave); }}>
              <span className="pv-scheda-icona"><IconaFinestra tipo={f.tipo} size={40} /></span>
              <span className="pv-scheda-stato">{f.stato === 'ridotta' ? 'Ridotta a icona' : f.aggancio ? 'Affiancata' : f.stato === 'ingrandita' ? 'Ingrandita' : 'Finestra'}</span>
            </button>
            {menu === f.chiave && <div className="pv-menu" role="menu">
              <strong>Sposta in</strong>
              {scrivanie.elenco.filter((d) => d.id !== qui).map((d) => <button key={d.id} role="menuitem" type="button" onClick={() => { azioni.inScrivania(f.chiave, d.id); setMenu(null); }}>{d.nome}</button>)}
              <button role="menuitem" type="button" onClick={() => { const id = Math.max(...scrivanie.elenco.map((d) => d.id)) + 1; azioni.nuovaScrivania(); azioni.inScrivania(f.chiave, id); azioni.scrivania(qui); setMenu(null); }}>+ Nuovo desktop</button>
            </div>}
          </div>
        ))}
      </div>
      <div className="pv-scrivanie" role="list" aria-label="Scrivanie">
        {scrivanie.elenco.map((d) => (
          <div key={d.id} role="listitem" data-scrivania={d.id} className={`pv-scrivania pv-sfondo-${d.sfondo}${d.id === qui ? ' scelta' : ''}${presa?.sopra === String(d.id) ? ' sopra' : ''}`}>
            <button type="button" className="pv-scrivania-anteprima" aria-label={`${d.nome}, ${nellaScrivania(pagine, d.id).length} finestre`} aria-current={d.id === scrivanie.attiva ? 'true' : undefined} onClick={() => toccaScrivania(d.id)}>
              {nellaScrivania(pagine, d.id).slice(0, 4).map((f) => <span key={f.chiave} className="pv-mini"><IconaFinestra tipo={f.tipo} size={12} /></span>)}
            </button>
            {rinomina?.id === d.id
              ? <input className="pv-rinomina" autoFocus aria-label="Nome della scrivania" value={rinomina.nome} onChange={(e) => setRinomina({ ...rinomina, nome: e.target.value })}
                onBlur={() => { azioni.rinominaScrivania(d.id, rinomina.nome); setRinomina(null); }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setRinomina(null); }} />
              : <span className="pv-scrivania-nome">{d.nome}</span>}
            {scrivanie.elenco.length > 1 && <button type="button" className="pv-scrivania-chiudi" aria-label={`Chiudi ${d.nome}`} onClick={() => { azioni.chiudiScrivania(d.id); if (mostrata === d.id) setMostrata(scrivanie.elenco.find((x) => x.id !== d.id).id); }}>×</button>}
          </div>
        ))}
        <button type="button" className="pv-nuova" aria-label="Nuovo desktop" onClick={() => { const id = Math.max(...scrivanie.elenco.map((d) => d.id)) + 1; azioni.nuovaScrivania(); setMostrata(id); }}>
          <span aria-hidden="true">+</span><small>Nuovo desktop</small></button>
      </div>
      {trascinata && <div className="pv-fantasma" style={{ left: presa.x, top: presa.y }} aria-hidden="true"><IconaFinestra tipo={trascinata.tipo} size={22} /><span>{titolo(trascinata)}</span></div>}
    </div>
  );
}
