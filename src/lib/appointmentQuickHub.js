export function normalizePhoneForTel(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const normalized = raw.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  return /^\+?\d{5,}$/.test(normalized) ? normalized : null;
}

export function patientDisplayName(patient) {
  return [patient?.nome, patient?.cognome].filter(Boolean).join(' ').trim();
}

export function buildActivityText(text, patient) {
  const cleanText = String(text || '').trim();
  const name = patientDisplayName(patient);
  if (!cleanText) return '';
  return name ? `${name} — ${cleanText}` : cleanText;
}

export const APPOINTMENT_PATIENT_ACTIONS = [
  { id: 'treatment', label: 'Prestazione', icon: 'tooth' },
  { id: 'prescription', label: 'Ricetta', icon: 'file' },
  { id: 'documents', label: 'Documenti', icon: 'folder' },
  { id: 'payment', label: 'Incasso', icon: 'eur' },
];

export function appointmentPatientAction(patient, appointment, action) {
  if (!patient?.id || !appointment || String(appointment.pazienteId) !== String(patient.id) || !APPOINTMENT_PATIENT_ACTIONS.some(item => item.id === action)) return null;
  const tab = action === 'treatment' ? 'piani' : action === 'payment' ? 'paga' : 'doc';
  const documentType = action === 'prescription' ? 'ricetta' : action === 'documents' ? 'medico' : null;
  return { tab, initialAction: action, documentType };
}
