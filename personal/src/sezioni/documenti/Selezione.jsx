import { AzioniFascicolo } from './AzioniFascicolo.jsx';
import { ScorriElimina } from '../../ScorriElimina.jsx';
// Documenti — elenco con selezione multipla (tieni premuto o "Seleziona") e azioni di massa; fogli di scelta.
import { useEffect, useRef, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { aggiornaDocumenti, eliminaDocumenti, portafoglioDocumenti, cestinaSuDrive, eCaricato } from '../../lib/archivio.js';
import { euro } from '../../lib/coreArchivio.js';
import { caricaCartelle } from '../../lib/cartelle.js';
import { preparaFile, comeFile, condividi } from '../../lib/condividi.js';
import { colore, dataBreve, titoloDoc, Gruppo, ConfermaElimina, tokenSessione } from '../../ui.jsx';
import { Miniatura } from '../../Miniatura.jsx';
import { IconaCerca, IconaChiudi, IconaDocumenti, IconaFreccia, IconaStella, IconaCestino, IconaCondividi } from '../../Icone.jsx';

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
      {scelti.length > 0 && <AzioniFascicolo documenti={scelti} ctx={ctx} />}
      <div className={modo === 'griglia' ? 'pp-griglia-doc' : 'pp-gruppo'}>
        {elenco.map((d) => <ScorriElimina key={d.id} doc={d} ctx={ctx} onCambiato={onCambiato} disabilitato={!!selezione || d.fascicolo === 'clinico_pazienti'}><VoceDocumento doc={d} modo={modo} selezione={selezione} onApri={(x) => apri({ tipo: 'documento', id: x.id })} onSeleziona={seleziona} /></ScorriElimina>)}
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
