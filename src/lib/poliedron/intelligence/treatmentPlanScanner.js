import {
  createSignal, SEVERITY, SIGNAL_TAXONOMY, SIGNAL_TYPE,
} from './model.js';

const ACCEPTED_PLAN_STATES = new Set(['accettato', 'accepted', 'in_corso']);
const WAITING_PLAN_STATES = new Set(['attivo', 'active', 'in_attesa']);

const daysSince = (date, today) => {
  if (!date) return null;
  const start = new Date(`${date}T12:00:00`).getTime();
  const end = new Date(`${today}T12:00:00`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.floor((end - start) / 86400000);
};

export function scanTreatmentPlans({ plans, hasFuture, today, canReadClinical }) {
  if (!canReadClinical) return [];
  const signals = [];

  for (const plan of plans) {
    const sourceId = plan.id ?? null;
    const status = typeof plan.stato === 'string' ? plan.stato.toLowerCase() : '';
    if (!status) {
      signals.push(createSignal({
        type: SIGNAL_TYPE.MISSING_PLAN_STATUS,
        taxonomy: SIGNAL_TAXONOMY.DATA_QUALITY,
        severity: SEVERITY.MEDIUM,
        reason: `Il piano "${plan.titolo || 'senza titolo'}" non ha uno stato operativo verificabile.`,
        source: 'treatment_plan',
        sourceId,
        confidence: 0.55,
        confidencePenalty: 0.12,
      }));
    }

    const voices = Array.isArray(plan.voci) ? plan.voci : [];
    if (ACCEPTED_PLAN_STATES.has(status) && voices.length === 0) {
      signals.push(createSignal({
        type: SIGNAL_TYPE.EMPTY_ACCEPTED_PLAN,
        taxonomy: SIGNAL_TAXONOMY.DATA_QUALITY,
        severity: SEVERITY.MEDIUM,
        reason: `Il piano accettato "${plan.titolo || 'senza titolo'}" non contiene prestazioni verificabili.`,
        source: 'treatment_plan',
        sourceId,
        confidence: 0.55,
        confidencePenalty: 0.12,
      }));
      continue;
    }

    const ambiguous = voices.filter((voice) => typeof voice.eseguita !== 'boolean');
    if (ambiguous.length) {
      signals.push(createSignal({
        type: SIGNAL_TYPE.MISSING_EXECUTION_STATUS,
        taxonomy: SIGNAL_TAXONOMY.DATA_QUALITY,
        severity: SEVERITY.MEDIUM,
        reason: `${ambiguous.length} ${ambiguous.length === 1 ? 'prestazione non ha' : 'prestazioni non hanno'} uno stato di esecuzione aggiornato.`,
        source: 'treatment_plan',
        sourceId,
        confidence: 0.5,
        confidencePenalty: Math.min(0.24, ambiguous.length * 0.06),
        context: { count: ambiguous.length, planTitle: plan.titolo || null },
      }));
    }

    // POL-AI-005B: a completed treatment with no tooth on file — e.g. an
    // AI-recorded "segna ... come eseguita, non ricordo il dente". Derived
    // live from `voci` every scan: filling in the tooth later (updating
    // the same item, never a new one — see treatmentPlanService.js's
    // findIncompleteItemToComplete) makes this clear on the very next
    // scan, with no separate signal state to reconcile.
    const missingTooth = voices.filter((voice) => voice.eseguita === true && !voice.dente);
    if (missingTooth.length) {
      signals.push(createSignal({
        type: SIGNAL_TYPE.MISSING_TOOTH_REFERENCE,
        taxonomy: SIGNAL_TAXONOMY.DATA_QUALITY,
        severity: SEVERITY.LOW,
        reason: `${missingTooth.length} ${missingTooth.length === 1 ? 'prestazione eseguita non ha' : 'prestazioni eseguite non hanno'} il dente registrato.`,
        source: 'treatment_plan',
        sourceId,
        confidence: 1,
        confidencePenalty: Math.min(0.15, missingTooth.length * 0.05),
        context: { count: missingTooth.length, planTitle: plan.titolo || null, treatments: missingTooth.map((v) => v.prestazione).filter(Boolean).slice(0, 3) },
      }));
    }

    if (ACCEPTED_PLAN_STATES.has(status)) {
      const remaining = voices.filter((voice) => voice.eseguita === false);
      if (remaining.length) {
        signals.push(createSignal({
          type: SIGNAL_TYPE.UNFINISHED_TREATMENT,
          taxonomy: SIGNAL_TAXONOMY.OPPORTUNITY,
          severity: hasFuture ? SEVERITY.MEDIUM : SEVERITY.HIGH,
          reason: `${remaining.length} ${remaining.length === 1 ? 'prestazione del piano non risulta eseguita' : 'prestazioni del piano non risultano eseguite'}${plan.titolo ? ` (${plan.titolo})` : ''}.`,
          source: 'treatment_plan',
          sourceId,
          confidence: 0.95,
          contactRecommended: !hasFuture,
          context: {
            remainingCount: remaining.length,
            planTitle: plan.titolo || null,
            treatments: remaining.map((voice) => voice.prestazione).filter(Boolean).slice(0, 3),
          },
        }));
        if (!hasFuture) {
          signals.push(createSignal({
            type: SIGNAL_TYPE.NO_FUTURE_APPOINTMENT,
            taxonomy: SIGNAL_TAXONOMY.FOLLOW_UP,
            severity: SEVERITY.HIGH,
            reason: 'Non risulta un appuntamento futuro per proseguire il piano.',
            source: 'appointment_index',
            confidence: 1,
            contactRecommended: true,
          }));
        }
      }
    } else if (WAITING_PLAN_STATES.has(status)) {
      const age = daysSince(plan.data, today);
      if (age != null && age >= 14 && !hasFuture) {
        signals.push(createSignal({
          type: SIGNAL_TYPE.ACCEPTED_QUOTE_FOLLOW_UP,
          taxonomy: SIGNAL_TAXONOMY.ADMINISTRATIVE,
          severity: SEVERITY.LOW,
          reason: `Il preventivo "${plan.titolo || 'senza titolo'}" risulta in attesa da ${age} giorni e non ha un appuntamento futuro.`,
          source: 'treatment_plan',
          sourceId,
          confidence: 0.9,
          contactRecommended: true,
          context: { ageDays: age, planTitle: plan.titolo || null },
        }));
      }
    }
  }

  return signals;
}
