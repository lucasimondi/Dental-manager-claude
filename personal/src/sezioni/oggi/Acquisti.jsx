import { useEffect, useRef, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { leggiAcquisti, salvaAcquisto, eliminaAcquisto, TIPI_ACQUISTO } from '../../lib/acquisti.js';
import { Sezione, Gruppo } from '../../ui.jsx';

export function Acquisti({ ctx }) {
  const [voci, setVoci] = useState(null);
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('Spesa');
  const [occupato, setOccupato] = useState(false);
  const [errore, setErrore] = useState('');
  const [comprati, setComprati] = useState(false);
  const lock = useRef(false);
  const carica = () => leggiAcquisti(archivioDb).then((xs) => { setVoci(xs); setErrore(''); }).catch((e) => setErrore(e.message));
  useEffect(() => { carica(); }, [ctx.versione]);
  const esegui = async (fai) => {
    if (lock.current) return;
    lock.current = true; setOccupato(true); setErrore('');
    try { await fai(); await carica(); } catch (e) { setErrore(e.message); }
    finally { lock.current = false; setOccupato(false); }
  };
  const aperte = (voci || []).filter((v) => !v.comprato);
  return <Sezione titolo={`Da comprare${voci ? ` · ${aperte.length}` : ''}`}>
    <form onSubmit={(e) => { e.preventDefault(); const testo = nome; esegui(async () => { await salvaAcquisto(archivioDb, { nome: testo, categoria }); setNome((attuale) => attuale === testo ? '' : attuale); }); }}>
      <label className="pp-campo"><span>Cosa manca?</span><input value={nome} maxLength={200} onChange={(e) => setNome(e.target.value)} placeholder="Es. latte 2 litri, detersivo, pellet" /></label>
      <div className="pp-due">
        <label className="pp-campo"><span>Lista</span><select className="pp-select" value={categoria} onChange={(e) => setCategoria(e.target.value)}>{TIPI_ACQUISTO.map((c) => <option key={c}>{c}</option>)}</select></label>
        <button className="pp-bottone" disabled={occupato || !voci || !nome.trim()}>Aggiungi</button>
      </div>
    </form>
    {errore && <p role="alert">{errore} <button className="pp-testo-link" onClick={carica}>Riprova</button></p>}
    {!voci && !errore && <p className="pp-riga-meta">Caricamento lista…</p>}
    {voci && !aperte.length && <p className="pp-riga-meta">Niente da comprare. Aggiungi qui la spesa e gli altri acquisti.</p>}
    <Gruppo>{(voci || []).filter((v) => comprati || !v.comprato).map((v) => <div className="pp-riga" key={v.id}>
      <label className="pp-riga-testo" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <input type="checkbox" checked={v.comprato} disabled={occupato} onChange={() => esegui(() => salvaAcquisto(archivioDb, { ...v, comprato: !v.comprato }))} aria-label={`${v.comprato ? 'Da comprare' : 'Comprato'}: ${v.nome}`} />
        <span><span style={{ textDecoration: v.comprato ? 'line-through' : undefined }}>{v.nome}</span><span className="pp-riga-meta">{v.categoria}</span></span>
      </label>
      {v.comprato && <button className="pp-testo-link" disabled={occupato} onClick={() => esegui(() => eliminaAcquisto(archivioDb, v.id))}>Elimina</button>}
    </div>)}</Gruppo>
    {(voci || []).some((v) => v.comprato) && <button className="pp-testo-link" onClick={() => setComprati(!comprati)}>{comprati ? 'Nascondi comprati' : 'Mostra comprati / ripristina'}</button>}
    <p className="pp-riga-meta">Spunta quando compri. La lista non registra spese o pagamenti.</p>
  </Sezione>;
}
