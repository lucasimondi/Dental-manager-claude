import React, { useEffect, useState } from 'react';
import { Ic } from '../ui';
import { CATEGORIA_LABEL, deleteMemoria, listMemoria } from '../../lib/poliedron/memoryRepository.js';

/* POL-AI-009 — "Cosa ricorda Poliedron": le voci della memoria dell'utente
   (solo le sue, per RLS), con la possibilità di cancellarle una per una. */
export default function PoliedronMemoryPanel({ client, onClose }) {
  const [voci, setVoci] = useState(null);
  const [errore, setErrore] = useState('');
  const [inCancellazione, setInCancellazione] = useState(null);

  useEffect(() => {
    let attivo = true;
    listMemoria(client)
      .then((righe) => { if (attivo) setVoci(righe); })
      .catch(() => { if (attivo) { setVoci([]); setErrore('La memoria di Poliedron non è disponibile in questo momento.'); } });
    return () => { attivo = false; };
  }, [client]);

  const cancella = async (id) => {
    setInCancellazione(id);
    setErrore('');
    try {
      await deleteMemoria(client, id);
      setVoci((correnti) => (correnti || []).filter((v) => v.id !== id));
    } catch {
      setErrore('Non sono riuscito a cancellare questa voce. Riprova.');
    } finally {
      setInCancellazione(null);
    }
  };

  return (
    <section className="poliedron-memory" aria-label="Cosa ricorda Poliedron">
      <header className="poliedron-memory__header">
        <div>
          <h2>Cosa ricorda Poliedron</h2>
          <p>Lo impara da ciò che gli dici e dalle ricette che generi. Solo tu vedi queste voci.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Chiudi la memoria"><Ic n="x" s={16} /></button>
      </header>
      {errore && <div className="poliedron-memory__error" role="alert">{errore}</div>}
      {voci === null && <p className="poliedron-memory__empty">Carico…</p>}
      {voci && voci.length === 0 && !errore && (
        <p className="poliedron-memory__empty">Ancora niente. Scrivi per esempio "Ricorda che preferisco risposte brevi".</p>
      )}
      {voci && voci.length > 0 && (
        <ul className="poliedron-memory__list">
          {voci.map((voce) => (
            <li key={voce.id}>
              <div>
                <small>{CATEGORIA_LABEL[voce.categoria] || 'Altro'}{voce.origine === 'ricetta' ? ' · da una ricetta' : ''}</small>
                <span>{voce.testo}</span>
              </div>
              <button
                type="button"
                onClick={() => cancella(voce.id)}
                disabled={inCancellazione === voce.id}
                aria-label={`Dimentica: ${voce.testo}`}
              >
                <Ic n="del" s={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
