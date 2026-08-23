import { buildAnatomicalContext } from '../patientCockpitModel.js';

export const POLIEDRON_OPEN_CONTEXT_EVENT = 'poliedron:open-context';
export const POLIEDRON_INPUT_SOURCE = Object.freeze({
  TEXT: 'TEXT',
  VOICE_TRANSCRIPT: 'VOICE_TRANSCRIPT',
});

export function buildPatientChatContext({ patient, anatomicalContext = null, inputSource = POLIEDRON_INPUT_SOURCE.TEXT }) {
  if (!patient?.id) return null;
  const safeAnatomicalContext = anatomicalContext
    ? buildAnatomicalContext(anatomicalContext.type, anatomicalContext.value, anatomicalContext.label)
    : null;
  return Object.freeze({
    source: 'patient_cockpit',
    patient: Object.freeze({
      id: patient.id,
      nome: patient.nome || '',
      cognome: patient.cognome || '',
      studio_id: patient.studio_id ?? patient.studioId ?? null,
    }),
    anatomicalContext: safeAnatomicalContext,
    inputSource: Object.values(POLIEDRON_INPUT_SOURCE).includes(inputSource)
      ? inputSource
      : POLIEDRON_INPUT_SOURCE.TEXT,
  });
}

export function openPoliedronWithPatientContext(context) {
  const detail = buildPatientChatContext(context);
  if (!detail || typeof window === 'undefined') return false;
  window.dispatchEvent(new CustomEvent(POLIEDRON_OPEN_CONTEXT_EVENT, { detail }));
  return true;
}
