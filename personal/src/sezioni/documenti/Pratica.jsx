// Documenti — una pratica: stato, pagamenti e documenti in ordine di tempo.
import { useCallback, useEffect, useRef, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { documentiDellaPratica, cambiaStatoPratica, praticaCompleta } from '../../lib/archivio.js';
import { collegaLegal, scadenzaLegal } from '../../lib/legal.js';
import { cercaArchivio, segnaScadenza, scadenzeDeiDocumenti } from '../../lib/archivio.js';
import { euro } from '../../lib/coreArchivio.js';
import { colore, dataBreve, titoloDoc, Vuoto, Sezione, Gruppo, RigaPagamento } from '../../ui.jsx';
import { Miniatura } from '../../Miniatura.jsx';

const STATI_PRATICA = { aperta: 'Aperta', in_corso: 'In corso', risolta: 'Risolta', archiviata: 'Archiviata' };

export function PaginaPratica({ p: base, ctx }) {
  const { esegui, apri, aggiorna, pagato, mostra, fascicoli } = ctx;
  const [p, setP] = useState(base);
  const [documenti, setDocumenti] = useState(null);
  const [candidati, setCandidati] = useState(null), [busy, setBusy] = useState(false);
  const [termine, setTermine] = useState({ data: '', descrizione: '' });
  const legal = p.fascicolo === 'legale';
  const lock = useRef(false);
  const operazione = (fn) => { if (lock.current) return; lock.current = true; setBusy(true); return esegui(fn).finally(() => { lock.current = false; setBusy(false); }); };
  const carica = useCallback(() => esegui(async () => {
    const [completa, docs] = await Promise.all([praticaCompleta(archivioDb, base.id), documentiDellaPratica(archivioDb, base.id)]);
    if (completa.fascicolo === 'legale' && docs.length) {
      const collegate = await scadenzeDeiDocumenti(archivioDb, docs.map((d) => d.id));
      completa.scadenze = [...new Map([...(completa.scadenze || []), ...collegate].map((s) => [s.id, s])).values()].sort((a, b) => String(a.data).localeCompare(String(b.data)));
    }
    setP((x) => ({ ...x, ...completa })); setDocumenti(docs);
  }), [esegui, base.id]);
  useEffect(() => { carica(); }, [carica]);
  const cambiaStato = (stato) => esegui(async () => { await cambiaStatoPratica(archivioDb, p.id, stato); setP({ ...p, stato }); aggiorna(); mostra(`Pratica ${STATI_PRATICA[stato].toLowerCase()}`); });

  const scadenze = p.scadenze || [];
  const aperte = scadenze.filter((s) => !s.completata);
  const daPagare = aperte.reduce((t, s) => t + Number(s.importo || 0), 0);
  const totaleDoc = (documenti || []).reduce((t, d) => t + Number(d.importo || 0), 0);
  const c = colore(p.fascicolo);
  // Documenti in ordine di tempo, raggruppati per anno.
  const perAnno = (documenti || []).reduce((g, d) => { const a = String(d.data_documento || d.email_data || '').slice(0, 4) || '—'; (g[a] ||= []).push(d); return g; }, {});

  return (
    <>
      <div className="pp-pratica-testa" style={{ '--c': c }}>
        <span className="pp-pratica-fascicolo">{fascicoli.find((f) => f.codice === p.fascicolo)?.nome || p.fascicolo || 'Pratica'}</span>
        <h2>{p.titolo}</h2>
        <span className="pp-pratica-stati">
          <span className={`pp-stato pp-stato-${p.stato}`}>{STATI_PRATICA[p.stato] || p.stato}</span>
          {p.urgenza === 'alta' && <span className="pp-stato pp-stato-urgente">Urgente</span>}
        </span>
        {p.note && <p className="pp-pratica-note" style={{ whiteSpace: 'pre-wrap' }}>{p.note}</p>}
      </div>
      <div className="pp-numeri">
        <div><strong>{documenti ? documenti.length : '…'}</strong><span>documenti</span></div>
        <div><strong>{legal ? aperte.length : aperte.length ? euro(daPagare) : '—'}</strong><span>{legal ? 'termini da verificare' : 'da pagare'}</span></div>
        <div><strong>{p.prossima_scadenza ? dataBreve(p.prossima_scadenza).replace(/ \d{4}$/, '') : '—'}</strong><span>prossima scadenza</span></div>
      </div>
      <div className="pp-azioni">
        {legal && <button className="pp-bottone pp-bottone-chiaro" onClick={() => apri({ tipo: 'legal-modifica', p })}>Modifica / aggiorna a mano</button>}
        {legal && <button className="pp-bottone pp-bottone-chiaro" disabled={busy} onClick={() => operazione(async () => setCandidati((await cercaArchivio(archivioDb, { fascicolo: 'legale', limite: 300 })).filter((d) => !d.pratica_id)))}>Collega documento archiviato</button>}

        {['aperta', 'in_corso'].includes(p.stato)
          ? <button className="pp-bottone pp-bottone-verde" onClick={() => cambiaStato('risolta')}>Segna risolta</button>
          : <button className="pp-bottone pp-bottone-chiaro" onClick={() => cambiaStato('aperta')}>Riapri</button>}
        {p.stato === 'aperta' && <button className="pp-bottone pp-bottone-chiaro" onClick={() => cambiaStato('in_corso')}>In corso</button>}
      </div>
      {legal && <Sezione titolo="Aggiungi scadenza o prossima azione">
        <form onSubmit={(e) => { e.preventDefault(); operazione(async () => { await scadenzaLegal(archivioDb, p.id, termine.data, termine.descrizione); setTermine({ data: '', descrizione: '' }); await carica(); aggiorna(); mostra('Scadenza salvata'); }); }}>
          <label className="pp-campo"><span>Data</span><input required type="date" value={termine.data} onChange={(e) => setTermine({ ...termine, data: e.target.value })} /></label>
          <label className="pp-campo"><span>Cosa fare</span><input required value={termine.descrizione} onChange={(e) => setTermine({ ...termine, descrizione: e.target.value })} /></label>
          <button className="pp-bottone" disabled={busy}>Aggiungi scadenza</button>
        </form>
      </Sezione>}
      {legal && candidati && <Sezione titolo="Scegli documento da collegare (ultimi 300)">
        {!candidati.length && <Vuoto>Nessun documento legale senza pratica.</Vuoto>}
        {candidati.map((d) => <button className="pp-riga" disabled={busy} key={d.id} onClick={() => operazione(async () => { await collegaLegal(archivioDb, d.id, p.id); setCandidati((xs) => xs.filter((x) => x.id !== d.id)); await carica(); aggiorna(); mostra('Documento collegato'); })}>{titoloDoc(d)}</button>)}
      </Sezione>}
      {legal && scadenze.length > 0 && <Sezione titolo="Termini e scadenze"><Gruppo>{scadenze.map((s) => <div className="pp-riga" key={s.id}>
        <span className="pp-riga-testo"><strong>{s.descrizione}</strong><span className="pp-riga-meta">{dataBreve(s.data)} · {s.completata ? 'Completata' : s.storica ? 'Storica, da verificare' : 'Da gestire'}</span></span>
        {!s.completata && !s.storica && <button className="pp-chip-azione" disabled={busy} onClick={() => operazione(async () => { await segnaScadenza(archivioDb, s.id); await carica(); aggiorna(); })}>Fatta</button>}
      </div>)}</Gruppo></Sezione>}
      {!legal && scadenze.length > 0 && (
        <Sezione titolo="Pagamenti e scadenze">
          <Gruppo>{scadenze.map((s) => <RigaPagamento key={s.id} s={s} onApri={(x) => apri({ tipo: 'pagamento', s: x })} onPagato={async (x) => { await pagato(x); carica(); }} />)}</Gruppo>
        </Sezione>
      )}
      <Sezione titolo="Documenti" azione={!legal && totaleDoc > 0 ? <span className="pp-riga-meta">{euro(totaleDoc)} in totale</span> : null}>
        {!documenti ? <Vuoto>Carico…</Vuoto> : !documenti.length ? <Vuoto>Nessun documento.</Vuoto> : (
          <div className="pp-cronologia">
            {Object.entries(perAnno).map(([anno, docs]) => (
              <div key={anno}>
                <h3 className="pp-cronologia-anno">{anno}</h3>
                {docs.map((d) => (
                  <button key={d.id} className="pp-cronologia-voce" onClick={() => apri({ tipo: 'documento', id: d.id })}>
                    <Miniatura doc={d} colore={c} />
                    <span className="pp-riga-testo">
                      <span className="pp-riga-titolo">{titoloDoc(d)}</span>
                      <span className="pp-riga-meta">{[dataBreve(d.data_documento || d.email_data), d.tipo_documento].filter(Boolean).join(' · ')}</span>
                      {d.riassunto && <span className="pp-cronologia-riassunto">{d.riassunto}</span>}
                    </span>
                    {d.importo != null && <span className="pp-riga-importo">{euro(d.importo)}</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </Sezione>
    </>
  );
}
