import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AREE_NOTE, areaNota, aggiungiNota, aggiornaNota, eliminaNota, leggiNote, dividiNota } from './note.js';
import './note.css';

// NOTE-PERSONALI — pagina Note, identica in Studio e in Personal (stile iOS).
// `db` è il client del database dello studio, `studioId` lo studio della sessione.
const quando = (iso) => {
  const d = new Date(iso), oggi = new Date();
  if (d.toDateString() === oggi.toDateString()) return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
};

function Nota({ nota, occupato, onSalva, onFissa, onElimina }) {
  const [modifica, setModifica] = useState(false);
  const [testo, setTesto] = useState(nota.testo);
  const [conferma, setConferma] = useState(false);
  const area = areaNota(nota.area);
  const { titolo, corpo } = dividiNota(nota.testo);
  if (modifica) return <div className="note-card note-card--edit" style={{ '--area': area.colore }}>
    <textarea aria-label="Modifica nota" value={testo} onChange={(e) => setTesto(e.target.value)} rows={5} autoFocus />
    <div className="note-card-actions">
      <button type="button" onClick={() => { setTesto(nota.testo); setModifica(false); }}>Annulla</button>
      <button type="button" className="note-primary" disabled={occupato || !testo.trim()} onClick={async () => { if (await onSalva(nota, testo)) setModifica(false); }}>Salva</button>
    </div>
  </div>;
  return <article className={`note-card${nota.fissata ? ' note-card--pin' : ''}`} style={{ '--area': area.colore }}>
    <button type="button" className="note-card-body" onClick={() => setModifica(true)} aria-label={`Modifica nota: ${titolo}`}>
      <b>{titolo}</b>
      {corpo && <p>{corpo}</p>}
    </button>
    <div className="note-card-meta">
      <span className="note-tag">{area.nome}</span>
      <span>{quando(nota.updated_at || nota.created_at)}</span>
      <span className="note-card-tools">
        <button type="button" aria-pressed={nota.fissata} aria-label={nota.fissata ? 'Togli dai fissati' : 'Fissa in alto'} disabled={occupato} onClick={() => onFissa(nota)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l-1 6 4 4H6l4-4z" /><path d="M12 13v8" /></svg>
        </button>
        {conferma
          ? <><button type="button" className="note-danger" disabled={occupato} onClick={() => onElimina(nota)}>Elimina</button><button type="button" onClick={() => setConferma(false)}>No</button></>
          : <button type="button" aria-label="Elimina nota" disabled={occupato} onClick={() => setConferma(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M6.5 7l1 13h9l1-13" /></svg></button>}
      </span>
    </div>
  </article>;
}

export default function NotePage({ db, studioId, titolo = 'Note', scriviSubito = false }) {
  const [note, setNote] = useState(null);
  const [errore, setErrore] = useState('');
  const [testo, setTesto] = useState('');
  const [area, setArea] = useState('personale');
  const [filtro, setFiltro] = useState('tutte');
  const [occupato, setOccupato] = useState(false);
  const lock = useRef(false);
  const carica = useCallback(() => leggiNote(db).then((xs) => { setNote(xs); setErrore(''); }).catch((e) => { setNote([]); setErrore(e.message); }), [db]);
  useEffect(() => { carica(); }, [carica]);
  const esegui = async (fai) => {
    if (lock.current) return false;
    lock.current = true; setOccupato(true); setErrore('');
    try { await fai(); return true; } catch (e) { setErrore(e.message); return false; } finally { lock.current = false; setOccupato(false); }
  };
  const visibili = useMemo(() => (note || []).filter((n) => filtro === 'tutte' || n.area === filtro), [note, filtro]);
  const aggiungi = (e) => {
    e.preventDefault();
    const scritto = testo;
    esegui(async () => {
      const nuova = await aggiungiNota(db, { studioId, testo: scritto, area });
      setNote((xs) => [nuova, ...(xs || [])].sort((a, b) => Number(b.fissata) - Number(a.fissata)));
      setTesto((t) => (t === scritto ? '' : t));
    });
  };
  const sostituisci = (riga) => setNote((xs) => (xs || []).map((n) => (n.id === riga.id ? riga : n)).sort((a, b) => Number(b.fissata) - Number(a.fissata) || String(b.updated_at).localeCompare(String(a.updated_at))));
  return <div className="note-page">
    <h1 className="note-title">{titolo}</h1>
    <form className="note-capture" onSubmit={aggiungi}>
      <textarea autoFocus={scriviSubito} aria-label="Nuova nota" placeholder="Scrivi una nota…" value={testo} maxLength={4000} rows={testo.includes('\n') ? 4 : 2} onChange={(e) => setTesto(e.target.value)} />
      <div className="note-capture-bar">
        <div className="note-areas" role="radiogroup" aria-label="Area della nota">
          {AREE_NOTE.map((a) => <button key={a.id} type="button" role="radio" aria-checked={area === a.id} className={area === a.id ? 'on' : ''} style={{ '--area': a.colore }} onClick={() => setArea(a.id)}><i />{a.nome}</button>)}
        </div>
        <button type="submit" className="note-add" disabled={occupato || !testo.trim()} aria-label="Aggiungi nota">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </div>
    </form>
    <div className="note-filters" role="tablist" aria-label="Filtra le note">
      {[{ id: 'tutte', nome: 'Tutte' }, ...AREE_NOTE].map((a) => <button key={a.id} type="button" role="tab" aria-selected={filtro === a.id} className={filtro === a.id ? 'on' : ''} style={a.colore ? { '--area': a.colore } : undefined} onClick={() => setFiltro(a.id)}>{a.colore && <i />}{a.nome}</button>)}
    </div>
    {errore && <p className="note-error" role="alert">{errore} <button type="button" onClick={carica}>Riprova</button></p>}
    {note === null && <p className="note-empty">Caricamento…</p>}
    {note && !visibili.length && !errore && <p className="note-empty">{filtro === 'tutte' ? 'Nessuna nota. Scrivi la prima qui sopra: la prima riga diventa il titolo.' : 'Nessuna nota in quest\'area.'}</p>}
    <div className="note-grid">
      {visibili.map((n) => <Nota key={n.id} nota={n} occupato={occupato}
        onSalva={(nota, t) => esegui(async () => sostituisci(await aggiornaNota(db, nota.id, { testo: t })))}
        onFissa={(nota) => esegui(async () => sostituisci(await aggiornaNota(db, nota.id, { fissata: !nota.fissata })))}
        onElimina={(nota) => esegui(async () => { await eliminaNota(db, nota.id); setNote((xs) => xs.filter((x) => x.id !== nota.id)); })} />)}
    </div>
  </div>;
}
