import {
  createSignal, patientDisplayName, patientKey, SEVERITY, SIGNAL_TAXONOMY, SIGNAL_TYPE,
} from './model.js';

const normalize = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

const activityText = (activity) => [
  activity.testo, activity.titolo, activity.note, activity.descrizione,
].filter(Boolean).join(' ');

const OPEN_ACTIVITY_STATES = new Set(['aperto', 'da_fare', 'todo', 'pending', 'open']);

const isOpenActivity = (activity) => (
  activity.fatto === false
  || OPEN_ACTIVITY_STATES.has(String(activity.stato || '').toLowerCase())
);

export function buildActivityIndex(activities, patients, canReadOperations) {
  const byPatient = new Map();
  if (!canReadOperations) return byPatient;
  const patientsById = new Map(patients.map((patient) => [patientKey(patient.id), patient]));
  const patientsByName = new Map();
  const namesByFirstToken = new Map();
  for (const patient of patients) {
    const name = normalize(patientDisplayName(patient));
    if (!name) continue;
    const list = patientsByName.get(name) || [];
    list.push(patient);
    patientsByName.set(name, list);
    const firstToken = name.split(' ')[0];
    const names = namesByFirstToken.get(firstToken) || new Set();
    names.add(name);
    namesByFirstToken.set(firstToken, names);
  }

  for (const activity of activities) {
    if (!isOpenActivity(activity)) continue;
    const explicitId = activity.pazienteId ?? activity.patientId ?? activity.paziente_id;
    let patient = explicitId != null ? patientsById.get(patientKey(explicitId)) : null;
    let association = patient ? 'patient_id' : null;
    if (explicitId != null && !patient) continue;
    if (!patient) {
      const text = normalize(activityText(activity));
      const matches = [];
      const candidateNames = new Set();
      for (const token of text.split(' ')) {
        for (const name of namesByFirstToken.get(token) || []) candidateNames.add(name);
      }
      for (const name of candidateNames) {
        const candidates = patientsByName.get(name) || [];
        if (candidates.length === 1 && (` ${text} `).includes(` ${name} `)) matches.push(candidates[0]);
      }
      if (matches.length === 1) {
        patient = matches[0];
        association = 'unique_full_name';
      }
    }
    if (!patient) continue;
    const key = patientKey(patient.id);
    const list = byPatient.get(key) || [];
    list.push(createSignal({
      type: SIGNAL_TYPE.OPEN_ACTIVITY,
      taxonomy: SIGNAL_TAXONOMY.FOLLOW_UP,
      severity: SEVERITY.MEDIUM,
      reason: `Attività aperta collegata al paziente: ${activityText(activity) || 'attività senza descrizione'}.`,
      source: 'activity',
      sourceId: activity.id ?? null,
      confidence: association === 'patient_id' ? 0.98 : 0.72,
      contactRecommended: true,
      context: { association },
    }));
    byPatient.set(key, list);
  }
  return byPatient;
}
