import { isValidToothNumber } from './poliedron/planner/toothModel.js';

export const ANATOMICAL_AREA_TYPE = Object.freeze({
  TOOTH: 'tooth',
  FACE_REGION: 'face_region',
  BODY_REGION: 'body_region',
  UNASSIGNED: 'unassigned',
});

const idEquals = (left, right) => String(left ?? '') === String(right ?? '');
const rowStudioId = (row) => row?.studio_id ?? row?.studioId ?? null;

export function belongsToCockpitTenant(row, studioId) {
  const tenantId = rowStudioId(row);
  return tenantId != null && studioId != null && idEquals(tenantId, studioId);
}

export function rowsForPatient(rows, patientId, studioId) {
  return (rows || []).filter((row) => {
    const rowPatientId = row?.pazienteId ?? row?.paziente_id ?? row?.patientId;
    return idEquals(rowPatientId, patientId) && belongsToCockpitTenant(row, studioId);
  });
}

export function treatmentArea(item, { dentalApplicable = true } = {}) {
  const tooth = String(item?.dente ?? '').trim();
  if (dentalApplicable && tooth && isValidToothNumber(tooth)) {
    return Object.freeze({
      type: ANATOMICAL_AREA_TYPE.TOOTH,
      value: tooth,
      label: `Elemento ${tooth}`,
    });
  }
  return Object.freeze({
    type: ANATOMICAL_AREA_TYPE.UNASSIGNED,
    value: 'unassigned',
    label: dentalApplicable ? 'Elemento da completare' : 'Contesto non specificato',
  });
}

export function patientTreatments(plans, patientId, studioId, { dentalApplicable = true } = {}) {
  return rowsForPatient(plans, patientId, studioId).flatMap((plan) => (
    (plan.voci || []).map((item, itemIndex) => Object.freeze({
      key: `${plan.id}:${itemIndex}`,
      planId: plan.id,
      planTitle: plan.titolo || 'Piano di cura',
      planDate: plan.data || null,
      itemIndex,
      procedure: item.prestazione || 'Prestazione senza nome',
      tooth: item.dente ? String(item.dente) : null,
      price: Number(item.prezzo || 0),
      priceAvailable: item.prezzo !== '' && item.prezzo != null && Number.isFinite(Number(item.prezzo)),
      completed: item.eseguita === true,
      completedAt: item.dataEsec || null,
      collected: item.incassata === true,
      notes: item.note || item.nota || '',
      dentalApplicable,
      area: treatmentArea(item, { dentalApplicable }),
    }))
  ));
}

export function groupTreatmentsByArea(treatments) {
  const groups = new Map();
  for (const treatment of treatments || []) {
    const key = `${treatment.area.type}:${treatment.area.value}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        area: treatment.area,
        treatments: [],
        completedCount: 0,
        remainingCount: 0,
      });
    }

    const group = groups.get(key);
    group.treatments.push(treatment);
    if (treatment.completed) group.completedCount += 1;
    else group.remainingCount += 1;
  }
  return [...groups.values()]
    .map((group) => Object.freeze({ ...group, treatments: Object.freeze(group.treatments) }))
    .sort((left, right) => {
      if (left.area.type === ANATOMICAL_AREA_TYPE.UNASSIGNED) return 1;
      if (right.area.type === ANATOMICAL_AREA_TYPE.UNASSIGNED) return -1;
      return left.area.label.localeCompare(right.area.label, 'it', { numeric: true });
    });
}

export function filterTreatmentGroups(groups, filter = 'all') {
return (groups || []).map((group) => {
  const treatments = group.treatments.filter((item) => (
    filter === 'all' || (filter === 'todo' ? !item.completed : item.completed)
  ));
  const completedCount = treatments.filter((item) => item.completed).length;
  return {
    ...group,
    treatments,
    completedCount,
    remainingCount: treatments.length - completedCount,
  };
}).filter((group) => group.treatments.length > 0);
}

export function treatmentSummary(treatments) {
  const completed = (treatments || []).filter((item) => item.completed).length;
  return Object.freeze({
    total: (treatments || []).length,
    completed,
    remaining: (treatments || []).length - completed,
  });
}

export function patientFinancialSummary({ plans, payments, patientId, studioId }) {
  void plans;
  void payments;
  void patientId;
  void studioId;
  return Object.freeze({
    planned: null,
    collected: null,
    outstanding: null,
    available: false,
    source: null,
    reason: 'Nessun contratto finanziario canonico per-paziente disponibile.',
  });
}

export function patientAppointments(appointments, patientId, studioId, todayIso) {
  const patientRows = rowsForPatient(appointments, patientId, studioId)
    .filter((appointment) => appointment.stato !== 'annullato')
    .sort((left, right) => `${left.data || ''}T${left.ora || ''}`.localeCompare(`${right.data || ''}T${right.ora || ''}`));
  const future = patientRows.filter((appointment) => (appointment.data || '') >= todayIso);
  return Object.freeze({
    last: [...patientRows].reverse().find((appointment) => (appointment.data || '') < todayIso) || null,
    next: future[0] || null,
    all: Object.freeze(patientRows),
  });
}

export function derivePatientDataHealth(treatments) {
  const issues = [];
  for (const treatment of treatments || []) {
    if (treatment.dentalApplicable && treatment.area.type === ANATOMICAL_AREA_TYPE.UNASSIGNED) {
      issues.push(Object.freeze({
        key: `${treatment.key}:tooth`,
        type: 'CLINICAL_METADATA_INCOMPLETE',
        field: 'tooth',
        label: `${treatment.procedure}: elemento dentario da completare`,
        treatmentKey: treatment.key,
      }));
    }
    if (!treatment.priceAvailable) {
      issues.push(Object.freeze({
        key: `${treatment.key}:price`,
        type: 'CLINICAL_METADATA_INCOMPLETE',
        field: 'price',
        label: `${treatment.procedure}: prezzo non disponibile`,
        treatmentKey: treatment.key,
      }));
    }
  }
  return Object.freeze({
    issues: Object.freeze(issues),
    completenessPercent: null,
    scoreAvailable: false,
    reason: 'Nessun punteggio Data Health paziente canonico disponibile.',
  });
}

export function buildPatientTimeline({ treatments, appointments, payments, annotations = [] }) {
  const entries = [
    ...(treatments || []).filter((item) => item.completedAt).map((item) => ({
      key: `treatment:${item.key}`,
      date: item.completedAt,
      type: 'treatment',
      title: item.procedure,
      detail: item.area.type === ANATOMICAL_AREA_TYPE.TOOTH ? item.area.label : 'Area non specificata',
    })),
    ...(appointments || []).map((appointment) => ({
      key: `appointment:${appointment.id}`,
      date: appointment.data,
      time: appointment.ora || '',
      type: 'appointment',
      title: appointment.tipo || 'Appuntamento',
      detail: appointment.stato || '',
    })),
    ...(payments || []).map((payment) => ({
      key: `payment:${payment.id}`,
      date: payment.data,
      type: 'payment',
      title: 'Pagamento registrato',
      amount: Number(payment.importo || 0),
      detail: payment.metodo || '',
    })),
    ...(annotations || []).map((annotation) => ({
      key: `annotation:${annotation.id}`,
      date: annotation.data,
      type: 'annotation',
      title: 'Annotazione clinica',
      detail: annotation.testo || '',
    })),
  ];
  return Object.freeze(entries
    .filter((entry) => entry.date)
    .sort((left, right) => `${right.date}T${right.time || ''}`.localeCompare(`${left.date}T${left.time || ''}`)));
}

export function buildPatientCockpitModel({
  patient,
  plans,
  payments,
  appointments,
  studioId,
  vertical,
  todayIso,
}) {
  const dentalApplicable = !vertical || vertical === 'dentistico';
  const treatments = patientTreatments(plans, patient?.id, studioId, { dentalApplicable });
  const patientAppointmentModel = patientAppointments(appointments, patient?.id, studioId, todayIso);
  const filteredPayments = rowsForPatient(payments, patient?.id, studioId);
  return Object.freeze({
    dentalApplicable,
    treatments: Object.freeze(treatments),
    treatmentGroups: Object.freeze(groupTreatmentsByArea(treatments)),
    treatmentSummary: treatmentSummary(treatments),
    financial: patientFinancialSummary({ plans, payments, patientId: patient?.id, studioId }),
    appointments: patientAppointmentModel,
    dataHealth: derivePatientDataHealth(treatments),
    timeline: buildPatientTimeline({
      treatments,
      appointments: patientAppointmentModel.all,
      payments: filteredPayments,
      annotations: patient?.annotazioni || [],
    }),
  });
}

export function buildAnatomicalContext(type, value, label) {
  if (!Object.values(ANATOMICAL_AREA_TYPE).includes(type) || type === ANATOMICAL_AREA_TYPE.UNASSIGNED) {
    return null;
  }
  if (!String(value || '').trim()) return null;
  return Object.freeze({ type, value: String(value), label: label || String(value) });
}

export function buildMultiTreatmentPreview(selectedAreas, procedure) {
  if (!procedure || !(selectedAreas || []).length) return [];
  return Object.freeze((selectedAreas || []).map((area) => Object.freeze({
    anatomicalContext: area,
    procedure,
  })));
}
