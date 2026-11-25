// PERSONAL-FINESTRE (PO 2026-11-24): il desktop di Personal. Le pagine aperte sono finestre stile
// Windows 11 (più insieme, riducibili a icona, ingrandibili, spostabili, ridimensionabili); la barra
// delle applicazioni resta sempre visibile. Qui lo stato (useFinestre) e la resa (Desktop).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Finestra } from './Finestra.jsx';
import { IconaFinestra } from './IconeFinestre.jsx';
import { useIndietro } from './lib/indietro.js';
import { apriFinestra, attiva, inPrimoPiano, riduci, chiudi, ingrandisciRipristina, mostraDesktop, sposta, toccaIcona, sostituisciIn, riadatta, preferenzaTipo, ricordaTipo } from './lib/finestre.js';

// Finestre che accettano documenti trascinati da un'altra finestra (Esplora → scanner, PDF, Archivia).
export const ACCETTANO_FILE = new Set(['scansione', 'pdf', 'carica', 'scanner']); // 'scanner' = lo scanner dello Scan dentro Personal (PR #348)

export function useFinestre({ onErrore = () => {} } = {}) {
  const [pagine, setPagine] = useState([]);
  const contatore = useRef(0), desktop = useRef(null);
  const [area, setArea] = useState(() => ({ w: typeof window !== 'undefined' ? window.innerWidth : 400, h: typeof window !== 'undefined' ? window.innerHeight - 64 : 700 }));
  const areaRef = useRef(area); areaRef.current = area;
  const pagineRef = useRef(pagine); pagineRef.current = pagine;
  useEffect(() => {
    const misura = () => { const el = desktop.current; if (!el) return; const a = { w: el.clientWidth, h: el.clientHeight }; setArea(a); setPagine((st) => riadatta(st, a)); };
    misura(); addEventListener('resize', misura); return () => removeEventListener('resize', misura);
  }, []);
  const nuova = (p) => { contatore.current += 1; return { ...p, chiave: contatore.current }; };
  const apri = useCallback((p) => { onErrore(null); setPagine((st) => apriFinestra(st, nuova(p), areaRef.current, preferenzaTipo(p.tipo))); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // «Indietro» di una pagina = chiude la finestra in primo piano; sostituisci = nuovo contenuto nella stessa finestra.
  const indietro = useCallback(() => { onErrore(null); setPagine((st) => { const a = attiva(st); return a ? chiudi(st, a.chiave) : st; }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const sostituisci = useCallback((p) => { const n = nuova(p); setPagine((st) => { const a = attiva(st); return a ? sostituisciIn(st, a.chiave, n) : apriFinestra(st, n, areaRef.current, preferenzaTipo(p.tipo)); }); }, []);
  const azioni = {
    primoPiano: (k) => setPagine((st) => inPrimoPiano(st, k)),
    riduci: (k) => setPagine((st) => riduci(st, k)),
    chiudi: (k) => { onErrore(null); setPagine((st) => chiudi(st, k)); },
    ingrandisci: (k) => setPagine((st) => { const n = ingrandisciRipristina(st, k); const f = n.find((x) => x.chiave === k); if (f) ricordaTipo(f.tipo, f.stato); return n; }),
    sposta: (k, r) => setPagine((st) => sposta(st, k, r, areaRef.current)),
    sostituisciIn: (k, p) => setPagine((st) => sostituisciIn(st, k, nuova(p))),
    icona: (k) => setPagine((st) => toccaIcona(st, k)),
    desktop: () => setPagine((st) => mostraDesktop(st)),
    // Andare a un'app della barra la mostra: le finestre restano ridotte nella barra.
    perVista: () => setPagine((st) => (st.some((f) => f.stato !== 'ridotta') ? mostraDesktop(st) : st)),
  };
  const visibili = pagine.filter((f) => f.stato !== 'ridotta');
  const inPrimo = attiva(pagine);
  // Indietro del telefono: riduce a icona la finestra in primo piano (nessun lavoro perso).
  useIndietro(visibili.length > 0, () => { const st = pagineRef.current, a = attiva(st); if (!a) return false; const n = riduci(st, a.chiave); setPagine(n); return n.some((f) => f.stato !== 'ridotta'); });
  useEffect(() => { document.body.classList.toggle('pp-con-pagina', visibili.length > 0); }, [visibili.length]);
  return { pagine, visibili, inPrimo, area, desktop, apri, indietro, sostituisci, azioni };
}

// render(p, { chiudi, sostituisci }) → contenuto della finestra (dal registro delle sezioni).
export function Desktop({ finestre: fs, titolo, render, errore }) {
  const { pagine, inPrimo, area, desktop, azioni } = fs;
  return (
    <div className="pf-desktop" ref={desktop}>
      {pagine.map((p) => (
        <Finestra key={p.chiave} f={p} area={area} titolo={titolo(p) || 'Poliedron'} icona={<IconaFinestra tipo={p.tipo} />} attiva={inPrimo?.chiave === p.chiave}
          accetta={ACCETTANO_FILE.has(p.tipo)} onPrimoPiano={() => azioni.primoPiano(p.chiave)} onRiduci={() => azioni.riduci(p.chiave)} onChiudi={() => azioni.chiudi(p.chiave)}
          onIngrandisci={() => azioni.ingrandisci(p.chiave)} onSposta={(r) => azioni.sposta(p.chiave, r)}>
          {inPrimo?.chiave === p.chiave && errore && <p className="pp-messaggio pp-messaggio-errore" role="alert">{errore}</p>}
          <div key={p.nuova || p.chiave} className="pf-contenuto pp-pagina-corpo">
            {render(p, { chiudi: () => azioni.chiudi(p.chiave), sostituisci: (q) => azioni.sostituisciIn(p.chiave, q) })}
          </div>
        </Finestra>
      ))}
    </div>
  );
}
