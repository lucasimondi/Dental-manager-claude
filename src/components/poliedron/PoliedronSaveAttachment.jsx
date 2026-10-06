import React, { useMemo, useState } from 'react';
import { Ic } from '../ui';
import { cercaPazienti } from '../../lib/ricercaPazienti.js';

const nomePaziente = (p) => [p?.nome, p?.cognome].filter(Boolean).join(' ') || 'Paziente';

/* POL-AI-011 — conferma "Salva nella scheda": il file allegato in chat va
   nella sezione Foto della scheda del paziente scelto. Il paziente è già
   selezionato quando la richiesta lo nomina senza ambiguità; altrimenti si
   cerca qui. Niente viene salvato senza il tocco su "Salva". */
export default function PoliedronSaveAttachment({ attachment, candidates = [], patients = [], busy = false, onSave, onCancel }) {
  const [selected, setSelected] = useState(candidates.length === 1 ? candidates[0] : null);
  const [query, setQuery] = useState('');
  const results = useMemo(() => {
    if (query.trim()) return cercaPazienti(patients, query).slice(0, 6);
    return candidates.slice(0, 6);
  }, [candidates, patients, query]);

  if (!attachment) {
    return (
      <div className="poliedron-save" role="status">
        <p>Allega prima il file da salvare con la graffetta.</p>
        <div className="poliedron-save__actions"><button type="button" onClick={onCancel}>Chiudi</button></div>
      </div>
    );
  }

  return (
    <div className="poliedron-save" role="group" aria-label="Salva il file nella scheda del paziente">
      <p className="poliedron-save__title">
        <Ic n="folder" s={15} />
        <span>Salva <strong>{attachment.name}</strong> nella scheda del paziente (sezione Foto)</span>
      </p>
      {selected ? (
        <div className="poliedron-save__selected">
          <span>Paziente: <strong>{nomePaziente(selected)}</strong></span>
          <button type="button" onClick={() => setSelected(null)} disabled={busy}>Cambia</button>
        </div>
      ) : (
        <>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cerca il paziente per nome o telefono"
            aria-label="Cerca il paziente"
            autoFocus
          />
          {results.length > 0 && (
            <ul className="poliedron-save__list">
              {results.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => setSelected(p)}>{nomePaziente(p)}{p.data_nascita || p.dataNascita ? <small> · {p.data_nascita || p.dataNascita}</small> : null}</button>
                </li>
              ))}
            </ul>
          )}
          {query.trim() && results.length === 0 && <p className="poliedron-save__empty">Nessun paziente trovato.</p>}
        </>
      )}
      <div className="poliedron-save__actions">
        <button type="button" onClick={onCancel} disabled={busy}>Annulla</button>
        <button type="button" className="is-primary" onClick={() => onSave?.(selected)} disabled={!selected || busy} aria-busy={busy}>
          {busy ? 'Salvo…' : 'Salva nella scheda'}
        </button>
      </div>
    </div>
  );
}
