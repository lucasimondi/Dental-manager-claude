import React, { useEffect, useState } from 'react';
import { Ic } from '../ui';
import { etichettaAttivita, dettaglioAttivita, idsRipristinati, puoRipristinare } from '../../lib/poliedron/attivita.js';
import { riepilogoStatistiche } from '../../lib/poliedron/statistiche.js';

// POL-AI-010: "Attività di Poliedron" — everything Poliedron executed in this
// studio, newest first. The rows are written by the server together with each
// action and cannot be edited or deleted; "Ripristina" undoes one action in the
// database (itself logged as a new row).
const giorno = (iso) => new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Rome' }).format(new Date(iso));
const ora = (iso) => new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }).format(new Date(iso));

// POL-AI-011: how Poliedron answered in the last 30 days — share closed by the
// Core without the model, and what still goes to the model (the next things to
// bring into the Core). Hidden when there is no data or it cannot be read.
function ComeRisponde({ loadStats }) {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    let active = true;
    Promise.resolve(loadStats?.()).then((s) => { if (active) setStats(riepilogoStatistiche(s)); }).catch(() => {});
    return () => { active = false; };
  }, [loadStats]);
  if (!stats) return null;
  const elenco = (titolo, righe) => righe.length > 0 && (
    <>
      <h3>{titolo}</h3>
      <ul>{righe.slice(0, 5).map((r) => <li key={r.etichetta}>{r.etichetta} <small>{r.n}</small></li>)}</ul>
    </>
  );
  return (
    <div className="poliedron-attivita__stats" aria-label="Come risponde Poliedron">
      <p>
        <strong>Ultimi {stats.giorni} giorni: {stats.richieste} richieste.</strong>{' '}
        Senza modello AI (Core): {stats.core.pct}%. Con il modello AI: {stats.modello.pct}%.
        {stats.essenziale.n > 0 && ` Modalità essenziale: ${stats.essenziale.pct}%.`}
      </p>
      {elenco('Il Core ha risolto', stats.intentiCore)}
      {elenco('Il modello AI ha usato', stats.azioniModello)}
      {elenco('Capite dal Core ma passate al modello', stats.passateAlModello)}
    </div>
  );
}

export default function PoliedronAttivita({ load, loadStats, onRestore, onClose }) {
  const [state, setState] = useState({ loading: true, rows: [], error: null });
  const [reloadKey, setReloadKey] = useState(0);
  // { id, phase: 'confirm' | 'running' | 'error', message }
  const [restore, setRestore] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.resolve(load?.())
      .then((rows) => { if (active) setState({ loading: false, rows: rows || [], error: null }); })
      .catch(() => { if (active) setState({ loading: false, rows: [], error: 'Non riesco a caricare le attività. Riprova.' }); });
    return () => { active = false; };
  }, [load, reloadKey]);

  const ripristinati = idsRipristinati(state.rows);
  const eseguiRipristino = async (row) => {
    setRestore({ id: row.id, phase: 'running' });
    try {
      await onRestore(row);
      setRestore(null);
      setReloadKey((k) => k + 1);
    } catch (error) {
      setRestore({ id: row.id, phase: 'error', message: error?.message || 'Ripristino non riuscito.' });
    }
  };

  let ultimoGiorno = '';
  return (
    <section className="poliedron-attivita" aria-label="Attività di Poliedron">
      <header>
        <strong><Ic n="spark" s={15} /> Attività di Poliedron</strong>
        <button type="button" onClick={onClose} aria-label="Chiudi attività di Poliedron">Chiudi</button>
      </header>
      {loadStats && <ComeRisponde loadStats={loadStats} />}
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
                  <p style={{ whiteSpace: 'pre-wrap' }}>{r.azione === 'ripristino' ? r.riepilogo : dettaglioAttivita(r.riepilogo)}</p>
                  {ripristinati.has(r.id) && <small>Ripristinata</small>}
                  {onRestore && puoRipristinare(r, ripristinati) && (
                    restore?.id === r.id && restore.phase === 'confirm' ? (
                      <span className="poliedron-attivita__restore">
                        <button type="button" onClick={() => eseguiRipristino(r)}>Conferma ripristino</button>
                        <button type="button" onClick={() => setRestore(null)}>No</button>
                      </span>
                    ) : (
                      <span className="poliedron-attivita__restore">
                        <button
                          type="button"
                          disabled={restore?.phase === 'running'}
                          onClick={() => setRestore({ id: r.id, phase: 'confirm' })}
                        >
                          {restore?.id === r.id && restore.phase === 'running' ? 'Ripristino…' : 'Ripristina'}
                        </button>
                      </span>
                    )
                  )}
                  {restore?.id === r.id && restore.phase === 'error' && <p role="alert">{restore.message}</p>}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
