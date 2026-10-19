import { useEffect, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { scadenzeRevisione, segnaScadenza, confermaDebito, documentiDaGestire, avviaRilettura } from '../../lib/archivio.js';
import { valutaScadenza, propostaDocumento } from '../../lib/revisioneArchivio.js';
import { Sezione, Gruppo, Vuoto, dataBreve, tokenSessione } from '../../ui.jsx';
import { euro } from '../../lib/coreArchivio.js';

export function RevisioneArchivio({ ctx }) {
  const [righe, setRighe] = useState(null);
  const [docs, setDocs] = useState([]);
  const [filtro, setFiltro] = useState('verifica');
  const { esegui, versione, apri, aggiorna, mostra } = ctx;
  useEffect(() => { esegui(async () => {
    const [s, d] = await Promise.all([scadenzeRevisione(archivioDb), documentiDaGestire(archivioDb)]);
    setRighe(s.filter((x) => !x.completata).map((x) => ({ ...x, valutazione: valutaScadenza(x) })));
    setDocs(d.filter((x) => x.fascicolo !== 'clinico_pazienti'));
  }); }, [esegui, versione]);
  const decidi = (s, pagata) => esegui(async () => {
    if (pagata) await segnaScadenza(archivioDb, s.id, true);
    else await confermaDebito(archivioDb, s);
    aggiorna(); mostra(pagata ? 'Verificato: nessuna spesa creata oggi' : 'Confermato tra i pagamenti da eseguire');
  });
  if (!righe) return <Vuoto>Controllo i documenti…</Vuoto>;
  const visibili = righe.filter((s) => s.valutazione.tipo === filtro);
  return <>
    <button className="pp-chip-azione" onClick={() => esegui(async () => { await avviaRilettura(await tokenSessione()); mostra('Rilettura accodata: procede a lotti quando il servizio AI è disponibile'); })}>Rileggi mail e allegati già archiviati</button>
    <div className="pp-filtri">{[['verifica', 'Da verificare'], ['opportunita', 'Inviti e opportunità'], ['promemoria', 'Termini e rinnovi']].map(([k, n]) => <button key={k} className={`pp-filtro${filtro === k ? ' attivo' : ''}`} onClick={() => setFiltro(k)}>{n} ({righe.filter((s) => s.valutazione.tipo === k).length})</button>)}</div>
    <p className="pp-frase">Ti sottopongo le cose da decidere. Una vecchia fattura non dimostra che oggi sia ancora da pagare.</p>
    {visibili.slice(0, 60).map((s) => <section className="pp-pannello" key={s.id}>
      <strong>{s.documento?.titolo || s.descrizione}</strong>
      <p className="pp-riga-meta">{dataBreve(s.data)}{s.importo != null ? ` · ${euro(s.importo)}` : ''}</p>
      {s.documento?.riassunto && <p>{s.documento.riassunto}</p>}
      <p><strong>Ti propongo:</strong> {s.valutazione.proposta}</p>
      <div className="pp-azioni">
        {s.documento_id && <button className="pp-chip-azione" onClick={() => apri({ tipo: 'documento', id: s.documento_id })}>Apri documento</button>}
        {s.documento_id && <button className="pp-chip-azione" onClick={() => ctx.apriChat({ id: s.documento_id, titolo: s.documento?.titolo })}>Indaga con Poliedron</button>}
        {filtro === 'verifica' ? <>
          <button className="pp-chip-azione" onClick={() => decidi(s, true)}>Già saldato / risolto</button>
          <button className="pp-chip-azione" onClick={() => decidi(s, false)}>Confermo: da pagare</button>
        </> : <button className="pp-chip-azione" onClick={() => decidi(s, true)}>Archivia avviso</button>}
      </div>
    </section>)}
    {visibili.length > 60 && <p>Mostro i primi 60: le altre voci restano disponibili dopo la revisione.</p>}
    {!visibili.length && <Vuoto>Nessuna voce in questa sezione.</Vuoto>}
    <Sezione titolo="Documenti importanti da sottoporre">
      <Gruppo>{docs.slice(0, 20).map((d) => <button key={d.id} className="pp-riga" onClick={() => apri({ tipo: 'documento', id: d.id })}><span className="pp-riga-testo"><strong>{d.titolo}</strong><span className="pp-riga-meta">{propostaDocumento(d)}</span></span></button>)}</Gruppo>
    </Sezione>
  </>;
}
