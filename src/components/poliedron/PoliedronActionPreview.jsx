import React, { useEffect, useMemo, useState } from 'react';
import { C } from '../../lib/utils';
import { Btn, Ic } from '../ui';

/* POL-AI-001 §11, §19 — confirmation preview for CREATE/UPDATE intents.
   Phase 1 scope (see actionRegistry.js header comment): "Conferma" opens
   the existing, unchanged form via the reused workflow — it does not
   write data itself, so this stays a Level 1 flow even though the UI
   pattern already matches the Level 2 "preview + confirm" shape the task
   describes for when a direct-write path exists in a future phase. */
export default function PoliedronActionPreview({ entities, suggestedActions, onConfirm, onModify }) {
  const primary = suggestedActions?.[0];
  if (!primary) return null;
  const options = entities?.patientOptions || entities?.patientCandidates || [];
  const initialPatient = entities?.patientCandidates?.length === 1 ? entities.patientCandidates[0] : null;
  const [selectedPatientId, setSelectedPatientId] = useState(initialPatient?.id || null);
  const optionKey = useMemo(() => options.map((patient) => patient.id).join('|'), [options]);
  useEffect(() => {
    setSelectedPatientId(initialPatient?.id || null);
  }, [initialPatient?.id, optionKey]);
  const patient = options.find((candidate) => candidate.id === selectedPatientId) || initialPatient;
  const isPrescription = primary.id === 'prescription.create';
  const drugText = entities?.drugText || '';

  return (
    <div className="poliedron-workflow-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span className="poliedron-workflow-card__icon"><Ic n={isPrescription ? 'pill' : 'zap'} s={15} c={C.pri} /></span>
        <div>
          <div className="poliedron-workflow-card__type">{isPrescription ? 'Workflow clinico · revisione richiesta' : 'Conferma azione'}</div>
          <div className="poliedron-workflow-card__title">{primary.label}</div>
        </div>
      </div>

      {entities?.drugNeedsClarification && (
        <div className="poliedron-workflow-card__warning" role="status">
          Hai indicato più alternative per il farmaco (“{entities.requestedDrugText}”). Scrivi un solo farmaco o principio attivo: Poliedron non sceglie al posto tuo.
        </div>
      )}

      {!patient && options.length > 0 && !entities?.drugNeedsClarification && (
        <div className="poliedron-patient-picker">
          <div className="poliedron-patient-picker__label">{entities?.patientCandidates?.length > 1 ? 'Quale paziente intendi?' : 'Seleziona il paziente'}</div>
          <div className="poliedron-patient-picker__list">
            {options.map((candidate) => (
              <button key={candidate.id} onClick={() => setSelectedPatientId(candidate.id)} className="poliedron-patient-option">
                <span><strong>{candidate.nome} {candidate.cognome}</strong>{candidate.telefono && <small>{candidate.telefono}</small>}</span>
                <span aria-hidden="true">›</span>
              </button>
            ))}
          </div>
          {entities?.patientCandidates?.length === 0 && (
            <button className="poliedron-text-action" onClick={onModify}>Cerca un altro paziente nel comando</button>
          )}
        </div>
      )}

      {patient && !entities?.drugNeedsClarification && (
        <div className="poliedron-workflow-summary">
          <div><span>Paziente</span><strong>{patient.nome} {patient.cognome}</strong></div>
          {isPrescription && <div><span>Farmaco</span><strong>{drugText || 'Da compilare nel modulo'}</strong></div>}
        {entities?.amount != null && (
          <div><span>Importo</span><strong>{entities.amount.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</strong></div>
        )}
          <div><span>Stato</span><strong>Bozza da verificare</strong></div>
        </div>
      )}

      {isPrescription && (
        <p className="poliedron-workflow-card__guardrail">
          Poliedron apre il modulo Ricetta esistente e precompila solo il nome del farmaco esattamente come scritto. Posologia, durata, validazione clinica e generazione restano a carico del professionista.
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <Btn ch="Modifica richiesta" v="sec" onClick={onModify} />
        {patient && !entities?.drugNeedsClarification && (
          <Btn ch={isPrescription ? 'Apri modulo Ricetta' : 'Conferma'} onClick={() => onConfirm(primary, patient)} full />
        )}
      </div>
    </div>
  );
}
