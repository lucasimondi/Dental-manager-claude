import React from 'react';
import { C } from '../../lib/utils';
import { Btn, Ic } from '../ui';
import { PLAN_STEP_TYPE, PRICE_UNRESOLVED } from '../../lib/poliedron/planner/actionPlanner.js';

/* POL-AI-005B — the real Level-2 (write) confirmation preview: PLAN ->
   PREVIEW -> CONFIRM. Reuses the exact same "poliedron-workflow-card"
   visual language PoliedronActionPreview.jsx already established for
   Level-1 previews, extended with the sections a real write needs —
   what will be created, what will be updated, what's missing, the
   financial impact, and warnings — so this reads as one coherent
   confirmation for one logical workflow, per the task's own instruction.
   Nothing here writes anything; `onConfirm(plan)` is the only path that
   can, and it is wired to the real executor one level up in
   Poliedron.jsx, never from this presentation component. */

const INTENT_LABEL = Object.freeze({
  MARK_TREATMENT_COMPLETED: 'Segna prestazione come eseguita',
  RECORD_TREATMENT_AND_PENDING_PAYMENT: 'Registra prestazione e pagamento in sospeso',
  RECORD_MULTIPLE_TREATMENTS_AND_PAYMENT: 'Registra più prestazioni e pagamento in sospeso',
  CREATE_TREATMENT_PLAN: 'Crea piano di cura',
  COMPLETE_MISSING_TOOTH: 'Completa elemento dentario mancante',
  CREATE_PAYMENT_PLAN: 'Crea piano di pagamento',
  RECORD_PAYMENT_AGAINST_DEADLINE: 'Registra pagamento',
});

const fmtEur = (n) => Number(n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

const toothLabel = (tooth) => {
  if (!tooth) return null;
  if (tooth.state === 'known') return `dente ${tooth.value}`;
  if (tooth.state === 'legacy_incomplete') return `dente "${tooth.value}" non riconosciuto`;
  return 'dente non specificato';
};

const OUTCOME_META = Object.freeze({
  SUCCESS: { label: 'Completato', color: C.suc, icon: 'okc' },
  PARTIAL: { label: 'Parzialmente completato', color: C.war, icon: 'warn' },
  FAILED: { label: 'Non riuscito', color: C.dan, icon: 'x' },
});

export default function PoliedronActionPreviewLevel2({ plan, running, result, onConfirm, onModify }) {
  if (!plan) return null;
  const patient = plan.patientRef?.candidate;
  const candidates = plan.patientRef?.candidates || [];
  const ambiguous = plan.patientRef?.status === 'AMBIGUOUS';
  const notFound = plan.patientRef?.status === 'NOT_FOUND';
  const invalid = plan.patientRef?.status === 'INVALID';

  const toCreate = plan.steps.filter((s) => s.type === PLAN_STEP_TYPE.ENSURE_TREATMENT_ITEM);
  const toUpdate = plan.steps.filter((s) => s.type === PLAN_STEP_TYPE.MARK_TREATMENT_COMPLETED);
  const payment = plan.steps.find((s) => s.type === PLAN_STEP_TYPE.ENSURE_PENDING_PAYMENT);
  const completeTooth = plan.steps.find((s) => s.type === PLAN_STEP_TYPE.COMPLETE_TREATMENT_TOOTH);
  const createPaymentPlan = plan.steps.find((s) => s.type === PLAN_STEP_TYPE.CREATE_PAYMENT_PLAN);
  const recordAllocation = plan.steps.find((s) => s.type === PLAN_STEP_TYPE.RECORD_PAYMENT_ALLOCATION);
  const contextPatientMissing = plan.patientRef?.mechanism === 'context' && plan.patientRef?.status === 'NOT_FOUND';

  const canConfirm = !!patient && !plan.blocked && !running && !result;
  const outcome = result ? OUTCOME_META[result.outcome] : null;

  return (
    <div className="poliedron-workflow-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span className="poliedron-workflow-card__icon"><Ic n="zap" s={15} c={C.pri} /></span>
        <div>
          <div className="poliedron-workflow-card__type">Azione — conferma richiesta</div>
          <div className="poliedron-workflow-card__title">{INTENT_LABEL[plan.intent] || plan.intent}</div>
        </div>
      </div>

      {(ambiguous || (notFound && candidates.length > 0)) && (
        <div className="poliedron-patient-picker">
          <div className="poliedron-patient-picker__label">{ambiguous ? 'Quale paziente intendi?' : 'Nessuna corrispondenza esatta — forse intendevi:'}</div>
          <div className="poliedron-patient-picker__list">
            {candidates.map((candidate) => (
              <div key={candidate.id} className="poliedron-patient-option" style={{ cursor: 'default' }}>
                <span><strong>{candidate.nome} {candidate.cognome}</strong></span>
              </div>
            ))}
          </div>
          <button className="poliedron-text-action" onClick={onModify}>Riscrivi la richiesta specificando il paziente</button>
        </div>
      )}

      {contextPatientMissing ? (
        <div className="poliedron-workflow-card__warning" role="status">Nessun paziente aperto: apri la scheda di un paziente e riprova.</div>
      ) : notFound && candidates.length === 0 && (
        <div className="poliedron-workflow-card__warning" role="status">Nessun paziente trovato per "{plan.patientRef?.text}".</div>
      )}
      {invalid && (
        <div className="poliedron-workflow-card__warning" role="status">Il paziente risolto non appartiene al tuo studio: richiesta rifiutata.</div>
      )}

      {patient && (
        <div className="poliedron-workflow-summary">
          <div><span>Paziente</span><strong>{patient.nome} {patient.cognome}</strong></div>

          {toCreate.length > 0 && (
            <div><span>Da creare</span><strong>
              {toCreate.map((s, i) => (
                <div key={i}>{s.procedureRef.canonicalName || s.procedureRef.text}{s.tooth ? ` — ${toothLabel(s.tooth)}` : ''}{s.procedureRef.price === PRICE_UNRESOLVED ? ' (prezzo non disponibile)' : ` — ${Number(s.procedureRef.price).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}`}</div>
              ))}
            </strong></div>
          )}

          {toUpdate.length > 0 && (
            <div><span>Da aggiornare</span><strong>
              {toUpdate.map((s, i) => (
                <div key={i}>{s.existingPlanId ? 'Prestazione esistente' : (s.procedureRef.canonicalName || s.procedureRef.text)} → segnata come eseguita</div>
              ))}
            </strong></div>
          )}

          {completeTooth && (
            <>
              <div><span>Prestazione</span><strong>{completeTooth.procedureRef.canonicalName}</strong></div>
              <div><span>Stato</span><strong>Eseguita</strong></div>
              <div><span>Elemento attuale</span><strong>{completeTooth.currentTooth || 'Da completare'}</strong></div>
              <div><span>Nuovo elemento</span><strong>{completeTooth.newTooth.value}</strong></div>
              <div><span>Azione</span><strong>{completeTooth.expectedOutcome === 'ALREADY_COMPLETE' ? 'Nessuna modifica (già aggiornato)' : 'Aggiorna elemento dentario'}</strong></div>
            </>
          )}

          {payment && (
            <div><span>Impatto finanziario</span><strong>{fmtEur(payment.amount)} — pagamento in sospeso</strong></div>
          )}

          {createPaymentPlan && (
            <>
              <div><span>Importo totale</span><strong>{fmtEur(createPaymentPlan.totalAmount)}</strong></div>
              <div><span>Rate</span><strong>
                {createPaymentPlan.deadlines.map((d, i) => <div key={i}>{d.dueDate} — {fmtEur(d.amountDue)}</div>)}
              </strong></div>
            </>
          )}

          {recordAllocation && (
            <>
              <div><span>Importo pagamento</span><strong>{fmtEur(recordAllocation.amount)}</strong></div>
              {recordAllocation.targetDeadlineSnapshot ? (
                <>
                  <div><span>Scadenza</span><strong>{recordAllocation.targetDeadlineSnapshot.label}{recordAllocation.targetDeadlineSnapshot.dueDate ? ` (${recordAllocation.targetDeadlineSnapshot.dueDate})` : ''} — {fmtEur(recordAllocation.targetDeadlineSnapshot.amountDue)}</strong></div>
                  <div><span>Residuo dopo il pagamento</span><strong>{fmtEur(Math.max(0, recordAllocation.targetDeadlineSnapshot.remaining - recordAllocation.amount))}</strong></div>
                </>
              ) : (
                <div><span>Allocazione</span><strong>Saldo generale del paziente (nessuna scadenza specifica)</strong></div>
              )}
            </>
          )}

          {plan.assumptions.length > 0 && (
            <div><span>Dati mancanti</span><strong>{plan.assumptions.join(' · ')}</strong></div>
          )}
        </div>
      )}

      {plan.warnings.length > 0 && (
        <div className="poliedron-workflow-card__warning" role="status">
          {plan.warnings.map((w, i) => <div key={i}>{w}</div>)}
        </div>
      )}

      {result && outcome && (
        <div className="poliedron-workflow-card__warning" role="status" style={{ borderColor: outcome.color, color: outcome.color }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800 }}>
            <Ic n={outcome.icon} s={13} c={outcome.color} />{outcome.label}
          </div>
          {result.recoveryActions?.map((r, i) => <div key={i} style={{ marginTop: 4 }}>{r}</div>)}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <Btn ch="Modifica richiesta" v="sec" onClick={onModify} />
        {canConfirm && <Btn ch="Conferma" onClick={() => onConfirm(plan)} full />}
        {running && <Btn ch="Sto eseguendo…" full dis />}
      </div>
    </div>
  );
}
