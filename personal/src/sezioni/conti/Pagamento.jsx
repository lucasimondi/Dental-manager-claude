// Conti — scheda di un pagamento da fare: pagato / da pagare, modifica, documento di origine.
import { useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { RICORRENZE, aggiornaScadenza } from '../../lib/archivio.js';
import { CATEGORIE_PAGAMENTO } from '../../lib/conti.js';
import { segnaPagato, annullaPagato, rimettiDaPagare, eliminaPagamento, interrompiRicorrenza } from '../../lib/automatismi.js';
import { euro } from '../../lib/coreArchivio.js';
import { colore, dataBreve, oggiIso, quando, Sezione, Gruppo, Conferma } from '../../ui.jsx';
import { IconaPratiche, IconaPiu, IconaFreccia, IconaCalendario, IconaFile, IconaCestino } from '../../Icone.jsx';

export function PaginaPagamento({ s: iniziale, ctx, chiudi }) {
  const { esegui, aggiorna, mostra, apri } = ctx;
  const [s, setS] = useState(iniziale);
  const [conferma, setConferma] = useState(false);
  const [modifica, setModifica] = useState(null);
  const scaduto = !s.completata && s.data < oggiIso();
  const salvaModifica = () => esegui(async () => {
    const r = await aggiornaScadenza(archivioDb, s.id, modifica);
    setS({ ...s, ...r }); setModifica(null); aggiorna(); mostra('Pagamento aggiornato');
  });
  // POL-VITA-021 — tutto ciò che il Pagato crea da solo (spesa, prossimo fisso) si può annullare.
  const cambiaStato = (completata) => esegui(async () => {
    if (completata) {
      const r = await segnaPagato(archivioDb, s);
      setS({ ...s, completata: true }); aggiorna();
      mostra(r.messaggio, { etichetta: 'Annulla', fai: async () => { const m = await annullaPagato(archivioDb, r.annulla); setS((x) => ({ ...x, completata: false })); aggiorna(); return m; } });
    } else {
      const m = await rimettiDaPagare(archivioDb, s);
      setS({ ...s, completata: false }); aggiorna(); mostra(m);
    }
  });
  const [confermaStop, setConfermaStop] = useState(false);
  const fermaRicorrenza = () => esegui(async () => {
    const m = await interrompiRicorrenza(archivioDb, s);
    setS({ ...s, ricorrenza: null }); setConfermaStop(false); aggiorna(); mostra(m);
  });
  return (
    <>
      <div className="pp-dettaglio-testa" style={{ '--c': s.completata ? '#067647' : scaduto ? '#B42318' : '#0c447c' }}>
        <span className="pp-etichetta">{s.completata ? 'Pagato' : scaduto ? 'Scaduto' : 'Da pagare'}</span>
        <h2>{s.descrizione}</h2>
        {s.importo != null && <p className="pp-importo-grande">{euro(s.importo)}</p>}
        <p className="pp-riga-meta"><IconaCalendario size={14} /> {dataBreve(s.data)}{!s.completata ? ` · ${quando(s.data)}` : ''}</p>
        {(s.categoria || s.ricorrenza) && <p className="pp-riga-meta">{[s.categoria, RICORRENZE.find(([k]) => k === s.ricorrenza)?.[1]].filter(Boolean).join(' · ')}</p>}
      </div>
      <div className="pp-azioni">
        {s.completata
          ? <button className="pp-bottone pp-bottone-chiaro" onClick={() => cambiaStato(false)}>Segna da pagare</button>
          : <button className="pp-bottone pp-bottone-verde" onClick={() => cambiaStato(true)}>Segna come pagato</button>}
        {!modifica && <button className="pp-bottone pp-bottone-chiaro" onClick={() => setModifica({ descrizione: s.descrizione, data: s.data, importo: s.importo ?? '', categoria: s.categoria || '', ricorrenza: s.ricorrenza || '' })}>Modifica</button>}
      </div>
      {s.ricorrenza && (
        <div className="pp-elimina">
          {!confermaStop
            ? <button className="pp-testo-link" onClick={() => setConfermaStop(true)}>Non lo pago più: smetti di ripeterlo</button>
            : <Conferma testo="Non si ripete più: tolgo anche i pagamenti successivi creati in automatico ancora da pagare. Quelli già pagati restano." etichetta="Smetti"
              onNo={() => setConfermaStop(false)} onSi={fermaRicorrenza} />}
        </div>
      )}
      {modifica && (
        <div className="pp-modifica">
          <label className="pp-campo"><span>Descrizione</span><input value={modifica.descrizione} onChange={(e) => setModifica({ ...modifica, descrizione: e.target.value })} /></label>
          <div className="pp-due">
            <label className="pp-campo"><span>Data</span><input type="date" value={modifica.data} onChange={(e) => setModifica({ ...modifica, data: e.target.value })} /></label>
            <label className="pp-campo"><span>Importo (€)</span><input inputMode="decimal" value={modifica.importo} onChange={(e) => setModifica({ ...modifica, importo: e.target.value })} placeholder="nessuno" /></label>
          </div>
          <div className="pp-due">
            <label className="pp-campo"><span>Tipo</span>
              <select className="pp-select" value={modifica.categoria} onChange={(e) => setModifica({ ...modifica, categoria: e.target.value })}>
                <option value="">—</option>
                {[...new Set([...CATEGORIE_PAGAMENTO, ...(modifica.categoria ? [modifica.categoria] : [])])].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="pp-campo"><span>Si ripete</span>
              <select className="pp-select" value={modifica.ricorrenza} onChange={(e) => setModifica({ ...modifica, ricorrenza: e.target.value })}>
                {RICORRENZE.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
          </div>
          <div className="pp-azioni">
            <button className="pp-bottone" onClick={salvaModifica} disabled={!modifica.descrizione.trim() || !modifica.data}>Salva</button>
            <button className="pp-bottone pp-bottone-chiaro" onClick={() => setModifica(null)}>Annulla</button>
          </div>
        </div>
      )}
      <Sezione titolo="Da dove viene">
        {s.documento?.riassunto && <p className="pp-paragrafo">{s.documento.riassunto}</p>}
        {s.documento?.email_oggetto && <p className="pp-riga-meta">Email: {s.documento.email_oggetto}</p>}
        {!s.documento_id && !s.documento && <p className="pp-paragrafo">Nessun documento o email collegato: la fonte di questo pagamento non è verificabile dall’archivio. Puoi correggerlo o allegare una ricevuta.</p>}
        {s.documento || s.documento_id ? (
          <Gruppo>
            <button className="pp-riga" onClick={() => apri({ tipo: 'documento', id: s.documento?.id || s.documento_id })}>
              <span className="pp-riga-icona" style={{ '--c': colore(s.documento?.fascicolo) }}><IconaFile size={18} /></span>
              <span className="pp-riga-testo"><span className="pp-riga-titolo">{s.documento?.titolo || 'Documento di origine'}</span><span className="pp-riga-meta">Apri il documento</span></span>
              <IconaFreccia size={16} />
            </button>
          </Gruppo>
        ) : (
          <button className="pp-riga pp-riga-aggiungi pp-riga-sola" onClick={() => apri({ tipo: 'carica', opzioni: { pagamentoId: s.id, descrizione: s.descrizione } })}>
            <IconaPiu size={18} /><span>Allega la foto o il PDF (bolletta, polizza, ricevuta…)</span>
          </button>
        )}
        {s.pratica && (
          <Gruppo>
            <button className="pp-riga" onClick={() => apri({ tipo: 'pratica', p: s.pratica })}>
              <span className="pp-riga-icona" style={{ '--c': colore(s.documento?.fascicolo) }}><IconaPratiche size={18} /></span>
              <span className="pp-riga-testo"><span className="pp-riga-titolo">{s.pratica.titolo}</span><span className="pp-riga-meta">Pratica</span></span>
              <IconaFreccia size={16} />
            </button>
          </Gruppo>
        )}
      </Sezione>
      <div className="pp-elimina">
        {!conferma
          ? <button className="pp-testo-link pp-rosso" onClick={() => setConferma(true)}><IconaCestino size={16} /> Elimina questo pagamento</button>
          : <Conferma testo={`Eliminare questo pagamento?${s.completata ? ' Tolgo anche la spesa registrata nei Conti.' : ''} Il documento da cui deriva resta in archivio.`} onNo={() => setConferma(false)}
            onSi={() => esegui(async () => { mostra(await eliminaPagamento(archivioDb, s)); aggiorna(); chiudi(); })} />}
      </div>
    </>
  );
}
