import { useEffect, useRef, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { caricaLegal, salvaPraticaLegal, STATI_LEGAL } from '../../lib/legal.js';
import { cercaArchivio } from '../../lib/archivio.js';
import { Sezione, Vuoto, Chips, ElencoPratiche, RigaDocumento, Gruppo } from '../../ui.jsx';
export function Legal({ ctx }) {
  const [elenco, setElenco] = useState(null), [docs, setDocs] = useState([]), [filtro, setFiltro] = useState('aperte');
  useEffect(() => { let vivo = true; ctx.esegui(async () => {
    const [p, d] = await Promise.all([caricaLegal(archivioDb), cercaArchivio(archivioDb, { fascicolo: 'legale', limite: 300 })]);
    if (vivo) { setElenco(p); setDocs(d.filter((x) => !x.pratica_id)); }
  }); return () => { vivo = false; }; }, [ctx.esegui, ctx.versione]);
  const visibili = (elenco || []).filter((p) => filtro === 'tutte' || (filtro === 'aperte' ? ['aperta', 'in_corso'].includes(p.stato) : ['risolta', 'archiviata'].includes(p.stato)));
  return <>
    <h2>Legal</h2><p>Pratiche, recuperi crediti e contenziosi. Aggiornamenti manuali e documenti dalle scansioni nello stesso fascicolo.</p>
    <button className="pp-bottone" onClick={() => ctx.apri({ tipo: 'legal-modifica' })}>Nuova pratica</button>
    <Chips voci={[[ 'aperte', 'In corso' ], ['chiuse', 'Chiuse'], ['tutte', 'Tutte']]} attiva={filtro} onScegli={setFiltro} />
    {!elenco ? <Vuoto>Carico…</Vuoto> : <ElencoPratiche elenco={visibili} onApri={(p) => ctx.apri({ tipo: 'pratica', p })} />}
    <Sezione titolo="Documenti da collegare"><p className="pp-riga-meta">Documenti legali ancora senza pratica (ultimi 300 documenti). Apri una pratica per collegarli.</p><Gruppo>{docs.map((d) => <RigaDocumento key={d.id} doc={d} onApri={(x) => ctx.apri({ tipo: 'documento', id: x.id })} />)}</Gruppo>{!docs.length && <Vuoto>Nessun documento da collegare.</Vuoto>}</Sezione>
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
