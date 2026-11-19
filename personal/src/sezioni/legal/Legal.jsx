import { useEffect, useRef, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { caricaLegal, salvaPraticaLegal, STATI_LEGAL, statiSchede, avanzamentoSchede } from '../../lib/legal.js';
import { cercaArchivio } from '../../lib/archivio.js';
import { TabellaScadenze } from './Scadenze.jsx';
import { Sezione, Vuoto } from '../../ui.jsx';
import { ElencoSelezionabile, PraticheCartelle } from '../documenti/index.jsx';
export function Legal({ ctx }) {
  const [elenco, setElenco] = useState(null), [docs, setDocs] = useState([]), [schede, setSchede] = useState([]);
  useEffect(() => { let vivo = true; ctx.esegui(async () => {
    const [p, d, s] = await Promise.all([caricaLegal(archivioDb), cercaArchivio(archivioDb, { fascicolo: 'legale', limite: 300 }), statiSchede(archivioDb).catch(() => [])]);
    if (vivo) { setElenco(p); setDocs(d.filter((x) => !x.pratica_id)); setSchede(s); }
  }); return () => { vivo = false; }; }, [ctx.esegui, ctx.versione]);
  return <>
    <h2>Legal</h2><p>Scadenze legali ed economiche, pratiche, recuperi crediti e contenziosi. Apri una pratica per la sua scheda: sintesi, punti salienti, cose da attenzionare e passi da fare.</p>
    <TabellaScadenze ctx={ctx} />
    {elenco && (() => { const a = avanzamentoSchede(elenco, schede); return a.totale > 0 && <p className="pp-legal-avanzamento" aria-label="Avanzamento delle analisi"><strong>{a.analizzate}/{a.totale}</strong> pratiche in corso analizzate · {a.verificate} verificate da te</p>; })()}
    <button className="pp-bottone" onClick={() => ctx.apri({ tipo: 'legal-modifica' })}>Nuova pratica</button>
    {/* PRATICHE-CARTELLE (proposta B): le pratiche come cartelle «Pratica …» con anteprime e passi. */}
    <PraticheCartelle ctx={ctx} />
    <Sezione titolo="Documenti da collegare"><p className="pp-riga-meta">Documenti legali ancora senza pratica (ultimi 300 documenti). Usa «•••» su un documento, o selezionane più di uno, e «Pratica» per metterli nella pratica giusta.</p>{docs.length > 0 ? <ElencoSelezionabile elenco={docs} ctx={ctx} titoloInvio="Documenti legali" intestazione={`${docs.length} documenti senza pratica · «•••» o «Seleziona» → Pratica`} /> : <Vuoto>Nessun documento da collegare.</Vuoto>}</Sezione>
    <p className="pp-riga-meta">Le scansioni alimentano le pratiche tramite la catalogazione esistente. Gli importi riportati nei documenti non certificano un debito né un saldo.</p>
  </>;
}
export function ModuloLegal({ p, ctx, chiudi }) {
  const [campi, setCampi] = useState({ titolo: p?.titolo || '', note: p?.note || '', stato: p?.stato || 'aperta', urgenza: p?.urgenza || 'media' });
  const [busy, setBusy] = useState(false); const lock = useRef(false);
  const campo = (k) => ({ value: campi[k], onChange: (e) => setCampi({ ...campi, [k]: e.target.value }) });
  return <form onSubmit={(e) => { e.preventDefault(); if (lock.current) return; lock.current = true; setBusy(true); ctx.esegui(async () => {
    const salvata = await salvaPraticaLegal(archivioDb, p?.id, campi); ctx.aggiorna(); chiudi(); ctx.apri({ tipo: 'pratica', p: salvata }); ctx.mostra('Pratica salvata');
  }).finally(() => { lock.current = false; setBusy(false); }); }}>
    <label className="pp-campo"><span>Titolo / controparte</span><input required maxLength={200} {...campo('titolo')} /></label>
    <label className="pp-campo"><span>Stato</span><select {...campo('stato')}>{STATI_LEGAL.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></label>
    <label className="pp-campo"><span>Urgenza</span><select {...campo('urgenza')}>{['bassa', 'media', 'alta'].map((s) => <option key={s}>{s}</option>)}</select></label>
    <label className="pp-campo"><span>Note e aggiornamenti manuali</span><textarea rows={10} {...campo('note')} placeholder="Controparte, importo richiesto (da verificare), avvocato, ultimo aggiornamento, prossima azione…" /></label>
    <p className="pp-riga-meta">Le scansioni aggiungono documenti e scadenze senza riscrivere queste note.</p>
    <button className="pp-bottone" disabled={busy}>{busy ? 'Salvo…' : 'Salva pratica'}</button>
  </form>;
}
