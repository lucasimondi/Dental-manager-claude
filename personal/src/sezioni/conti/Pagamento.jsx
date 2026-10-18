// Conti — scheda di un pagamento da fare: pagato / da pagare, modifica, documento di origine.
import { useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { segnaScadenza, eliminaScadenza, prossimoPagamentoFisso, RICORRENZE, aggiornaScadenza } from '../../lib/archivio.js';
import { spesaDaScadenza, annullaSpesaDaScadenza, CATEGORIE_PAGAMENTO } from '../../lib/conti.js';
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
  const cambiaStato = (completata) => esegui(async () => {
    await segnaScadenza(archivioDb, s.id, completata);
    // Pagato → spesa nei Conti; di nuovo da pagare → la spesa automatica si toglie.
    const spesa = completata ? await spesaDaScadenza(archivioDb, s).catch(() => null) : (await annullaSpesaDaScadenza(archivioDb, s.id).catch(() => null), null);
    const prossimo = completata && s.ricorrenza ? await prossimoPagamentoFisso(archivioDb, s).catch(() => null) : null;
    setS({ ...s, completata }); aggiorna();
    mostra([completata ? (spesa ? 'Pagato e registrato tra le spese' : 'Segnato come pagato') : 'Segnato da pagare', prossimo ? `prossimo il ${dataBreve(prossimo.data)}` : null].filter(Boolean).join(' · '));
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
          : <Conferma testo="Eliminare questo pagamento? Il documento da cui deriva resta in archivio." onNo={() => setConferma(false)}
            onSi={() => esegui(async () => { await eliminaScadenza(archivioDb, s.id); aggiorna(); mostra('Pagamento eliminato'); chiudi(); })} />}
      </div>
    </>
  );
}
