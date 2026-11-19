// PRATICHE-CARTELLE (proposta B): le pratiche come cartelle con le anteprime dei documenti.
import { useEffect, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { caricaCartellePratiche, filtraPratiche, contaFiltri } from '../../lib/praticheCartelle.js';
import { colore, dataBreve, Vuoto } from '../../ui.jsx';
import { Miniatura } from '../../Miniatura.jsx';

export function CartellaPratica({ p, onApri }) {
  const caselle = [0, 1, 2, 3].map((i) => p.anteprime?.[i] || null);
  const meta = [p.passiAperti ? `${p.passiAperti} ${p.passiAperti === 1 ? 'passo' : 'passi'}` : null, p.prossimo ? dataBreve(p.prossimo).replace(/ \d{4}$/, '') : null].filter(Boolean).join(' · ')
    || `${p.n_documenti ?? 0} documenti`;
  return (
    <button type="button" className="pp-cartella-pratica" onClick={() => onApri(p)} aria-label={`Apri ${p.nome}`}>
      <span className="pp-cartella-pratica-anteprime" aria-hidden="true">
        {caselle.map((d, i) => <span key={d?.id || i} className="pp-cartella-pratica-casella">{d ? <Miniatura doc={d} colore={colore(p.fascicolo)} /> : null}</span>)}
      </span>
      <strong className="pp-cartella-pratica-nome">{p.nome}</strong>
      <span className={`pp-cartella-pratica-meta${p.urgente && p.passiAperti ? ' urgente' : ''}`}>{meta}</span>
    </button>
  );
}

export function GrigliaPratiche({ elenco, onApri }) {
  if (!elenco.length) return <Vuoto>Nessuna pratica.</Vuoto>;
  return <div className="pp-griglia-pratiche">{elenco.map((p) => <CartellaPratica key={p.id} p={p} onApri={onApri} />)}</div>;
}

// Elenco completo con i filtri «Da gestire», «Tutte», «Chiuse».
export function PraticheCartelle({ ctx, fascicolo = null }) {
  const [elenco, setElenco] = useState(null), [filtro, setFiltro] = useState('gestire');
  useEffect(() => { let vivo = true; ctx.esegui(async () => { const e = await caricaCartellePratiche(archivioDb, { fascicolo }); if (vivo) setElenco(e); }); return () => { vivo = false; }; }, [ctx.esegui, ctx.versione, fascicolo]);
  if (!elenco) return <Vuoto>Carico le pratiche…</Vuoto>;
  const n = contaFiltri(elenco);
  return (
    <>
      <div className="pp-dafare-filtri" role="tablist" aria-label="Quali pratiche">
        {[['gestire', 'Da gestire'], ['tutte', 'Tutte'], ['chiuse', 'Chiuse']].map(([id, nome]) => (
          <button key={id} type="button" role="tab" aria-selected={filtro === id} className={`pp-chip${filtro === id ? ' attiva' : ''}`} onClick={() => setFiltro(id)}>{nome} <span>{n[id]}</span></button>
        ))}
      </div>
      <GrigliaPratiche elenco={filtraPratiche(elenco, filtro)} onApri={(p) => ctx.apri({ tipo: 'pratica', p })} />
    </>
  );
}
