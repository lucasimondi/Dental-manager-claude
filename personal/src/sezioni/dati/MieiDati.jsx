// MIEI-DATI (PO 2026-11-25): «I miei dati». Una scheda per Luca e una per ogni società (o altro), affiancate in
// orizzontale: si scorre col dito o con le linguette in alto. Ogni valore si scrive e si copia lì dove sta;
// «Copia fatturazione» copia il blocco pronto da incollare. Si salva da solo, poco dopo l'ultima modifica.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { archiviaScheda, bloccoFatturazione, caricaSchede, campiDi, CAMPI_PERSONA, COLORI, creaScheda, daCompilare, filtra, GRUPPI, iniziali, nuovaScheda, salvaScheda, testoPersona, testoScheda, TIPI } from '../../lib/mieiDati.js';
import { Conferma, Vuoto } from '../../ui.jsx';

const ATTESA = 700;

async function copia(testo, mostra, cosa = 'Copiato') {
  try { await navigator.clipboard.writeText(testo); mostra?.(cosa); }
  catch { mostra?.('Copia non riuscita: tieni premuto sul testo e copialo a mano'); }
}

export function MieiDati({ ctx }) {
  const [schede, setSchede] = useState(null), [cerca, setCerca] = useState(''), [attiva, setAttiva] = useState(null);
  const [stato, setStato] = useState(''); // '', 'salvo', 'salvato', 'errore'
  const striscia = useRef(null), timer = useRef({}), inAttesa = useRef({});

  useEffect(() => { let vivo = true; ctx.esegui(async () => { const s = await caricaSchede(archivioDb); if (vivo) setSchede(s); }); return () => { vivo = false; }; }, [ctx.esegui, ctx.versione]);

  const salvaOra = useCallback(async (id) => {
    clearTimeout(timer.current[id]);
    const patch = inAttesa.current[id]; if (!patch) return;
    delete inAttesa.current[id];
    setStato('salvo');
    try { await salvaScheda(archivioDb, id, patch); setStato('salvato'); }
    catch (e) { setStato('errore'); ctx.mostra?.(`Non salvato: ${e.message}`); }
  }, [ctx]);
  // Salva le modifiche rimaste anche quando si chiude la finestra.
  useEffect(() => () => { for (const id of Object.keys(inAttesa.current)) salvaOra(id); }, [salvaOra]);

  const cambia = useCallback((id, patch) => {
    setSchede((v) => v.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    inAttesa.current[id] = { ...inAttesa.current[id], ...patch };
    clearTimeout(timer.current[id]);
    timer.current[id] = setTimeout(() => salvaOra(id), ATTESA);
    setStato('');
  }, [salvaOra]);

  const vaiA = (id) => {
    setAttiva(id);
    striscia.current?.querySelector(`[data-scheda="${id}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  };
  // La linguetta accesa segue la scheda che si vede.
  const alloScorrere = () => {
    const el = striscia.current; if (!el) return;
    const x = el.getBoundingClientRect().left;
    let migliore = null, d = Infinity;
    for (const c of el.querySelectorAll('[data-scheda]')) { const dd = Math.abs(c.getBoundingClientRect().left - x); if (dd < d) { d = dd; migliore = c.dataset.scheda; } }
    if (migliore && migliore !== attiva) setAttiva(migliore);
  };

  const aggiungi = (tipo) => ctx.esegui(async () => {
    const nuova = await creaScheda(archivioDb, nuovaScheda(tipo, '', (schede?.length || 0)));
    setSchede((v) => [...v, { ...nuova, _nuova: true }]);
    setTimeout(() => vaiA(nuova.id), 60);
  });
  const archivia = (id) => ctx.esegui(async () => {
    await salvaOra(id); await archiviaScheda(archivioDb, id);
    setSchede((v) => v.filter((s) => s.id !== id)); ctx.mostra?.('Scheda archiviata');
  });

  const visibili = useMemo(() => filtra(schede || [], cerca), [schede, cerca]);
  if (!schede) return <Vuoto>Carico…</Vuoto>;
  const accesa = visibili.some((s) => s.id === attiva) ? attiva : visibili[0]?.id;

  return <div className="pp-md">
    <div className="pp-md-testa">
      <div><h2>I miei dati</h2><p>Fatturazione, contatti e consulenti, pronti da copiare. Scorri di lato per le società.</p></div>
      <span className={`pp-md-stato ${stato}`} aria-live="polite">{stato === 'salvo' ? 'Salvo…' : stato === 'salvato' ? 'Salvato' : stato === 'errore' ? 'Non salvato' : ''}</span>
    </div>
    <input className="pp-md-cerca" type="search" id="md-cerca" placeholder="Cerca: P.IVA, PEC, IBAN, commercialista…" value={cerca} onChange={(e) => setCerca(e.target.value)} aria-label="Cerca nei miei dati" />
    <div className="pp-md-linguette" role="tablist">
      {visibili.map((s) => <button key={s.id} role="tab" type="button" aria-selected={s.id === accesa} className={s.id === accesa ? 'attiva' : ''} onClick={() => vaiA(s.id)}>
        <span className={`pp-md-pallino pp-md-${s.colore || 'blu'}`} aria-hidden="true">{iniziali(s.nome)}</span>{s.nome.replace(/\s+(s\.a\.s\.|s\.r\.l\.|S\.r\.l\.).*$/i, '')}
      </button>)}
      <button type="button" className="pp-md-linguetta-piu" onClick={() => vaiA('nuova')}>+ Aggiungi</button>
    </div>
    <div className="pp-md-striscia" ref={striscia} onScroll={alloScorrere}>
      {visibili.map((s) => <Scheda key={s.id} s={s} cambia={(p) => cambia(s.id, p)} archivia={() => archivia(s.id)} mostra={ctx.mostra} />)}
      {!visibili.length && <div className="pp-md-scheda pp-md-vuota">Nessuna scheda contiene «{cerca}».</div>}
      <div className="pp-md-scheda pp-md-nuova" data-scheda="nuova">
        <strong>Aggiungi una scheda</strong>
        <span>Una società, una persona (per esempio un familiare di cui ti servono i dati) o altro: un'auto, un immobile, un contratto.</span>
        {TIPI.map(([t, n]) => <button key={t} type="button" className="pp-bottone pp-bottone-chiaro" onClick={() => aggiungi(t)}>+ {n}</button>)}
      </div>
    </div>
  </div>;
}

function Scheda({ s, cambia, archivia, mostra }) {
  const [modifica, setModifica] = useState(Boolean(s._nuova)), [chiedi, setChiedi] = useState(false);
  const campi = s.campi || [], persone = s.persone || [];
  const metti = (i, k, v) => cambia({ campi: campi.map((c, j) => (j === i ? { ...c, [k]: v } : c)) });
  const togli = (i) => cambia({ campi: campi.filter((_, j) => j !== i) });
  const nuovoCampo = (gruppo) => cambia({ campi: [...campi, { gruppo, etichetta: '', valore: '' }] });
  const mettiP = (i, k, v) => cambia({ persone: persone.map((p, j) => (j === i ? { ...p, [k]: v } : p)) });
  const vuoti = daCompilare(s);

  return <article className={`pp-md-scheda${modifica ? ' in-modifica' : ''}`} data-scheda={s.id} aria-label={s.nome}>
    <header className="pp-md-capo">
      <span className={`pp-md-sigla pp-md-${s.colore || 'blu'}`} aria-hidden="true">{iniziali(s.nome)}</span>
      <div className="pp-md-nome">
        {modifica ? <>
          <input id={`md-nome-${s.id}`} value={s.nome} onChange={(e) => cambia({ nome: e.target.value })} aria-label="Nome" />
          <input id={`md-desc-${s.id}`} value={s.descrizione || ''} placeholder="Descrizione (ruolo, attività…)" onChange={(e) => cambia({ descrizione: e.target.value })} aria-label="Descrizione" />
        </> : <><h3>{s.nome}</h3>{s.descrizione && <p>{s.descrizione}</p>}</>}
      </div>
    </header>
    {modifica && <div className="pp-md-colori" aria-label="Colore">
      {COLORI.map((c) => <button key={c} type="button" className={`pp-md-${c}${s.colore === c ? ' scelto' : ''}`} aria-label={c} onClick={() => cambia({ colore: c })} />)}
      <select value={s.tipo} onChange={(e) => cambia({ tipo: e.target.value })} aria-label="Tipo">{TIPI.map(([t, n]) => <option key={t} value={t}>{n}</option>)}</select>
    </div>}
    <div className="pp-md-azioni">
      <button type="button" className="pp-bottone" onClick={() => copia(bloccoFatturazione(s), mostra, 'Dati di fatturazione copiati')}>Copia fatturazione</button>
      <button type="button" className="pp-bottone pp-bottone-chiaro" onClick={() => copia(testoScheda(s), mostra, 'Scheda copiata')}>Copia tutto</button>
      <button type="button" className="pp-bottone pp-bottone-chiaro" aria-pressed={modifica} onClick={() => setModifica(!modifica)}>{modifica ? 'Fatto' : 'Modifica'}</button>
    </div>
    {vuoti > 0 && !modifica && <p className="pp-md-mancano">{vuoti === 1 ? '1 dato da compilare' : `${vuoti} dati da compilare`}: tocca il campo vuoto e scrivi.</p>}

    {GRUPPI.map(([g, titolo]) => {
      const righe = campiDi(s, g);
      if (!righe.length && !modifica) return null;
      return <section key={g} className="pp-md-gruppo">
        <h4>{titolo}</h4>
        {righe.map((c) => <div key={c.i} className="pp-md-campo">
          {modifica ? <input className="pp-md-etichetta" id={`md-e-${s.id}-${c.i}`} value={c.etichetta} placeholder="Nome del campo" onChange={(e) => metti(c.i, 'etichetta', e.target.value)} aria-label="Nome del campo" />
            : <label htmlFor={`md-v-${s.id}-${c.i}`}>{c.etichetta}</label>}
          <input className={`pp-md-valore${c.valore ? '' : ' vuoto'}`} id={`md-v-${s.id}-${c.i}`} value={c.valore || ''} placeholder="Da compilare" onChange={(e) => metti(c.i, 'valore', e.target.value)} aria-label={c.etichetta} spellCheck={false} />
          {modifica ? <button type="button" className="pp-md-x" aria-label={`Togli ${c.etichetta}`} onClick={() => togli(c.i)}>✕</button>
            : <button type="button" className="pp-md-copia" disabled={!c.valore} aria-label={`Copia ${c.etichetta}`} onClick={() => copia(c.valore, mostra, `${c.etichetta} copiato`)}>Copia</button>}
        </div>)}
        {modifica && <button type="button" className="pp-md-piu" onClick={() => nuovoCampo(g)}>+ Aggiungi campo</button>}
      </section>;
    })}

    <section className="pp-md-gruppo">
      <h4>Chi la segue</h4>
      {persone.map((p, i) => <div key={i} className="pp-md-persona">
        {modifica ? <>
          {CAMPI_PERSONA.map(([k, n]) => <input key={k} id={`md-p-${s.id}-${i}-${k}`} value={p[k] || ''} placeholder={n} aria-label={n} onChange={(e) => mettiP(i, k, e.target.value)} />)}
          <button type="button" className="pp-md-piu" onClick={() => cambia({ persone: persone.filter((_, j) => j !== i) })}>Togli consulente</button>
        </> : <>
          <span className="pp-md-ruolo">{p.ruolo || 'Consulente'}</span>
          <strong>{p.nome || '—'}</strong>
          {p.studio && <span className="pp-md-studio">{p.studio}</span>}
          {['email', 'pec', 'telefono'].filter((k) => p[k]).map((k) => <div key={k} className="pp-md-contatto">
            <span><em>{k === 'pec' ? 'PEC' : k === 'email' ? 'Email' : 'Tel.'}</em>{p[k]}</span>
            <button type="button" className="pp-md-copia" onClick={() => copia(p[k], mostra)}>Copia</button>
          </div>)}
          {p.note && <span className="pp-md-studio">{p.note}</span>}
          <button type="button" className="pp-md-piu" onClick={() => copia(testoPersona(p), mostra, 'Contatto copiato')}>Copia contatto</button>
        </>}
      </div>)}
      {!persone.length && !modifica && <p className="pp-md-mancano">Nessun consulente: tocca «Modifica» per aggiungerlo.</p>}
      {modifica && <button type="button" className="pp-md-piu" onClick={() => cambia({ persone: [...persone, { ruolo: 'Commercialista' }] })}>+ Aggiungi consulente</button>}
    </section>

    {(s.note || modifica) && <section className="pp-md-gruppo">
      <h4>Note</h4>
      {modifica ? <textarea id={`md-note-${s.id}`} value={s.note || ''} rows={3} onChange={(e) => cambia({ note: e.target.value })} aria-label="Note" />
        : <p className="pp-md-note">{s.note}</p>}
    </section>}

    {modifica && (chiedi
      ? <Conferma testo="Archiviare la scheda? Non si cancella, sparisce solo dall'elenco." etichetta="Archivia" onSi={archivia} onNo={() => setChiedi(false)} />
      : <button type="button" className="pp-md-archivia" onClick={() => setChiedi(true)}>Archivia scheda</button>)}
  </article>;
}
