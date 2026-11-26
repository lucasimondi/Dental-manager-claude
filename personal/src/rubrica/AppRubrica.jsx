// RUBRICA (PO 2026-11-26, mockup approvato «Ok crea»): «ho un problema, chi chiamo?». Contatti per categoria con
// ricerca anche per problema («perdita lavandino» → idraulico), scheda con Chiama / WhatsApp / Email / Mappa, note
// e storico interventi, e promemoria che si ripetono (cambio gomme, manutenzione stufa). Si salva da solo poco dopo
// l'ultima modifica. Si apre dentro Personal e come app a sé sulla Home (/poliedron/rubrica/).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { archivioDb } from '../lib/supabasePersonal.js';
import {
  archiviaContatto, archiviaPromemoria, AVVISI, CATEGORIE, categoria, categorieUsate, caricaRubrica, cerca as cercaContatti, creaContatto, creaPromemoria,
  dataBreve, dataIso, dataSuggerita, euro, iniziali, mappa, nomeCategoria, numero, oggiIso, ordinaInterventi, ordinaPromemoria, perCategoria, RIPETI,
  salvaContatto, salvaPromemoria, segnaFatto, sitoWeb, SUGGERITI, telefonoChiamabile, testoDaCopiare, testoPromemoria, testoRipeti, totaleInterventi, whatsapp,
} from '../lib/rubrica.js';
import { Conferma, Vuoto } from '../ui.jsx';
import { IconaApp } from '../cose/IconeCose.jsx';
import './rubrica.css';

const ATTESA = 700;
const I = {
  tel: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
  wa: 'M21 11.5a8.4 8.4 0 0 1-12.3 7.5L3 21l2-5.6A8.4 8.4 0 1 1 21 11.5z',
  mail: 'M3 5h18v14H3zM3 7l9 6 9-6',
  mappa: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  sito: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z',
  campana: 'M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0',
  indietro: 'M15 6l-6 6 6 6',
  piu: 'M12 5v14M5 12h14',
  stella: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z',
};
const Svg = ({ d, size = 20, piena = false }) => <svg width={size} height={size} viewBox="0 0 24 24" fill={piena ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
const Avatar = ({ c, size = 44 }) => <span className={`pp-rb-avatar pp-rb-c-${categoria(c.categorie?.[0] || 'Altro').colore}`} style={{ width: size, height: size }} aria-hidden="true">{iniziali(c.nome)}</span>;

async function copia(testo, mostra, cosa = 'Copiato') {
  try { await navigator.clipboard.writeText(testo); mostra?.(cosa); }
  catch { mostra?.('Copia non riuscita: tieni premuto sul testo e copialo a mano'); }
}

export function AppRubrica({ ctx }) {
  const [dati, setDati] = useState(null), [vista, setVista] = useState({ tab: 'contatti' });
  const [stato, setStato] = useState('');
  const timer = useRef({}), inAttesa = useRef({});

  useEffect(() => { let vivo = true; ctx.esegui(async () => { const d = await caricaRubrica(archivioDb); if (vivo) setDati(d); }); return () => { vivo = false; }; }, [ctx.esegui, ctx.versione]); // eslint-disable-line react-hooks/exhaustive-deps

  const salvaOra = useCallback(async (id) => {
    clearTimeout(timer.current[id]);
    const patch = inAttesa.current[id]; if (!patch) return;
    delete inAttesa.current[id];
    setStato('salvo');
    try { await salvaContatto(archivioDb, id, patch); setStato('salvato'); }
    catch (e) { setStato('errore'); ctx.mostra?.(`Non salvato: ${e.message}`); }
  }, [ctx]);
  useEffect(() => () => { for (const id of Object.keys(inAttesa.current)) salvaOra(id); }, [salvaOra]);

  const cambia = useCallback((id, patch, subito = false) => {
    setDati((d) => ({ ...d, contatti: d.contatti.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
    inAttesa.current[id] = { ...inAttesa.current[id], ...patch };
    clearTimeout(timer.current[id]);
    timer.current[id] = setTimeout(() => salvaOra(id), subito ? 0 : ATTESA);
    setStato('');
  }, [salvaOra]);

  const promemoria = useMemo(() => ordinaPromemoria(dati?.promemoria || []), [dati]);
  const daGuardare = promemoria.filter((p) => p.stato !== 'ok');
  if (!dati) return <Vuoto>Carico…</Vuoto>;
  const contatto = (id) => dati.contatti.find((c) => c.id === id);
  const apriScheda = (id) => setVista({ tab: 'contatti', scheda: id });

  const azioni = {
    nuovoContatto: (c, p) => ctx.esegui(async () => {
      const nuovo = await creaContatto(archivioDb, c);
      let pr = null;
      if (p) pr = await creaPromemoria(archivioDb, { ...p, contatto_id: nuovo.id });
      setDati((d) => ({ contatti: [...d.contatti, nuovo], promemoria: pr ? [...d.promemoria, pr] : d.promemoria }));
      ctx.mostra?.('Contatto salvato'); apriScheda(nuovo.id);
    }),
    archiviaContatto: (id) => ctx.esegui(async () => {
      await salvaOra(id); await archiviaContatto(archivioDb, id);
      setDati((d) => ({ ...d, contatti: d.contatti.filter((c) => c.id !== id) }));
      ctx.mostra?.('Contatto archiviato'); setVista({ tab: 'contatti' });
    }),
    nuovoPromemoria: (p) => ctx.esegui(async () => {
      const pr = await creaPromemoria(archivioDb, p);
      setDati((d) => ({ ...d, promemoria: [...d.promemoria, pr] })); ctx.mostra?.('Promemoria salvato');
      return pr;
    }),
    salvaPromemoria: (id, patch) => ctx.esegui(async () => {
      const pr = await salvaPromemoria(archivioDb, id, patch);
      setDati((d) => ({ ...d, promemoria: d.promemoria.map((x) => (x.id === id ? pr : x)) }));
    }),
    fatto: (p) => ctx.esegui(async () => {
      const pr = await segnaFatto(archivioDb, p);
      // Si segna anche nello storico del professionista collegato.
      const c = p.contatto_id && contatto(p.contatto_id);
      if (c) cambia(c.id, { interventi: [...(c.interventi || []), { data: oggiIso(), voce: p.cosa }] }, true);
      setDati((d) => ({ ...d, promemoria: p.ripeti === 'mai' ? d.promemoria.filter((x) => x.id !== p.id) : d.promemoria.map((x) => (x.id === p.id ? pr : x)) }));
      ctx.mostra?.(p.ripeti === 'mai' ? 'Fatto' : `Fatto: il prossimo è il ${dataBreve(pr.data)}`);
    }),
    archiviaPromemoria: (id) => ctx.esegui(async () => {
      await archiviaPromemoria(archivioDb, id);
      setDati((d) => ({ ...d, promemoria: d.promemoria.filter((x) => x.id !== id) })); ctx.mostra?.('Promemoria archiviato');
    }),
  };

  const scheda = vista.scheda && contatto(vista.scheda);
  return <div className="pp-rb">
    <header className="pp-rb-testa">
      <IconaApp ambito="rubrica" size={46} />
      <div><h2>Rubrica</h2><p>Chi chiamare: professionisti, note e promemoria</p></div>
      <span className={`pp-md-stato ${stato}`} aria-live="polite">{stato === 'salvo' ? 'Salvo…' : stato === 'salvato' ? 'Salvato' : stato === 'errore' ? 'Non salvato' : ''}</span>
    </header>
    <div className="pp-rb-tab" role="tablist" aria-label="Rubrica">
      <button type="button" role="tab" aria-selected={vista.tab === 'contatti'} onClick={() => setVista({ tab: 'contatti' })}>Contatti <span>{dati.contatti.length}</span></button>
      <button type="button" role="tab" aria-selected={vista.tab === 'promemoria'} onClick={() => setVista({ tab: 'promemoria' })}>Promemoria {daGuardare.length > 0 ? <span className="avviso">{daGuardare.length}</span> : <span>{promemoria.length}</span>}</button>
    </div>
    {vista.tab === 'promemoria'
      ? <Promemoria lista={promemoria} contatti={dati.contatti} contatto={contatto} azioni={azioni} apriScheda={apriScheda} nuovo={vista.nuovo} />
      : vista.nuovo ? <NuovoContatto contatti={dati.contatti} chiudi={() => setVista({ tab: 'contatti' })} salva={azioni.nuovoContatto} />
        : scheda ? <Scheda c={scheda} promemoria={promemoria.filter((p) => p.contatto_id === scheda.id)} cambia={(p, subito) => cambia(scheda.id, p, subito)} azioni={azioni} mostra={ctx.mostra}
          indietro={() => { salvaOra(scheda.id); setVista({ tab: 'contatti' }); }} nuovoPromemoria={() => setVista({ tab: 'promemoria', nuovo: { contatto_id: scheda.id } })} />
          : <Elenco contatti={dati.contatti} urgenti={daGuardare} apriScheda={apriScheda} nuovo={() => setVista({ tab: 'contatti', nuovo: true })} vaiPromemoria={() => setVista({ tab: 'promemoria' })} />}
  </div>;
}

function Elenco({ contatti, urgenti, apriScheda, nuovo, vaiPromemoria }) {
  const [q, setQ] = useState(''), [cat, setCat] = useState(null);
  const usate = useMemo(() => categorieUsate(contatti), [contatti]);
  const trovati = useMemo(() => cercaContatti(contatti, q, cat), [contatti, q, cat]);
  const gruppi = useMemo(() => (q.trim() ? null : perCategoria(trovati).filter((g) => !cat || g.nome === cat)), [trovati, q, cat]);
  return <>
    {urgenti.length > 0 && !q && !cat && <button type="button" className="pp-rb-avviso" onClick={vaiPromemoria}>
      <span className="pp-rb-avviso-icona"><Svg d={I.campana} /></span>
      <span><strong>{urgenti.length === 1 ? '1 promemoria' : `${urgenti.length} promemoria`} da guardare</strong><span>{urgenti[0].cosa} · {urgenti[0].quando}</span></span>
      <i aria-hidden="true">›</i>
    </button>}
    <div className="pp-rb-barra">
      <input className="pp-md-cerca" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Problema o nome: «perdita lavandino», «gomme»…" aria-label="Cerca nella rubrica" />
      <button type="button" className="pp-bottone" onClick={nuovo}><Svg d={I.piu} size={16} /> Nuovo</button>
    </div>
    {usate.length > 1 && <div className="pp-rb-chips" aria-label="Categorie">
      <button type="button" aria-pressed={!cat} onClick={() => setCat(null)}>Tutti <span>{contatti.length}</span></button>
      {usate.map((u) => <button key={u.nome} type="button" aria-pressed={cat === u.nome} onClick={() => setCat(cat === u.nome ? null : u.nome)}>{u.nome} <span>{u.n}</span></button>)}
    </div>}
    {!contatti.length && <div className="pp-rb-vuoto">
      <strong>La tua rubrica dei professionisti</strong>
      <span>Idraulico, elettricista, chi fa la manutenzione della stufa, il gommista, il cartongessista… Aggiungili qui con le tue note: quando hai un problema cerchi il problema e trovi chi chiamare.</span>
      <button type="button" className="pp-bottone" onClick={nuovo}>Aggiungi il primo contatto</button>
    </div>}
    {contatti.length > 0 && !trovati.length && <div className="pp-rb-vuoto"><span>Nessun contatto per «{q}».</span><button type="button" className="pp-bottone" onClick={nuovo}>Aggiungi contatto</button></div>}
    {gruppi ? gruppi.map((g) => <section key={g.nome} className="pp-rb-gruppo" aria-label={g.nome}>
      <h3>{g.nome}</h3>
      <div className="pp-rb-lista">{g.contatti.map((c) => <Riga key={c.id} c={c} apri={() => apriScheda(c.id)} />)}</div>
    </section>) : trovati.length > 0 && <div className="pp-rb-lista">{trovati.map((c) => <Riga key={c.id} c={c} apri={() => apriScheda(c.id)} conCategoria />)}</div>}
  </>;
}

function Riga({ c, apri, conCategoria = false }) {
  const tel = telefonoChiamabile(c.telefono || c.telefono2);
  const sotto = [conCategoria && nomeCategoria(c), c.referente].filter(Boolean).join(' · ');
  const nota = (c.note || '').split('\n')[0];
  return <div className="pp-rb-riga">
    <button type="button" className="pp-rb-riga-apri" onClick={apri}>
      <Avatar c={c} />
      <span className="pp-rb-riga-testo">
        <strong>{c.nome}{c.preferito && <span className="pp-rb-stellina" aria-label="preferito"><Svg d={I.stella} size={13} piena /></span>}</strong>
        {sotto && <span>{sotto}</span>}
        {nota && <em>{nota}</em>}
      </span>
    </button>
    {tel && <a className="pp-rb-chiama" href={`tel:${tel}`} aria-label={`Chiama ${c.nome}`}><Svg d={I.tel} /></a>}
  </div>;
}

function Categorie({ scelte, cambia }) {
  const [altra, setAltra] = useState('');
  const nomi = [...new Set([...CATEGORIE.map(([, n]) => n).filter((n) => n !== 'Altro'), ...scelte.map((n) => categoria(n).nome)])];
  const tocca = (n) => cambia(scelte.includes(n) ? scelte.filter((x) => x !== n) : [...scelte, n]);
  const aggiungi = () => { const n = categoria(altra).nome; if (n && !scelte.includes(n)) cambia([...scelte, n]); setAltra(''); };
  return <div className="pp-rb-cat">
    {nomi.map((n) => <button key={n} type="button" aria-pressed={scelte.includes(n)} onClick={() => tocca(n)}>{n}</button>)}
    <span className="pp-rb-cat-nuova">
      <input value={altra} onChange={(e) => setAltra(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); aggiungi(); } }} placeholder="Altra categoria (es. Vetraio)" aria-label="Nuova categoria" />
      {altra.trim() && <button type="button" onClick={aggiungi}>Aggiungi</button>}
    </span>
  </div>;
}

function NuovoContatto({ chiudi, salva }) {
  const [c, setC] = useState({ nome: '', categorie: [], telefono: '', referente: '', note: '' });
  const [conProm, setConProm] = useState(false), [p, setP] = useState({ cosa: '', data: '', ripeti: '1a', avviso_giorni: 30 });
  const metti = (k) => (e) => setC({ ...c, [k]: e.target.value });
  const ok = c.nome.trim() && (!conProm || (p.cosa.trim() && dataIso(p.data)));
  return <form className="pp-rb-form" onSubmit={(e) => { e.preventDefault(); if (ok) salva(c, conProm ? p : null); }}>
    <div className="pp-rb-form-testa"><button type="button" className="pp-rb-link" onClick={chiudi}>Annulla</button><strong>Nuovo contatto</strong><button type="submit" className="pp-rb-link forte" disabled={!ok}>Salva</button></div>
    <label className="pp-rb-campo">Nome o azienda<input value={c.nome} onChange={metti('nome')} placeholder="Es. Idraulica Bianchi" autoFocus /></label>
    <div className="pp-rb-campo"><span>Categoria (anche più di una)</span><Categorie scelte={c.categorie} cambia={(categorie) => setC({ ...c, categorie })} /></div>
    <div className="pp-rb-due">
      <label className="pp-rb-campo">Telefono<input type="tel" inputMode="tel" value={c.telefono} onChange={metti('telefono')} placeholder="Cellulare" /></label>
      <label className="pp-rb-campo">Referente<input value={c.referente} onChange={metti('referente')} placeholder="Es. Paolo" /></label>
    </div>
    <label className="pp-rb-campo">Note<textarea rows={4} value={c.note} onChange={metti('note')} placeholder="Cosa ha fatto, prezzi, come contattarlo meglio, parole per ritrovarlo («perdita», «muffa»…)" /></label>
    <p className="pp-rb-aiuto">Email, indirizzo, sito e orari si aggiungono dopo, dalla scheda (Modifica).</p>
    <section className="pp-rb-box">
      <label className="pp-rb-interruttore"><span>Promemoria</span><input type="checkbox" checked={conProm} onChange={(e) => setConProm(e.target.checked)} /></label>
      {conProm && <CampiPromemoria p={p} setP={setP} />}
    </section>
    <button type="submit" className="pp-bottone" disabled={!ok}>Salva contatto</button>
  </form>;
}

function CampiPromemoria({ p, setP, contatti }) {
  return <div className="pp-rb-prom-campi">
    <label className="pp-rb-campo">Cosa<input list="rb-suggeriti" value={p.cosa} onChange={(e) => {
      const s = SUGGERITI.find(([x]) => x === e.target.value);
      setP({ ...p, cosa: e.target.value, ...(s ? { ripeti: s[1], data: p.data || dataSuggerita(s[2]) } : {}) });
    }} placeholder="Es. Manutenzione stufa" /></label>
    <datalist id="rb-suggeriti">{SUGGERITI.map(([x]) => <option key={x} value={x} />)}</datalist>
    <div className="pp-rb-due">
      <label className="pp-rb-campo">Data<input type="date" value={dataIso(p.data) || ''} onChange={(e) => setP({ ...p, data: e.target.value })} /></label>
      <label className="pp-rb-campo">Avvisami<select value={p.avviso_giorni} onChange={(e) => setP({ ...p, avviso_giorni: Number(e.target.value) })}>{AVVISI.map(([g, n]) => <option key={g} value={g}>{n}</option>)}</select></label>
    </div>
    <div className="pp-rb-campo"><span>Si ripete</span><div className="pp-rb-ripeti">{RIPETI.map(([k, n]) => <button key={k} type="button" aria-pressed={p.ripeti === k} onClick={() => setP({ ...p, ripeti: k })}>{n}</button>)}</div></div>
    {contatti && <label className="pp-rb-campo">Chi chiamare<select value={p.contatto_id || ''} onChange={(e) => setP({ ...p, contatto_id: e.target.value || null })}>
      <option value="">Nessuno</option>
      {[...contatti].sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => <option key={c.id} value={c.id}>{c.nome}{c.categorie?.length ? ` (${c.categorie[0]})` : ''}</option>)}
    </select></label>}
    {contatti && <label className="pp-rb-campo">Note<input value={p.note || ''} onChange={(e) => setP({ ...p, note: e.target.value })} placeholder="Es. Panda, gomme in deposito" /></label>}
  </div>;
}

function Scheda({ c, promemoria, cambia, azioni, mostra, indietro, nuovoPromemoria }) {
  const [modifica, setModifica] = useState(false), [chiedi, setChiedi] = useState(false), [nuovo, setNuovo] = useState(null);
  const tel = telefonoChiamabile(c.telefono), tel2 = telefonoChiamabile(c.telefono2), wa = whatsapp(c.telefono || c.telefono2), mp = mappa(c.indirizzo), web = sitoWeb(c.sito);
  const interventi = ordinaInterventi(c.interventi || []), speso = totaleInterventi(c.interventi || []);
  const metti = (k) => (e) => cambia({ [k]: e.target.value });
  const DETTAGLI = [['telefono', 'Telefono', 'tel'], ['telefono2', 'Altro telefono', 'tel'], ['email', 'Email', 'email'], ['indirizzo', 'Indirizzo'], ['sito', 'Sito'], ['orari', 'Orari'], ['referente', 'Referente'], ['parole', 'Parole per ritrovarlo']];
  const salvaIntervento = () => { cambia({ interventi: [...(c.interventi || []), nuovo] }, true); setNuovo(null); };

  return <article className="pp-rb-scheda" aria-label={c.nome}>
    <div className="pp-rb-scheda-barra">
      <button type="button" className="pp-rb-link" onClick={indietro}><Svg d={I.indietro} size={18} /> Rubrica</button>
      <button type="button" className="pp-rb-link forte" aria-pressed={modifica} onClick={() => setModifica(!modifica)}>{modifica ? 'Fatto' : 'Modifica'}</button>
    </div>
    <div className="pp-rb-scheda-testa">
      <Avatar c={c} size={72} />
      {modifica ? <input className="pp-rb-nome" value={c.nome} onChange={metti('nome')} aria-label="Nome" /> : <h3>{c.nome}</h3>}
      {!modifica && c.referente && <p>Referente: {c.referente}</p>}
      {!modifica && <div className="pp-rb-etichette">{(c.categorie?.length ? c.categorie : ['Altro']).map((n) => <span key={n} className={`pp-rb-c-${categoria(n).colore}`}>{categoria(n).nome}</span>)}</div>}
      <div className="pp-rb-voto" aria-label="Voto">
        {[1, 2, 3, 4, 5].map((v) => <button key={v} type="button" aria-label={`${v} su 5`} aria-pressed={(c.voto || 0) >= v} onClick={() => cambia({ voto: c.voto === v ? null : v }, true)}><Svg d={I.stella} size={18} piena={(c.voto || 0) >= v} /></button>)}
        <button type="button" className="pp-rb-pref" aria-pressed={Boolean(c.preferito)} onClick={() => cambia({ preferito: !c.preferito }, true)}>{c.preferito ? 'Preferito' : 'Segna preferito'}</button>
      </div>
    </div>

    {modifica ? <div className="pp-rb-campo"><span>Categorie</span><Categorie scelte={c.categorie || []} cambia={(categorie) => cambia({ categorie }, true)} /></div>
      : <div className="pp-rb-azioni">
        {tel ? <a className="primaria" href={`tel:${tel}`}><Svg d={I.tel} />Chiama</a> : <button type="button" onClick={() => setModifica(true)}><Svg d={I.tel} />Aggiungi tel.</button>}
        {wa && <a href={wa} target="_blank" rel="noreferrer"><Svg d={I.wa} />WhatsApp</a>}
        {c.email && <a href={`mailto:${c.email}`}><Svg d={I.mail} />Email</a>}
        {mp && <a href={mp} target="_blank" rel="noreferrer"><Svg d={I.mappa} />Mappa</a>}
        {web && <a href={web} target="_blank" rel="noreferrer"><Svg d={I.sito} />Sito</a>}
      </div>}

    <section className="pp-rb-box pp-rb-dettagli">
      {DETTAGLI.filter(([k]) => modifica || c[k]).map(([k, n, tipo]) => <div key={k} className="pp-rb-dato">
        {modifica ? <label>{n}<input type={tipo === 'email' ? 'email' : tipo === 'tel' ? 'tel' : 'text'} value={c[k] || ''} onChange={metti(k)} /></label>
          : <><span>{n}</span><strong>{c[k]}</strong>
            {k === 'telefono2' && tel2 ? <a href={`tel:${tel2}`}>Chiama</a> : <button type="button" onClick={() => copia(c[k], mostra, `${n} copiato`)}>Copia</button>}</>}
      </div>)}
      {!modifica && !DETTAGLI.some(([k]) => c[k]) && <p className="pp-rb-aiuto">Nessun recapito: tocca «Modifica».</p>}
    </section>

    <section className="pp-rb-sez">
      <h4>Note</h4>
      {modifica ? <textarea rows={4} value={c.note || ''} onChange={metti('note')} aria-label="Note" placeholder="Cosa ha fatto, prezzi, quando chiamarlo…" />
        : c.note ? <p className="pp-rb-note">{c.note}</p> : <p className="pp-rb-aiuto">Nessuna nota.</p>}
    </section>

    <section className="pp-rb-sez">
      <div className="pp-rb-sez-testa"><h4>Promemoria</h4><button type="button" className="pp-rb-link forte" onClick={nuovoPromemoria}>+ Aggiungi</button></div>
      {promemoria.map((p) => <div key={p.id} className={`pp-rb-prom-mini ${p.stato}`}>
        <span className="pallino" aria-hidden="true" />
        <span><strong>{p.cosa}</strong><span>{testoRipeti(p.ripeti)} · {testoPromemoria(p)}</span></span>
        <button type="button" className="pp-bottone pp-bottone-chiaro" onClick={() => azioni.fatto(p)}>Fatto</button>
      </div>)}
      {!promemoria.length && <p className="pp-rb-aiuto">Nessun promemoria: ad esempio la manutenzione annuale.</p>}
    </section>

    <section className="pp-rb-sez">
      <h4>Storico interventi{speso > 0 && <span> · totale {euro(speso)}</span>}</h4>
      {interventi.map((r) => { const i = (c.interventi || []).indexOf(r); return <div key={i} className="pp-rb-intervento">
        <span className="data">{r.data ? dataBreve(r.data) : '—'}</span>
        <span className="testo"><strong>{r.voce || 'Intervento'}</strong>{r.note && <span>{r.note}</span>}</span>
        {r.importo && <span className="euro">{numero(r.importo) != null ? euro(numero(r.importo)) : r.importo}</span>}
        {modifica && <button type="button" className="pp-md-x" aria-label="Togli intervento" onClick={() => cambia({ interventi: (c.interventi || []).filter((_, j) => j !== i) }, true)}>✕</button>}
      </div>; })}
      {nuovo ? <div className="pp-rb-nuovo">
        <input type="date" value={nuovo.data} onChange={(e) => setNuovo({ ...nuovo, data: e.target.value })} aria-label="Data" />
        <input inputMode="decimal" value={nuovo.importo} placeholder="€ spesa" onChange={(e) => setNuovo({ ...nuovo, importo: e.target.value })} aria-label="Spesa" />
        <input className="largo" value={nuovo.voce} placeholder="Cosa ha fatto" onChange={(e) => setNuovo({ ...nuovo, voce: e.target.value })} aria-label="Cosa ha fatto" />
        <input className="largo" value={nuovo.note} placeholder="Note" onChange={(e) => setNuovo({ ...nuovo, note: e.target.value })} aria-label="Note" />
        <div className="largo pp-rb-riga-bottoni"><button type="button" className="pp-bottone" onClick={salvaIntervento}>Salva</button><button type="button" className="pp-bottone pp-bottone-chiaro" onClick={() => setNuovo(null)}>Annulla</button></div>
      </div> : <button type="button" className="pp-md-piu" onClick={() => setNuovo({ data: oggiIso(), voce: '', importo: '', note: '' })}>+ Aggiungi intervento</button>}
    </section>

    <div className="pp-rb-riga-bottoni">
      <button type="button" className="pp-bottone pp-bottone-chiaro" onClick={() => copia(testoDaCopiare(c), mostra, 'Contatto copiato')}>Copia contatto</button>
      {modifica && !chiedi && <button type="button" className="pp-md-archivia" onClick={() => setChiedi(true)}>Archivia contatto</button>}
    </div>
    {chiedi && <Conferma testo="Archiviare il contatto? Non si cancella, sparisce solo dalla rubrica." etichetta="Archivia" onSi={() => azioni.archiviaContatto(c.id)} onNo={() => setChiedi(false)} />}
  </article>;
}

function Promemoria({ lista, contatti, contatto, azioni, apriScheda, nuovo: iniziale }) {
  const [nuovo, setNuovo] = useState(iniziale ? { cosa: '', data: '', ripeti: '1a', avviso_giorni: 30, note: '', ...iniziale } : null);
  const [aperto, setAperto] = useState(null);
  const vicini = lista.filter((p) => p.stato !== 'ok'), avanti = lista.filter((p) => p.stato === 'ok');
  const salvaNuovo = async () => { const r = await azioni.nuovoPromemoria(nuovo); if (r) setNuovo(null); };
  const usate = new Set(lista.map((p) => p.cosa));
  const suggeriti = SUGGERITI.filter(([x]) => !usate.has(x)).slice(0, 6);
  const voce = (p) => {
    const c = p.contatto_id && contatto(p.contatto_id), tel = c && telefonoChiamabile(c.telefono || c.telefono2);
    const [mese, giorno] = [p.data.slice(5, 7), p.data.slice(8, 10)];
    return <div key={p.id} className={`pp-rb-prom ${p.stato}`}>
      <div className="pp-rb-prom-testa">
        <span className="pp-rb-data" aria-hidden="true"><strong>{Number(giorno)}</strong>{new Date(`${p.data}T12:00:00`).toLocaleDateString('it-IT', { month: 'short' }).replace('.', '')}{mese === '01' || p.data.slice(0, 4) !== String(new Date().getFullYear()) ? <em>{p.data.slice(0, 4)}</em> : null}</span>
        <span className="pp-rb-prom-testo">
          <strong>{p.cosa}</strong>
          <span>{testoRipeti(p.ripeti)}{c ? ` · ${c.nome}` : ''}{p.note ? ` · ${p.note}` : ''}</span>
          <em>{p.quando[0].toUpperCase() + p.quando.slice(1)} · {dataBreve(p.data)}</em>
        </span>
      </div>
      <div className="pp-rb-riga-bottoni">
        {tel && <a className="pp-bottone" href={`tel:${tel}`}>Chiama</a>}
        {c && <button type="button" className="pp-bottone pp-bottone-chiaro" onClick={() => apriScheda(c.id)}>Scheda</button>}
        <button type="button" className="pp-bottone pp-bottone-chiaro" onClick={() => azioni.fatto(p)}>Fatto</button>
        <button type="button" className="pp-rb-link" onClick={() => setAperto(aperto?.id === p.id ? null : { ...p })}>Modifica</button>
      </div>
      {aperto?.id === p.id && <div className="pp-rb-box">
        <CampiPromemoria p={aperto} setP={setAperto} contatti={contatti} />
        <div className="pp-rb-riga-bottoni">
          <button type="button" className="pp-bottone" onClick={async () => { await azioni.salvaPromemoria(p.id, { cosa: aperto.cosa, data: aperto.data, ripeti: aperto.ripeti, avviso_giorni: aperto.avviso_giorni, contatto_id: aperto.contatto_id, note: aperto.note }); setAperto(null); }}>Salva</button>
          <button type="button" className="pp-bottone pp-bottone-chiaro" onClick={() => setAperto(null)}>Annulla</button>
          <button type="button" className="pp-md-archivia" onClick={() => azioni.archiviaPromemoria(p.id)}>Archivia</button>
        </div>
      </div>}
    </div>;
  };
  return <>
    {nuovo ? <section className="pp-rb-box">
      <h4 className="pp-rb-box-titolo">Nuovo promemoria</h4>
      <CampiPromemoria p={nuovo} setP={setNuovo} contatti={contatti} />
      <div className="pp-rb-riga-bottoni">
        <button type="button" className="pp-bottone" disabled={!nuovo.cosa.trim() || !dataIso(nuovo.data)} onClick={salvaNuovo}>Salva promemoria</button>
        <button type="button" className="pp-bottone pp-bottone-chiaro" onClick={() => setNuovo(null)}>Annulla</button>
      </div>
    </section> : <button type="button" className="pp-bottone pp-rb-nuovo-prom" onClick={() => setNuovo({ cosa: '', data: '', ripeti: '1a', avviso_giorni: 30, note: '' })}><Svg d={I.piu} size={16} /> Nuovo promemoria</button>}
    {!lista.length && !nuovo && <div className="pp-rb-vuoto"><strong>Nessun promemoria</strong><span>Cambio gomme, manutenzione della stufa, revisione caldaia: metti la data e ogni quanto si ripete, ti avviso prima.</span></div>}
    {vicini.length > 0 && <section className="pp-rb-gruppo"><h3 className="caldo">Da guardare</h3>{vicini.map(voce)}</section>}
    {avanti.length > 0 && <section className="pp-rb-gruppo"><h3>Più avanti</h3>{avanti.map(voce)}</section>}
    {!nuovo && suggeriti.length > 0 && <section className="pp-rb-suggeriti">
      <h4>Suggeriti</h4>
      <p>Tocca per aggiungerli, poi scegli la data e chi chiamare.</p>
      <div className="pp-rb-cat">{suggeriti.map(([x, r, md, cat]) => {
        const chi = contatti.find((c) => (c.categorie || []).some((n) => categoria(n).nome === cat));
        return <button key={x} type="button" onClick={() => setNuovo({ cosa: x, data: dataSuggerita(md), ripeti: r, avviso_giorni: 30, note: '', contatto_id: chi?.id || null })}>+ {x}</button>;
      })}</div>
    </section>}
  </>;
}
