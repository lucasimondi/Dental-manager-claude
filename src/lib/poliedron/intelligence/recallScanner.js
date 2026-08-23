import {
  createSignal, SEVERITY, SIGNAL_TAXONOMY, SIGNAL_TYPE,
} from './model.js';
import { hasAppointmentNear } from './appointmentScanner.js';

const addDays = (date, amount) => {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + amount);
  return value.toISOString().slice(0, 10);
};

export function scanRecalls({
  recalls,
  patientId,
  appointmentIndex,
  today,
  canReadOperations,
  canReadFinancial,
}) {
  if (!canReadOperations) return [];
  const signals = [];
  const dueBoundary = addDays(today, 30);

  for (const recall of recalls) {
    if (String(recall.stato || '').toLowerCase() !== 'da_fare') continue;
    const category = String(recall.categoria || 'generico').toLowerCase();
    if (category === 'incasso' && !canReadFinancial) continue;
    const target = recall.dataScadenza;
    if (hasAppointmentNear(appointmentIndex, patientId, target, 20)) continue;

    let type = SIGNAL_TYPE.RECALL_OPEN;
    let severity = SEVERITY.LOW;
    let timing = 'aperto';
    if (target && target < today) {
      type = SIGNAL_TYPE.RECALL_OVERDUE;
      severity = SEVERITY.HIGH;
      timing = `scaduto il ${target}`;
    } else if (target && target <= dueBoundary) {
      type = SIGNAL_TYPE.RECALL_DUE;
      severity = SEVERITY.MEDIUM;
      timing = `in scadenza il ${target}`;
    }
    const taxonomy = category === 'clinico'
      ? SIGNAL_TAXONOMY.PREVENTION
      : category === 'incasso' ? SIGNAL_TAXONOMY.ADMINISTRATIVE : SIGNAL_TAXONOMY.FOLLOW_UP;
    signals.push(createSignal({
      type,
      taxonomy,
      severity,
      reason: `Richiamo ${timing}: ${recall.motivo || category}.`,
      source: 'recall',
      sourceId: recall.id ?? null,
      confidence: 0.95,
      contactRecommended: true,
      context: { dueDate: target || null, category, subject: recall.motivo || null },
    }));
  }
  return signals;
}
