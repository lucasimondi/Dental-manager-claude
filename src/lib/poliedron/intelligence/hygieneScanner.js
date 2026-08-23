import {
  createSignal, SEVERITY, SIGNAL_TAXONOMY, SIGNAL_TYPE,
} from './model.js';
import { hasAppointmentNear } from './appointmentScanner.js';

const isHygiene = (voice) => /igien/i.test(String(voice?.prestazione || voice?.richiamoTipo || ''));

export function scanHygiene({
  plans,
  patientId,
  appointmentIndex,
  today,
  canReadClinical,
  vertical,
}) {
  if (!canReadClinical || (vertical && vertical !== 'dentistico')) return [];
  const completed = [];
  for (const plan of plans) {
    for (const [index, voice] of (Array.isArray(plan.voci) ? plan.voci : []).entries()) {
      if (voice.eseguita === true && isHygiene(voice)) completed.push({ plan, voice, index });
    }
  }
  if (!completed.length) return [];
  if (completed.some((item) => !item.voice.dataEsec)) {
    return [createSignal({
      type: SIGNAL_TYPE.HYGIENE_CONFIGURATION_MISSING,
      taxonomy: SIGNAL_TAXONOMY.DATA_QUALITY,
      severity: SEVERITY.LOW,
      reason: 'Una prestazione di igiene eseguita non ha una data verificabile; non è possibile stabilire quale registrazione sia la più recente.',
      source: 'treatment_plan',
      confidence: 0.45,
      confidencePenalty: 0.12,
    })];
  }
  completed.sort((a, b) => String(b.voice.dataEsec || '').localeCompare(String(a.voice.dataEsec || '')));
  const latest = completed[0];
  const sourceId = latest.plan.id ?? null;

  if (!latest.voice.richiamoData) {
    return [createSignal({
      type: SIGNAL_TYPE.HYGIENE_CONFIGURATION_MISSING,
      taxonomy: SIGNAL_TAXONOMY.DATA_QUALITY,
      severity: SEVERITY.LOW,
      reason: 'L’ultima prestazione di igiene registrata non ha una data di esecuzione e richiamo entrambe verificabili.',
      source: 'treatment_plan',
      sourceId,
      confidence: 0.5,
      confidencePenalty: 0.1,
      context: { planTitle: latest.plan.titolo || null },
    })];
  }

  if (
    latest.voice.richiamoData < today
    && !hasAppointmentNear(appointmentIndex, patientId, latest.voice.richiamoData, 20)
  ) {
    return [createSignal({
      type: SIGNAL_TYPE.HYGIENE_OVERDUE,
      taxonomy: SIGNAL_TAXONOMY.PREVENTION,
      severity: SEVERITY.MEDIUM,
      reason: `Il richiamo di prevenzione/igiene configurato risulta scaduto il ${latest.voice.richiamoData}.`,
      source: 'treatment_plan',
      sourceId,
      confidence: 0.9,
      contactRecommended: true,
      context: {
        lastPerformedAt: latest.voice.dataEsec,
        configuredDueDate: latest.voice.richiamoData,
      },
    })];
  }
  return [];
}
