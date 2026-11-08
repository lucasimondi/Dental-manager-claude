import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { aggiungiPassword, aggiornaPassword, eliminaPassword, leggiPassword, corrispondePassword, linkSito } from './password.js';
import './password.css';

// PASSWORD-PERSONALI — registro password, identico in Studio e in Personal (stile iOS).
// PO 2026-11-08: "un registro su cui registro e devono vedersi": ogni password si vede con un tocco
// (occhio) e si copia; resta privata del suo autore.
const VUOTA = { titolo: '', utente: '', segreto: '', sito: '', note: '' };

async function copia(testo) {
  try { await navigator.clipboard.writeText(testo); return true; } catch { return false; }
}

function Modulo({ iniziale = VUOTA, occupato, onSalva, onAnnulla, etichetta }) {
  const [v, setV] = useState(iniziale);
  const [vedi, setVedi] = useState(true);
  const campo = (k, label, extra = {}) => <label className="pw-field"><span>{label}</span><input value={v[k]} onChange={(e) => setV((x) => ({ ...x, [k]: e.target.value }))} autoComplete="off" autoCapitalize="off" spellCheck={false} {...extra} /></label>;
  return <form className="pw-form" onSubmit={async (e) => { e.preventDefault(); if (await onSalva(v)) setV(VUOTA); }}>
    {campo('titolo', 'Servizio', { placeholder: 'Banca, Email, Fornitore…', autoCapitalize: 'sentences', required: true, autoFocus: etichetta === 'nuova' })}
    {campo('utente', 'Utente o email')}
    <div className="pw-field pw-field--secret">
      <label htmlFor={`pw-${etichetta}`}>Password</label>
      <div className="pw-secret-row">
        <input id={`pw-${etichetta}`} type={vedi ? 'text' : 'password'} value={v.segreto} onChange={(e) => setV((x) => ({ ...x, segreto: e.target.value }))} autoComplete="new-password" autoCapitalize="off" spellCheck={false} />
        <button type="button" className="pw-icon" aria-label={vedi ? 'Nascondi password' : 'Mostra password'} aria-pressed={vedi} onClick={() => setVedi((x) => !x)}><Occhio aperto={vedi} /></button>
      </div>
    </div>
    {campo('sito', 'Sito', { inputMode: 'url', placeholder: 'esempio.it' })}
    <label className="pw-field"><span>Note</span><textarea rows={2} value={v.note} onChange={(e) => setV((x) => ({ ...x, note: e.target.value }))} /></label>
    <div className="pw-form-actions">
      {onAnnulla && <button type="button" onClick={onAnnulla}>Annulla</button>}
      <button type="submit" className="pw-primary" disabled={occupato || !v.titolo.trim()}>{etichetta === 'nuova' ? 'Registra' : 'Salva'}</button>
    </div>
  </form>;
}

const Occhio = ({ aperto }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />{!aperto && <path d="M4 4l16 16" />}</svg>;
const Copia = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></svg>;

function Voce({ voce, aperta, onApri, occupato, onSalva, onElimina, avvisa }) {
  const [vedi, setVedi] = useState(false);
  const [modifica, setModifica] = useState(false);
  const [conferma, setConferma] = useState(false);
  const sito = linkSito(voce.sito);
  if (modifica) return <li className="pw-item pw-item--open"><Modulo iniziale={{ ...VUOTA, ...voce }} etichetta={voce.id} occupato={occupato} onAnnulla={() => setModifica(false)} onSalva={async (v) => { const ok = await onSalva(voce, v); if (ok) setModifica(false); return false; }} /></li>;
  return <li className={`pw-item${aperta ? ' pw-item--open' : ''}`}>
    <button type="button" className="pw-row" aria-expanded={aperta} onClick={onApri}>
      <span className="pw-avatar" aria-hidden="true">{voce.titolo.slice(0, 1).toUpperCase()}</span>
      <span className="pw-row-text"><b>{voce.titolo}</b>{voce.utente && <small>{voce.utente}</small>}</span>
      <svg className="pw-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
    </button>
    {aperta && <div className="pw-detail">
      {voce.utente && <div className="pw-line"><span>Utente</span><code>{voce.utente}</code><button type="button" className="pw-icon" aria-label="Copia utente" onClick={async () => avvisa(await copia(voce.utente) ? 'Utente copiato' : 'Copia non riuscita')}><Copia /></button></div>}
      <div className="pw-line"><span>Password</span><code aria-label="Password">{vedi ? (voce.segreto || '—') : '••••••••'}</code>
        <button type="button" className="pw-icon" aria-label={vedi ? 'Nascondi password' : 'Mostra password'} aria-pressed={vedi} onClick={() => setVedi((x) => !x)}><Occhio aperto={vedi} /></button>
        <button type="button" className="pw-icon" aria-label="Copia password" disabled={!voce.segreto} onClick={async () => avvisa(await copia(voce.segreto) ? 'Password copiata' : 'Copia non riuscita')}><Copia /></button></div>
      {voce.sito && <div className="pw-line"><span>Sito</span>{sito ? <a href={sito} target="_blank" rel="noopener noreferrer">{voce.sito}</a> : <code>{voce.sito}</code>}</div>}
      {voce.note && <p className="pw-note">{voce.note}</p>}
      <div className="pw-form-actions">
        {conferma
          ? <><button type="button" onClick={() => setConferma(false)}>No</button><button type="button" className="pw-danger" disabled={occupato} onClick={() => onElimina(voce)}>Elimina davvero</button></>
          : <><button type="button" className="pw-danger-link" onClick={() => setConferma(true)}>Elimina</button><button type="button" onClick={() => setModifica(true)}>Modifica</button></>}
      </div>
    </div>}
  </li>;
}

export default function PasswordPage({ db, studioId, titolo = 'Password', cercaIniziale = '', nuovaSubito = false }) {
  const [voci, setVoci] = useState(null);
  const [errore, setErrore] = useState('');
  const [avviso, setAvviso] = useState('');
  const [cerca, setCerca] = useState(cercaIniziale);
  const [nuova, setNuova] = useState(nuovaSubito);
  const [aperta, setAperta] = useState(null);
  const [occupato, setOccupato] = useState(false);
  const lock = useRef(false);
  const carica = useCallback(() => leggiPassword(db).then((xs) => { setVoci(xs); setErrore(''); }).catch((e) => { setVoci([]); setErrore(e.message); }), [db]);
  useEffect(() => { carica(); }, [carica]);
  useEffect(() => { if (!avviso) return undefined; const t = setTimeout(() => setAvviso(''), 1800); return () => clearTimeout(t); }, [avviso]);
  const esegui = async (fai) => {
    if (lock.current) return false;
    lock.current = true; setOccupato(true); setErrore('');
    try { await fai(); return true; } catch (e) { setErrore(e.message); return false; } finally { lock.current = false; setOccupato(false); }
  };
  const ordina = (xs) => [...xs].sort((a, b) => a.titolo.localeCompare(b.titolo, 'it', { sensitivity: 'base' }));
  const visibili = useMemo(() => (voci || []).filter((v) => corrispondePassword(v, cerca)), [voci, cerca]);
  useEffect(() => { if (cercaIniziale && visibili.length === 1) setAperta(visibili[0].id); }, [cercaIniziale, visibili]);
  return <div className="pw-page">
    <div className="pw-head"><h1 className="pw-title">{titolo}</h1>
      <button type="button" className="pw-add" aria-label="Registra una password" aria-pressed={nuova} onClick={() => setNuova((x) => !x)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></button></div>
    <p className="pw-hint">Visibili solo a te. Poliedron non le legge mai.</p>
    {nuova && <Modulo etichetta="nuova" occupato={occupato} onAnnulla={() => setNuova(false)} onSalva={(v) => esegui(async () => { const r = await aggiungiPassword(db, { studioId, ...v }); setVoci((xs) => ordina([...(xs || []), r])); setNuova(false); setAperta(r.id); })} />}
    <input className="pw-search" type="search" aria-label="Cerca nel registro password" placeholder="Cerca servizio, utente o sito" value={cerca} onChange={(e) => setCerca(e.target.value)} />
    {errore && <p className="pw-error" role="alert">{errore} <button type="button" onClick={carica}>Riprova</button></p>}
    {voci === null && <p className="pw-empty">Caricamento…</p>}
    {voci && !visibili.length && !errore && <p className="pw-empty">{cerca ? 'Nessuna voce trovata.' : 'Nessuna password registrata. Tocca + per registrare la prima.'}</p>}
    <ul className="pw-list">
      {visibili.map((v) => <Voce key={v.id} voce={v} aperta={aperta === v.id} occupato={occupato} avvisa={setAvviso}
        onApri={() => setAperta((x) => (x === v.id ? null : v.id))}
        onSalva={(voce, dati) => esegui(async () => { const r = await aggiornaPassword(db, voce.id, dati); setVoci((xs) => ordina(xs.map((x) => (x.id === r.id ? r : x)))); })}
        onElimina={(voce) => esegui(async () => { await eliminaPassword(db, voce.id); setVoci((xs) => xs.filter((x) => x.id !== voce.id)); })} />)}
    </ul>
    {avviso && <p className="pw-toast" role="status">{avviso}</p>}
  </div>;
}
