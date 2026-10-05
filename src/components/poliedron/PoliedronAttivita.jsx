import React, { useEffect, useState } from 'react';
import { Ic } from '../ui';
import { etichettaAttivita, dettaglioAttivita } from '../../lib/poliedron/attivita.js';

// POL-AI-010: "Attività di Poliedron" — everything Poliedron executed in this
// studio, newest first. Read-only: the rows are written by the server together
// with each action and cannot be edited or deleted.
const giorno = (iso) => new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Rome' }).format(new Date(iso));
const ora = (iso) => new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }).format(new Date(iso));

export default function PoliedronAttivita({ load, onClose }) {
  const [state, setState] = useState({ loading: true, rows: [], error: null });

  useEffect(() => {
    let active = true;
    Promise.resolve(load?.())
      .then((rows) => { if (active) setState({ loading: false, rows: rows || [], error: null }); })
      .catch(() => { if (active) setState({ loading: false, rows: [], error: 'Non riesco a caricare le attività. Riprova.' }); });
    return () => { active = false; };
  }, [load]);

  let ultimoGiorno = '';
  return (
    <section className="poliedron-attivita" aria-label="Attività di Poliedron">
      <header>
        <strong><Ic n="spark" s={15} /> Attività di Poliedron</strong>
        <button type="button" onClick={onClose} aria-label="Chiudi attività di Poliedron">Chiudi</button>
      </header>
      {state.loading && <p role="status">Carico le attività…</p>}
      {state.error && <p role="alert">{state.error}</p>}
      {!state.loading && !state.error && state.rows.length === 0 && (
        <p>Nessuna azione eseguita da Poliedron per ora.</p>
      )}
      <ol>
        {state.rows.map((r) => {
          const g = giorno(r.created_at);
          const intestazione = g !== ultimoGiorno ? (ultimoGiorno = g) : null;
          return (
            <li key={r.id}>
              {intestazione && <h3>{intestazione}</h3>}
              <div className="poliedron-attivita__item" data-azione={r.azione}>
                <time dateTime={r.created_at}>{ora(r.created_at)}</time>
                <div>
                  <strong>{etichettaAttivita(r.azione)}</strong>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{dettaglioAttivita(r.riepilogo)}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
