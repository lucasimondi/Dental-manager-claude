import React, { useEffect, useMemo, useState } from 'react';
import { fmt } from '../lib/utils';
import { supabase } from '../lib/supabase.js';
import { loadCanonicalFinancialSnapshot, MANAGEMENT_CONTROL_MODES } from '../lib/canonicalFinancialSelectors';
import CanonicalManagementView from './CanonicalManagementView.jsx';
import { Crd, EmptyState } from './ui';

const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const ymd = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const monthRange = (year, index) => [ymd(year, index + 1, 1), ymd(year, index + 1, new Date(year, index + 1, 0).getDate())];

export default function AnnualFinancialOverview({ studioId, onDrillDown }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [view, setView] = useState('year');
  const [month, setMonth] = useState(now.getMonth());
  const [annual, setAnnual] = useState(null);
  const [months, setMonths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const years = useMemo(() => [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2], [now]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const annualRequest = loadCanonicalFinancialSnapshot(supabase, ymd(year, 1, 1), ymd(year, 12, 31), studioId);
    const monthlyRequests = MONTHS.map((_, index) => {
      const [from, to] = monthRange(year, index);
      return loadCanonicalFinancialSnapshot(supabase, from, to, studioId);
    });
    Promise.all([annualRequest, ...monthlyRequests]).then(([annualResult, ...monthlyResults]) => {
      if (!active) return;
      setAnnual(annualResult.snapshot);
      setMonths(monthlyResults.map((result, index) => ({ index, snapshot: result.snapshot, error: result.error })));
      setError(annualResult.error?.message || monthlyResults.find((result) => result.error)?.error?.message || '');
      setLoading(false);
    });
    return () => { active = false; };
  }, [studioId, year]);

  const selected = view === 'year' ? annual : months[month]?.snapshot;
  const openMonth = (index) => { setMonth(index); setView('month'); };
  const value = (snapshot, field) => snapshot?.[field] == null ? '—' : fmt(snapshot[field]);

  return <div className="balance-overview">
    <div className="balance-toolbar">
      <div className="balance-period-switch" role="group" aria-label="Periodo bilancio">
        <button type="button" className={view === 'year' ? 'is-active' : ''} onClick={() => setView('year')}>Annuale</button>
        <button type="button" className={view === 'month' ? 'is-active' : ''} onClick={() => setView('month')}>Mensile</button>
      </div>
      <div className="balance-selectors">
        <label>Anno<select value={year} onChange={(event) => setYear(Number(event.target.value))}>{years.map((item) => <option key={item}>{item}</option>)}</select></label>
        {view === 'month' && <label>Mese<select value={month} onChange={(event) => setMonth(Number(event.target.value))}>{MONTHS.map((label, index) => <option key={label} value={index}>{label}</option>)}</select></label>}
      </div>
    </div>

    {loading && <Crd style={{ padding: 32, textAlign: 'center' }}>Preparazione del bilancio…</Crd>}
    {!loading && error && !annual && <Crd><EmptyState icon="chart" title="Bilancio non disponibile" subtitle={error} /></Crd>}
    {!loading && selected && <>
      <div className="balance-heading"><div><small>{view === 'year' ? 'Bilancio annuale' : 'Bilancio mensile'}</small><h2>{view === 'year' ? year : `${MONTHS[month]} ${year}`}</h2></div><span>Valori dalla fonte finanziaria canonica</span></div>
      <CanonicalManagementView snapshot={selected} mode={MANAGEMENT_CONTROL_MODES.ADVANCED} onDrillDown={onDrillDown} />
    </>}

    {!loading && <section className="monthly-ledger" aria-labelledby="monthly-ledger-title">
      <div className="monthly-ledger__head"><div><small>ANDAMENTO MENSILE</small><h3 id="monthly-ledger-title">I dodici mesi del {year}</h3></div><span>Clicca un mese per aprire il dettaglio</span></div>
      <div className="monthly-ledger__scroll">
        <table><thead><tr><th>Mese</th><th>Prodotto</th><th>Incassato</th><th>Costi fissi</th><th>Costi variabili</th><th>EBITDA</th></tr></thead>
          <tbody>{months.map(({ index, snapshot }) => <tr key={MONTHS[index]} className={view === 'month' && month === index ? 'is-selected' : ''} onClick={() => openMonth(index)} tabIndex="0" role="button">
            <th>{MONTHS[index]}</th><td>{value(snapshot, 'prodotto')}</td><td>{value(snapshot, 'incassato')}</td><td>{value(snapshot, 'costi_fissi_operativi')}</td><td>{value(snapshot, 'costi_variabili')}</td><td className={Number(snapshot?.ebitda_operativo_gestionale) < 0 ? 'is-negative' : 'is-positive'}>{value(snapshot, 'ebitda_operativo_gestionale')}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>}
  </div>;
}
