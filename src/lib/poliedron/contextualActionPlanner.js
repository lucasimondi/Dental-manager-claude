import { parseCommand } from './planner/commandParser.js';
import { buildActionPlan } from './planner/actionPlanner.js';

const CONTEXTUAL_MARK_COMPLETED = /^segna\s+(?<procedure>.+?)(?:\s+(?<tooth>\d{2}))?\s+come\s+eseguit[ao]\s*$/i;

export function contextualizePatientCommand(text, patient, anatomicalContext) {
  const direct = parseCommand(text);
  if (direct || !patient?.id) return direct;
  const match = CONTEXTUAL_MARK_COMPLETED.exec((text || '').trim());
  if (!match) return null;
  const contextualTooth = anatomicalContext?.type === 'tooth' ? anatomicalContext.value : null;
  const tooth = match.groups.tooth || contextualTooth;
  const patientName = [patient.nome, patient.cognome].filter(Boolean).join(' ').trim();
  if (!patientName) return null;
  return parseCommand(`Segna ${match.groups.procedure}${tooth ? ` ${tooth}` : ''} di ${patientName} come eseguita`);
}

export function planContextualPatientAction(text, {
  patient,
  anatomicalContext,
  patients,
  plans,
  payments,
  pricelist,
  homePermissions,
  studioId,
} = {}) {
  const parsed = contextualizePatientCommand(text, patient, anatomicalContext);
  if (!parsed) return null;
  return buildActionPlan(parsed, {
    patients: patients || [],
    plans: plans || [],
    payments: payments || [],
    pricelist: pricelist || [],
    homePermissions: homePermissions || {},
    studioId,
  });
}
