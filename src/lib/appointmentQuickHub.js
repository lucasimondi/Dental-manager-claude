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
