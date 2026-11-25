// PERSONAL-FINESTRE (PO 2026-11-24) + PERSONAL-MULTITASK (PO 2026-11-25): il desktop di Personal come
// Windows 11 per il telefono. Le pagine aperte sono finestre (più insieme, riducibili, ingrandibili,
// spostabili, ridimensionabili); si agganciano ai bordi (Snap) e con gli schemi di affiancamento; due
// finestre agganciate hanno un divisore comune; Visualizzazione attività con le scrivanie virtuali.
// La barra delle applicazioni resta sempre visibile. Qui lo stato (useFinestre) e la resa (Desktop).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Finestra } from './Finestra.jsx';
import { IconaFinestra } from './IconeFinestre.jsx';
import { VistaAttivita } from './VistaAttivita.jsx';
import { useIndietro } from './lib/indietro.js';
import { apriFinestra, attiva, inPrimoPiano, riduci, chiudi, ingrandisciRipristina, mostraDesktop, sposta, toccaIcona, sostituisciIn, riadatta, preferenzaTipo, ricordaTipo, telefono } from './lib/finestre.js';
import { aggancia, stacca, zonaDaPunto, rettangoloZona, zoneLibere, schemi, coppiaAgganciata, spostaDivisore, riadattaAgganciate, SCRIVANIE_INIZIALI, nuovaScrivania, vaiAScrivania, chiudiScrivania, rinominaScrivania, spostaInScrivania, nellaScrivania } from './lib/multitasking.js';

// Finestre che accettano documenti trascinati da un'altra finestra (Esplora → Scan, PDF, Archivia).
export const ACCETTANO_FILE = new Set(['scansione', 'pdf', 'pdfStrumento', 'carica', 'scanner']); // + gestore PDF dello Scan (PERSONAL-MULTITASK) // 'scanner' = lo scanner dello Scan dentro Personal (PR #348)

export function useFinestre({ onErrore = () => {} } = {}) {
  const [pagine, setPagine] = useState([]);
  const [scrivanie, setScrivanie] = useState(SCRIVANIE_INIZIALI);
  const [vista, setVista] = useState(false); // Visualizzazione attività aperta
  const contatore = useRef(0), desktop = useRef(null);
  const [area, setArea] = useState(() => ({ w: typeof window !== 'undefined' ? window.innerWidth : 400, h: typeof window !== 'undefined' ? window.innerHeight - 64 : 700 }));
  const areaRef = useRef(area); areaRef.current = area;
  const pagineRef = useRef(pagine); pagineRef.current = pagine;
  const scrivRef = useRef(scrivanie); scrivRef.current = scrivanie;
  useEffect(() => {
    const misura = () => { const el = desktop.current; if (!el) return; const a = { w: el.clientWidth, h: el.clientHeight }; setArea(a); setPagine((st) => riadattaAgganciate(riadatta(st, a), a)); };
    misura(); addEventListener('resize', misura); return () => removeEventListener('resize', misura);
  }, []);
  const qui = scrivanie.attiva;
  const nuova = (p) => { contatore.current += 1; return { ...p, chiave: contatore.current, scrivania: scrivRef.current.attiva }; };
  const apri = useCallback((p) => { onErrore(null); setVista(false); setPagine((st) => apriFinestra(st, nuova(p), areaRef.current, preferenzaTipo(p.tipo))); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const diQui = (st) => nellaScrivania(st, scrivRef.current.attiva);
  // «Indietro» di una pagina = chiude la finestra in primo piano; sostituisci = nuovo contenuto nella stessa finestra.
  const indietro = useCallback(() => { onErrore(null); setPagine((st) => { const a = attiva(diQui(st)); return a ? chiudi(st, a.chiave) : st; }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const sostituisci = useCallback((p) => { const n = nuova(p); setPagine((st) => { const a = attiva(diQui(st)); return a ? sostituisciIn(st, a.chiave, n) : apriFinestra(st, n, areaRef.current, preferenzaTipo(p.tipo)); }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const azioni = {
    primoPiano: (k) => setPagine((st) => inPrimoPiano(st, k)),
    riduci: (k) => setPagine((st) => riduci(st, k)),
    chiudi: (k) => { onErrore(null); setPagine((st) => chiudi(st, k)); },
    ingrandisci: (k) => setPagine((st) => { const f0 = st.find((x) => x.chiave === k); const n = f0?.aggancio ? stacca(st, k, { x: areaRef.current.w / 2, y: 60 }, areaRef.current) : ingrandisciRipristina(st, k); const f = n.find((x) => x.chiave === k); if (f) ricordaTipo(f.tipo, f.stato); return n.map((x) => (x.chiave === k && x.stato === 'ingrandita' ? { ...x, aggancio: null } : x)); }),
    // ridimensionare una finestra agganciata la libera dallo schema
    sposta: (k, r, ridimensiona = false) => setPagine((st) => sposta(st.map((f) => (f.chiave === k && ridimensiona ? { ...f, aggancio: null } : f)), k, r, areaRef.current)),
    stacca: (k, punto) => { const n = stacca(pagineRef.current, k, punto, areaRef.current); setPagine(n); const f = n.find((x) => x.chiave === k); return { x: f.x, y: f.y, w: f.w, h: f.h }; },
    aggancia: (k, zona) => setPagine((st) => aggancia(st, k, zona, areaRef.current)),
    sostituisciIn: (k, p) => setPagine((st) => sostituisciIn(st, k, nuova(p))),
    icona: (k) => { const f = pagineRef.current.find((x) => x.chiave === k); if (f && (f.scrivania ?? 1) !== scrivRef.current.attiva) { setScrivanie((s) => vaiAScrivania(s, f.scrivania)); setPagine((st) => inPrimoPiano(st, k)); return; } setPagine((st) => toccaIcona(st, k)); },
    desktop: () => setPagine((st) => { const mie = new Set(diQui(st).map((f) => f.chiave)); const r = mostraDesktop(diQui(st)); return st.map((f) => (mie.has(f.chiave) ? r.find((x) => x.chiave === f.chiave) : f)); }),
    // Andare a un'app della barra la mostra: le finestre restano ridotte nella barra.
    perVista: () => setPagine((st) => (diQui(st).some((f) => f.stato !== 'ridotta') ? st.map((f) => ((f.scrivania ?? 1) === scrivRef.current.attiva && f.stato !== 'ridotta' ? { ...f, prima: f.stato, stato: 'ridotta', daDesktop: true } : f)) : st)),
    divisore: (coppia, frazione) => setPagine((st) => spostaDivisore(st, coppia, frazione, areaRef.current)),
    // scrivanie
    vista: (v = (x) => !x) => setVista(v),
    scrivania: (id) => setScrivanie((s) => vaiAScrivania(s, id)),
    nuovaScrivania: () => setScrivanie((s) => nuovaScrivania(s)),
    rinominaScrivania: (id, nome) => setScrivanie((s) => rinominaScrivania(s, id, nome)),
    chiudiScrivania: (id) => { const r = chiudiScrivania(scrivRef.current, pagineRef.current, id); setScrivanie(r.scrivanie); setPagine(r.finestre); },
    inScrivania: (k, id) => setPagine((st) => spostaInScrivania(st, k, id)),
  };
  const mie = nellaScrivania(pagine, qui);
  const visibili = mie.filter((f) => f.stato !== 'ridotta');
  const inPrimo = attiva(mie);
  // Indietro del telefono: chiude la Visualizzazione attività, altrimenti riduce la finestra in primo piano.
  useIndietro(visibili.length > 0 || vista, () => {
    if (vista) { setVista(false); return nellaScrivania(pagineRef.current, scrivRef.current.attiva).some((f) => f.stato !== 'ridotta'); }
    const st = pagineRef.current, a = attiva(diQui(st)); if (!a) return false; const n = riduci(st, a.chiave); setPagine(n); return diQui(n).some((f) => f.stato !== 'ridotta');
  });
  useEffect(() => { document.body.classList.toggle('pp-con-pagina', visibili.length > 0); }, [visibili.length]);
  // PERSONAL-MULTITASK: un file trascinato da Esplora e lasciato sul desktop (fuori dalle finestre) si apre.
  useEffect(() => { document.body.dataset.bersaglio = 'desktop:apri'; return () => { delete document.body.dataset.bersaglio; }; }, []);
  return { pagine, mie, visibili, inPrimo, area, desktop, apri, indietro, sostituisci, azioni, scrivanie, vista };
}

// render(p, { chiudi, sostituisci }) → contenuto della finestra (dal registro delle sezioni).
export function Desktop({ finestre: fs, titolo, render, errore }) {
  const { pagine, inPrimo, area, desktop, azioni, scrivanie, vista } = fs;
  const [anteprima, setAnteprima] = useState(null); // zona d'aggancio sotto il dito
  const [menuSchemi, setMenuSchemi] = useState(null); // { chiave, rect }
  const [assist, setAssist] = useState(null); // { zone: [..], esclusi: Set }
  const [avviso, setAvviso] = useState(null); // nome della scrivania appena aperta
  const qui = scrivanie.attiva;
  const primaQui = useRef(qui);
  useEffect(() => { if (primaQui.current !== qui) { primaQui.current = qui; setAvviso(scrivanie.elenco.find((d) => d.id === qui)?.nome); const t = setTimeout(() => setAvviso(null), 1200); return () => clearTimeout(t); } return undefined; }, [qui]); // eslint-disable-line react-hooks/exhaustive-deps
  const punto = (p) => { const r = desktop.current?.getBoundingClientRect(); return r ? { x: p.x - r.left, y: p.y - r.top } : p; };
  // dopo un aggancio: se restano zone libere e ci sono altre finestre, si propone cosa metterci
  const dopoAggancio = (chiave, zona) => {
    const altre = fs.mie.filter((f) => f.chiave !== chiave && !f.aggancio);
    const libere = zoneLibere(zona, fs.pagine.map((f) => (f.chiave === chiave ? { ...f, aggancio: zona, stato: 'normale' } : f)), qui);
    if (altre.length && libere.length) setAssist({ zone: libere, esclusi: new Set([chiave]) });
  };
  const coppia = coppiaAgganciata(pagine, qui);
  const rz = anteprima && anteprima !== 'massimo' ? rettangoloZona(anteprima, area) : anteprima === 'massimo' ? { x: 0, y: 0, w: area.w, h: area.h } : null;
  return (
    <div className="pf-desktop" ref={desktop}>
      {pagine.map((p) => (
        <Finestra key={p.chiave} f={p} area={area} titolo={titolo(p) || 'Poliedron'} icona={<IconaFinestra tipo={p.tipo} />} attiva={inPrimo?.chiave === p.chiave}
          nascosta={(p.scrivania ?? 1) !== qui} accetta={ACCETTANO_FILE.has(p.tipo)}
          onPrimoPiano={() => azioni.primoPiano(p.chiave)} onRiduci={() => azioni.riduci(p.chiave)} onChiudi={() => azioni.chiudi(p.chiave)}
          onIngrandisci={() => azioni.ingrandisci(p.chiave)} onSposta={(r, ridim) => azioni.sposta(p.chiave, r, ridim)}
          onStacca={(pt) => azioni.stacca(p.chiave, punto(pt))}
          onTrascinaTitolo={(pt) => setAnteprima(zonaDaPunto(punto(pt).x, punto(pt).y, area))}
          onLasciaTitolo={(pt) => { const z = zonaDaPunto(punto(pt).x, punto(pt).y, area); setAnteprima(null); if (z) { azioni.aggancia(p.chiave, z); if (z !== 'massimo') dopoAggancio(p.chiave, z); } }}
          onSchemi={(rect) => setMenuSchemi({ chiave: p.chiave, rect })}>
          {inPrimo?.chiave === p.chiave && errore && <p className="pp-messaggio pp-messaggio-errore" role="alert">{errore}</p>}
          <div key={p.nuova || p.chiave} className="pf-contenuto pp-pagina-corpo">
            {render(p, { chiudi: () => azioni.chiudi(p.chiave), sostituisci: (q) => azioni.sostituisciIn(p.chiave, q) })}
          </div>
        </Finestra>
      ))}
      {rz && <div className="pf-anteprima-snap" style={{ left: rz.x + 6, top: rz.y + 6, width: rz.w - 12, height: rz.h - 12 }} aria-hidden="true" />}
      {coppia && <Divisore coppia={coppia} area={area} onSposta={(fr) => azioni.divisore(coppia, fr)} desktop={desktop} />}
      {menuSchemi && <MenuSchemi area={area} rect={menuSchemi.rect} origine={desktop.current?.getBoundingClientRect()} onChiudi={() => setMenuSchemi(null)}
        onScegli={(zona) => { const k = menuSchemi.chiave; setMenuSchemi(null); azioni.aggancia(k, zona); if (zona !== 'massimo') dopoAggancio(k, zona); }} />}
      {assist && <AssistenteSnap zona={assist.zone[0]} area={area} finestre={fs.mie.filter((f) => !assist.esclusi.has(f.chiave) && !f.aggancio)} titolo={titolo}
        onScegli={(k) => { const [z, ...resto] = assist.zone; azioni.aggancia(k, z); azioni.primoPiano(k); const esclusi = new Set([...assist.esclusi, k]); setAssist(resto.length && fs.mie.some((f) => !esclusi.has(f.chiave) && !f.aggancio) ? { zone: resto, esclusi } : null); }}
        onChiudi={() => setAssist(null)} />}
      {vista && <VistaAttivita fs={fs} titolo={titolo} onChiudi={() => azioni.vista(false)} />}
      {avviso && !vista && <div className="pf-avviso-scrivania" role="status">{avviso}</div>}
    </div>
  );
}

// Divisore comune tra due finestre agganciate (sinistra|destra o sopra/sotto): trascinandolo cambiano entrambe.
function Divisore({ coppia, area, onSposta, desktop }) {
  const presa = useRef(false);
  const vert = coppia.asse === 'x', pos = vert ? coppia.b.x : coppia.b.y;
  const muovi = (e) => { if (!presa.current) return; const r = desktop.current.getBoundingClientRect(); onSposta(vert ? (e.clientX - r.left) / area.w : (e.clientY - r.top) / area.h); };
  return <div className={`pf-divisore ${vert ? 'verticale' : 'orizzontale'}`} style={vert ? { left: pos - 8, top: 0, height: area.h } : { top: pos - 8, left: 0, width: area.w }}
    role="separator" aria-orientation={vert ? 'vertical' : 'horizontal'} aria-label="Divisore tra le finestre"
    onPointerDown={(e) => { presa.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); }} onPointerMove={muovi} onPointerUp={() => { presa.current = false; }} onPointerCancel={() => { presa.current = false; }}>
    <span /></div>;
}

// Schemi di affiancamento (Snap layouts) sotto il tasto Ingrandisci: tocchi la zona dove mettere la finestra.
function MenuSchemi({ area, rect, origine, onScegli, onChiudi }) {
  const elenco = schemi(area);
  const o = origine || { left: 0, top: 0 };
  const L = 236, x = Math.max(8, Math.min(area.w - L - 8, rect.right - o.left - L)), y = Math.min(area.h - 60, rect.bottom - o.top + 6);
  return (<>
    <div className="pf-velo-schemi" onPointerDown={onChiudi} />
    <div className="pf-schemi" role="menu" aria-label="Schemi di affiancamento" style={{ left: x, top: y, width: L }}>
      {elenco.map((zone, i) => (
        <div key={i} className={`pf-schema pf-schema-${zone.length === 1 ? 'pieno' : zone.join('_')}`} role="group">
          {zone.map((z) => {
            const r = z === 'massimo' ? { x: 0, y: 0, w: 1, h: 1 } : (() => { const q = rettangoloZona(z, { w: 1000, h: 1000 }); return { x: q.x / 1000, y: q.y / 1000, w: q.w / 1000, h: q.h / 1000 }; })();
            return <button key={z} type="button" role="menuitem" aria-label={NOMI_ZONE[z] || z} title={NOMI_ZONE[z] || z} onClick={() => onScegli(z)}
              style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }} />;
          })}
        </div>
      ))}
    </div>
  </>);
}
export const NOMI_ZONE = { sinistra: 'Metà sinistra', destra: 'Metà destra', sopra: 'Metà in alto', sotto: 'Metà in basso', massimo: 'Tutto lo schermo', 'alto-sx': 'In alto a sinistra', 'alto-dx': 'In alto a destra', 'basso-sx': 'In basso a sinistra', 'basso-dx': 'In basso a destra', 'due-terzi-sx': 'Due terzi a sinistra', 'terzo-dx': 'Un terzo a destra', 'terzo-1': 'Primo terzo', 'terzo-2': 'Terzo centrale', 'terzo-3': 'Ultimo terzo' };

// Snap assist: nella zona rimasta libera le altre finestre aperte, una si sceglie e la riempie.
function AssistenteSnap({ zona, area, finestre, titolo, onScegli, onChiudi }) {
  const r = rettangoloZona(zona, area);
  if (!r || !finestre.length) return null;
  return (
    <div className="pf-assist" style={{ left: r.x + 6, top: r.y + 6, width: r.w - 12, height: r.h - 12 }} role="dialog" aria-label="Scegli la finestra da affiancare">
      <div className="pf-assist-testa"><span>Scegli cosa affiancare</span><button type="button" onClick={onChiudi} aria-label="Chiudi suggerimenti">×</button></div>
      <div className="pf-assist-griglia">
        {finestre.map((f) => <button key={f.chiave} type="button" className="pf-assist-scheda" onClick={() => onScegli(f.chiave)}>
          <span className="pf-assist-icona"><IconaFinestra tipo={f.tipo} size={28} /></span><span>{titolo(f) || 'Finestra'}</span></button>)}
      </div>
    </div>
  );
}
export { telefono };
