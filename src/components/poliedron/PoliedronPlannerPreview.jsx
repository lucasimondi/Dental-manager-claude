import React from 'react';
import { Ic } from '../ui';

const STEP_LABEL = {
  RESOLVE_PATIENT: 'Verifica paziente',
  RESOLVE_PROCEDURE: 'Verifica prestazione',
  CHECK_EXISTING_TREATMENT: 'Cerca la prestazione nel piano',
  ENSURE_TREATMENT_ITEM: 'Prepara la prestazione mancante',
  MARK_TREATMENT_COMPLETED: 'Prepara lo stato Eseguita',
  CHECK_EXISTING_PENDING_PAYMENT: 'Controlla pagamenti in sospeso',
  ENSURE_PENDING_PAYMENT: 'Prepara il pagamento',
  VERIFY_REQUIRED_LATER: 'Verifica finale richiesta',
};

export default function PoliedronPlannerPreview({ plan }) {
  if (!plan) return null;
  const patient = plan.patientRef?.candidate;
  return (
    <div className="poliedron-workflow-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span className="poliedron-workflow-card__icon"><Ic n="plan" s={15} c="currentColor" /></span>
        <div>
          <div className="poliedron-workflow-card__type">Action Plan · sola anteprima</div>
          <div className="poliedron-workflow-card__title">{patient ? `${patient.nome} ${patient.cognome}` : 'Paziente da verificare'}</div>
        </div>
      </div>
      <div className="poliedron-planner-steps">
        {plan.steps.map((step, index) => (
          <div key={`${step.type}-${index}`}>
            <span>{index + 1}</span>
            <div>
              <strong>{STEP_LABEL[step.type] || step.type}</strong>
              {step.procedureText && <small>{step.procedureText}</small>}
              {step.tooth?.value && <small>Elemento {step.tooth.value}</small>}
            </div>
          </div>
        ))}
      </div>
      {[...plan.warnings, ...plan.assumptions].map((message) => <div className="poliedron-workflow-card__warning" key={message}>{message}</div>)}
      <p className="poliedron-workflow-card__guardrail">
        {plan.blocked
          ? 'Il piano è bloccato dai permessi correnti.'
          : 'POL-AI-005A prepara soltanto il piano. Conferma, esecuzione e verifica non sono ancora abilitate; nessun dato è stato modificato.'}
      </p>
    </div>
  );
}
