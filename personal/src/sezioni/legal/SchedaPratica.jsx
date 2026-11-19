// LEGAL-SCHEDE (PO 2026-11-18): la scheda di una pratica — in sintesi, punti salienti, da attenzionare, passi da
// fare. Scritta leggendo i documenti (mai quelli dei pazienti); i passi sono anche in «Da fare».
import { useCallback, useEffect, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { schedaPratica, passiPratica, segnaPasso, aggiungiPasso, analizzaPratica, confermaScheda, filoOrdinato, STATI_ANALISI } from '../../lib/legal.js';
import { euro } from '../../lib/coreArchivio.js';
import { tokenSessione, dataBreve } from '../../ui.jsx';

// «doc N»: N è la posizione del documento fra quelli letti per la scheda, uguale in tutti i punti.
function Fonti({ ids, fonti = [], ctx }) {
  if (!ids?.length) return null;
  return <span className="pp-sp-fonti">{ids.map((id) => { const n = fonti.indexOf(id) + 1 || '·'; return <button key={id} type="button" className="pp-sp-fonte" onClick={() => ctx.apri({ tipo: 'documento', id })} aria-label={`Apri il documento ${n}`}>doc {n}</button>; })}</span>;
}

export function SchedaPratica({ p, ctx, onDati, parte = 'tutto' }) {
  const [scheda, setScheda] = useState(undefined), [passi, setPassi] = useState([]);
  const [stato, setStato] = useState(''), [nuovo, setNuovo] = useState({ testo: '', entro: '' });
  const carica = useCallback(async () => {
    const [s, ps] = await Promise.all([schedaPratica(archivioDb, p.id), passiPratica(archivioDb, p.id)]);
    setScheda(s || null); setPassi(ps || []);
  }, [p.id]);
  useEffect(() => { carica().catch(() => setScheda(null)); }, [carica, ctx.versione]);
  // PRATICHE-PER-NOME: la pagina della pratica mostra in cima quante date e quanti passi ci sono.
  useEffect(() => { if (scheda !== undefined) onDati?.({ filo: filoOrdinato(scheda?.filo).length, passi }); }, [scheda, passi, onDati]);
  const analizza = async () => {
    setStato('Leggo i documenti della pratica…');
    try {
      const r = await analizzaPratica({ token: await tokenSessione(), praticaId: p.id });
      await carica(); setStato(''); ctx.mostra?.(r.passi_nuovi ? `Scheda aggiornata · ${r.passi_nuovi} passi nuovi in Da fare` : 'Scheda aggiornata');
    } catch (e) { setStato(e.message); }
  };
  const spunta = (x) => ctx.esegui(async () => { const fatto = x.stato !== 'gestito'; await segnaPasso(archivioDb, x.id, fatto); setPassi((l) => l.map((y) => (y.id === x.id ? { ...y, stato: fatto ? 'gestito' : 'aperto' } : y))); });
  const aggiungi = (e) => { e.preventDefault(); ctx.esegui(async () => { const r = await aggiungiPasso(archivioDb, p, nuovo.testo, nuovo.entro); setPassi((l) => [...l, r]); setNuovo({ testo: '', entro: '' }); }); };
  if (scheda === undefined) return null;
  const aperti = passi.filter((x) => x.stato !== 'gestito').length;
  return (
    <section className="pp-sp" aria-label="Scheda della pratica">
      {parte === 'passi' ? null : !scheda ? (
        <div className="pp-sp-vuota">
          <p>Nessuna scheda ancora. Poliedron legge i documenti e scrive sintesi, punti salienti, cose da attenzionare e passi da fare.</p>
          <button type="button" className="pp-bottone" disabled={!!stato && stato.endsWith('…')} onClick={analizza}>{stato.endsWith('…') ? stato : 'Analizza la pratica'}</button>
          {stato && !stato.endsWith('…') && <p className="pp-messaggio pp-messaggio-errore" role="alert">{stato}</p>}
        </div>
      ) : <>
        <div className="pp-sp-blocco pp-sp-sintesi">
          <h3>In sintesi</h3>
          {scheda.oggetto && <p className="pp-sp-oggetto">{scheda.oggetto}</p>}
          <dl className="pp-sp-dati">
            {scheda.controparte && <><dt>Controparte</dt><dd>{scheda.controparte}</dd></>}
            {scheda.autorita && <><dt>Davanti a</dt><dd>{scheda.autorita}</dd></>}
            {scheda.importo != null && <><dt>In gioco</dt><dd>{euro(scheda.importo)}</dd></>}
          </dl>
          {scheda.sintesi && <p>{scheda.sintesi}</p>}
        </div>
        {scheda.parti?.length > 0 && <div className="pp-sp-blocco"><h3>Parti</h3><ul className="pp-sp-parti">{scheda.parti.map((x, i) => <li key={i}><strong>{x.nome}</strong>{x.ruolo && <span> · {x.ruolo}</span>}</li>)}</ul></div>}
        {filoOrdinato(scheda.filo).length > 0 && <div id="pp-sez-filo" className="pp-sp-blocco pp-sp-filo"><h3>Filo temporale · date e fatti</h3><ol>{filoOrdinato(scheda.filo).map((x, i) => (
          <li key={i}><span className="pp-sp-filo-data">{x.data ? dataBreve(x.data) : 'senza data'}</span><span className="pp-sp-filo-evento">{x.evento}{x.chi && <em> · {x.chi}</em>}{x.importo != null && <em> · {euro(x.importo)}</em>}{x.rif && <em> · {x.rif}</em>} <Fonti ids={x.doc ? [].concat(x.doc) : []} fonti={scheda.fonti} ctx={ctx} /></span></li>))}</ol></div>}
        {scheda.punti?.length > 0 && <div className="pp-sp-blocco"><h3>Punti salienti</h3><ol>{scheda.punti.map((x, i) => <li key={i}>{x.testo} <Fonti ids={x.doc} fonti={scheda.fonti} ctx={ctx} /></li>)}</ol></div>}
        {scheda.attenzione?.length > 0 && <div className="pp-sp-blocco pp-sp-attenzione"><h3>Da attenzionare</h3><ul>{scheda.attenzione.map((x, i) => <li key={i}>{x.testo} <Fonti ids={x.doc} fonti={scheda.fonti} ctx={ctx} /></li>)}</ul></div>}
        {scheda.mancanti?.length > 0 && <div className="pp-sp-blocco pp-sp-mancanti"><h3>Documenti mancanti</h3><ul>{scheda.mancanti.map((x, i) => <li key={i}>{x.cosa}{x.perche && <span className="pp-riga-meta"> — {x.perche}</span>}</li>)}</ul></div>}
      </>}
      {parte !== 'scheda' && <div id="pp-sez-passi" className="pp-sp-blocco pp-sp-passi">
        <h3>Passi da fare{passi.length ? ` · ${aperti} aperti` : ''}</h3>
        {passi.length > 0 && <ul>{[...passi].sort((a, b) => (a.stato === 'gestito') - (b.stato === 'gestito') || String(a.scadenza || '9999').localeCompare(String(b.scadenza || '9999'))).map((x) => (
          <li key={x.id} className={x.stato === 'gestito' ? 'fatto' : ''}>
            <label><input type="checkbox" checked={x.stato === 'gestito'} onChange={() => spunta(x)} /><span>{x.titolo}{x.scadenza && <em> · entro {dataBreve(x.scadenza)}</em>}</span></label>
          </li>))}</ul>}
        <form className="pp-sp-nuovo" onSubmit={aggiungi}>
          <input aria-label="Nuovo passo" placeholder="Aggiungi un passo…" value={nuovo.testo} onChange={(e) => setNuovo({ ...nuovo, testo: e.target.value })} />
          <input aria-label="Entro il" type="date" value={nuovo.entro} onChange={(e) => setNuovo({ ...nuovo, entro: e.target.value })} />
          <button type="submit" className="pp-bottone pp-bottone-chiaro" disabled={!nuovo.testo.trim()}>Aggiungi</button>
        </form>
        <p className="pp-riga-meta">I passi compaiono anche in «Da fare».</p>
      </div>}
      {scheda && parte !== 'passi' && <div className={`pp-sp-verifica pp-sp-verifica-${scheda.stato_analisi || 'analizzata'}`}>
        <span>{STATI_ANALISI[scheda.stato_analisi] || 'Da verificare'}{scheda.verificata_il && ` il ${dataBreve(scheda.verificata_il)}`}</span>
        {scheda.stato_analisi === 'verificata'
          ? <button type="button" className="pp-testo-link" onClick={() => ctx.esegui(async () => { await confermaScheda(archivioDb, p.id, false); await carica(); })}>Togli conferma</button>
          : <button type="button" className="pp-bottone pp-bottone-verde" onClick={() => ctx.esegui(async () => { await confermaScheda(archivioDb, p.id, true); await carica(); ctx.mostra?.('Scheda confermata'); })}>Conferma</button>}
      </div>}
      {scheda && parte !== 'passi' && <div className="pp-sp-piede">
        <span className="pp-riga-meta">Scritta il {dataBreve(scheda.generata_il)}{scheda.modello === 'claude-code' ? ' da Claude Code' : ''} leggendo {scheda.fonti?.length || 0} documenti. Non è un parere legale.</span>
        <button type="button" className="pp-testo-link" disabled={stato.endsWith('…')} onClick={analizza}>{stato.endsWith('…') ? stato : 'Aggiorna analisi'}</button>
        {stato && !stato.endsWith('…') && <p className="pp-messaggio pp-messaggio-errore" role="alert">{stato}</p>}
      </div>}
    </section>
  );
}
