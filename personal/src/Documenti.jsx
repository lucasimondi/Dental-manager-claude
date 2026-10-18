// POL-VITA-007 — Documenti: ricerca immediata con filtri (categoria, ente, anno, tipo, persona),
// cartelle per ente (POL-VITA-015, vista principale), categorie, pratiche; le cose poco utili (pubblicità, foto, catene) restano
// nascoste finché non le chiedi. Selezione multipla (tieni premuto o "Seleziona") con azioni di
// massa: sposta, importanza, ente, persona, Personali, elimina.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { archivioDb } from './lib/supabasePersonal.js';
import {
  cercaArchivio, enti as caricaEnti, aggiornaDocumenti, eliminaDocumenti, portafoglioDocumenti, documentiSezione, cestinaSuDrive,
  pratiche as caricaPratiche, eCaricato,
} from './lib/archivio.js';
import { euro } from './lib/coreArchivio.js';
import { caricaCartelle } from './lib/cartelle.js';
import { preparaFile, comeFile, condividi } from './lib/condividi.js';
import { VistaCartelle } from './Cartelle.jsx';
import { colore, dataBreve, titoloDoc, Vuoto, Sezione, Gruppo, Chips, Segmenti, ConfermaElimina, ElencoPratiche, tokenSessione } from './ui.jsx';
import { Miniatura } from './Miniatura.jsx';
import { IconaCerca, IconaChiudi, IconaDocumenti, IconaFreccia, IconaStella, IconaCestino, IconaCondividi } from './Icone.jsx';

const RILEVANZA = { alta: 'Importante', normale: 'Normale', bassa: 'Poco utile' };
const MAX_CONDIVISI = 10;
const MODO_KEY = 'poliedron-personal-elenco';
const leggiModo = () => { try { return localStorage.getItem(MODO_KEY) || 'griglia'; } catch { return 'griglia'; } };

/* ---------- foglio con un elenco di scelte ---------- */
export function FoglioScelta({ titolo, voci, onScegli, onChiudi, cerca = false }) {
  const [filtro, setFiltro] = useState('');
  const visibili = filtro ? voci.filter((v) => v.nome.toLowerCase().includes(filtro.toLowerCase())) : voci;
  return (
    <div className="pp-velo" onClick={onChiudi}>
      <div className="pp-foglio" role="dialog" aria-label={titolo} onClick={(e) => e.stopPropagation()}>
        <div className="pp-foglio-maniglia" />
        <div className="pp-foglio-testa"><span>{titolo}</span>
          <button className="pp-icona-bottone pp-piccolo" onClick={onChiudi} aria-label="Chiudi"><IconaChiudi size={18} /></button>
        </div>
        <div className="pp-foglio-corpo">
          {cerca && <div className="pp-cerca pp-cerca-foglio"><IconaCerca size={16} /><input autoFocus value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Cerca" /></div>}
          <Gruppo>
            {visibili.map((v) => (
              <button key={v.id ?? 'nessuno'} className={`pp-riga${v.attivo ? ' pp-riga-attiva' : ''}`} onClick={() => onScegli(v.id)}>
                {v.colore && <span className="pp-punto" style={{ '--c': v.colore }} />}
                <span className="pp-riga-testo"><span className="pp-riga-titolo">{v.nome}</span>{v.meta && <span className="pp-riga-meta">{v.meta}</span>}</span>
                {v.attivo && <span className="pp-spunta-ok">✓</span>}
              </button>
            ))}
            {!visibili.length && <p className="pp-vuoto">Nessuna voce.</p>}
          </Gruppo>
        </div>
      </div>
    </div>
  );
}

/* ---------- scheda e riga selezionabili ---------- */
function usaPressione(onLungo) {
  const timer = useRef(null);
  const lungo = useRef(false);
  const inizio = () => { lungo.current = false; timer.current = setTimeout(() => { lungo.current = true; onLungo(); navigator.vibrate?.(15); }, 450); };
  const fine = () => clearTimeout(timer.current);
  return { onTouchStart: inizio, onTouchEnd: fine, onTouchMove: fine, onMouseDown: inizio, onMouseUp: fine, onMouseLeave: fine, eraLungo: () => lungo.current };
}

function VoceDocumento({ doc, modo, selezione, onApri, onSeleziona }) {
  const scelto = selezione?.has(doc.id);
  const p = usaPressione(() => onSeleziona(doc, true));
  const tocco = () => { if (p.eraLungo()) return; if (selezione) onSeleziona(doc); else onApri(doc); };
  const { eraLungo, ...gesti } = p;
  const meta = [doc.ente, dataBreve(doc.data_documento || doc.email_data)].filter(Boolean).join(' · ');
  const casella = selezione && <span className={`pp-casella${scelto ? ' scelta' : ''}`} aria-hidden="true">{scelto ? '✓' : ''}</span>;
  if (modo === 'righe') {
    return (
      <button className={`pp-riga pp-riga-doc${scelto ? ' scelta' : ''}`} onClick={tocco} {...gesti} aria-pressed={selezione ? scelto : undefined}>
        {casella}
        <Miniatura doc={doc} colore={colore(doc.fascicolo)} />
        <span className="pp-riga-testo">
          <span className="pp-riga-titolo">{titoloDoc(doc)}</span>
          <span className="pp-riga-meta">{[doc.tipo_documento, meta, doc.persona, eCaricato(doc) ? 'caricato da te' : null].filter(Boolean).join(' · ')}</span>
        </span>
        {doc.importo != null && <span className="pp-riga-importo">{euro(doc.importo)}</span>}
        {!selezione && <IconaFreccia size={16} />}
      </button>
    );
  }
  return (
    <button className={`pp-scheda-doc${scelto ? ' scelta' : ''}${doc.rilevanza === 'bassa' ? ' poco-utile' : ''}`} style={{ '--c': colore(doc.fascicolo) }} onClick={tocco} {...gesti} aria-pressed={selezione ? scelto : undefined}>
      <Miniatura doc={doc} colore={colore(doc.fascicolo)} grande />
      {casella}
      <span className="pp-scheda-doc-testo">
        {doc.tipo_documento && <span className="pp-scheda-doc-tipo">{doc.tipo_documento}</span>}
        <span className="pp-scheda-doc-titolo">{titoloDoc(doc)}</span>
        <span className="pp-riga-meta">{meta}</span>
      </span>
      {doc.importo != null && <span className="pp-scheda-doc-importo">{euro(doc.importo)}</span>}
      {doc.rilevanza === 'alta' && !selezione && <span className="pp-scheda-doc-stella" aria-label="Importante"><IconaStella size={12} piena /></span>}
      {doc.azione_richiesta && !selezione && <span className={`pp-pallino pp-${doc.urgenza || 'media'} pp-scheda-doc-pallino`} aria-label="Da gestire" />}
    </button>
  );
}

/* ---------- elenco con selezione e azioni di massa ---------- */
export function ElencoSelezionabile({ elenco, ctx, onCambiato, intestazione }) {
  const { apri, esegui, aggiorna, mostra, fascicoli, impostazioni } = ctx;
  const [modo, setModoStato] = useState(leggiModo);
  const [selezione, setSelezione] = useState(null); // Set di id, o null fuori dalla selezione
  const [foglio, setFoglio] = useState(null);
  const [conferma, setConferma] = useState(false);
  const [avanzamento, setAvanzamento] = useState(null);
  const [cartelle, setCartelle] = useState(null);
  const [pronti, setPronti] = useState(null); // { chiave, file } dei documenti scelti, per Condividi
  const setModo = (m) => { setModoStato(m); try { localStorage.setItem(MODO_KEY, m); } catch { /* facoltativo */ } };
  useEffect(() => { setSelezione((s) => (s ? new Set([...s].filter((id) => elenco.some((d) => d.id === id))) : s)); }, [elenco]);

  const seleziona = (doc, avvia = false) => setSelezione((s) => {
    const n = new Set(s || []);
    if (avvia && !s) { n.add(doc.id); return n; }
    if (n.has(doc.id)) n.delete(doc.id); else n.add(doc.id);
    return n;
  });
  const ids = [...(selezione || [])];
  const scelti = elenco.filter((d) => selezione?.has(d.id));
  // Condividi più file: si preparano mentre li scegli, perché iOS apre il foglio solo se parte
  // subito dal tocco (massimo 10 file, mai i clinici: lo script non li manda all'anteprima).
  const chiaveScelti = ids.slice().sort().join(',');
  useEffect(() => {
    const daPreparare = scelti.filter((d) => d.drive_file_id && d.fascicolo !== 'clinico_pazienti');
    if (!daPreparare.length || daPreparare.length > MAX_CONDIVISI) { setPronti(null); return undefined; }
    let vivo = true;
    setPronti(null);
    (async () => {
      try {
        const token = await tokenSessione();
        const file = await Promise.all(daPreparare.map((d) => preparaFile(d.drive_file_id, token).then(comeFile)));
        if (vivo) setPronti({ chiave: chiaveScelti, file });
      } catch { if (vivo) setPronti({ chiave: chiaveScelti, file: [], errore: true }); }
    })();
    return () => { vivo = false; };
  }, [chiaveScelti]); // eslint-disable-line react-hooks/exhaustive-deps
  const condividiScelti = async () => {
    if (!pronti || pronti.chiave !== chiaveScelti) return;
    try {
      const r = await condividi({ titolo: scelti.length === 1 ? titoloDoc(scelti[0]) : `${scelti.length} documenti`, file: pronti.file.length === 1 ? pronti.file[0] : null, files: pronti.file });
      if (r === 'copiato') mostra('Link copiato');
      else if (r === 'non_disponibile') mostra('Condivisione non disponibile su questo dispositivo');
    } catch (e) { mostra(e.message); }
  };
  const statoCondividi = !ids.length ? null : ids.length > MAX_CONDIVISI ? `Al massimo ${MAX_CONDIVISI}` : !pronti || pronti.chiave !== chiaveScelti ? 'Preparo…' : pronti.errore ? 'Non disponibile' : null;
  const fatto = (msg) => { setFoglio(null); setSelezione(null); aggiorna(); onCambiato?.(); mostra(msg); };
  const cambia = (campi, msg) => esegui(async () => { await aggiornaDocumenti(archivioDb, ids, campi); fatto(msg); });

  const fogli = {
    sposta: { titolo: `Sposta ${ids.length} in…`, cerca: true, voci: fascicoli.filter((f) => f.codice !== 'clinico_pazienti').map((f) => ({ id: f.codice, nome: f.nome, colore: colore(f.codice) })),
      scegli: (id) => cambia({ fascicolo: id }, `Spostati in ${fascicoli.find((f) => f.codice === id)?.nome}`) },
    importanza: { titolo: 'Importanza', voci: Object.entries(RILEVANZA).map(([id, nome]) => ({ id, nome, meta: id === 'bassa' ? 'nascosti nelle ricerche, finché non li chiedi' : null })),
      scegli: (id) => cambia({ rilevanza: id }, `Segnati: ${RILEVANZA[id].toLowerCase()}`) },
    persona: { titolo: 'Di chi è', voci: [{ id: '', nome: 'Nessuno' }, ...impostazioni.persone.map((p) => ({ id: p, nome: p }))],
      scegli: (id) => cambia({ persona: id }, id ? `Assegnati a ${id}` : 'Persona tolta') },
    cartella: { titolo: `Metti ${ids.length} in una cartella`, cerca: true,
      voci: [{ id: '__nuova', nome: 'Nuova cartella…' }, ...(cartelle || []).map((c) => ({ id: c.ente, nome: c.ente, meta: `${c.n} documenti`, colore: colore(c.fascicolo) }))],
      scegli: (id) => {
        if (id === '__nuova') {
          const nome = window.prompt(`Nome della nuova cartella per ${ids.length} documenti (es. Kerdos)`, scelti[0]?.ente || '');
          if (nome != null && nome.trim()) cambia({ ente: nome }, `Nella cartella ${nome.trim()}`);
          return;
        }
        cambia({ ente: id }, `Nella cartella ${id}`);
      } },
    altro: { titolo: 'Altre azioni', voci: [
      { id: 'ente', nome: 'Togli dalla cartella', meta: 'restano in archivio, in "Senza cartella"' },
      { id: 'importanza', nome: 'Importanza', meta: 'importante, normale, poco utile' },
      { id: 'personali_si', nome: 'Aggiungi ai Personali' },
      { id: 'personali_no', nome: 'Togli dai Personali' },
      { id: 'persona', nome: 'Assegna a una persona' },
    ], scegli: (id) => {
      if (id === 'persona') { setFoglio('persona'); return; }
      if (id === 'importanza') { setFoglio('importanza'); return; }
      if (id === 'ente') { cambia({ ente: '' }, 'Tolti dalla cartella'); return; }
      esegui(async () => { await portafoglioDocumenti(archivioDb, scelti, id === 'personali_si'); fatto(id === 'personali_si' ? 'Aggiunti ai Personali' : 'Tolti dai Personali'); });
    } },
  };
  const elimina = (ancheDrive) => esegui(async () => {
    setConferma(false);
    setAvanzamento({ fatti: 0, totale: ids.length });
    let suDrive = null;
    try {
      // Prima Drive (lo script controlla che i file siano in archivio), poi l'archivio.
      if (ancheDrive) suDrive = await cestinaSuDrive({ token: await tokenSessione(), ids: scelti.map((d) => d.drive_file_id) });
      await eliminaDocumenti(archivioDb, ids, (fatti, totale) => setAvanzamento({ fatti, totale }));
    } finally { setAvanzamento(null); }
    const quanti = `${ids.length} ${ids.length === 1 ? 'documento eliminato' : 'documenti eliminati'}`;
    fatto(suDrive ? `${quanti}; ${suDrive.cestinati.length} file nel Cestino di Drive` : `${quanti} dall'archivio`);
  });

  return (
    <>
      <div className="pp-elenco-testa">
        <span className="pp-frase">{intestazione ?? `${elenco.length} documenti`}</span>
        <span className="pp-elenco-azioni">
          {selezione
            ? <button className="pp-testo-link" onClick={() => setSelezione(scelti.length === elenco.length ? new Set() : new Set(elenco.map((d) => d.id)))}>{scelti.length === elenco.length ? 'Nessuno' : 'Tutti'}</button>
            : elenco.length > 0 && <button className="pp-testo-link" onClick={() => setSelezione(new Set())}>Seleziona</button>}
          <span className="pp-commuta" role="group" aria-label="Vista">
            <button className={modo === 'griglia' ? 'attivo' : ''} onClick={() => setModo('griglia')} aria-label="Griglia con anteprime">▦</button>
            <button className={modo === 'righe' ? 'attivo' : ''} onClick={() => setModo('righe')} aria-label="Elenco">☰</button>
          </span>
        </span>
      </div>
      <div className={modo === 'griglia' ? 'pp-griglia-doc' : 'pp-gruppo'}>
        {elenco.map((d) => <VoceDocumento key={d.id} doc={d} modo={modo} selezione={selezione} onApri={(x) => apri({ tipo: 'documento', id: x.id })} onSeleziona={seleziona} />)}
      </div>
      {selezione && (
        <div className="pp-barra-selezione" role="toolbar" aria-label="Azioni sui documenti scelti">
          <div className="pp-barra-selezione-testa">
            <strong>{ids.length ? `${ids.length} ${ids.length === 1 ? 'scelto' : 'scelti'}` : 'Tocca i documenti'}</strong>
            <button className="pp-icona-bottone pp-piccolo" onClick={() => { setSelezione(null); setConferma(false); }} aria-label="Esci dalla selezione"><IconaChiudi size={16} /></button>
          </div>
          {avanzamento ? <p className="pp-riga-meta"><span className="pp-rotella" /> Elimino {avanzamento.fatti}/{avanzamento.totale}…</p>
            : conferma ? (
              <ConfermaElimina n={ids.length} onNo={() => setConferma(false)} onSi={elimina} />
            ) : (
              <div className="pp-barra-selezione-azioni">
                <button disabled={!ids.length || !!statoCondividi} onClick={condividiScelti}><IconaCondividi size={18} /><span>{statoCondividi || 'Condividi'}</span></button>
                <button disabled={!ids.length} onClick={() => { esegui(async () => setCartelle(await caricaCartelle(archivioDb))); setFoglio('cartella'); }}><IconaDocumenti size={18} /><span>Cartella</span></button>
                <button disabled={!ids.length} onClick={() => setFoglio('sposta')}><IconaStella size={18} /><span>Categoria</span></button>
                <button disabled={!ids.length} onClick={() => setFoglio('altro')}><span className="pp-tre-punti">•••</span><span>Altro</span></button>
                <button disabled={!ids.length} className="pp-rosso" onClick={() => setConferma(true)}><IconaCestino size={18} /><span>Elimina</span></button>
              </div>
            )}
        </div>
      )}
      {foglio && <FoglioScelta titolo={fogli[foglio].titolo} voci={fogli[foglio].voci} cerca={fogli[foglio].cerca} onScegli={fogli[foglio].scegli} onChiudi={() => setFoglio(null)} />}
    </>
  );
}

/* ---------- filtri ---------- */
const ANNI = () => { const y = new Date().getFullYear(); return Array.from({ length: y - 2003 }, (_, i) => String(y - i)); };

function BarraFiltri({ filtri, setFiltri, ctx, elencoEnti }) {
  const { fascicoli, impostazioni } = ctx;
  const [aperto, setAperto] = useState(null);
  const nomeFasc = fascicoli.find((f) => f.codice === filtri.fascicolo)?.nome;
  const imposta = (k, v) => { setFiltri({ ...filtri, [k]: v || null }); setAperto(null); };
  const chip = (k, etichetta, valore) => (
    <button key={k} className={`pp-filtro${valore ? ' attivo' : ''}`} onClick={() => (valore ? imposta(k, null) : setAperto(k))}>
      {valore || etichetta}{valore ? <IconaChiudi size={12} /> : <span className="pp-filtro-freccia">▾</span>}
    </button>
  );
  const voci = {
    fascicolo: fascicoli.filter((f) => f.n > 0).map((f) => ({ id: f.codice, nome: f.nome, meta: `${f.n}`, colore: colore(f.codice) })),
    ente: (elencoEnti || []).map((e) => ({ id: e.ente, nome: e.ente, meta: `${e.n} documenti` })),
    anno: ANNI().map((a) => ({ id: a, nome: a })),
    persona: impostazioni.persone.map((p) => ({ id: p, nome: p })),
  };
  return (
    <>
      <div className="pp-filtri">
        {chip('fascicolo', 'Categoria', nomeFasc)}
        {chip('ente', 'Ente', filtri.ente)}
        {chip('anno', 'Anno', filtri.anno)}
        {chip('persona', 'Persona', filtri.persona)}
        <button className={`pp-filtro${filtri.anchePocoUtili ? ' attivo' : ''}`} onClick={() => setFiltri({ ...filtri, anchePocoUtili: !filtri.anchePocoUtili })}>
          {filtri.anchePocoUtili ? 'Anche poco utili ✓' : 'Anche poco utili'}
        </button>
      </div>
      {aperto && <FoglioScelta titolo={{ fascicolo: 'Categoria', ente: 'Ente', anno: 'Anno', persona: 'Persona' }[aperto]} voci={voci[aperto]} cerca={aperto !== 'anno'} onScegli={(v) => imposta(aperto, v)} onChiudi={() => setAperto(null)} />}
    </>
  );
}

const filtriVuoti = { fascicolo: null, ente: null, anno: null, persona: null, anchePocoUtili: false };
const conFiltri = (f) => !!(f.fascicolo || f.ente || f.anno || f.persona);

/* ---------- vista Documenti ---------- */
export function VistaDocumenti({ ctx }) {
  const { esegui, apri, versione, impostazioni, fascicoli, sotto } = ctx;
  const [scheda, setScheda] = useState(sotto === 'enti' ? 'cartelle' : sotto || 'cartelle');
  const [testo, setTesto] = useState('');
  const [filtri, setFiltri] = useState(filtriVuoti);
  const [risultati, setRisultati] = useState(null);
  const [elencoEnti, setElencoEnti] = useState(null);
  const [elencoPratiche, setElencoPratiche] = useState(null);
  const [filtroPratiche, setFiltroPratiche] = useState('aperte');
  const [rinfresca, setRinfresca] = useState(0);
  const ricerca = testo.trim().length > 1 || conFiltri(filtri);

  useEffect(() => { caricaEnti(archivioDb).then(setElencoEnti).catch(() => setElencoEnti([])); }, [versione]);
  useEffect(() => { if (scheda === 'pratiche') esegui(async () => setElencoPratiche(await caricaPratiche(archivioDb))); }, [scheda, esegui, versione]);

  // Ricerca immediata (dopo una breve pausa nella digitazione) o elenco dei recenti.
  useEffect(() => {
    if (!ricerca && scheda !== 'recenti') return undefined;
    let vivo = true;
    const t = setTimeout(() => {
      esegui(async () => {
        const r = await cercaArchivio(archivioDb, { testo, ...filtri, limite: ricerca ? 200 : 60 });
        if (vivo) setRisultati(r);
      });
    }, ricerca ? 280 : 0);
    return () => { vivo = false; clearTimeout(t); };
  }, [testo, filtri, scheda, ricerca, esegui, versione, rinfresca]);

  const sezioni = impostazioni.sezioni;
  const apriFascicolo = (f) => apri({ tipo: 'ricerca', titolo: f.nome, filtri: { fascicolo: f.codice } });
  const apriSezione = (s) => apri({ tipo: 'ricerca', titolo: s.nome, sezione: s });
  const principali = fascicoli.filter((f) => f.n > 0 && !['pubblicita', 'foto_video', 'corrispondenza', 'altro'].includes(f.codice));
  const secondari = fascicoli.filter((f) => f.n > 0 && ['pubblicita', 'foto_video', 'corrispondenza', 'altro'].includes(f.codice));

  return (
    <>
      <div className="pp-cerca">
        <IconaCerca size={18} />
        <input type="search" value={testo} onChange={(e) => setTesto(e.target.value)} placeholder="Cerca: Enel, IMU 2024, carta d'identità…" enterKeyHint="search" aria-label="Cerca nell'archivio" />
        {testo && <button type="button" className="pp-cerca-pulisci" aria-label="Cancella ricerca" onClick={() => setTesto('')}><IconaChiudi size={16} /></button>}
      </div>
      <BarraFiltri filtri={filtri} setFiltri={setFiltri} ctx={ctx} elencoEnti={elencoEnti} />
      {ricerca ? (
        risultati
          ? (risultati.length
            ? <ElencoSelezionabile elenco={risultati} ctx={ctx} onCambiato={() => setRinfresca((n) => n + 1)} intestazione={`${risultati.length}${risultati.length >= 200 ? '+' : ''} risultati`} />
            : <Vuoto>Nessun documento. Prova un'altra parola o togli un filtro{filtri.anchePocoUtili ? '' : ', oppure tocca "Anche poco utili"'}.</Vuoto>)
          : <Vuoto>Cerco…</Vuoto>
      ) : (
        <>
          <Chips voci={[['cartelle', 'Cartelle'], ['recenti', 'Recenti'], ['categorie', 'Categorie'], ['pratiche', 'Pratiche']]} attiva={scheda} onScegli={setScheda} />
          {scheda === 'cartelle' && <VistaCartelle ctx={ctx} anchePocoUtili={filtri.anchePocoUtili} />}
          {scheda === 'recenti' && risultati && <ElencoSelezionabile elenco={risultati} ctx={ctx} onCambiato={() => setRinfresca((n) => n + 1)} intestazione="Ultimi arrivati" />}
          {scheda === 'categorie' && (
            <>
              {sezioni.length > 0 && (
                <Sezione titolo="Le tue sezioni">
                  <div className="pp-griglia">
                    {sezioni.map((s) => (
                      <button key={s.id} className="pp-cartella pp-cartella-sezione" style={{ '--c': colore(s.fascicoli[0] || 'altro') }} onClick={() => apriSezione(s)}>
                        <span className="pp-cartella-icona"><IconaStella size={20} /></span>
                        <span className="pp-cartella-nome">{s.nome}</span>
                        <span className="pp-cartella-numero">{[...s.fascicoli.map((f) => fascicoli.find((x) => x.codice === f)?.nome || f), ...s.parole].slice(0, 3).join(', ')}</span>
                      </button>
                    ))}
                  </div>
                </Sezione>
              )}
              <Sezione titolo="Categorie">
                <div className="pp-griglia">
                  {principali.map((f) => (
                    <button key={f.codice} className="pp-cartella" style={{ '--c': colore(f.codice) }} onClick={() => apriFascicolo(f)}>
                      <span className="pp-cartella-icona"><IconaDocumenti size={20} /></span>
                      <span className="pp-cartella-nome">{f.nome}</span>
                      <span className="pp-cartella-numero">{f.n}{f.n_azioni ? <em> · {f.n_azioni} da fare</em> : null}</span>
                    </button>
                  ))}
                </div>
              </Sezione>
              {secondari.length > 0 && (
                <Sezione titolo="Meno importanti">
                  <Gruppo>
                    {secondari.map((f) => (
                      <button key={f.codice} className="pp-riga" onClick={() => apriFascicolo(f)}>
                        <span className="pp-punto" style={{ '--c': colore(f.codice) }} />
                        <span className="pp-riga-testo"><span className="pp-riga-titolo">{f.nome}</span></span>
                        <span className="pp-conteggio">{f.n}</span>
                        <IconaFreccia size={16} />
                      </button>
                    ))}
                  </Gruppo>
                </Sezione>
              )}
            </>
          )}
          {scheda === 'pratiche' && elencoPratiche && (
            <>
              <Segmenti voci={[['aperte', 'Aperte'], ['risolte', 'Risolte'], ['tutte', 'Tutte']]} attiva={filtroPratiche} onScegli={setFiltroPratiche} />
              <ElencoPratiche
                elenco={elencoPratiche.filter((p) => (filtroPratiche === 'aperte' ? ['aperta', 'in_corso'].includes(p.stato) : filtroPratiche === 'risolte' ? p.stato === 'risolta' : true))}
                onApri={(p) => apri({ tipo: 'pratica', p })}
              />
            </>
          )}
        </>
      )}
    </>
  );
}

/* ---------- pagina con un elenco filtrato (ente, categoria, sezione, da gestire) ---------- */
export function PaginaRicerca({ filtri: base = {}, sezione, carica, ctx }) {
  const { esegui, versione } = ctx;
  const [testo, setTesto] = useState('');
  const [anchePocoUtili, setAnchePocoUtili] = useState(false);
  const [elenco, setElenco] = useState(null);
  const [rinfresca, setRinfresca] = useState(0);
  const chiave = JSON.stringify(base);
  const leggi = useCallback(async () => {
    if (carica) return carica();
    if (sezione) return documentiSezione(archivioDb, sezione);
    return cercaArchivio(archivioDb, { ...base, testo, anchePocoUtili, limite: 400 });
  }, [carica, sezione, chiave, testo, anchePocoUtili]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setTimeout(() => esegui(async () => setElenco(await leggi())), testo ? 250 : 0);
    return () => clearTimeout(t);
  }, [leggi, esegui, versione, rinfresca, testo]);
  const filtrato = useMemo(() => {
    if (!elenco || !(carica || sezione) || !testo.trim()) return elenco;
    const w = testo.toLowerCase();
    return elenco.filter((d) => `${d.titolo} ${d.ente || ''} ${d.riassunto || ''} ${d.tipo_documento || ''}`.toLowerCase().includes(w));
  }, [elenco, testo, carica, sezione]);
  return (
    <>
      <div className="pp-cerca">
        <IconaCerca size={18} />
        <input type="search" value={testo} onChange={(e) => setTesto(e.target.value)} placeholder="Cerca qui dentro" aria-label="Cerca nell'elenco" />
        {testo && <button type="button" className="pp-cerca-pulisci" aria-label="Cancella" onClick={() => setTesto('')}><IconaChiudi size={16} /></button>}
      </div>
      {!carica && !sezione && !base.fascicolo && !base.ente && (
        <div className="pp-filtri"><button className={`pp-filtro${anchePocoUtili ? ' attivo' : ''}`} onClick={() => setAnchePocoUtili(!anchePocoUtili)}>{anchePocoUtili ? 'Anche poco utili ✓' : 'Anche poco utili'}</button></div>
      )}
      {!filtrato ? <Vuoto>Carico…</Vuoto> : filtrato.length
        ? <ElencoSelezionabile elenco={filtrato} ctx={ctx} onCambiato={() => setRinfresca((n) => n + 1)} />
        : <Vuoto>Nessun documento.</Vuoto>}
    </>
  );
}
