import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bar, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { C, fmt } from '../lib/utils';
import { supabase } from '../lib/supabase.js';
import { useIsMobile } from '../lib/useIsMobile';
import { loadCanonicalFinancialSnapshot, MANAGEMENT_CONTROL_MODES } from '../lib/canonicalFinancialSelectors';
import { exportAnnualLedgerCsv, exportAnnualLedgerPdf } from '../lib/annualLedgerExport.js';
import CanonicalManagementView from './CanonicalManagementView.jsx';
import { Btn, Crd, EmptyState } from './ui';

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
  const isMobile = useIsMobile();
  // Product Owner follow-up: clicking a month in the ledger must actually
  // land on the detailed monthly view, not just flip a state the reader
  // has to scroll up to notice — the detail card sits above the ledger, so
  // bring it into view on click.
  const detailRef = useRef(null);

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
  const openMonth = (index) => {
    setMonth(index);
    setView('month');
    requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const numeric = (snapshot, field) => (snapshot?.[field] == null ? null : Number(snapshot[field]));
  const value = (snapshot, field) => snapshot?.[field] == null ? '—' : fmt(snapshot[field]);

  // Product Owner follow-up: "vista annuale deve contenere tutti i mesi
  // anche con un andamento" — the table already lists all twelve months;
  // this adds the trend itself (Incassato/EBITDA per month) above it, same
  // charting library/style already used on Dashboard, no new dependency.
  const trendData = useMemo(() => months.map(({ index, snapshot }) => ({
    mese: MONTHS[index].slice(0, 3),
    incassato: numeric(snapshot, 'incassato') || 0,
    ebitda: numeric(snapshot, 'ebitda_operativo_gestionale') || 0,
  })), [months]);
  const hasTrend = trendData.some((point) => point.incassato !== 0 || point.ebitda !== 0);

  // "Le voci devono essere come un excel" — a real spreadsheet always shows
  // the column total, not just twelve rows to sum by eye.
  const LEDGER_FIELDS = ['prodotto', 'incassato', 'costi_fissi_operativi', 'costi_variabili', 'ebitda_operativo_gestionale'];
  const totals = useMemo(() => LEDGER_FIELDS.reduce((acc, field) => {
    const values = months.map(({ snapshot }) => numeric(snapshot, field)).filter((entry) => entry != null);
    acc[field] = values.length ? values.reduce((sum, entry) => sum + entry, 0) : null;
    return acc;
  }, {}), [months]);
  const totalValue = (field) => totals[field] == null ? '—' : fmt(totals[field]);

  // Product Owner follow-up: "deve essere possibile estrarre il pdf o
  // excel da quella tabella" — same rows/totals the table and the export
  // show, so the file always matches what's on screen.
  const exportCsv = () => exportAnnualLedgerCsv({ year, months, MONTHS, totals });
  const exportPdf = () => exportAnnualLedgerPdf({ year, months, MONTHS, totals });

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
    {!loading && selected && <div ref={detailRef}>
      <div className="balance-heading"><div><small>{view === 'year' ? 'Bilancio annuale' : 'Bilancio mensile'}</small><h2>{view === 'year' ? year : `${MONTHS[month]} ${year}`}</h2></div><span>Valori dalla fonte finanziaria canonica</span></div>
      <CanonicalManagementView snapshot={selected} mode={MANAGEMENT_CONTROL_MODES.ADVANCED} onDrillDown={onDrillDown} />
    </div>}

    {!loading && view === 'year' && hasTrend && (
      <section className="annual-trend" aria-labelledby="annual-trend-title">
        <div className="monthly-ledger__head"><div><small>ANDAMENTO</small><h3 id="annual-trend-title">Incassato ed EBITDA, mese per mese</h3></div></div>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={trendData} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.brd} vertical={false} />
            <XAxis dataKey="mese" tick={{ fontSize: 11, fill: C.txl }} axisLine={{ stroke: C.brd }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: C.txl }} axisLine={false} tickLine={false} width={48} />
            <Tooltip contentStyle={{ background: C.txt, border: 'none', borderRadius: 8, color: C.sur, fontSize: 12 }} labelStyle={{ color: C.sur }} formatter={(v, n) => [fmt(v), n === 'incassato' ? 'Incassato' : 'EBITDA']} />
            <Bar dataKey="incassato" fill={C.priL} radius={[6, 6, 0, 0]} barSize={20} />
            <Line dataKey="ebitda" stroke={C.pri} strokeWidth={2.5} dot={{ r: 3, fill: C.pri }} />
          </ComposedChart>
        </ResponsiveContainer>
      </section>
    )}

    {!loading && <section className="monthly-ledger monthly-ledger--excel" aria-labelledby="monthly-ledger-title">
      <div className="monthly-ledger__head">
        <div><small>ANDAMENTO MENSILE</small><h3 id="monthly-ledger-title">I dodici mesi del {year}</h3></div>
        <div className="monthly-ledger__head-actions">
          <span className="monthly-ledger__hint">Clicca un mese per aprire il dettaglio</span>
          <Btn ch="Esporta PDF" ic="file" v="sec" sz="sm" onClick={exportPdf} />
          <Btn ch="Esporta Excel" ic="file" v="sec" sz="sm" onClick={exportCsv} />
        </div>
      </div>
      {/* Product Owner follow-up: "su mobile la tabella sia responsive e ci
          stia nello schermo" — a 6-column table can't shrink to a phone
          without either scrolling or unreadable text, so mobile gets a
          stacked card per month instead of the same table squeezed down;
          desktop/tablet keep the real table. Same data, same click-through
          to the monthly detail, same totals row either way. */}
      {isMobile ? (
        <div className="monthly-ledger__cards">
          {months.map(({ index, snapshot }) => (
            <button type="button" key={MONTHS[index]} className={`monthly-ledger__card${view === 'month' && month === index ? ' is-selected' : ''}`} onClick={() => openMonth(index)}>
              <div className="monthly-ledger__card-head"><strong>{MONTHS[index]}</strong><span className={Number(snapshot?.ebitda_operativo_gestionale) < 0 ? 'is-negative' : 'is-positive'}>{value(snapshot, 'ebitda_operativo_gestionale')}</span></div>
              <div className="monthly-ledger__card-grid">
                <div><small>Prodotto</small><span>{value(snapshot, 'prodotto')}</span></div>
                <div><small>Incassato</small><span>{value(snapshot, 'incassato')}</span></div>
                <div><small>Costi fissi</small><span>{value(snapshot, 'costi_fissi_operativi')}</span></div>
                <div><small>Costi variabili</small><span>{value(snapshot, 'costi_variabili')}</span></div>
              </div>
            </button>
          ))}
          <div className="monthly-ledger__card monthly-ledger__card--totals">
            <div className="monthly-ledger__card-head"><strong>Totale {year}</strong><span className={Number(totals.ebitda_operativo_gestionale) < 0 ? 'is-negative' : 'is-positive'}>{totalValue('ebitda_operativo_gestionale')}</span></div>
            <div className="monthly-ledger__card-grid">
              <div><small>Prodotto</small><span>{totalValue('prodotto')}</span></div>
              <div><small>Incassato</small><span>{totalValue('incassato')}</span></div>
              <div><small>Costi fissi</small><span>{totalValue('costi_fissi_operativi')}</span></div>
              <div><small>Costi variabili</small><span>{totalValue('costi_variabili')}</span></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="monthly-ledger__scroll">
          <table><thead><tr><th>Mese</th><th>Prodotto</th><th>Incassato</th><th>Costi fissi</th><th>Costi variabili</th><th>EBITDA</th></tr></thead>
            <tbody>{months.map(({ index, snapshot }) => <tr key={MONTHS[index]} className={view === 'month' && month === index ? 'is-selected' : ''} onClick={() => openMonth(index)} tabIndex="0" role="button">
              <th>{MONTHS[index]}</th><td>{value(snapshot, 'prodotto')}</td><td>{value(snapshot, 'incassato')}</td><td>{value(snapshot, 'costi_fissi_operativi')}</td><td>{value(snapshot, 'costi_variabili')}</td><td className={Number(snapshot?.ebitda_operativo_gestionale) < 0 ? 'is-negative' : 'is-positive'}>{value(snapshot, 'ebitda_operativo_gestionale')}</td>
            </tr>)}</tbody>
            <tfoot><tr>
              <th>Totale {year}</th><td>{totalValue('prodotto')}</td><td>{totalValue('incassato')}</td><td>{totalValue('costi_fissi_operativi')}</td><td>{totalValue('costi_variabili')}</td><td className={Number(totals.ebitda_operativo_gestionale) < 0 ? 'is-negative' : 'is-positive'}>{totalValue('ebitda_operativo_gestionale')}</td>
            </tr></tfoot>
          </table>
        </div>
      )}
    </section>}
  </div>;
}
