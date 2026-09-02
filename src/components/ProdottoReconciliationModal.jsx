import React, { useEffect, useMemo, useState } from 'react';
import { fmt, fmtD } from '../lib/utils';
import { supabase } from '../lib/supabase.js';
import { loadProdottoReconciliation } from '../lib/domain/prodottoReconciliationService.js';
import { EmptyState, Modal } from './ui';
import './ProdottoReconciliationModal.css';

const PERIOD_RELATION = {
  BEFORE: 'Prima del periodo',
  IN: 'Nel periodo',
  AFTER: 'Dopo il periodo',
};

const QUALITY_LABELS = {
  PLAN_VOCI_NOT_ARRAY: 'Piano con prestazioni non leggibili',
  PLAN_PRICE_INVALID: 'Piano con prezzo non valido',
  PLAN_PATIENT_MISSING: 'Piano senza paziente',
  PLAN_DISCOUNT_INVALID: 'Piano con sconto non valido',
  EXECUTION_DATE_INVALID: 'Prestazione eseguita senza data valida',
  PAYMENT_STATUS_AMBIGUOUS: 'Pagamento con stato ambiguo',
  PAYMENT_AMOUNT_INVALID: 'Pagamento con importo non valido',
  PAYMENT_DATE_INVALID: 'Pagamento senza data valida',
  PAYMENT_PATIENT_MISSING: 'Pagamento senza paziente',
  PAYMENT_PLAN_LINK_MISMATCH: 'Pagamento collegato a un piano non coerente',
};

const stateLabel = (state) => {
  if (state === 'RESIDUAL') return 'Prodotto superiore agli incassi';
  if (state === 'OVERCOLLECTED') return 'Incassi superiori al prodotto';
  if (state === 'RECONCILED') return 'Prodotto e incassi allineati';
  if (state === 'UNALLOCATED') return 'Pagamento non assegnato a un piano';
  return 'Dati da completare';
};

export default function ProdottoReconciliationModal({
  studioId,
  period,
  patients = [],
  onClose,
  loadReconciliationData = loadProdottoReconciliation,
}) {
  const [result, setResult] = useState({ summary: null, groups: [], error: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadReconciliationData(supabase, {
      dateFrom: period.dateFrom,
      dateTo: period.dateTo,
      studioId,
    }).then((next) => {
      if (!active) return;
      setResult(next);
      setLoading(false);
    });
    return () => { active = false; };
  }, [loadReconciliationData, period.dateFrom, period.dateTo, studioId]);

  const patientNames = useMemo(
    () => new Map(patients.map((patient) => [
      String(patient.id),
      `${patient.nome || ''} ${patient.cognome || ''}`.trim() || `Paziente ${patient.id}`,
    ])),
    [patients],
  );
  const patientName = (id) => id == null
    ? 'Paziente non identificato'
    : (patientNames.get(String(id)) || `Paziente ${id}`);
  const summary = result.summary;
  const incomplete = summary?.data_quality_status?.includes('INCOMPLETE');

  return (
    <Modal title={`Riconciliazione Prodotto · ${period.label}`} icon="chart" onClose={onClose} wide mobileVariant="sheet">
      <div className="prodotto-reconciliation">
        {loading && <div className="prodotto-reconciliation__state" role="status">Caricamento riconciliazione…</div>}

        {!loading && result.error && (
          <EmptyState icon="warning" title="Riconciliazione non disponibile" subtitle={result.error.message} />
        )}

        {!loading && !result.error && summary && (
          <>
            <section className="prodotto-reconciliation__summary" aria-label="Riepilogo del periodo">
              <div><small>Prodotto</small><strong>{summary.prodotto_periodo == null ? 'Non disponibile' : fmt(summary.prodotto_periodo)}</strong></div>
              <div><small>Incassato</small><strong>{summary.incassato_periodo == null ? 'Non disponibile' : fmt(summary.incassato_periodo)}</strong></div>
              <div><small>Scostamento</small><strong>{summary.scostamento_periodo == null ? 'Non disponibile' : fmt(summary.scostamento_periodo)}</strong></div>
            </section>

            <p className="prodotto-reconciliation__explanation">
              Lo scostamento è <strong>Prodotto − Incassato nello stesso periodo</strong>: descrive un gap temporale o di incasso,
              non identifica automaticamente un debito del paziente.
            </p>

            {(incomplete || (summary.quality_issues || []).length > 0) && (
              <section className="prodotto-reconciliation__quality" role="alert">
                <strong>Dato incompleto: nessun totale parziale viene presentato come definitivo.</strong>
                {(summary.quality_issues || []).map((issue) => (
                  <span key={`${issue.metric}-${issue.code}`}>
                    {QUALITY_LABELS[issue.code] || issue.code}: {issue.count}
                  </span>
                ))}
              </section>
            )}

            <div className="prodotto-reconciliation__groups">
              {result.groups.map((group) => (
                <section className="prodotto-reconciliation__group" key={group.group_key}>
                  <header>
                    <div>
                      <small>{group.group_kind === 'UNALLOCATED' ? 'PAGAMENTO NON ALLOCATO' : patientName(group.patient_id)}</small>
                      <h3>{group.group_kind === 'UNALLOCATED' ? patientName(group.patient_id) : (group.plan_title || 'Piano di cura')}</h3>
                    </div>
                    <span data-state={group.allocation_state}>{stateLabel(group.allocation_state)}</span>
                  </header>

                  <div className="prodotto-reconciliation__group-totals">
                    <div><small>Prodotto nel periodo</small><strong>{group.prodotto_periodo == null ? '—' : fmt(group.prodotto_periodo)}</strong></div>
                    <div><small>Incassato nel periodo</small><strong>{group.incassato_periodo == null ? '—' : fmt(group.incassato_periodo)}</strong></div>
                    <div><small>Posizione a fine periodo</small><strong>{group.posizione_al_periodo == null ? '—' : fmt(group.posizione_al_periodo)}</strong></div>
                  </div>

                  {(group.executed_items || []).length > 0 && (
                    <div className="prodotto-reconciliation__list">
                      <h4>Prestazioni eseguite</h4>
                      {(group.executed_items || []).map((item) => (
                        <article key={`${group.group_key}-${item.sourceLineId}`}>
                          <div>
                            <strong>{item.prestazione || 'Prestazione'}</strong>
                            <span>{fmtD(item.executionDate)} · {PERIOD_RELATION[item.periodRelation]}</span>
                            {item.originalAmount != null && (
                              <small>
                                Prezzo piano {fmt(item.originalAmount)}
                                {Number(item.allocatedDiscount) > 0 ? ` · sconto attribuito ${fmt(item.allocatedDiscount)}` : ''}
                              </small>
                            )}
                          </div>
                          <div><small>Valore venduto</small><strong>{fmt(item.soldAmount)}</strong></div>
                        </article>
                      ))}
                    </div>
                  )}

                  {(group.payment_rows || []).length > 0 && (
                    <div className="prodotto-reconciliation__list">
                      <h4>{group.group_kind === 'UNALLOCATED' ? 'Incassi a livello paziente' : 'Incassi collegati al piano'}</h4>
                      {(group.payment_rows || []).map((payment) => (
                        <article key={`${group.group_key}-${payment.paymentId}`}>
                          <div>
                            <strong>
                              {payment.linkage === 'PLAN'
                                ? 'Collegamento piano'
                                : payment.linkage === 'CANONICAL_EVENT'
                                  ? 'Evento di cassa canonico'
                                  : 'Non assegnato a un piano'}
                            </strong>
                            <span>{fmtD(payment.paymentDate)} · {PERIOD_RELATION[payment.periodRelation]}</span>
                            <small>Nessuna quota è attribuita a una singola prestazione.</small>
                          </div>
                          <div><small>Incassato</small><strong>{fmt(payment.amount)}</strong></div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>

            {result.groups.length === 0 && (
              <EmptyState icon="chart" title="Nessun movimento nel periodo" subtitle="Non risultano prestazioni eseguite o incassi da riconciliare." />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
