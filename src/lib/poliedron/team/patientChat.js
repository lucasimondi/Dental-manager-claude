// Patient chats in the Poliedron chat list (WhatsApp style). Pure helpers.
export const PATIENT_PREFIX = 'patient:';
export const patientChatKey = (id) => `${PATIENT_PREFIX}${id}`;
export const patientIdFromKey = (key) => (typeof key === 'string' && key.startsWith(PATIENT_PREFIX) ? key.slice(PATIENT_PREFIX.length) : null);
export const patientName = (p) => `${p?.nome || ''} ${p?.cognome || ''}`.trim() || 'Paziente';
export const patientInitials = (p) => `${(p?.nome || '?')[0]}${(p?.cognome || '')[0] || ''}`.toUpperCase();

/** wa.me link for an Italian or international number; null when unusable. */
export function whatsappLink(phone, text = '') {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length < 6) return null;
  if (!digits.startsWith('39') || digits.length <= 10) digits = `39${digits}`;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/** Patients matching a search (name, surname, phone), at most `limit`. */
export function searchPatients(patients = [], query = '', limit = 30) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const out = [];
  for (const p of patients) {
    const hay = `${p.nome || ''} ${p.cognome || ''} ${p.telefono || ''}`.toLowerCase();
    if (words.every((w) => hay.includes(w))) out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

/** Messages containing the search text across chats: [{ key, id, content, at }]. */
export function searchMessages(threadsByKey = {}, query = '', limit = 30) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const hits = [];
  for (const [key, thread] of Object.entries(threadsByKey)) {
    for (const m of thread || []) {
      if (typeof m?.content === 'string' && m.content.toLowerCase().includes(q)) hits.push({ key, id: m.id, content: m.content, at: m.at || m.created_at || null });
    }
  }
  return hits.sort((a, b) => String(b.at || '').localeCompare(String(a.at || ''))).slice(0, limit);
}
