import React, { useMemo, useState } from 'react';
import './altro.css';
import { blocchiBento } from './bento.js';

// APP-UNICA (PO 2026-11-08): «Altro», uguale in Studio e Personal. Due gruppi a tessere —
// Lavoro (studio) e Vita (personale) — e una ricerca per trovare subito una sezione.
// Ogni voce: { id, nome, icona, colore, fai } oppure { …, href } per aprire l'altra parte.
const P = {
  pazienti: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M22 21a7 7 0 0 0-4-6.3',
  incassi: 'M17.5 6.5A7 7 0 1 0 17.5 17.5M4 10.5h9M4 13.5h9',
  piani: 'M6 3h9l4 4v14H6zM9 12h7M9 16h5M9 8h3',
  preventivi: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  richiami: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  attivita: 'M9 4h6v3H9zM6 5H5v16h14V5h-1M8.5 13l2.5 2.5 4.5-5',
  spese: 'M3 7h18v10H3zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  controllo: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  listino: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  whatsapp: 'M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z',
  chat: 'M4 5h16v11H8l-4 4z',
  agente: 'M12 3v3M5 9h14v10H5zM9 13h.01M15 13h.01M9 16.5h6',
  home: 'M3 11l9-7 9 7v9H3zM9 20v-6h6v6',
  oggi: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  conti: 'M3 7h16v12H3zM3 7l12-3v3M16 13h.01',
  personali: 'M3 6h18v12H3zM8 10.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM5.5 15a2.5 2.5 0 0 1 5 0M14 9h4M14 13h4',
  pratiche: 'M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0zM8 21h8',
  foto: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9.5h.01',
  diario: 'M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zM5 18a2 2 0 0 1 2-2h12',
  biblioteca: 'M3 5h7a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H3zM21 5h-7a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h7z',
  password: 'M7 10.5V7.5a5 5 0 0 1 10 0v3M5 10.5h14v10H5zM12 14.5v2.5',
  nota: 'M5 4h10l4 4v12H5zM15 4v4h4M8.5 12.5h7M8.5 16h5',
  pdf: 'M6 3h8l4 4v14H6zM14 3v4h4M8.5 17.5c1.5-2 2.5-4.5 3-6 .5 2 1.5 3.5 3.5 4',
  impostazioni: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
};
export const ICONE_ALTRO = P;
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function Tessera({ v }) {
  const dentro = <>
    <span className="altro-icona" style={{ '--c': v.colore }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={P[v.icona] || P.listino} /></svg></span>
    <span className="altro-nome">{v.nome}</span>
    <i aria-hidden="true">›</i>
  </>;
  // DOCK-PER-TE passo 4: righe leggibili con icona e titolo (non più tessere multicolore).
  return v.href
    ? <a className="altro-voce" href={v.href}>{dentro}</a>
    : <button type="button" className="altro-voce" onClick={v.fai}>{dentro}</button>;
}

// STUDIO-BENTO (PO 2026-11-08, mockup B): ogni voce può avere una `taglia` — 'grande' (riquadro
// verde a tutta larghezza), 'alta' (due righe), 'media' (mezza larghezza), 'piccola' (un terzo),
// 'pulsante' (basso, in fondo) — e un `sotto` (una riga di spiegazione). Le taglie vicine si
// raggruppano: grande/alta/media su due colonne, piccola su tre, pulsante in fila. Cercando si
// torna all'elenco a righe.
function Riquadro({ v }) {
  const taglia = v.taglia || 'piccola';
  const dentro = <>
    <span className="bento-icona"><svg viewBox="0 0 24 24" aria-hidden="true"><path d={P[v.icona] || P.listino} /></svg></span>
    <span className="bento-testi"><strong>{v.nome}</strong>{v.sotto && taglia !== 'piccola' && taglia !== 'pulsante' && <span>{v.sotto}</span>}</span>
    {taglia === 'grande' && <i aria-hidden="true">›</i>}
  </>;
  const cls = `bento-voce bento-${taglia}`;
  return v.href ? <a className={cls} href={v.href}>{dentro}</a> : <button type="button" className={cls} onClick={v.fai}>{dentro}</button>;
}

export default function AltroPage({ titolo = 'Altro', gruppi = [], piede = [] }) {
  const [cerca, setCerca] = useState('');
  const visibili = useMemo(() => gruppi.map((g) => ({ ...g, voci: g.voci.filter((v) => !cerca || norm(v.nome).includes(norm(cerca))) })).filter((g) => g.voci.length), [gruppi, cerca]);
  return <div className="altro-pagina">
    <h1 className="altro-titolo">{titolo}</h1>
    <label className="altro-cerca">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
      <input type="search" aria-label="Cerca una sezione" placeholder="Cerca una sezione" value={cerca} onChange={(e) => setCerca(e.target.value)} />
    </label>
    {visibili.map((g) => <section key={g.nome} className="altro-gruppo" aria-label={g.nome}>
      {g.nome !== titolo && <h2>{g.nome}</h2>}
      {!cerca && g.voci.some((v) => v.taglia)
        ? blocchiBento(g.voci).map((b, i) => <div key={i} className={`bento bento-${b.tipo}`}>{b.voci.map((v) => <Riquadro key={v.id} v={v} />)}</div>)
        : <div className="altro-elenco">{g.voci.map((v) => <Tessera key={v.id} v={v} />)}</div>}
    </section>)}
    {!visibili.length && <p className="altro-vuoto">Nessuna sezione con «{cerca}».</p>}
    {!cerca && piede.map((v) => v.href
      ? <a key={v.id} className="altro-riga" href={v.href}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={P[v.icona] || P.impostazioni} /></svg><span>{v.nome}</span><i aria-hidden="true">›</i></a>
      : <button key={v.id} type="button" className="altro-riga" onClick={v.fai}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={P[v.icona] || P.impostazioni} /></svg><span>{v.nome}</span><i aria-hidden="true">›</i></button>)}
  </div>;
}
