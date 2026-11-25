// APP-AUTO-CASA-SALUTE (PO 2026-11-25): la stessa app per «Auto e motori», «Casa» e «Salute». Una scheda per cosa
// (un veicolo, un immobile, una persona) affiancate in orizzontale come «I miei dati": foto, dati che si scrivono lì
// dove stanno (date con il calendario), scadenze colorate, registro (tagliandi, lavori, visite), contatti da
// chiamare. Si salva da solo poco dopo l'ultima modifica. Si apre dentro Personal e come app a sé sulla Home.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { archivioDb } from '../lib/supabasePersonal.js';
import {
  ambito as datiAmbito, archiviaCosa, caricaCose, campiDi, CAMPI_CONTATTO, COLORI, creaCosa, daCompilare, dataBreve, dataIso, euro, filtra,
  FOTO_MASSIMA, numero, nuovaCosa, registroDi, ordinaRegistro, PASSI_FOTO, salvaCosa, scadenzeDi, scadenzeTutte, testoContatto, testoCosa, testoScadenza, TIPI_CAMPO, totaleRegistro,
} from '../lib/mieCose.js';
import { Conferma, Vuoto } from '../ui.jsx';
import { IconaApp } from './IconeCose.jsx';
import './cose.css';

const ATTESA = 700;
const oggi = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

async function copia(testo, mostra, cosa = 'Copiato') {
  try { await navigator.clipboard.writeText(testo); mostra?.(cosa); }
  catch { mostra?.('Copia non riuscita: tieni premuto sul testo e copialo a mano'); }
}

// La foto si riduce sul telefono (lato lungo 1280 px, JPEG) finché sta nel limite del database.
async function fotoRidotta(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('Immagine non leggibile')); i.src = url; });
    for (const [lato, qualita] of PASSI_FOTO) {
      const k = Math.min(1, lato / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const dati = c.toDataURL('image/jpeg', qualita);
      if (dati.length <= FOTO_MASSIMA) return dati;
    }
    throw new Error('Foto troppo grande');
  } finally { URL.revokeObjectURL(url); }
}

export function AppCose({ ambito: idAmbito, ctx, aParte = false }) {
  const a = datiAmbito(idAmbito);
  const [schede, setSchede] = useState(null), [cerca, setCerca] = useState(''), [attiva, setAttiva] = useState(null);
  const [stato, setStato] = useState('');
  const striscia = useRef(null), timer = useRef({}), inAttesa = useRef({});

  useEffect(() => { let vivo = true; ctx.esegui(async () => { const s = await caricaCose(archivioDb, idAmbito); if (vivo) setSchede(s); }); return () => { vivo = false; }; }, [ctx.esegui, ctx.versione, idAmbito]); // eslint-disable-line react-hooks/exhaustive-deps

  const salvaOra = useCallback(async (id) => {
    clearTimeout(timer.current[id]);
    const patch = inAttesa.current[id]; if (!patch) return;
    delete inAttesa.current[id];
    setStato('salvo');
    try { await salvaCosa(archivioDb, id, patch, idAmbito); setStato('salvato'); }
    catch (e) { setStato('errore'); ctx.mostra?.(`Non salvato: ${e.message}`); }
  }, [ctx, idAmbito]);
  useEffect(() => () => { for (const id of Object.keys(inAttesa.current)) salvaOra(id); }, [salvaOra]);

  const cambia = useCallback((id, patch, subito = false) => {
    setSchede((v) => v.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    inAttesa.current[id] = { ...inAttesa.current[id], ...patch };
    clearTimeout(timer.current[id]);
    timer.current[id] = setTimeout(() => salvaOra(id), subito ? 0 : ATTESA);
    setStato('');
  }, [salvaOra]);

  const vaiA = (id) => {
    setAttiva(id);
    striscia.current?.querySelector(`[data-scheda="${id}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  };
  const alloScorrere = () => {
    const el = striscia.current; if (!el) return;
    const x = el.getBoundingClientRect().left;
    let migliore = null, d = Infinity;
    for (const c of el.querySelectorAll('[data-scheda]')) { const dd = Math.abs(c.getBoundingClientRect().left - x); if (dd < d) { d = dd; migliore = c.dataset.scheda; } }
    if (migliore && migliore !== attiva) setAttiva(migliore);
  };
  const aggiungi = (tipo) => ctx.esegui(async () => {
    const nuova = await creaCosa(archivioDb, nuovaCosa(idAmbito, tipo, '', schede?.length || 0));
    setSchede((v) => [...v, { ...nuova, _nuova: true }]);
    setTimeout(() => vaiA(nuova.id), 60);
  });
  const archivia = (id) => ctx.esegui(async () => {
    await salvaOra(id); await archiviaCosa(archivioDb, id);
    setSchede((v) => v.filter((s) => s.id !== id)); ctx.mostra?.('Scheda archiviata');
  });

  const visibili = useMemo(() => filtra(schede || [], cerca), [schede, cerca]);
  const prossime = useMemo(() => {
    const tutte = scadenzeTutte(schede || []);
    const urgenti = tutte.filter((x) => x.stato !== 'ok');
    return urgenti.length ? urgenti : tutte.slice(0, 3);
  }, [schede]);
  if (!a) return <Vuoto>App sconosciuta.</Vuoto>;
  if (!schede) return <Vuoto>Carico…</Vuoto>;
  const accesa = visibili.some((s) => s.id === attiva) ? attiva : visibili[0]?.id;
  const documenti = !aParte && ctx.apri ? () => ctx.apri(idAmbito === 'salute' ? { tipo: 'salute' } : { tipo: 'cosa', id: idAmbito }) : null;

  return <div className={`pp-md pp-ac pp-ac-${idAmbito}`}>
    <header className="pp-ac-testa">
      <IconaApp ambito={idAmbito} size={46} />
      <div><h2>{a.nome}</h2><p>{a.sotto}</p></div>
      <span className={`pp-md-stato ${stato}`} aria-live="polite">{stato === 'salvo' ? 'Salvo…' : stato === 'salvato' ? 'Salvato' : stato === 'errore' ? 'Non salvato' : ''}</span>
    </header>

    {prossime.length > 0 && <section className="pp-ac-prossime" aria-label="Scadenze">
      <h3>{prossime.some((x) => x.stato !== 'ok') ? 'Da tenere d’occhio' : 'Prossime scadenze'}</h3>
      {prossime.slice(0, 6).map((x, i) => <button key={`${x.cosa}-${x.voce}-${i}`} type="button" className={`pp-ac-scad ${x.stato}`} onClick={() => vaiA(x.cosa)}>
        <span><strong>{x.voce}</strong>{schede.length > 1 && <em>{x.nome}</em>}</span><span>{testoScadenza(x)}</span>
      </button>)}
    </section>}

    <div className="pp-ac-barra">
      {schede.length > 2 && <input className="pp-md-cerca" type="search" placeholder={`Cerca: targa, polizza, ${idAmbito === 'salute' ? 'medico, allergie' : idAmbito === 'casa' ? 'POD, caldaia' : 'officina'}…`} value={cerca} onChange={(e) => setCerca(e.target.value)} aria-label={`Cerca in ${a.nome}`} />}
      {documenti && <button type="button" className="pp-bottone pp-bottone-chiaro" onClick={documenti}>{idAmbito === 'salute' ? 'Referti ed esami' : 'Documenti'}</button>}
    </div>
    <div className="pp-md-linguette" role="tablist">
      {visibili.map((s) => <button key={s.id} role="tab" type="button" aria-selected={s.id === accesa} className={s.id === accesa ? 'attiva' : ''} onClick={() => vaiA(s.id)}>
        {s.foto ? <img className="pp-ac-mini" src={s.foto} alt="" /> : <span className={`pp-md-pallino pp-md-${s.colore || 'blu'}`} aria-hidden="true">{s.nome.slice(0, 1).toUpperCase()}</span>}{s.nome}
      </button>)}
      <button type="button" className="pp-md-linguetta-piu" onClick={() => vaiA('nuova')}>+ Aggiungi</button>
    </div>
    <div className="pp-md-striscia" ref={striscia} onScroll={alloScorrere}>
      {visibili.map((s) => <Scheda key={s.id} s={s} a={a} cambia={(p, subito) => cambia(s.id, p, subito)} archivia={() => archivia(s.id)} mostra={ctx.mostra} />)}
      {!visibili.length && cerca && <div className="pp-md-scheda pp-md-vuota">Nessuna scheda contiene «{cerca}».</div>}
      <div className="pp-md-scheda pp-md-nuova" data-scheda="nuova">
        <strong>{schede.length ? 'Aggiungi' : `Inizia: aggiungi ${idAmbito === 'auto' ? 'il tuo primo veicolo' : idAmbito === 'casa' ? 'la tua casa' : 'una persona'}`}</strong>
        <span>{idAmbito === 'auto' ? 'Auto, moto, barca o altro mezzo: poi metti la foto, la polizza e le scadenze. Le multe di altri veicoli vanno in «Multe e pedaggi».' : idAmbito === 'casa' ? 'Casa, studio, box o terreno: utenze, catasto, assicurazione e manutenzioni.' : 'Tu, un familiare o un animale: medico, tessera sanitaria, allergie e controlli.'}</span>
        {a.tipi.map(([t, n]) => <button key={t} type="button" className="pp-bottone pp-bottone-chiaro" onClick={() => aggiungi(t)}>+ {n}</button>)}
      </div>
    </div>
  </div>;
}

function Foto({ s, cambia, mostra, modifica, a }) {
  const scegli = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    try { cambia({ foto: await fotoRidotta(f) }, true); mostra?.('Foto salvata'); }
    catch (err) { mostra?.(err.message); }
  };
  return <div className={`pp-ac-foto${s.foto ? '' : ' vuota'}`}>
    {s.foto ? <img src={s.foto} alt={`Foto di ${s.nome}`} /> : <span className="pp-ac-foto-segno"><IconaApp ambito={a.id} size={54} piatta /></span>}
    <div className="pp-ac-foto-azioni">
      <label className="pp-ac-foto-bottone">{s.foto ? 'Cambia foto' : 'Aggiungi foto'}<input type="file" accept="image/*" onChange={scegli} hidden aria-label={s.foto ? 'Cambia foto' : 'Aggiungi foto'} /></label>
      {s.foto && modifica && <button type="button" className="pp-ac-foto-bottone" onClick={() => cambia({ foto: null }, true)}>Togli</button>}
    </div>
  </div>;
}

function Campo({ s, c, metti, togli, modifica, mostra }) {
  const id = `ac-v-${s.id}-${c.i}`;
  const valore = c.tipo === 'data' ? (dataIso(c.valore) || '') : (c.valore || '');
  const sc = c.avviso && dataIso(c.valore) ? scadenzeDi({ ...s, campi: [c] })[0] : null;
  return <div className={`pp-md-campo pp-ac-campo${sc ? ` ${sc.stato}` : ''}`}>
    {modifica ? <span className="pp-ac-campo-mod">
      <input className="pp-md-etichetta" value={c.etichetta} placeholder="Nome del campo" onChange={(e) => metti(c.i, { etichetta: e.target.value })} aria-label="Nome del campo" />
      <select value={c.tipo || 'testo'} onChange={(e) => metti(c.i, { tipo: e.target.value, avviso: e.target.value === 'data' && c.avviso })} aria-label="Tipo di campo">{TIPI_CAMPO.map(([t, n]) => <option key={t} value={t}>{n}</option>)}</select>
      {c.tipo === 'data' && <label className="pp-ac-avviso"><input type="checkbox" checked={Boolean(c.avviso)} onChange={(e) => metti(c.i, { avviso: e.target.checked })} />Scadenza</label>}
    </span> : <label htmlFor={id}>{c.etichetta}{sc && <em className={`pp-ac-quando ${sc.stato}`}> · {testoScadenza(sc).split(' · ')[1]}</em>}</label>}
    <input className={`pp-md-valore${c.valore ? '' : ' vuoto'}`} id={id} type={c.tipo === 'data' ? 'date' : 'text'} inputMode={c.tipo === 'numero' ? 'numeric' : undefined}
      value={valore} placeholder="Da compilare" onChange={(e) => metti(c.i, { valore: e.target.value })} aria-label={c.etichetta} spellCheck={false} />
    {modifica ? <button type="button" className="pp-md-x" aria-label={`Togli ${c.etichetta}`} onClick={() => togli(c.i)}>✕</button>
      : <button type="button" className="pp-md-copia" disabled={!c.valore} aria-label={`Copia ${c.etichetta}`} onClick={() => copia(c.tipo === 'data' && dataIso(c.valore) ? dataBreve(dataIso(c.valore)) : c.valore, mostra, `${c.etichetta} copiato`)}>Copia</button>}
  </div>;
}

function Registro({ s, a: app, cambia, modifica }) {
  const a = { ...app, registro: registroDi(s) || app.registro };
  const [nuovo, setNuovo] = useState(null);
  const righe = ordinaRegistro(s.registro || []);
  const anno = new Date().getFullYear(), speso = totaleRegistro(s.registro, anno);
  const salva = () => {
    const r = { ...nuovo, voce: nuovo.voce.trim() || a.registro.voci[0] };
    const patch = { registro: [...(s.registro || []), r] };
    // Un tagliando con i km aggiorna da solo «Ultimo tagliando», «Km ultimo tagliando» e i km attuali.
    if (a.registro.km && r.data) {
      const km = numero(r.km);
      patch.campi = (s.campi || []).map((c) => {
        const e = c.etichetta.trim().toLowerCase();
        if (/tagliando/i.test(r.voce) && e === 'ultimo tagliando') return { ...c, valore: r.data };
        if (/tagliando/i.test(r.voce) && e === 'km ultimo tagliando' && km != null) return { ...c, valore: String(km) };
        if (e === 'km attuali' && km != null && km > (numero(c.valore) || 0)) return { ...c, valore: String(km) };
        return c;
      });
    }
    cambia(patch, true); setNuovo(null);
  };
  return <section className="pp-md-gruppo pp-ac-registro">
    <h4>{a.registro.titolo}{speso > 0 && <span> · {anno}: {euro(speso)}</span>}</h4>
    {righe.map((r) => { const i = (s.registro || []).indexOf(r); return <div key={i} className="pp-ac-riga">
      <span className="pp-ac-riga-data">{r.data ? dataBreve(r.data) : '—'}</span>
      <span className="pp-ac-riga-testo"><strong>{r.voce || 'Intervento'}</strong>{[r.km && `${Number(numero(r.km)).toLocaleString('it-IT')} km`, r.note].filter(Boolean).map((t) => <span key={t}>{t}</span>)}</span>
      {r.importo && <span className="pp-ac-riga-euro">{numero(r.importo) != null ? euro(numero(r.importo)) : r.importo}</span>}
      {modifica && <button type="button" className="pp-md-x" aria-label="Togli riga" onClick={() => cambia({ registro: (s.registro || []).filter((_, j) => j !== i) }, true)}>✕</button>}
    </div>; })}
    {!righe.length && !nuovo && <p className="pp-md-mancano">Ancora niente: aggiungi {s.tipo === 'multe' ? 'una multa o un pedaggio da pagare' : a.id === 'auto' ? 'l’ultimo tagliando' : a.id === 'casa' ? 'l’ultimo lavoro' : 'l’ultima visita'}.</p>}
    {nuovo ? <div className="pp-ac-nuovo">
      <input type="date" value={nuovo.data} onChange={(e) => setNuovo({ ...nuovo, data: e.target.value })} aria-label="Data" />
      <input list={`ac-voci-${s.id}`} value={nuovo.voce} placeholder={a.registro.voci[0]} onChange={(e) => setNuovo({ ...nuovo, voce: e.target.value })} aria-label="Cosa" />
      <datalist id={`ac-voci-${s.id}`}>{a.registro.voci.map((v) => <option key={v} value={v} />)}</datalist>
      {a.registro.km && <input inputMode="numeric" value={nuovo.km} placeholder="Km" onChange={(e) => setNuovo({ ...nuovo, km: e.target.value })} aria-label="Km" />}
      <input inputMode="decimal" value={nuovo.importo} placeholder="€ spesa" onChange={(e) => setNuovo({ ...nuovo, importo: e.target.value })} aria-label="Spesa" />
      <input className="pp-ac-nuovo-note" value={nuovo.note} placeholder={a.id === 'salute' ? 'Esito, medico, note' : 'Dove, cosa è stato fatto'} onChange={(e) => setNuovo({ ...nuovo, note: e.target.value })} aria-label="Note" />
      <div className="pp-ac-nuovo-azioni"><button type="button" className="pp-bottone" onClick={salva}>Salva</button><button type="button" className="pp-bottone pp-bottone-chiaro" onClick={() => setNuovo(null)}>Annulla</button></div>
    </div> : <button type="button" className="pp-md-piu" onClick={() => setNuovo({ data: oggi(), voce: '', km: '', importo: '', note: '' })}>+ Aggiungi {a.registro.aggiungi}</button>}
  </section>;
}

function Scheda({ s, a, cambia, archivia, mostra }) {
  const [modifica, setModifica] = useState(Boolean(s._nuova)), [chiedi, setChiedi] = useState(false);
  const campi = s.campi || [], persone = s.persone || [];
  const metti = (i, patch) => cambia({ campi: campi.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const togli = (i) => cambia({ campi: campi.filter((_, j) => j !== i) });
  const mettiP = (i, k, v) => cambia({ persone: persone.map((p, j) => (j === i ? { ...p, [k]: v } : p)) });
  const scad = scadenzeDi(s), vuoti = daCompilare(s);
  const tipo = a.tipi.find(([t]) => t === s.tipo)?.[1];

  return <article className={`pp-md-scheda pp-ac-scheda${modifica ? ' in-modifica' : ''}`} data-scheda={s.id} aria-label={s.nome}>
    <Foto s={s} a={a} cambia={cambia} mostra={mostra} modifica={modifica} />
    <div className="pp-md-nome">
      {modifica ? <>
        <input value={s.nome} onChange={(e) => cambia({ nome: e.target.value })} aria-label="Nome" />
        <input value={s.descrizione || ''} placeholder={a.id === 'auto' ? 'Chi la usa, colore…' : a.id === 'casa' ? 'Residenza, studio, in affitto…' : 'Parentela, note brevi…'} onChange={(e) => cambia({ descrizione: e.target.value })} aria-label="Descrizione" />
      </> : <><h3>{s.nome}</h3><p>{[tipo, s.descrizione].filter(Boolean).join(' · ')}</p></>}
    </div>
    {modifica && <div className="pp-md-colori" aria-label="Colore">
      {COLORI.map((c) => <button key={c} type="button" className={`pp-md-${c}${s.colore === c ? ' scelto' : ''}`} aria-label={c} onClick={() => cambia({ colore: c })} />)}
      <select value={s.tipo} onChange={(e) => cambia({ tipo: e.target.value })} aria-label="Tipo">{a.tipi.map(([t, n]) => <option key={t} value={t}>{n}</option>)}</select>
    </div>}
    {scad.length > 0 && !modifica && <div className="pp-ac-chips">{scad.map((x) => <span key={x.voce} className={`pp-ac-chip ${x.stato}`}>{x.voce}: {x.testo || testoScadenza(x).split(' · ')[1]}</span>)}</div>}
    <div className="pp-ac-azioni">
      <button type="button" className="pp-bottone pp-bottone-chiaro" onClick={() => copia(testoCosa(s), mostra, 'Scheda copiata')}>Copia tutto</button>
      <button type="button" className="pp-bottone pp-bottone-chiaro" aria-pressed={modifica} onClick={() => setModifica(!modifica)}>{modifica ? 'Fatto' : 'Modifica'}</button>
    </div>
    {vuoti > 0 && !modifica && <p className="pp-md-mancano">{vuoti === 1 ? '1 dato da compilare' : `${vuoti} dati da compilare`}: tocca il campo vuoto e scrivi.</p>}

    {a.gruppi.map(([g, titolo]) => {
      const righe = campiDi(s, g);
      if (!righe.length && !modifica) return null;
      return <section key={g} className="pp-md-gruppo">
        <h4>{titolo}</h4>
        {righe.map((c) => <Campo key={c.i} s={s} c={c} metti={metti} togli={togli} modifica={modifica} mostra={mostra} />)}
        {modifica && <button type="button" className="pp-md-piu" onClick={() => cambia({ campi: [...campi, { gruppo: g, etichetta: '', valore: '', tipo: 'testo' }] })}>+ Aggiungi campo</button>}
      </section>;
    })}

    <Registro s={s} a={a} cambia={cambia} modifica={modifica} />

    <section className="pp-md-gruppo">
      <h4>{a.contatti.titolo}</h4>
      {persone.map((p, i) => <div key={i} className="pp-md-persona">
        {modifica ? <>
          <input list={`ac-ruoli-${a.id}`} value={p.ruolo || ''} placeholder="Ruolo" aria-label="Ruolo" onChange={(e) => mettiP(i, 'ruolo', e.target.value)} />
          {CAMPI_CONTATTO.filter(([k]) => k !== 'ruolo').map(([k, n]) => <input key={k} value={p[k] || ''} placeholder={n} aria-label={n} inputMode={k === 'telefono' ? 'tel' : undefined} onChange={(e) => mettiP(i, k, e.target.value)} />)}
          <button type="button" className="pp-md-piu" onClick={() => cambia({ persone: persone.filter((_, j) => j !== i) })}>Togli contatto</button>
        </> : <>
          <span className="pp-md-ruolo">{p.ruolo || 'Contatto'}</span>
          <strong>{p.nome || '—'}</strong>
          {p.indirizzo && <span className="pp-md-studio">{p.indirizzo}</span>}
          {p.telefono && <div className="pp-md-contatto"><span><em>Tel.</em>{p.telefono}</span><a className="pp-md-copia" href={`tel:${p.telefono.replace(/[^\d+]/g, '')}`}>Chiama</a></div>}
          {p.email && <div className="pp-md-contatto"><span><em>Email</em>{p.email}</span><button type="button" className="pp-md-copia" onClick={() => copia(p.email, mostra)}>Copia</button></div>}
          {p.note && <span className="pp-md-studio">{p.note}</span>}
          <button type="button" className="pp-md-piu" onClick={() => copia(testoContatto(p), mostra, 'Contatto copiato')}>Copia contatto</button>
        </>}
      </div>)}
      <datalist id={`ac-ruoli-${a.id}`}>{a.contatti.ruoli.map((r) => <option key={r} value={r} />)}</datalist>
      {!persone.length && !modifica && <p className="pp-md-mancano">Nessun contatto: tocca «Modifica» per aggiungerlo.</p>}
      {modifica && <button type="button" className="pp-md-piu" onClick={() => cambia({ persone: [...persone, { ruolo: a.contatti.ruoli[0] }] })}>+ Aggiungi contatto</button>}
    </section>

    {(s.note || modifica) && <section className="pp-md-gruppo">
      <h4>Note</h4>
      {modifica ? <textarea value={s.note || ''} rows={3} onChange={(e) => cambia({ note: e.target.value })} aria-label="Note" />
        : <p className="pp-md-note">{s.note}</p>}
    </section>}

    {modifica && (chiedi
      ? <Conferma testo="Archiviare la scheda? Non si cancella, sparisce solo dall'elenco." etichetta="Archivia" onSi={archivia} onNo={() => setChiedi(false)} />
      : <button type="button" className="pp-md-archivia" onClick={() => setChiedi(true)}>Archivia scheda</button>)}
  </article>;
}
