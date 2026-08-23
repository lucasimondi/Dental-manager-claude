import {
  belongsToTenant, patientDisplayName, patientKey, SIGNAL_TAXONOMY, SIGNAL_TYPE,
} from './model.js';
import { buildAppointmentIndex, hasFutureAppointment } from './appointmentScanner.js';
import { scanTreatmentPlans } from './treatmentPlanScanner.js';
import { scanRecalls } from './recallScanner.js';
import { scanHygiene } from './hygieneScanner.js';
import { buildActivityIndex } from './activityScanner.js';
import { scanDataCompleteness } from './dataCompletenessScanner.js';
import { scoreSignals } from './scoringEngine.js';
import { calculateStudioDataHealth } from './studioDataHealth.js';
import {
  createIntelligenceCacheKey, createIntelligenceFingerprint, getCachedIntelligence, setCachedIntelligence,
} from './intelligenceCache.js';

const mapByPatient = (rows, fieldNames) => {
  const map = new Map();
  for (const row of rows) {
    const patientId = fieldNames.map((field) => row?.[field]).find((value) => value != null);
    if (patientId == null) continue;
    const key = patientKey(patientId);
    const list = map.get(key) || [];
    list.push(row);
    map.set(key, list);
  }
  return map;
};

const localDate = (date = new Date()) => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
);

const hasMatchingPreventionRecall = (signals, hygieneSignal) => {
  const hygieneDue = hygieneSignal?.context?.configuredDueDate;
  if (!hygieneDue) return false;
  const target = new Date(`${hygieneDue}T12:00:00`).getTime();
  return signals.some((signal) => {
    if (
      signal.taxonomy !== SIGNAL_TAXONOMY.PREVENTION
      || !signal.context?.dueDate
      || !/igien/i.test(String(signal.context?.subject || ''))
    ) return false;
    const recallDue = new Date(`${signal.context.dueDate}T12:00:00`).getTime();
    return Math.abs(recallDue - target) <= 20 * 86400000;
  });
};

const groupResults = (results) => {
  const contact = [];
  const dataQuality = [];
  for (const result of results) {
    const contactSignals = result.signals.filter((signal) => signal.contactRecommended);
    const qualitySignals = result.signals.filter((signal) => signal.taxonomy === SIGNAL_TAXONOMY.DATA_QUALITY);
    if (contactSignals.length) {
      contact.push({ ...result, visibleSignals: contactSignals });
    }
    if (qualitySignals.length) {
      dataQuality.push({ ...result, visibleSignals: qualitySignals });
    }
  }
  return Object.freeze([
    Object.freeze({ group: 'DA CONTATTARE', items: Object.freeze(contact) }),
    Object.freeze({ group: 'DATI DA COMPLETARE', items: Object.freeze(dataQuality) }),
  ]);
};

export function scanPatientOpportunities({
  studioId,
  today = localDate(),
  vertical = 'dentistico',
  permissions = {},
  sources = {},
  useCache = true,
} = {}) {
  if (!studioId || permissions.activeMember !== true) {
    return Object.freeze({
      results: Object.freeze([]),
      groups: Object.freeze([]),
      studioDataHealth: calculateStudioDataHealth({
        results: [], patientCount: 0, planCount: 0, performanceCount: 0, available: false,
      }),
      tokenUsage: 0,
      cacheHit: false,
    });
  }

  const tenantSources = {
    patients: (sources.patients || []).filter((row) => belongsToTenant(row, studioId)),
    plans: (sources.plans || []).filter((row) => belongsToTenant(row, studioId)),
    appointments: (sources.appointments || []).filter((row) => belongsToTenant(row, studioId)),
    recalls: (sources.recalls || sources.richiami || []).filter((row) => belongsToTenant(row, studioId)),
    activities: (sources.activities || sources.impegni || []).filter((row) => belongsToTenant(row, studioId)),
  };
  const fingerprint = createIntelligenceFingerprint(tenantSources);
  const cacheKey = createIntelligenceCacheKey({ studioId, fingerprint: `${today}|${vertical}|${JSON.stringify(permissions)}|${fingerprint}` });
  if (useCache) {
    const cached = getCachedIntelligence(cacheKey);
    if (cached) return Object.freeze({ ...cached, cacheHit: true });
  }

  const canReadOperations = permissions.operations === true;
  const canReadClinical = permissions.clinical === true;
  const canReadFinancial = permissions.financial === true;
  const plansByPatient = mapByPatient(tenantSources.plans, ['pazienteId', 'patientId', 'paziente_id']);
  const recallsByPatient = mapByPatient(tenantSources.recalls, ['pazienteId', 'patientId', 'paziente_id']);
  const appointmentIndex = buildAppointmentIndex(tenantSources.appointments, today);
  const activityIndex = buildActivityIndex(tenantSources.activities, tenantSources.patients, canReadOperations);
  const results = [];

  for (const patient of tenantSources.patients) {
    const key = patientKey(patient.id);
    const plans = plansByPatient.get(key) || [];
    const future = hasFutureAppointment(appointmentIndex, patient.id);
    const treatmentSignals = scanTreatmentPlans({
      plans,
      hasFuture: future,
      today,
      canReadClinical,
    });
    const recallSignals = scanRecalls({
      recalls: recallsByPatient.get(key) || [],
      patientId: patient.id,
      appointmentIndex,
      today,
      canReadOperations,
      canReadFinancial,
    });
    let hygieneSignals = scanHygiene({
      plans,
      patientId: patient.id,
      appointmentIndex,
      today,
      canReadClinical,
      vertical,
    });
    hygieneSignals = hygieneSignals.filter((signal) => (
      signal.type !== SIGNAL_TYPE.HYGIENE_OVERDUE
      || !hasMatchingPreventionRecall(recallSignals, signal)
    ));
    const signals = [
      ...treatmentSignals,
      ...recallSignals,
      ...hygieneSignals,
      ...(activityIndex.get(key) || []),
      ...scanDataCompleteness({ plans, canReadClinical }),
    ];
    if (!signals.length) continue;
    const scored = scoreSignals(signals);
    results.push(Object.freeze({
      patientId: patient.id,
      patientName: patientDisplayName(patient),
      patient,
      score: scored.score,
      confidence: scored.confidence,
      contactRecommended: signals.some((signal) => signal.contactRecommended),
      signals: Object.freeze(signals),
    }));
  }

  results.sort((a, b) => b.score - a.score || b.confidence - a.confidence || a.patientName.localeCompare(b.patientName, 'it'));
  const performanceCount = tenantSources.plans.reduce((sum, plan) => sum + (Array.isArray(plan.voci) ? plan.voci.length : 0), 0);
  const value = Object.freeze({
    results: Object.freeze(results),
    groups: groupResults(results),
    studioDataHealth: calculateStudioDataHealth({
      results,
      patientCount: tenantSources.patients.length,
      planCount: canReadClinical ? tenantSources.plans.length : 0,
      performanceCount: canReadClinical ? performanceCount : 0,
      available: canReadClinical && tenantSources.patients.length > 0,
    }),
    tokenUsage: 0,
    cacheHit: false,
    fingerprint,
  });
  if (useCache) setCachedIntelligence(cacheKey, value);
  return value;
}
