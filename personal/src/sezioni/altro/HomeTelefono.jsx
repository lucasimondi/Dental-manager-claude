// HOME-TELEFONO (PO 2026-11-26, mockup proposta «E · A + B», "Ok e"): la Home di Personale sul telefono.
// Sfondo da desktop, barra di ricerca grande, «Da fare», «Aggiunte» (icone a colori di Start) e «Consigliati»
// (scadenza e promemoria più vicini, ultimo documento). La ricerca, mentre scrivi, trova insieme rubrica e
// promemoria, app e sezioni, pratiche e documenti. Sul computer resta la Home di prima (Personale.jsx).
// Solo lettura: stesse funzioni già usate dalle sezioni; i documenti clinici dei pazienti non compaiono mai.
import { useEffect, useMemo, useRef, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { documentiRecenti, cercaDocumenti } from '../../lib/archivio.js';
import { caricaDaFare, riepilogo } from '../../lib/daFare.js';
import { scadenzeHome, testoScadenza, AMBITI } from '../../lib/mieCose.js';
import { rubricaHome, testoPromemoria, caricaRubrica, cerca as cercaRubrica, ordinaPromemoria, nomeCategoria, telefonoChiamabile, norm } from '../../lib/rubrica.js';
import { caricaCartellePratiche } from '../../lib/praticheCartelle.js';
import { IconaColore } from '../../IconeColore.jsx';
import { saluto, dataBreve } from '../../ui.jsx';
import { PER_TE } from './index.jsx';
import { ICONE_ALTRO } from '../../../../shared/altro/AltroPage.jsx';

// Aggiunte: [id, nome, icona a colori, come si apre].
export const AGGIUNTE_TELEFONO = [
  ['conti', 'Conti', 'conti', { vai: 'conti' }], ['documenti', 'Documenti', 'documenti', { vai: 'documenti' }],
  ['scan', 'Scan', 'scan', { apri: 'scan' }], ['poliedron', 'Assistente', 'assistente', { vai: 'poliedron' }],
  ['auto', 'Auto', 'auto', { apri: 'auto' }], ['casa', 'Casa', 'casa', { apri: 'casa' }],
  ['salute', 'Salute', 'salute', { apri: 'saluteApp' }], ['rubrica', 'Rubrica', 'rubrica', { apri: 'rubrica' }],
  ['dati', 'I miei dati', 'dati', { vai: 'dati' }], ['personali', 'Identità', 'portafoglio', { vai: 'documenti', sotto: 'personali' }],
  ['note', 'Note', 'note', { vai: 'note' }], ['legal', 'Pratiche', 'pratiche', { vai: 'legal' }],
];
const APRI_SEZIONE = Object.fromEntries(AGGIUNTE_TELEFONO.map(([id, , , a]) => [id, a]));
const nonClinico = (d) => d && d.fascicolo !== 'clinico_pazienti';
const quanti = (n, uno, molti) => `${n} ${n === 1 ? uno : molti}`;
const ora = () => new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
const oggiLungo = () => { const t = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }); return t[0].toUpperCase() + t.slice(1); };

// Le cose più vicine: la prima scadenza delle app (Auto, Casa, Salute) e il primo promemoria della Rubrica.
export function consigliati(cose, rub, recente) {
  const out = [];
  const sc = Object.entries(cose || {}).map(([id, r]) => r?.prossima && { id, ...r.prossima }).filter(Boolean).sort((a, b) => a.giorni - b.giorni)[0];
  if (sc) out.push({ chiave: 'sc', icona: sc.id, titolo: `${AMBITI[sc.id]?.breve || ''}: ${sc.voce}`, sotto: testoScadenza(sc).split(' · ').pop(), stato: sc.stato, apri: APRI_SEZIONE[sc.id] });
  const p = rub?.prossimo;
  if (p) out.push({ chiave: 'pr', icona: 'rubrica', titolo: p.cosa, sotto: testoPromemoria(p).split(' · ').pop(), stato: p.stato, apri: APRI_SEZIONE.rubrica });
  if (nonClinico(recente)) out.push({ chiave: 'doc', pdf: /pdf/i.test(recente.mime_type || ''), titolo: recente.titolo || recente.nome_file_originale || 'Documento', sotto: ['Documenti', recente.creato_il && dataBreve(recente.creato_il.slice(0, 10))].filter(Boolean).join(' · '), apri: { documento: recente.id } });
  return out;
}

// Ricerca della rubrica (contatti e promemoria) sul testo scritto.
export function trovaInRubrica({ contatti = [], promemoria = [] }, q) {
  const t = norm(q).trim();
  if (t.length < 2) return { contatti: [], promemoria: [] };
  const parole = t.split(/\s+/).filter((x) => x.length > 1);
  return {
    contatti: cercaRubrica(contatti, q).slice(0, 4),
    promemoria: ordinaPromemoria(promemoria.filter((p) => parole.some((w) => norm(`${p.cosa} ${p.note || ''}`).includes(w)))).slice(0, 3),
  };
}

const Lente = () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>;
const Telefono = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg>;
const Formato = ({ pdf }) => <span className={`ppt-formato${pdf ? ' pdf' : ''}`} aria-hidden="true">{pdf ? 'PDF' : 'DOC'}</span>;

export function HomeTelefono({ ctx }) {
  const { vai, apri, versione } = ctx;
  const esegui = (a) => { if (!a) return; if (a.documento) apri({ tipo: 'documento', id: a.documento }); else if (a.apri) apri({ tipo: a.apri }); else vai(a.vai, a.sotto || null); };
  const [daFare, setDaFare] = useState(null), [cose, setCose] = useState(null), [rub, setRub] = useState(null), [recente, setRecente] = useState(null);
  const [orario, setOrario] = useState(ora);
  useEffect(() => { const t = setInterval(() => setOrario(ora()), 20000); return () => clearInterval(t); }, []);
  useEffect(() => {
    let vivo = true; const se = (f) => (v) => { if (vivo) f(v); };
    caricaDaFare(archivioDb).then((v) => se(setDaFare)(riepilogo(v))).catch(() => se(setDaFare)(undefined));
    scadenzeHome(archivioDb).then(se(setCose)).catch(() => se(setCose)(undefined));
    rubricaHome(archivioDb).then(se(setRub)).catch(() => se(setRub)(undefined));
    documentiRecenti(archivioDb, 6).then((d) => se(setRecente)(d.find(nonClinico) || null)).catch(() => se(setRecente)(null));
    return () => { vivo = false; };
  }, [versione]);

  // Ricerca mentre scrivi: rubrica (caricata una volta), sezioni, pratiche e documenti (dopo 250 ms).
  const [q, setQ] = useState('');
  const rubrica = useRef(null);
  const [trovati, setTrovati] = useState({ contatti: [], promemoria: [], pratiche: [], documenti: [], cerco: false });
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setTrovati({ contatti: [], promemoria: [], pratiche: [], documenti: [], cerco: false }); return undefined; }
    let vivo = true;
    setTrovati((x) => ({ ...x, cerco: true }));
    const timer = setTimeout(async () => {
      const [r, pratiche, documenti] = await Promise.all([
        (rubrica.current ||= caricaRubrica(archivioDb).catch(() => ({ contatti: [], promemoria: [] }))).then((dati) => trovaInRubrica(dati, t)),
        caricaCartellePratiche(archivioDb, { testo: t }).then((e) => e.slice(0, 4)).catch(() => []),
        cercaDocumenti(archivioDb, t, null, 12).then((d) => d.filter(nonClinico).slice(0, 5)).catch(() => []),
      ]);
      if (vivo) setTrovati({ ...r, pratiche, documenti, cerco: false });
    }, 250);
    return () => { vivo = false; clearTimeout(timer); };
  }, [q, versione]);
  useEffect(() => { rubrica.current = null; }, [versione]);
  const sezioni = useMemo(() => (q.trim().length < 1 ? [] : PER_TE.filter(([, nome, , , sotto]) => norm(`${nome} ${sotto || ''}`).includes(norm(q.trim()))).slice(0, 5)), [q]);
  const nulla = !trovati.cerco && !sezioni.length && !trovati.contatti.length && !trovati.promemoria.length && !trovati.pratiche.length && !trovati.documenti.length;
  const lista = consigliati(cose, rub, recente);

  return (
    <div className={`ppt${q ? ' ppt-cerca-aperta' : ''}`}>
      {!q && <header className="ppt-testa">
        <span><span className="ppt-data">{oggiLungo()}</span><h1>{saluto()}</h1></span>
        <span className="ppt-destra"><span className="ppt-ora" aria-hidden="true">{orario}</span>
          <button type="button" className="ppt-tondo ppt-vetro ppt-impostazioni" aria-label="Impostazioni" onClick={() => apri({ tipo: 'impostazioni' })}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONE_ALTRO.impostazioni} /></svg></button></span>
      </header>}

      <div className="ppt-cerca">
        <label><Lente /><input type="search" aria-label="Cerca in Personal" placeholder="Cerca app, documenti, contatti…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        {q ? <button type="button" className="ppt-tondo ppt-tondo-chiaro" aria-label="Cancella la ricerca" onClick={() => setQ('')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
          : <button type="button" className="ppt-tondo" aria-label="Aggiungi" onClick={ctx.apriAggiungi}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></button>}
      </div>

      {q ? (
        <section className="ppt-risultati" aria-label="Risultati della ricerca">
          <p className="ppt-nota">Cerca insieme in rubrica, promemoria, app, pratiche e documenti</p>
          {(trovati.contatti.length > 0 || trovati.promemoria.length > 0) && <><h2>Rubrica e promemoria</h2><div className="ppt-gruppo">
            {trovati.contatti.map((c) => <div key={c.id} className="ppt-riga">
              <button type="button" className="ppt-riga-apri" onClick={() => apri({ tipo: 'rubrica' })}><IconaColore id="rubrica" size={30} /><span><strong>{c.nome}</strong><span>{[nomeCategoria(c), c.note].filter(Boolean).join(' · ')}</span></span></button>
              {telefonoChiamabile(c.telefono) && <a className="ppt-chiama" href={`tel:${telefonoChiamabile(c.telefono)}`} aria-label={`Chiama ${c.nome}`}><Telefono /></a>}
            </div>)}
            {trovati.promemoria.map((p) => <button key={p.id} type="button" className="ppt-riga ppt-riga-apri" onClick={() => apri({ tipo: 'rubrica' })}><span className="ppt-campanella" aria-hidden="true">!</span><span><strong>{p.cosa}</strong><span className={p.stato !== 'ok' ? `ppt-${p.stato}` : ''}>{`${p.quando} · promemoria`}</span></span></button>)}
          </div></>}
          {sezioni.length > 0 && <><h2>App e sezioni</h2><div className="ppt-gruppo">
            {sezioni.map(([id, nome, , , sotto]) => <button key={id} type="button" className="ppt-riga ppt-riga-apri" onClick={() => esegui(APRI_SEZIONE[id] || { vai: id })}><IconaColore id={AGGIUNTE_TELEFONO.find((a) => a[0] === id)?.[2] || id} size={30} /><span><strong>{nome}</strong>{sotto && <span>{sotto}</span>}</span></button>)}
          </div></>}
          {trovati.pratiche.length > 0 && <><h2>Pratiche</h2><div className="ppt-gruppo">
            {trovati.pratiche.map((p) => <button key={p.id} type="button" className="ppt-riga ppt-riga-apri" onClick={() => apri({ tipo: 'pratica', p })}><IconaColore id="pratiche" size={30} /><span><strong>{p.titolo}</strong><span>{[p.n_documenti != null && quanti(p.n_documenti, 'documento', 'documenti'), p.stato].filter(Boolean).join(' · ')}</span></span></button>)}
          </div></>}
          {trovati.documenti.length > 0 && <><h2>Documenti</h2><div className="ppt-gruppo">
            {trovati.documenti.map((d) => <button key={d.id} type="button" className="ppt-riga ppt-riga-apri" onClick={() => apri({ tipo: 'documento', id: d.id })}><Formato pdf={/pdf/i.test(d.mime_type || '')} /><span><strong>{d.titolo || d.nome_file_originale || 'Documento'}</strong><span>{[d.ente, dataBreve(d.data_documento || d.email_data)].filter(Boolean).join(' · ')}</span></span></button>)}
          </div></>}
          {trovati.cerco && <p className="ppt-nota">Cerco…</p>}
          {nulla && q.trim().length >= 2 && <p className="ppt-nota">Niente con «{q.trim()}».</p>}
          <button type="button" className="ppt-chiedi" onClick={() => vai('poliedron')}>Chiedi all'Assistente</button>
        </section>
      ) : (<>
        <button type="button" className="ppt-vetro ppt-dafare" onClick={() => vai('dafare')}>
          <span className="ppt-tessera ppt-tessera-piccola"><IconaColore id="dafare" size={30} /></span>
          <span className="ppt-testi"><strong>{daFare ? (daFare.aperte ? quanti(daFare.aperte, 'cosa da gestire', 'cose da gestire') : 'Niente da gestire') : 'Da fare'}</strong>
            <span>{daFare?.urgenti ? `${quanti(daFare.urgenti, 'urgente', 'urgenti')} · ` : ''}solleciti, scadenze, risposte</span></span>
          <i aria-hidden="true">›</i>
        </button>

        <section aria-label="Aggiunte">
          <div className="ppt-titolo"><h2>Aggiunte</h2><button type="button" className="ppt-pillola" onClick={() => window.dispatchEvent(new CustomEvent('poliedra:apri-start'))}>Tutte le app ›</button></div>
          <div className="ppt-griglia">
            {AGGIUNTE_TELEFONO.map(([id, nome, icona, a]) => <button key={id} type="button" className="ppt-app" onClick={() => esegui(a)}><span className="ppt-tessera"><IconaColore id={icona} size={36} /></span><span>{nome}</span></button>)}
          </div>
        </section>

        {lista.length > 0 && <section aria-label="Consigliati">
          <div className="ppt-titolo"><h2>Consigliati</h2></div>
          <div className="ppt-vetro ppt-consigliati">
            {lista.map((c) => <button key={c.chiave} type="button" className="ppt-cons" onClick={() => esegui(c.apri)}>
              {c.icona ? <IconaColore id={c.icona} size={30} /> : <Formato pdf={c.pdf} />}
              <span className="ppt-testi"><strong>{c.titolo}</strong><span className={c.stato && c.stato !== 'ok' ? `ppt-${c.stato}` : ''}>{c.sotto}</span></span>
            </button>)}
          </div>
        </section>}
      </>)}
    </div>
  );
}
