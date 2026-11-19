// PERSONALE-HOME (PO 2026-11-16, mockup approvato «Così mi piace vai»): la Home della vita personale.
// Saluto, ricerca delle sezioni, Da fare in evidenza, Conti e Documenti, Scan, «Il tuo spazio» a
// icone e gli ultimi documenti. Solo lettura: conteggi e recenti vengono dalle funzioni già usate
// dalle sezioni; i documenti clinici dei pazienti non compaiono mai.
import { useEffect, useMemo, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { documentiRecenti } from '../../lib/archivio.js';
import { caricaDaFare, riepilogo } from '../../lib/daFare.js';
import { indirizzoScan } from '../../lib/scan.js';
import { ICONE_ALTRO } from '../../../../shared/altro/AltroPage.jsx';
import { saluto, dataBreve } from '../../ui.jsx';
import { PER_TE } from './index.jsx';
import { caricaCartellePratiche } from '../../lib/praticheCartelle.js';
import { GrigliaPratiche } from '../documenti/index.jsx';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const SCAN = 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16';
const OGGI_DOC = 'M6 3h9l4 4v14H6zM15 3v4h4';

// Il tuo spazio: [sezione, nome, icona, tono]. «Identità» = Documenti › Documenti personali.
const SPAZIO = [
  ['personali', 'Identità', 'personali', 'verde'], ['foto', 'Foto', 'foto', 'cielo'], ['note', 'Note', 'nota', 'ambra'],
  ['legal', 'Pratiche', 'pratiche', 'viola'], ['diario', 'Diario', 'diario', 'blu'], ['didattica', 'Biblioteca', 'biblioteca', 'smeraldo'],
  ['password', 'Password', 'password', 'oro'], ['oggi', 'Oggi', 'oggi', 'lilla'],
];

function Icona({ d, tono, grande = false }) {
  return (
    <span className={`pps-icona pps-${tono}${grande ? ' pps-icona-grande' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d={d} /></svg>
    </span>
  );
}

const quanti = (n, uno, molti) => `${n} ${n === 1 ? uno : molti}`;

export function VistaPersonale({ ctx }) {
  const { vai, apri, versione } = ctx;
  const [cerca, setCerca] = useState('');
  const [daFare, setDaFare] = useState(null);
  const [recenti, setRecenti] = useState(null);

  useEffect(() => {
    let vivo = true;
    caricaDaFare(archivioDb).then((v) => { if (vivo) setDaFare(riepilogo(v)); }).catch(() => { if (vivo) setDaFare(undefined); });
    documentiRecenti(archivioDb, 12)
      .then((d) => { if (vivo) setRecenti(d.filter((x) => x.fascicolo !== 'clinico_pazienti').slice(0, 3)); })
      .catch(() => { if (vivo) setRecenti([]); });
    return () => { vivo = false; };
  }, [versione]);

  // PRATICHE-CARTELLE (proposta B): la ricerca della Home trova anche le pratiche, per prime.
  const [pratiche, setPratiche] = useState([]);
  useEffect(() => {
    const t = cerca.trim();
    if (t.length < 2) { setPratiche([]); return undefined; }
    let vivo = true;
    const timer = setTimeout(() => caricaCartellePratiche(archivioDb, { testo: t }).then((e) => { if (vivo) setPratiche(e.slice(0, 6)); }).catch(() => { if (vivo) setPratiche([]); }), 250);
    return () => { vivo = false; clearTimeout(timer); };
  }, [cerca, versione]);

  const apriSezione = (id) => (id === 'personali' ? vai('documenti', 'personali') : vai(id));
  const trovate = useMemo(() => (cerca ? PER_TE.filter(([, nome, , , sotto]) => norm(`${nome} ${sotto || ''}`).includes(norm(cerca))) : []), [cerca]);

  return (
    <div className="pps">
      <header className="pps-testa">
        <span className="pps-testa-testi">
          <span className="pps-marchio"><img src="/poliedron-v2-192.png" alt="" width="16" height="16" />Poliedron</span>
          <h1>Personale</h1>
          <p>{saluto()}</p>
        </span>
        <button type="button" className="pps-profilo" onClick={() => apri({ tipo: 'impostazioni' })} aria-label="Impostazioni">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONE_ALTRO.impostazioni} /></svg>
        </button>
      </header>

      <div className="pps-cerca-riga">
        <label className="pps-cerca">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input type="search" aria-label="Cerca nelle tue cose" placeholder="Cerca nelle tue cose" value={cerca} onChange={(e) => setCerca(e.target.value)} />
        </label>
        <button type="button" className="pps-piu" onClick={ctx.apriAggiungi} aria-label="Aggiungi">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </div>

      {cerca ? (<>
        {pratiche.length > 0 && <section className="pps-trovate pps-trovate-pratiche" aria-label="Pratiche trovate">
          <h2 className="pps-titoletto">Pratiche</h2>
          <GrigliaPratiche elenco={pratiche} onApri={(p) => apri({ tipo: 'pratica', p })} />
        </section>}
        <section className="pps-trovate" aria-label="Sezioni trovate">
          {trovate.length ? trovate.map(([id, n, icona, , sotto]) => (
            <button key={id} type="button" className="pps-riga" onClick={() => apriSezione(id)}>
              <Icona d={ICONE_ALTRO[icona] || ICONE_ALTRO.listino} tono="verde" />
              <span className="pps-riga-testo"><strong>{n}</strong>{sotto && <span>{sotto}</span>}</span>
              <i aria-hidden="true">›</i>
            </button>
          )) : !pratiche.length && <p className="pps-vuoto">Nessuna pratica o sezione con «{cerca}». Per cercare nei documenti apri Documenti.</p>}
        </section>
      </>) : (
        <>
          <button type="button" className="pps-dafare" onClick={() => vai('dafare')}>
            <Icona d={ICONE_ALTRO.attivita} tono="vetro" grande />
            <span className="pps-dafare-testo">
              <span>Da fare</span>
              <strong>{daFare ? (daFare.aperte ? quanti(daFare.aperte, 'cosa da gestire', 'cose da gestire') : 'Niente da gestire') : 'Cose da gestire'}</strong>
              <span>{daFare?.aperte ? [daFare.urgenti ? quanti(daFare.urgenti, 'urgente', 'urgenti') : null, 'solleciti, scadenze, risposte'].filter(Boolean).join(' · ') : 'Solleciti, scadenze, risposte'}</span>
            </span>
            <i aria-hidden="true">›</i>
          </button>

          <div className="pps-coppia">
            <button type="button" className="pps-carta" onClick={() => vai('conti')}>
              <Icona d={ICONE_ALTRO.conti} tono="verde" />
              <span><strong>Conti</strong><span>Spese e pagamenti</span></span>
            </button>
            <button type="button" className="pps-carta" onClick={() => vai('documenti')}>
              <Icona d={ICONE_ALTRO.documenti} tono="blu" />
              <span><strong>Documenti</strong><span>Archivio personale</span></span>
            </button>
          </div>

          <a className="pps-scan" href={indirizzoScan()}>
            <Icona d={SCAN} tono="vetro" />
            <span><strong>Scan</strong><span>Scansiona, firma, invia</span></span>
            <i aria-hidden="true">›</i>
          </a>

          <section aria-label="Il tuo spazio">
            <h2 className="pps-titoletto">Il tuo spazio</h2>
            <div className="pps-griglia">
              {SPAZIO.map(([id, n, icona, tono]) => (
                <button key={id} type="button" className="pps-tessera" onClick={() => apriSezione(id)}>
                  <Icona d={ICONE_ALTRO[icona]} tono={tono} />
                  <span>{n}</span>
                </button>
              ))}
            </div>
          </section>

          {recenti?.length > 0 && (
            <section aria-label="Recenti">
              <h2 className="pps-titoletto">Recenti</h2>
              <div className="pps-recenti">
                {recenti.map((d) => (
                  <button key={d.id} type="button" className="pps-riga" onClick={() => apri({ tipo: 'documento', id: d.id })}>
                    <span className={`pps-formato${/pdf/i.test(d.mime_type || '') ? ' pdf' : ''}`} aria-hidden="true">
                      {/pdf/i.test(d.mime_type || '') ? 'PDF' : <svg viewBox="0 0 24 24"><path d={OGGI_DOC} /></svg>}
                    </span>
                    <span className="pps-riga-testo"><strong>{d.titolo || d.nome_file_originale || 'Documento'}</strong><span>{[d.ente, d.creato_il ? dataBreve(d.creato_il.slice(0, 10)) : null].filter(Boolean).join(' · ')}</span></span>
                    <i aria-hidden="true">›</i>
                  </button>
                ))}
              </div>
            </section>
          )}

          <button type="button" className="pps-piede" onClick={() => apri({ tipo: 'impostazioni' })}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONE_ALTRO.impostazioni} /></svg>
            <span>Impostazioni e account</span><i aria-hidden="true">›</i>
          </button>
        </>
      )}
    </div>
  );
}
