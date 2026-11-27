// HOME-STUDIO (PO 2026-11-17, mockup approvato «Sì, immagina bene e vai»): la Home dello Studio,
// gemella della Home Personale. Saluto, ricerca di pazienti e sezioni, + (Crea), azioni rapide
// (Appuntamento, Paziente, Ricetta, Preventivo, Incasso), «Oggi in studio», Pazienti e Incassi,
// Acquisisci, «Il tuo studio» a icone e «Da seguire».
// Solo presentazione: usa i dati che l'app ha già (appuntamenti, richiami, piani, pagamenti) e le
// funzioni che li calcolano già (computeScadenzePagamento, snapshot finanziario canonico). Nessuna
// formula nuova; le cifre economiche compaiono solo a chi ha il permesso del controllo di gestione.
import React, { useEffect, useMemo, useState } from 'react';
import './StudioHome.css';
import { supabase } from '../lib/supabase.js';
import { today, fmt } from '../lib/utils';
import { cercaPazienti } from '../lib/ricercaPazienti.js';
import { riepilogoStudio } from '../lib/studioHome.js';
import { loadHomeFinancialSnapshot } from '../lib/homeFinancialWidgets.js';
import { ICONE_ALTRO } from '../../shared/altro/AltroPage.jsx';
// STUDIO-TELEFONO (PO 2026-11-27): sul telefono la Home nuova (stile Personal); sul computer questa, invariata.
import { useIsMobile } from '../lib/useIsMobile.js';
import StudioHomeTelefono from './StudioHomeTelefono.jsx';

const ICONE = {
  ...ICONE_ALTRO,
  agenda: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  nuovoAppuntamento: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M12 13v4M10 15h4',
  nuovoPaziente: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M19 8v6M16 11h6',
  ricetta: 'M6 3h9l4 4v14H6zM15 3v4h4M9 10h3a2 2 0 0 1 0 4H9v-4zM9 14v4M12 14l3 4',
  scan: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16',
  cerca: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5',
  piu: 'M12 5v14M5 12h14',
};

// Sezioni di «Il tuo studio»: id della pagina → [icona, tono]. Pazienti e Incassi hanno la loro coppia.
export const SEZIONI_STUDIO = {
  piani: ['piani', 'blu'], preventivi: ['preventivi', 'indaco'], richiami: ['richiami', 'rosso'], attivita: ['attivita', 'acqua'],
  spese: ['spese', 'cremisi'], controllo: ['controllo', 'petrolio'], listino: ['listino', 'ardesia'], wa: ['whatsapp', 'wa'],
  chat: ['chat', 'blu'], agenteai: ['agente', 'viola'], home: ['home', 'ardesia'],
};

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const quanti = (n, uno, molti) => `${n} ${n === 1 ? uno : molti}`;
const saluto = (ora = new Date().getHours()) => (ora < 13 ? 'Buongiorno' : ora < 18 ? 'Buon pomeriggio' : 'Buonasera');
const giorno = () => new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

function Icona({ d, tono, classe = '' }) {
  return <span className={`sh-icona sh-${tono} ${classe}`} aria-hidden="true"><svg viewBox="0 0 24 24"><path d={d} /></svg></span>;
}

export default function StudioHome(props) {
  const isMobile = useIsMobile();
  return isMobile ? <StudioHomeTelefono {...props} /> : <StudioHomeComputer {...props} />;
}

function StudioHomeComputer({
  patients = [], appointments = [], richiami = [], plans = [], payments = [],
  nav = [], managementControl = false, conSpese = false,
  vai, apriPaziente, azioni = {}, onImpostazioni,
}) {
  const [cerca, setCerca] = useState('');
  // Le sezioni visibili (NAV già filtrato per piano e ruolo in App.jsx): Pazienti e Incassi in coppia, le altre a icone.
  const sezioni = useMemo(() => nav.filter((n) => SEZIONI_STUDIO[n.id] || ['paz', 'paga'].includes(n.id))
    .map((n) => ({ id: n.id, nome: n.l, icona: (SEZIONI_STUDIO[n.id] || [n.id === 'paz' ? 'pazienti' : 'incassi'])[0], tono: (SEZIONI_STUDIO[n.id] || [, n.id === 'paz' ? 'petrolio' : 'verde'])[1] })), [nav]);
  const [creaAperto, setCreaAperto] = useState(false);
  const [incassatoOggi, setIncassatoOggi] = useState(null);
  const oggi = today();

  const r = useMemo(() => riepilogoStudio({
    appointments, richiami, plans, patients, payments, oggi, ora: new Date().toTimeString().slice(0, 5), conScadenze: managementControl,
  }), [appointments, richiami, plans, patients, payments, oggi, managementControl]);

  // Incassato di oggi: lo stesso snapshot canonico dei widget economici della Home (nessuna somma qui).
  useEffect(() => {
    let vivo = true;
    if (!managementControl) { setIncassatoOggi(null); return () => { vivo = false; }; }
    loadHomeFinancialSnapshot(supabase, { authorized: true, period: { dateFrom: oggi, dateTo: oggi } })
      .then(({ snapshot }) => { if (vivo) setIncassatoOggi(snapshot?.incassato ?? null); })
      .catch(() => { if (vivo) setIncassatoOggi(null); });
    return () => { vivo = false; };
  }, [managementControl, oggi]);

  const nomePaziente = (id) => { const p = patients.find((x) => String(x.id) === String(id)); return p ? `${p.cognome || ''} ${p.nome ? `${p.nome[0]}.` : ''}`.trim() : ''; };
  const trovatiPazienti = useMemo(() => (cerca.trim() ? cercaPazienti(patients, cerca).slice(0, 6) : []), [patients, cerca]);
  const trovateSezioni = useMemo(() => (cerca.trim() ? sezioni.filter((s) => norm(s.nome).includes(norm(cerca))) : []), [sezioni, cerca]);

  const rapide = [
    azioni.appuntamento && { id: 'appuntamento', nome: 'Appuntamento', d: ICONE.nuovoAppuntamento, tono: 'blu', fai: azioni.appuntamento },
    azioni.paziente && { id: 'paziente', nome: 'Paziente', d: ICONE.nuovoPaziente, tono: 'petrolio', fai: azioni.paziente },
    azioni.ricetta && { id: 'ricetta', nome: 'Ricetta', d: ICONE.ricetta, tono: 'indaco', fai: azioni.ricetta },
    azioni.preventivo && { id: 'preventivo', nome: 'Preventivo', d: ICONE.preventivi, tono: 'viola', fai: azioni.preventivo },
    azioni.incasso && { id: 'incasso', nome: 'Incasso', d: ICONE.incassi, tono: 'verde', fai: azioni.incasso },
  ].filter(Boolean);
  const crea = [...rapide,
    conSpese && azioni.spesa && { id: 'spesa', nome: 'Spesa', d: ICONE.spese, tono: 'cremisi', fai: azioni.spesa },
    azioni.acquisisci && { id: 'documento', nome: 'Documento', d: ICONE.scan, tono: 'acqua', fai: azioni.acquisisci },
  ].filter(Boolean);

  const seguire = [
    r.richiamiScaduti > 0 && { id: 'richiami-scaduti', n: r.richiamiScaduti, tono: 'avviso', titolo: quanti(r.richiamiScaduti, 'richiamo scaduto', 'richiami scaduti'), sotto: 'Pazienti da richiamare', fai: () => vai('richiami') },
    r.richiamiOggi > 0 && { id: 'richiami-oggi', n: r.richiamiOggi, tono: 'info', titolo: quanti(r.richiamiOggi, 'richiamo in scadenza oggi', 'richiami in scadenza oggi'), sotto: 'Da gestire in Richiami', fai: () => vai('richiami') },
    r.daConfermare > 0 && { id: 'da-confermare', n: r.daConfermare, tono: 'info', titolo: quanti(r.daConfermare, 'appuntamento da confermare', 'appuntamenti da confermare'), sotto: 'Nei prossimi 7 giorni', fai: () => vai('agenda') },
    r.pagamentiScaduti > 0 && { id: 'pagamenti-scaduti', n: r.pagamentiScaduti, tono: 'avviso', titolo: quanti(r.pagamentiScaduti, 'pagamento scaduto', 'pagamenti scaduti'), sotto: 'Scadenze dei piani non saldate', fai: () => vai('controllo') },
  ].filter(Boolean);

  const griglia = sezioni.filter((s) => !['paz', 'paga'].includes(s.id));
  const haPazienti = sezioni.some((s) => s.id === 'paz');
  const haIncassi = sezioni.some((s) => s.id === 'paga');

  return (
    <div className="sh">
      <header className="sh-testa">
        <span className="sh-testa-testi">
          <span className="sh-marchio"><img src="/poliedron-v2-192.png" alt="" width="16" height="16" />Poliedron</span>
          <h1>Studio</h1>
          <p>{saluto()} · {giorno()}</p>
        </span>
        <button type="button" className="sh-tondo" onClick={onImpostazioni} aria-label="Impostazioni">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONE.impostazioni} /></svg>
        </button>
      </header>

      <div className="sh-cerca-riga">
        <label className="sh-cerca">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONE.cerca} /></svg>
          <input type="search" aria-label="Cerca pazienti e sezioni" placeholder="Cerca pazienti e sezioni" value={cerca} onChange={(e) => setCerca(e.target.value)} />
        </label>
        <button type="button" className="sh-piu" onClick={() => setCreaAperto(true)} aria-label="Crea">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONE.piu} /></svg>
        </button>
      </div>

      {cerca.trim() ? (
        <section className="sh-trovati" aria-label="Risultati">
          {trovatiPazienti.map((p) => (
            <button key={p.id} type="button" className="sh-riga" onClick={() => apriPaziente?.(p)}>
              <Icona d={ICONE.pazienti} tono="petrolio" />
              <span className="sh-riga-testo"><strong>{`${p.nome || ''} ${p.cognome || ''}`.trim()}</strong>{p.telefono && <span>{p.telefono}</span>}</span>
              <i aria-hidden="true">›</i>
            </button>
          ))}
          {trovateSezioni.map((s) => (
            <button key={s.id} type="button" className="sh-riga" onClick={() => vai(s.id)}>
              <Icona d={ICONE[s.icona] || ICONE.listino} tono={s.tono} />
              <span className="sh-riga-testo"><strong>{s.nome}</strong><span>Sezione</span></span>
              <i aria-hidden="true">›</i>
            </button>
          ))}
          {!trovatiPazienti.length && !trovateSezioni.length && <p className="sh-vuoto">Nessun paziente o sezione con «{cerca}».</p>}
        </section>
      ) : (
        <>
          <div className="sh-azioni" role="group" aria-label="Azioni rapide">
            {rapide.map((a) => (
              <button key={a.id} type="button" className="sh-azione" onClick={a.fai}>
                <Icona d={a.d} tono={a.tono} />{a.nome}
              </button>
            ))}
          </div>

          <button type="button" className="sh-eroe" onClick={() => vai('agenda')}>
            <Icona d={ICONE.agenda} tono="vetro" classe="sh-icona-grande" />
            <span className="sh-eroe-testo">
              <span>Oggi in studio</span>
              <strong>{r.diOggi.length ? quanti(r.diOggi.length, 'appuntamento', 'appuntamenti') : 'Nessun appuntamento'}</strong>
              <span>{[r.daConfermareOggi ? `${r.daConfermareOggi} da confermare` : null, r.fine ? `ultimo alle ${r.fine}` : 'Apri l\'agenda'].filter(Boolean).join(' · ')}</span>
              {r.prossimo && <span className="sh-prossimo"><em>{r.prossimo.ora}</em>Prossimo: {[r.prossimo.tipo, nomePaziente(r.prossimo.pazienteId)].filter(Boolean).join(' · ')}</span>}
            </span>
            <i aria-hidden="true">›</i>
          </button>

          {(haPazienti || haIncassi) && (
            <div className="sh-coppia">
              {haPazienti && (
                <button type="button" className="sh-carta" onClick={() => vai('paz')}>
                  <Icona d={ICONE.pazienti} tono="petrolio" />
                  <span><strong>Pazienti</strong><span>Schede e piani di cura</span></span>
                </button>
              )}
              {haIncassi && (
                <button type="button" className="sh-carta" onClick={() => vai('paga')}>
                  <Icona d={ICONE.incassi} tono="verde" />
                  <span><strong>Incassi</strong><span>Pagamenti dei pazienti</span></span>
                  {incassatoOggi != null && <span className="sh-cifra">Oggi {fmt(incassatoOggi)}</span>}
                </button>
              )}
            </div>
          )}

          {azioni.acquisisci && (
            <button type="button" className="sh-acquisisci" onClick={azioni.acquisisci}>
              <Icona d={ICONE.scan} tono="vetro" />
              <span><strong>Acquisisci</strong><span>Fotografa un documento e assegnalo al paziente</span></span>
              <i aria-hidden="true">›</i>
            </button>
          )}

          {griglia.length > 0 && (
            <section aria-label="Il tuo studio">
              <h2 className="sh-titoletto">Il tuo studio</h2>
              <div className="sh-griglia">
                {griglia.map((s) => (
                  <button key={s.id} type="button" className="sh-tessera" onClick={() => vai(s.id)}>
                    <Icona d={ICONE[s.icona] || ICONE.listino} tono={s.tono} />{s.nome}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section aria-label="Da seguire">
            <h2 className="sh-titoletto">Da seguire</h2>
            <div className="sh-seguire">
              {seguire.length ? seguire.map((x) => (
                <button key={x.id} type="button" className="sh-riga" onClick={x.fai}>
                  <span className={`sh-bollo sh-bollo-${x.tono}`}>{x.n}</span>
                  <span className="sh-riga-testo"><strong>{x.titolo}</strong><span>{x.sotto}</span></span>
                  <i aria-hidden="true">›</i>
                </button>
              )) : <p className="sh-vuoto">Tutto sotto controllo.</p>}
            </div>
          </section>
        </>
      )}

      {creaAperto && (
        <div className="sh-foglio-sfondo" onClick={() => setCreaAperto(false)}>
          <div className="sh-foglio" role="dialog" aria-modal="true" aria-label="Crea" onClick={(e) => e.stopPropagation()}>
            <div className="sh-foglio-testa"><strong>Crea</strong><button type="button" onClick={() => setCreaAperto(false)} aria-label="Chiudi">✕</button></div>
            <div className="sh-foglio-griglia">
              {crea.map((a) => (
                <button key={a.id} type="button" className="sh-tessera" onClick={() => { setCreaAperto(false); a.fai(); }}>
                  <Icona d={a.d} tono={a.tono} />{a.nome}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
