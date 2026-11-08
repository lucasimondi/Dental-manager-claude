import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { interpreta, proposta, trovaElementi, destinazione, etichettaData } from './comandi.js';
import './ricerca.css';

// RICERCA-AGENDA (PO 2026-11-08): la barra in cima all'agenda cerca subito, qui, mentre scrivi
// (niente seconda barra in basso) e agisce: nuovo appuntamento o impegno, sposta, cancella,
// note, password, documenti, acquisizione. Ogni modifica all'agenda chiede "Conferma".
// `fonte` è l'adattatore dell'app (Studio o Personal); le azioni che non fornisce non compaiono.
const ICONE = {
  appuntamento: 'M8 3v3M16 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  impegno: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  nota: 'M5 4h10l4 4v12H5zM15 4v4h4M8.5 12.5h7M8.5 16h5',
  password: 'M7 10.5V7.5a5 5 0 0 1 10 0v3M5 10.5h14v10H5zM12 14.5v2.5',
  documento: 'M6 3h8l4 4v14H6zM14 3v4h4',
  acquisisci: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  paziente: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  poliedron: 'M12 2l9 5v10l-9 5-9-5V7z',
};
const Icona = ({ n }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONE[n] || ICONE.documento} /></svg>;
const quando = (e, oggi) => [etichettaData(e.data, oggi), e.ora].filter(Boolean).join(' · ');
const ESEMPI = ['sposta Rossi a giovedì alle 15', 'appuntamento Bianchi domani alle 10', 'ricordami recita bimbe venerdì', 'nota: chiamare il commercialista', 'password banca'];

function Proposta({ p, cmd, fonte, oggi, esegui, occupato }) {
  const [scelto, setScelto] = useState(null);
  const candidati = p.candidati || [];
  useEffect(() => { setScelto(candidati.length === 1 ? candidati[0].id : null); }, [candidati.map((c) => c.id).join()]);
  const el = candidati.find((c) => c.id === scelto);
  if (p.tipo === 'sposta' || p.tipo === 'cancella') {
    const azione = p.tipo === 'sposta' ? fonte.sposta : fonte.cancella;
    if (!azione) return null;
    const verso = p.tipo === 'sposta' && el ? destinazione(el, p.verso) : null;
    const senzaMeta = p.tipo === 'sposta' && !p.verso.data && !p.verso.ora;
    return <section className="ricerca-proposta" aria-label={p.tipo === 'sposta' ? 'Sposta' : 'Elimina'}>
      <h3>{p.tipo === 'sposta' ? 'Sposta' : 'Elimina'}{cmd.soggetto ? ` «${cmd.soggetto}»` : ''}</h3>
      {!candidati.length && <p className="ricerca-nota">Nessun appuntamento o impegno trovato{cmd.soggetto ? ` per «${cmd.soggetto}»` : ''}.</p>}
      {candidati.length > 1 && <p className="ricerca-nota">Quale?</p>}
      <div className="ricerca-candidati" role="radiogroup" aria-label="Scegli cosa">
        {candidati.map((c) => <button key={`${c.tipo}-${c.id}`} type="button" role="radio" aria-checked={scelto === c.id} className={scelto === c.id ? 'on' : ''} style={{ '--c': c.colore || 'var(--agenda-tint, #0B7A5C)' }} onClick={() => setScelto(c.id)}>
          <i /><span><b>{c.titolo}</b><small>{quando(c, oggi)}</small></span>
        </button>)}
      </div>
      {senzaMeta && el && <p className="ricerca-nota">Dimmi quando, per esempio «sposta {cmd.soggetto || 'Rossi'} a giovedì alle 15».</p>}
      {verso && !senzaMeta && <p className="ricerca-verso">{quando(el, oggi)} <span aria-hidden="true">→</span> <b>{quando({ data: verso.data, ora: verso.ora }, oggi)}</b></p>}
      <div className="ricerca-bottoni">
        <button type="button" className={p.tipo === 'cancella' ? 'ricerca-pericolo' : 'ricerca-primario'} disabled={!el || senzaMeta || occupato}
          onClick={() => esegui(() => azione(el, verso), p.tipo === 'sposta' ? 'Spostato' : 'Eliminato')}>{p.tipo === 'sposta' ? 'Conferma' : 'Elimina'}</button>
      </div>
    </section>;
  }
  if (p.tipo === 'nuovoAppuntamento' || p.tipo === 'nuovoImpegno') {
    const fai = p.tipo === 'nuovoAppuntamento' ? fonte.nuovoAppuntamento : fonte.nuovoImpegno;
    if (!fai) return null;
    return <section className="ricerca-proposta" aria-label={p.tipo === 'nuovoAppuntamento' ? 'Nuovo appuntamento' : 'Nuovo impegno'}>
      <h3>{p.tipo === 'nuovoAppuntamento' ? 'Nuovo appuntamento' : 'Nuovo impegno'}</h3>
      <p className="ricerca-verso"><b>{p.titolo || (p.tipo === 'nuovoAppuntamento' ? 'Paziente da scegliere' : 'Senza titolo')}</b>{(p.data || p.ora) && <> · {quando({ data: p.data, ora: p.ora }, oggi)}</>}</p>
      <div className="ricerca-bottoni"><button type="button" className="ricerca-primario" onClick={() => esegui(() => fai({ data: p.data, ora: p.ora, soggetto: p.soggetto, titolo: p.titolo }), null)}>Continua</button></div>
    </section>;
  }
  if (p.tipo === 'nuovaNota' && fonte.nuovaNota) {
    return <section className="ricerca-proposta" aria-label="Nuova nota">
      <h3>Nuova nota</h3>
      <p className="ricerca-verso">{cmd.testo || 'Scrivi il testo dopo «nota:»'}</p>
      <div className="ricerca-bottoni"><button type="button" className="ricerca-primario" disabled={!cmd.testo.trim() || occupato} onClick={() => esegui(() => fonte.nuovaNota(cmd.testo), 'Nota salvata')}>Salva nota</button></div>
    </section>;
  }
  if (p.tipo === 'acquisisci' && fonte.acquisisci) {
    return <section className="ricerca-proposta" aria-label="Acquisisci documento">
      <h3>Acquisisci documento</h3>
      <div className="ricerca-bottoni"><button type="button" className="ricerca-primario" onClick={() => esegui(() => fonte.acquisisci(), null)}>Scatta o scegli</button></div>
    </section>;
  }
  return null;
}

export default function RicercaAgenda({ fonte, placeholder = 'Cerca o chiedi: «sposta Rossi a giovedì»', extra = null }) {
  const [testo, setTesto] = useState('');
  const [aperta, setAperta] = useState(false);
  const [altri, setAltri] = useState([]);
  const [esito, setEsito] = useState(null);
  const [occupato, setOccupato] = useState(false);
  const [top, setTop] = useState(120);
  const riga = useRef(null), input = useRef(null);
  const oggi = fonte.oggi;
  const cmd = useMemo(() => interpreta(testo, oggi), [testo, oggi]);
  const elementi = fonte.elementi || [];
  const p = useMemo(() => (cmd.tipo !== 'cerca' && cmd.tipo !== 'vuoto' ? proposta(cmd, elementi, oggi) : null), [cmd, elementi, oggi]);
  const trovati = useMemo(() => {
    if (cmd.tipo !== 'cerca') return [];
    if (!cmd.soggetto && !cmd.date.length) return [];
    return trovaElementi(elementi, cmd.soggetto, { oggi, data: cmd.date[0] || null, limite: 6 });
  }, [cmd, elementi, oggi]);
  const pazienti = useMemo(() => (cmd.tipo === 'cerca' && cmd.soggetto.length > 1 && fonte.cercaPazienti ? fonte.cercaPazienti(cmd.soggetto).slice(0, 5) : []), [cmd, fonte]);
  // Note, password (solo titoli) e documenti: arrivano un attimo dopo, mentre si scrive.
  useEffect(() => {
    const q = cmd.tipo === 'password' ? cmd.soggetto : cmd.tipo === 'cerca' ? cmd.soggetto : '';
    if (!aperta || !fonte.cercaAltro || (cmd.tipo !== 'password' && q.length < 2)) { setAltri([]); return undefined; }
    let vivo = true;
    const t = setTimeout(() => { fonte.cercaAltro(q, { solo: cmd.tipo === 'password' ? 'Password' : null }).then((xs) => { if (vivo) setAltri(xs || []); }).catch(() => { if (vivo) setAltri([]); }); }, 180);
    return () => { vivo = false; clearTimeout(t); };
  }, [aperta, cmd.tipo, cmd.soggetto, fonte]);
  useLayoutEffect(() => {
    if (!aperta || !riga.current) return undefined;
    const misura = () => setTop(Math.round(riga.current.getBoundingClientRect().bottom + 6));
    misura();
    globalThis.visualViewport?.addEventListener('resize', misura);
    return () => globalThis.visualViewport?.removeEventListener('resize', misura);
  }, [aperta]);
  // Con i risultati aperti l'icona di Poliedron e il dock si nascondono (stessa classe delle finestre).
  useEffect(() => { if (!aperta) return undefined; document.body.classList.add('pol-modale-aperto'); return () => document.body.classList.remove('pol-modale-aperto'); }, [aperta]);
  useEffect(() => { if (!esito?.ok) return undefined; const t = setTimeout(() => { setEsito(null); }, 2200); return () => clearTimeout(t); }, [esito]);
  const chiudi = () => { setAperta(false); setTesto(''); setAltri([]); input.current?.blur(); };
  const esegui = async (fai, messaggio) => {
    if (occupato) return;
    setOccupato(true); setEsito(null);
    try {
      await fai();
      if (messaggio) { setEsito({ ok: true, testo: `${messaggio} ✓` }); setTesto(''); } else chiudi();
    } catch (e) { setEsito({ ok: false, testo: e?.message || 'Operazione non riuscita' }); } finally { setOccupato(false); }
  };
  const apriElemento = (fai) => { chiudi(); fai(); };
  const gruppi = altri.reduce((m, x) => { (m[x.gruppo] ||= []).push(x); return m; }, {});
  const azioni = [
    fonte.nuovoAppuntamento && ['appuntamento', 'Nuovo appuntamento', () => apriElemento(() => fonte.nuovoAppuntamento({}))],
    fonte.nuovoImpegno && ['impegno', 'Nuovo impegno', () => apriElemento(() => fonte.nuovoImpegno({}))],
    fonte.nuovaNota && ['nota', 'Nuova nota', () => { setTesto('nota: '); input.current?.focus(); }],
    fonte.acquisisci && ['acquisisci', 'Acquisisci documento', () => apriElemento(() => fonte.acquisisci())],
    fonte.apriPassword && ['password', 'Password', () => apriElemento(() => fonte.apriPassword(''))],
    fonte.apriNote && ['nota', 'Note', () => apriElemento(() => fonte.apriNote())],
    fonte.apriDocumenti && ['documento', 'Documenti', () => apriElemento(() => fonte.apriDocumenti(''))],
  ].filter(Boolean);
  const vuoto = cmd.tipo === 'vuoto';
  const nessuno = cmd.tipo === 'cerca' && !trovati.length && !pazienti.length && !altri.length;
  const pannello = aperta && <>
    <div className="ricerca-velo" style={{ top }} onClick={chiudi} aria-hidden="true" />
    <div className="ricerca-pannello" role="dialog" aria-label="Risultati della ricerca" style={{ top, maxHeight: `calc(var(--ricerca-vh, 100dvh) - ${top}px - 96px - env(safe-area-inset-bottom, 0px))` }} onMouseDown={(e) => { if (e.target.closest('input,textarea')) return; e.preventDefault(); }}>
      {esito && <p className={`ricerca-esito${esito.ok ? '' : ' ricerca-esito--errore'}`} role={esito.ok ? 'status' : 'alert'}>{esito.testo}</p>}
      {p && <Proposta p={p} cmd={cmd} fonte={fonte} oggi={oggi} esegui={esegui} occupato={occupato} />}
      {vuoto && <>
        <div className="ricerca-azioni" role="group" aria-label="Azioni veloci">
          {azioni.map(([ic, nome, fai]) => <button key={nome} type="button" onClick={fai}><Icona n={ic} /><span>{nome}</span></button>)}
        </div>
        <p className="ricerca-titolo">Puoi anche scrivere</p>
        <div className="ricerca-esempi">{ESEMPI.map((e) => <button key={e} type="button" onClick={() => { setTesto(e); input.current?.focus(); }}>{e}</button>)}</div>
      </>}
      {trovati.length > 0 && <section aria-label="Agenda"><p className="ricerca-titolo">Agenda</p>
        {trovati.map((e) => <button key={`${e.tipo}-${e.id}`} type="button" className="ricerca-voce" style={{ '--c': e.colore || 'var(--agenda-tint, #0B7A5C)' }} onClick={() => apriElemento(() => fonte.apri(e))}>
          <i className="ricerca-punto" /><span><b>{e.titolo}</b><small>{quando(e, oggi)}{e.sottotitolo ? ` · ${e.sottotitolo}` : ''}</small></span></button>)}
      </section>}
      {pazienti.length > 0 && <section aria-label="Pazienti"><p className="ricerca-titolo">Pazienti</p>
        {pazienti.map((x) => <button key={x.id} type="button" className="ricerca-voce" onClick={() => apriElemento(x.apri)}><Icona n="paziente" /><span><b>{x.titolo}</b>{x.sottotitolo && <small>{x.sottotitolo}</small>}</span></button>)}
      </section>}
      {Object.entries(gruppi).map(([g, xs]) => <section key={g} aria-label={g}><p className="ricerca-titolo">{g}</p>
        {xs.map((x) => <button key={`${g}-${x.id}`} type="button" className="ricerca-voce" onClick={() => apriElemento(x.apri)}><Icona n={x.icona} /><span><b>{x.titolo}</b>{x.sottotitolo && <small>{x.sottotitolo}</small>}</span></button>)}
      </section>)}
      {cmd.tipo === 'password' && fonte.apriPassword && <button type="button" className="ricerca-voce" onClick={() => apriElemento(() => fonte.apriPassword(cmd.soggetto))}><Icona n="password" /><span><b>Apri il registro password</b>{cmd.soggetto && <small>«{cmd.soggetto}»</small>}</span></button>}
      {nessuno && <p className="ricerca-nota">Nessun risultato in agenda{fonte.cercaPazienti ? ', pazienti' : ''} e note.</p>}
      {cmd.tipo === 'cerca' && fonte.apriDocumenti && <button type="button" className="ricerca-voce" onClick={() => apriElemento(() => fonte.apriDocumenti(cmd.soggetto))}><Icona n="documento" /><span><b>Cerca nei documenti</b><small>«{testo.trim()}»</small></span></button>}
      {!vuoto && fonte.chiediPoliedron && <button type="button" className="ricerca-voce ricerca-poliedron" onClick={() => apriElemento(() => fonte.chiediPoliedron(testo.trim()))}><Icona n="poliedron" /><span><b>Chiedi a Poliedron</b><small>«{testo.trim()}»</small></span></button>}
    </div>
  </>;
  return <div className="agenda-search-row" ref={riga}>
    <label className={`agenda-search agenda-floating-interactive ricerca-campo${aperta ? ' ricerca-campo--aperta' : ''}`}>
      <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
      <input ref={input} type="search" enterKeyHint="search" aria-label="Cerca o chiedi" placeholder={placeholder} value={testo} autoComplete="off" autoCorrect="off" spellCheck={false}
        onFocus={() => setAperta(true)} onChange={(e) => { setTesto(e.target.value); setAperta(true); setEsito(null); }}
        onKeyDown={(e) => { if (e.key === 'Escape') chiudi(); if (e.key === 'Enter') { e.preventDefault(); input.current?.blur(); } }} />
      {testo && <button type="button" className="ricerca-svuota" aria-label="Svuota" onMouseDown={(e) => e.preventDefault()} onClick={() => { setTesto(''); input.current?.focus(); }}>×</button>}
    </label>
    {aperta ? <button type="button" className="ricerca-annulla agenda-floating-interactive" onClick={chiudi}>Chiudi</button> : extra}
    {pannello && createPortal(pannello, document.body)}
  </div>;
}
