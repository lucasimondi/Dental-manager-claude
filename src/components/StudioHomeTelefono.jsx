// STUDIO-TELEFONO (PO 2026-11-27, mockup «Studio · stesso stile di Personal», scelta "Misto S1 + S2", solo telefono):
// la Home dello Studio sul telefono nello stile della Home di Personal. Sfondo da desktop (petrolio), ricerca grande
// (pazienti con Chiama e Nuovo appuntamento, loro appuntamenti e piani, sezioni), azioni rapide, agenda di oggi con
// Chiama, avvisi, «Aggiunte» a icone a colori e «Tutte le app» (Start). Sul computer resta la Home di prima.
// Solo presentazione: stessi dati e stesse funzioni della Home di prima (riepilogoStudio, cercaPazienti); nessuna
// scrittura, nessuna formula economica nuova.
import React, { useEffect, useMemo, useState } from 'react';
import './StudioHomeTelefono.css';
import { today } from '../lib/utils';
import { cercaPazienti } from '../lib/ricercaPazienti.js';
import { riepilogoStudio } from '../lib/studioHome.js';
import IconaColoreStudio from './IconaColoreStudio.jsx';
import { apriStartStudio } from '../lib/startStudio.js';
import InterruttoreSpazio from '../../shared/spazio/InterruttoreSpazio.jsx'; // NAVIGAZIONE N4

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const quanti = (n, uno, molti) => `${n} ${n === 1 ? uno : molti}`;
const saluto = (ora = new Date().getHours()) => (ora < 13 ? 'Buongiorno' : ora < 18 ? 'Buon pomeriggio' : 'Buonasera');
const oraAdesso = () => new Date().toTimeString().slice(0, 5);
const oggiLungo = () => { const t = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }); return t[0].toUpperCase() + t.slice(1); };
const giornoBreve = (iso) => new Date(`${iso}T12:00`).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
const telefonoDi = (p) => String(p?.telefono || p?.cellulare || '').replace(/[^\d+]/g, '');
const iniziali = (p) => `${(p?.nome || '')[0] || ''}${(p?.cognome || '')[0] || ''}`.toUpperCase() || '?';
const PIANI_CHIUSI = new Set(['completato', 'chiuso', 'rifiutato', 'annullato', 'archiviato']);
const TAPPA = 'Tutte le app';

// Ordine delle icone in «Aggiunte» (le voci che lo studio non ha spariscono, come nel menu).
export const ORDINE_AGGIUNTE = ['agenda', 'paz', 'paga', 'piani', 'preventivi', 'richiami', 'attivita', 'archivio', 'spese', 'controllo', 'listino', 'wa', 'note', 'password', 'poliedron', 'chat', 'agenteai'];
const NON_IN_AGGIUNTE = new Set(['home', 'studio', 'perte', 'altro', 'set']);

// Cosa trova la ricerca: pazienti, i loro prossimi appuntamenti, i loro piani aperti, le sezioni.
export function trovaNelloStudio({ q, patients = [], appointments = [], plans = [], nav = [], oggi = today() }) {
  const t = String(q || '').trim();
  if (!t) return { pazienti: [], appuntamenti: [], piani: [], sezioni: [] };
  const pazienti = cercaPazienti(patients, t).slice(0, 6);
  const ids = new Set(pazienti.map((p) => String(p.id)));
  const appuntamenti = appointments.filter((a) => a && a.stato !== 'annullato' && ids.has(String(a.pazienteId)) && String(a.data || '') >= oggi)
    .sort((a, b) => `${a.data} ${a.ora || ''}`.localeCompare(`${b.data} ${b.ora || ''}`)).slice(0, 4);
  const piani = plans.filter((p) => p && ids.has(String(p.pazienteId)) && !PIANI_CHIUSI.has(String(p.stato || '').toLowerCase())).slice(0, 3);
  const sezioni = nav.filter((n) => !NON_IN_AGGIUNTE.has(n.id) && norm(n.l).includes(norm(t))).slice(0, 5);
  return { pazienti, appuntamenti, piani, sezioni };
}

function Chiama({ p, nome }) {
  const tel = telefonoDi(p);
  if (!tel) return null;
  return <a className="stt-tondo stt-chiama" href={`tel:${tel}`} aria-label={`Chiama ${nome}`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg></a>;
}

export default function StudioHomeTelefono({
  patients = [], appointments = [], richiami = [], plans = [], payments = [],
  nav = [], managementControl = false, conSpese = false,
  vai, apriPaziente, azioni = {}, onImpostazioni,
}) {
  const [q, setQ] = useState('');
  const [crea, setCrea] = useState(false);
  const [orario, setOrario] = useState(oraAdesso);
  useEffect(() => { const t = setInterval(() => setOrario(oraAdesso()), 20000); return () => clearInterval(t); }, []);
  const oggi = today();
  const r = useMemo(() => riepilogoStudio({ appointments, richiami, plans, patients, payments, oggi, ora: orario, conScadenze: managementControl }),
    [appointments, richiami, plans, patients, payments, oggi, orario, managementControl]);
  const paziente = (id) => patients.find((x) => String(x.id) === String(id)) || null;
  const nomeBreve = (p) => (p ? `${p.nome || ''} ${p.cognome ? `${p.cognome[0]}.` : ''}`.trim() : '');
  const nomeIntero = (p) => (p ? `${p.nome || ''} ${p.cognome || ''}`.trim() : '');
  const trovati = useMemo(() => trovaNelloStudio({ q, patients, appointments, plans, nav, oggi }), [q, patients, appointments, plans, nav, oggi]);

  const rapide = [
    azioni.appuntamento && { id: 'appuntamento', nome: 'Appuntam.', etichetta: 'Nuovo appuntamento', icona: 'nuovoAppuntamento', fai: azioni.appuntamento },
    azioni.paziente && { id: 'paziente', nome: 'Paziente', etichetta: 'Nuovo paziente', icona: 'nuovoPaziente', fai: azioni.paziente },
    azioni.ricetta && { id: 'ricetta', nome: 'Ricetta', etichetta: 'Nuova ricetta', icona: 'ricetta', fai: azioni.ricetta },
    azioni.preventivo && { id: 'preventivo', nome: 'Preventivo', etichetta: 'Nuovo preventivo', icona: 'preventivi', fai: azioni.preventivo },
    azioni.incasso && { id: 'incasso', nome: 'Incasso', etichetta: 'Nuovo incasso', icona: 'nuovoIncasso', fai: azioni.incasso },
  ].filter(Boolean);
  const tuttiCrea = [...rapide,
    conSpese && azioni.spesa && { id: 'spesa', nome: 'Spesa', etichetta: 'Nuova spesa', icona: 'spese', fai: azioni.spesa },
    azioni.acquisisci && { id: 'documento', nome: 'Documento', etichetta: 'Acquisisci un documento', icona: 'scan', fai: azioni.acquisisci },
  ].filter(Boolean);

  // Agenda di oggi: dal prossimo in poi (se la giornata è finita, gli ultimi tre).
  const daAdesso = r.diOggi.filter((a) => String(a.ora || '') >= orario);
  const inVista = (daAdesso.length ? daAdesso : r.diOggi.slice(-3)).slice(0, 3);
  const altri = inVista.length ? r.diOggi.length - r.diOggi.indexOf(inVista[0]) - inVista.length : 0;

  const avvisi = [
    r.richiamiScaduti > 0 && { id: 'richiami-scaduti', n: r.richiamiScaduti, tono: 'avviso', testo: r.richiamiScaduti === 1 ? 'Richiamo scaduto' : 'Richiami scaduti', fai: () => vai('richiami') },
    r.richiamiOggi > 0 && { id: 'richiami-oggi', n: r.richiamiOggi, tono: 'info', testo: 'Richiami di oggi', fai: () => vai('richiami') },
    r.daConfermare > 0 && { id: 'da-confermare', n: r.daConfermare, tono: 'info', testo: 'Da confermare (7 giorni)', fai: () => vai('agenda') },
    r.pagamentiScaduti > 0 && { id: 'pagamenti-scaduti', n: r.pagamentiScaduti, tono: 'avviso', testo: r.pagamentiScaduti === 1 ? 'Pagamento scaduto' : 'Pagamenti scaduti', fai: () => vai('paga') },
  ].filter(Boolean);

  const perId = Object.fromEntries(nav.map((n) => [n.id, n]));
  const aggiunte = ORDINE_AGGIUNTE.filter((id) => perId[id]).slice(0, 11).map((id) => perId[id]);

  return (
    <div className={`stt${q ? ' stt-cerca-aperta' : ''}`}>
      {!q && <InterruttoreSpazio attivo="studio" onPersonale={() => vai('perte')} />}
      {!q && <header className="stt-testa">
        <span className="stt-testa-testi"><span className="stt-data">{oggiLungo()} · Studio</span><h1>{saluto()}</h1></span>
        <span className="stt-ora" aria-hidden="true">{orario}</span>
        {onImpostazioni && <button type="button" className="stt-tondo stt-vetro" aria-label="Impostazioni" onClick={onImpostazioni}><IconaColoreStudio id="set" size={24} /></button>}
      </header>}

      <div className="stt-cerca">
        <label>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input type="search" aria-label="Cerca nello Studio" placeholder="Cerca pazienti, appuntamenti, sezioni…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {q ? <button type="button" className="stt-tondo stt-tondo-chiaro" aria-label="Cancella la ricerca" onClick={() => setQ('')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
          : tuttiCrea.length > 0 && <button type="button" className="stt-tondo stt-piu" aria-label="Crea" onClick={() => setCrea(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></button>}
      </div>

      {q ? (
        <section className="stt-risultati" aria-label="Risultati della ricerca">
          <p className="stt-nota">Cerca insieme pazienti, appuntamenti, piani e sezioni</p>
          {trovati.pazienti.length > 0 && <><h2>Pazienti</h2><div className="stt-gruppo">
            {trovati.pazienti.map((p) => {
              const prossimo = appointments.filter((a) => String(a.pazienteId) === String(p.id) && String(a.data || '') >= oggi && a.stato !== 'annullato').sort((a, b) => `${a.data}${a.ora}`.localeCompare(`${b.data}${b.ora}`))[0];
              return <div key={p.id} className="stt-riga">
                <button type="button" className="stt-riga-apri" onClick={() => apriPaziente?.(p)}><span className="stt-avatar" aria-hidden="true">{iniziali(p)}</span>
                  <span><strong>{nomeIntero(p)}</strong><span>{prossimo ? `Prossimo: ${giornoBreve(prossimo.data)} ${prossimo.ora || ''}${prossimo.tipo ? ` · ${prossimo.tipo}` : ''}` : (p.telefono || 'Nessun appuntamento in programma')}</span></span></button>
                <Chiama p={p} nome={nomeIntero(p)} />
                {azioni.appuntamentoPer && <button type="button" className="stt-tondo stt-nuovo" aria-label={`Nuovo appuntamento per ${nomeIntero(p)}`} onClick={() => azioni.appuntamentoPer(p)}><IconaColoreStudio id="nuovoAppuntamento" size={24} /></button>}
              </div>;
            })}
          </div></>}
          {trovati.appuntamenti.length > 0 && <><h2>Appuntamenti</h2><div className="stt-gruppo">
            {trovati.appuntamenti.map((a) => <button key={a.id} type="button" className="stt-riga stt-riga-apri" onClick={() => vai('agenda')}><IconaColoreStudio id="agenda" size={30} />
              <span><strong>{`${giornoBreve(a.data)} · ${a.ora || ''}`}</strong><span>{[nomeIntero(paziente(a.pazienteId)), a.tipo, a.stato].filter(Boolean).join(' · ')}</span></span></button>)}
          </div></>}
          {trovati.piani.length > 0 && <><h2>Piani di cura</h2><div className="stt-gruppo">
            {trovati.piani.map((pl) => { const p = paziente(pl.pazienteId); return <button key={pl.id} type="button" className="stt-riga stt-riga-apri" onClick={() => (p ? apriPaziente?.(p) : vai('piani'))}><IconaColoreStudio id="piani" size={30} />
              <span><strong>{pl.titolo || 'Piano di cura'}</strong><span>{[nomeIntero(p), pl.stato].filter(Boolean).join(' · ')}</span></span></button>; })}
          </div></>}
          {trovati.sezioni.length > 0 && <><h2>Sezioni</h2><div className="stt-gruppo">
            {trovati.sezioni.map((s) => <button key={s.id} type="button" className="stt-riga stt-riga-apri" onClick={() => vai(s.id)}><IconaColoreStudio id={s.id} size={30} /><span><strong>{s.l}</strong><span>Apri la sezione</span></span></button>)}
          </div></>}
          {!trovati.pazienti.length && !trovati.sezioni.length && <p className="stt-nota">Nessun paziente o sezione con «{q.trim()}».</p>}
        </section>
      ) : (<>
        {rapide.length > 0 && <div className="stt-rapide" role="group" aria-label="Azioni rapide">
          {rapide.map((a) => <button key={a.id} type="button" className="stt-rapida" aria-label={a.etichetta} onClick={a.fai}><span className="stt-tessera stt-tessera-tonda"><IconaColoreStudio id={a.icona} size={28} /></span><span aria-hidden="true">{a.nome}</span></button>)}
        </div>}

        <section className="stt-vetro stt-oggi" aria-label="Oggi in studio">
          <div className="stt-oggi-testa"><strong>{r.diOggi.length ? `Oggi · ${quanti(r.diOggi.length, 'appuntamento', 'appuntamenti')}` : 'Oggi · nessun appuntamento'}</strong>
            <button type="button" className="stt-pillola" onClick={() => vai('agenda')}>Agenda ›</button></div>
          {inVista.map((a) => { const p = paziente(a.pazienteId); const conferma = a.stato === 'da confermare'; return <div key={a.id} className="stt-ora-riga">
            <time>{a.ora}</time><span className={`stt-barretta${conferma ? ' stt-barretta-conferma' : ''}`} aria-hidden="true" />
            <button type="button" className="stt-ora-apri" onClick={() => (p ? apriPaziente?.(p) : vai('agenda'))}><strong>{nomeBreve(p) || 'Appuntamento'}</strong><span className={conferma ? 'stt-conferma' : ''}>{[conferma ? 'Da confermare' : null, a.tipo].filter(Boolean).join(' · ') || a.stato}</span></button>
            <Chiama p={p} nome={nomeIntero(p)} />
          </div>; })}
          {altri > 0 && <p className="stt-altri">+ {quanti(altri, 'altro', 'altri')} oggi</p>}
        </section>

        {avvisi.length > 0 && <div className="stt-avvisi" role="group" aria-label="Da seguire">
          {avvisi.map((x) => <button key={x.id} type="button" className="stt-avviso" onClick={x.fai}><b className={`stt-bollo-${x.tono}`}>{x.n}</b>{x.testo}</button>)}
        </div>}

        <section aria-label="Aggiunte">
          <div className="stt-titolo"><h2>Aggiunte</h2><button type="button" className="stt-pillola" onClick={apriStartStudio}>{TAPPA} ›</button></div>
          <div className="stt-griglia">
            {aggiunte.map((n) => <button key={n.id} type="button" className="stt-app" onClick={() => vai(n.id)}><span className="stt-tessera"><IconaColoreStudio id={n.id} size={34} /></span><span>{n.l}</span></button>)}
            <button type="button" className="stt-app" onClick={apriStartStudio}><span className="stt-tessera stt-tessera-vetro" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.2" /><circle cx="12" cy="6" r="2.2" /><circle cx="18" cy="6" r="2.2" /><circle cx="6" cy="12" r="2.2" /><circle cx="12" cy="12" r="2.2" /><circle cx="18" cy="12" r="2.2" /><circle cx="6" cy="18" r="2.2" /><circle cx="12" cy="18" r="2.2" /><circle cx="18" cy="18" r="2.2" /></svg></span><span>{TAPPA}</span></button>
          </div>
        </section>
      </>)}

      {crea && <div className="stt-foglio-sfondo" onClick={() => setCrea(false)}>
        <div className="stt-foglio" role="dialog" aria-modal="true" aria-label="Crea" onClick={(e) => e.stopPropagation()}>
          <div className="stt-foglio-testa"><strong>Crea</strong><button type="button" className="stt-tondo stt-tondo-chiaro" onClick={() => setCrea(false)} aria-label="Chiudi"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button></div>
          <div className="stt-foglio-griglia">
            {tuttiCrea.map((a) => <button key={a.id} type="button" className="stt-crea" onClick={() => { setCrea(false); a.fai(); }}><IconaColoreStudio id={a.icona} size={36} /><span>{a.nome === 'Appuntam.' ? 'Appuntamento' : a.nome}</span></button>)}
          </div>
        </div>
      </div>}
    </div>
  );
}
