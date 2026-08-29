import React, { useEffect, useMemo, useState } from 'react';
import { C } from '../lib/utils';
import { fetchSaldiApertiStudio } from '../lib/domain/incassiService.js';
import { Crd, EmptyState, ErrorState, LoadingState, PageHeader } from './ui';

const euro = (value) => Number(value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const today = () => new Date().toISOString().slice(0, 10);

const readSort = (studioId) => {
  try { return localStorage.getItem(`pol_incassi_sort:${studioId}`) === 'giorni' ? 'giorni' : 'saldo'; }
  catch { return 'saldo'; }
};

export default function Incassi({ studioId, patients = [], payments = [], onOpenPaz, embedded = false }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState(() => readSort(studioId));
  const [period, setPeriod] = useState('mese');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    fetchSaldiApertiStudio(studioId)
      .then((data) => { if (active) setRows(data); })
      .catch((cause) => { if (active) setError(cause?.message || 'Impossibile caricare i saldi aperti.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [studioId, reloadKey]);

  const patientById = useMemo(() => new Map(patients.map((patient) => [String(patient.id), patient])), [patients]);
  const sortedRows = useMemo(() => [...rows].sort((a, b) => sortBy === 'giorni'
    ? Number(b.giorni_apertura || 0) - Number(a.giorni_apertura || 0) || Number(b.saldo_piano || 0) - Number(a.saldo_piano || 0)
    : Number(b.saldo_piano || 0) - Number(a.saldo_piano || 0) || Number(b.giorni_apertura || 0) - Number(a.giorni_apertura || 0)), [rows, sortBy]);

  const changeSort = (value) => {
    setSortBy(value);
    try { localStorage.setItem(`pol_incassi_sort:${studioId}`, value); } catch { /* optional preference */ }
  };

  const currentPrefix = today().slice(0, period === 'mese' ? 7 : 4);
  const collected = payments
    .filter((payment) => String(payment.stato || '').toLowerCase() === 'pagato' && String(payment.data || '').startsWith(currentPrefix))
    .reduce((sum, payment) => sum + Number(payment.importo || 0), 0);
  const outstanding = rows.reduce((sum, row) => sum + Number(row.saldo_piano || 0), 0);

  const openPatient = (row) => {
    const patient = patientById.get(String(row.paziente_id));
    if (patient) onOpenPaz?.(patient, 'paga');
  };

  return (
    <section className={`incassi-page${embedded ? ' is-embedded' : ''}`}>
      {!embedded && <PageHeader icon="pay" title="Incassi" subtitle="Pagamenti ricevuti e saldi ancora aperti" />}
      <div className="incassi-toolbar">
        <div className="incassi-period" aria-label="Periodo incassato">
          {[['mese', 'Questo mese'], ['anno', "Quest'anno"]].map(([id, label]) => (
            <button key={id} type="button" className={`pol-tab${period === id ? ' is-active' : ''}`} onClick={() => setPeriod(id)}>{label}</button>
          ))}
        </div>
        <label className="incassi-sort">Ordina
          <select value={sortBy} onChange={(event) => changeSort(event.target.value)}>
            <option value="saldo">Importo più alto</option>
            <option value="giorni">Attesa più lunga</option>
          </select>
        </label>
      </div>

      <div className="incassi-kpis">
        <Crd className="incassi-kpi is-collected"><span>Incassato</span><strong>{euro(collected)}</strong><small>{period === 'mese' ? 'nel mese corrente' : "nell'anno corrente"}</small></Crd>
        <Crd className="incassi-kpi is-outstanding"><span>Da incassare</span><strong>{euro(outstanding)}</strong><small>saldo totale dei piani aperti</small></Crd>
      </div>

      <Crd className="incassi-worklist">
        <div className="incassi-worklist__header"><div><strong>Saldi aperti</strong><span>{rows.length} {rows.length === 1 ? 'piano' : 'piani'}</span></div></div>
        {loading && <LoadingState title="Caricamento saldi…" />}
        {!loading && error && <ErrorState title="Saldi non disponibili" message={error} onRetry={() => setReloadKey((key) => key + 1)} />}
        {!loading && !error && sortedRows.length === 0 && <EmptyState icon="ok" title="Nessun saldo aperto" subtitle="Tutti i piani risultano saldati." />}
        {!loading && !error && sortedRows.length > 0 && (
          <div className="incassi-list">
            {sortedRows.map((row) => {
              const patient = patientById.get(String(row.paziente_id));
              const patientName = patient ? `${patient.nome || ''} ${patient.cognome || ''}`.trim() : `Paziente #${row.paziente_id}`;
              return (
                <button type="button" className="incassi-row" key={row.piano_id} onClick={() => openPatient(row)} disabled={!patient}>
                  <span className="incassi-row__identity"><strong>{patientName}</strong><small>{row.titolo || 'Piano'} · aperto da {Number(row.giorni_apertura || 0)} giorni</small></span>
                  <span className="incassi-row__amount">{euro(row.saldo_piano)}</span>
                </button>
              );
            })}
          </div>
        )}
        <p className="incassi-note">I pagamenti sono compensati solo tra i piani dello stesso paziente; gli acconti non vengono mai spostati tra pazienti diversi.</p>
      </Crd>
    </section>
  );
}
