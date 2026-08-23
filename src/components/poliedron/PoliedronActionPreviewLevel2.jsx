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
});

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

      {notFound && candidates.length === 0 && (
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

          {payment && (
            <div><span>Impatto finanziario</span><strong>{Number(payment.amount).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })} — pagamento in sospeso</strong></div>
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
