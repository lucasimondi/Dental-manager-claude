// Poliedron Core — deterministic parsing of everyday commands beyond the agenda
// slot itself: appointment details, agenda blocks/holidays, patient record,
// recalls and payments. Pure functions on the raw text (case is kept for notes
// and names). A parser returns null whenever the sentence is not clearly its
// own: the model path then decides, as before. Identity, permissions and
// validation always happen server-side afterwards.
import { agendaMentions, hasDay, identifyAppointment, DAY_WORDS, MONTH_NAMES } from './poliedron-agenda.js';

const clean = (v = '') => String(v).normalize('NFC').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
const lower = (v = '') => clean(v).toLocaleLowerCase('it-IT');
const NAME = "[A-Za-zÀ-ÿ'][A-Za-zÀ-ÿ' ]{1,60}?";
export const VISIT_TYPES = ['igiene', 'controllo', 'visita', 'devitalizzazione', 'estrazione', 'implantologia', 'ortodonzia'];
const capitalize = (s) => s.replace(/(^|[\s'])([a-zà-ÿ])/g, (m, a, b) => a + b.toLocaleUpperCase('it-IT'));
const nameCase = (s) => (s === s.toLocaleLowerCase('it-IT') ? capitalize(s) : s);

// ── Appointment details: duration, type, status ─────────────────────────────
const NUMBER_WORDS = { un: 1, una: 1, uno: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, undici: 11, dodici: 12, diciotto: 18, ventiquattro: 24 };
const num = (w) => (/^\d+$/.test(w) ? Number(w) : NUMBER_WORDS[w] ?? null);

export function parseDuration(q) {
  if (/\bun'?\s?ora e mezza\b/.test(q)) return 90;
  if (/\bmezz'?\s?ora\b/.test(q)) return 30;
  const h = q.match(/\b(un|una|due|tre|\d)\s*'?\s*or[ae]\b/);
  if (h) return num(h[1]) * 60;
  const m = q.match(/\b(\d{1,3})\s*(?:min|minuti|')(?![a-z])/);
  return m ? Number(m[1]) : null;
}

/**
 * "Allunga l'appuntamento di Rossi di domani a 60 minuti", "cambia
 * l'appuntamento di Rossi in controllo", "conferma l'appuntamento di Rossi",
 * "segna da confermare l'appuntamento di domani alle 15", "allungalo a un'ora".
 * Identification (patient / slot) is read like "sposta…" by the caller.
 */
export function parseAppointmentUpdate(text = '') {
  const q = lower(text);
  const noun = /\b(?:appuntament[oi]|prenotazion[ei]|visita)\b/.test(q);
  const clitic = /\b(?:allungal|accorcial|confermal|segnal|cambial|portal|fall)[oa]\b/.test(q);
  if (!noun && !clitic) return null;
  const changes = {};
  if (/\b(?:allung|accorci|dur|port)\w*\b/.test(q) || /\bfa(?:llo|lla)? durare\b/.test(q)) {
    const d = parseDuration(q);
    if (d) changes.durata = d;
  }
  const tipo = q.match(/\b(?:cambia\w*|trasforma\w*|tipo)\b.*?\b(?:in|a|come)\s+(igiene|controllo|visita|devitalizzazione|estrazione|implantologia|ortodonzia)\b/);
  if (tipo) changes.tipo = capitalize(tipo[1]);
  if (/\b(?:segna\w*|metti\w*|imposta\w*)\b.*\bda confermare\b/.test(q)) changes.stato = 'da confermare';
  else if (/^(?:conferma|confermalo|confermala)\b/.test(q) || /\b(?:segna\w*|metti\w*)\b.*\bcome confermat[oa]\b/.test(q)) changes.stato = 'confermato';
  if (!Object.keys(changes).length) return null;
  // The new values are not part of the name: "allungalo a un'ora", "in controllo".
  const rest = q.replace(/\b(?:a|di|per)\s+(?:\d{1,3}\s*(?:minuti|min|')|un'?\s?ora(?: e mezza)?|mezz'?\s?ora|(?:due|tre)\s+ore)/g, ' ')
    .replace(/\b(?:in|come|a)\s+(?:igiene|controllo|visita|devitalizzazione|estrazione|implantologia|ortodonzia|confermat[oa])\b/g, ' ')
    .replace(/\bda confermare\b/g, ' ');
  const sp = rest.indexOf(' ');
  const target = identifyAppointment(rest, sp < 0 ? rest.length : sp + 1);
  if (!target) return { intent: 'APPOINTMENT_UPDATE', confidence: .94, entities: {}, missing: ['unclear'] };
  const known = target.patient_query || (hasDay(target.from) && target.from.time);
  return { intent: 'APPOINTMENT_UPDATE', confidence: .94, entities: { ...target, changes, use_context: clitic && !known }, missing: known || clitic ? [] : ['patient'] };
}

// ── Agenda blocks and holidays ──────────────────────────────────────────────
const MONTH_RE = MONTH_NAMES.join('|');

function range(q) {
  // "dal 10 al 15 agosto", "dal 10 agosto al 2 settembre", "dal 10/8 al 15/8"
  const m = q.match(new RegExp(`\\bdal(?:l')?\\s*(\\d{1,2})(?:\\s+(${MONTH_RE})|\\s*/\\s*(\\d{1,2}))?\\s+al(?:l')?\\s*(\\d{1,2})(?:\\s+(${MONTH_RE})|\\s*/\\s*(\\d{1,2}))`));
  if (!m) return null;
  const month = (name, n) => (name ? MONTH_NAMES.indexOf(name) + 1 : n ? Number(n) : null);
  const toMonth = month(m[5], m[6]);
  const fromMonth = month(m[2], m[3]) ?? toMonth;
  if (!toMonth) return null;
  return { from: { day_of_month: Number(m[1]), month: fromMonth }, to: { day_of_month: Number(m[4]), month: toMonth } };
}

/**
 * "Ferie dal 10 al 15 agosto", "blocca venerdì pomeriggio", "blocca domani
 * dalle 14 alle 16 per corso", "chiudi l'agenda lunedì", "chiamata col
 * laboratorio domani alle 12". Day parts are resolved with the studio's agenda
 * hours by the caller (mattina = apertura–13:00, pomeriggio = 14:00–chiusura).
 */
export function parseAgendaBlock(text = '') {
  const q = lower(text);
  if (VISIT_TYPES.some((t) => new RegExp(`\\b${t}\\b`).test(q)) || /\bappuntament/.test(q)) return null;
  const ferie = /\bferie\b/.test(q) && !/\?$/.test(q);
  const call = q.match(/^(?:segna\s+|metti\s+|fissa\s+)?(?:una\s+)?(chiamata|telefonata|riunione)\s+(?:con|col|coi|alla|al|allo)\s+(.+?)\s+(?=(?:oggi|domani|dopodomani|luned|marted|mercoled|gioved|venerd|sabato|domenica|il\s+\d|\d|alle|dalle))/);
  const block = new RegExp(`^(?:blocca|bloccami|chiudi)\\s+(?:l'agenda\\s+|agenda\\s+|lo studio\\s+)?(?:(?:il|la|tutto il|tutta la)\\s+)?(?:pomeriggio|mattina|mattinata|giornata|${DAY_WORDS}|dal|il\\s+\\d|\\d)`).test(q);
  if (!ferie && !call && !block) return null;

  const span = range(q);
  const day = span ? null : agendaMentions(q).find((m) => m.kind === 'day')?.value || null;
  if (!span && !day) return { intent: 'AGENDA_BLOCK', confidence: .94, entities: {}, missing: ['day'] };
  const times = agendaMentions(q).filter((m) => m.kind === 'time').map((m) => m.value);
  const part = /\bpomeriggio\b/.test(q) ? 'pomeriggio' : /\bmattin/.test(q) ? 'mattina' : null;
  const title = q.match(/\bper\s+([a-zà-ÿ' ]{3,60})$/);
  const tipo = ferie ? 'ferie' : call ? 'chiamata' : 'personale';
  const titolo = ferie ? 'Ferie'
    : call ? capitalize(call[1]) + call[0].slice(call[0].indexOf(call[1]) + call[1].length).replace(/\s+$/, '')
    : title ? title[1].trim().replace(/^./, (c) => c.toLocaleUpperCase('it-IT')) : 'Agenda bloccata';
  const entities = { tipo, titolo, ...(span ? { from: span.from, to: span.to } : { from: day, to: day }) };
  if (call) {
    if (!times[0]) return { intent: 'AGENDA_BLOCK', confidence: .94, entities, missing: ['time'] };
    entities.ora_inizio = times[0];
    entities.durata = parseDuration(q) || 30;
  } else if (times.length >= 2) { entities.ora_inizio = times[0]; entities.ora_fine = times[1]; }
  else if (part) entities.parte = part;
  else if (times.length === 1) return { intent: 'AGENDA_BLOCK', confidence: .94, entities, missing: ['end'] };
  return { intent: 'AGENDA_BLOCK', confidence: .94, entities, missing: [] };
}

// ── Patient record ──────────────────────────────────────────────────────────
/** "Aggiungi una nota a Mario Rossi: allergico alla penicillina", "nota per Rossi: …", "annota su Rossi: …". */
export function parsePatientNote(text = '') {
  const t = clean(text);
  const m = t.match(new RegExp(`^(?:(?:aggiungi|metti|scrivi|inserisci)\\s+(?:una\\s+)?nota|nota|annota)\\s+(?:a|al|alla|per|su|sul|sulla|nella scheda di|in scheda di)\\s+(?:paziente\\s+)?(${NAME})\\s*(?::|,|-)\\s*(.{2,2000})$`, 'i'));
  if (!m) return null;
  return { intent: 'PATIENT_NOTE', confidence: .95, entities: { patient_query: m[1].trim(), testo: m[2].trim() }, missing: [] };
}

/** "Il telefono di Mario Rossi è 333 1234567", "cambia l'email di Rossi in mario@x.it". */
export function parsePatientContact(text = '') {
  const t = clean(text);
  const m = t.match(new RegExp(`^(?:(?:cambia|aggiorna|modifica|imposta|segna)\\s+)?(?:il|l'|la)?\\s*(telefono|cellulare|numero(?: di telefono)?|e-?mail|mail|indirizzo email)\\s+(?:di|del|della|per)\\s+(?:paziente\\s+)?(${NAME})\\s*(?:è|e'|:|=|in|con|diventa)\\s*(.+)$`, 'i'));
  if (!m) return null;
  const field = /mail/i.test(m[1]) ? 'email' : 'telefono';
  const value = m[3].trim().replace(/[.;]$/, '');
  if (field === 'telefono' && !/^\+?[\d\s./-]{6,20}$/.test(value)) return null;
  if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null;
  return { intent: 'PATIENT_CONTACT', confidence: .95, entities: { patient_query: m[2].trim(), field, value: field === 'telefono' ? value.replace(/[\s./-]/g, '') : value.toLowerCase() }, missing: [] };
}

/** "Nuovo paziente Mario Bianchi 333 1234567", "crea il paziente Anna Verdi, email anna@x.it". Exactly nome + cognome. */
export function parseNewPatient(text = '') {
  const t = clean(text);
  const m = t.match(/^(?:(?:crea|aggiungi|inserisci|registra)\s+(?:un\s+|il\s+)?(?:nuovo\s+)?paziente|nuovo paziente)\s*:?\s+(.+)$/i);
  if (!m) return null;
  const rest = m[1];
  const nameMatch = rest.match(/^([A-Za-zÀ-ÿ'][A-Za-zÀ-ÿ' ]*?)(?=\s*(?:,|\btel\w*\b|\bcell\w*\b|\be-?mail\b|\+?\d|$))/i);
  if (!nameMatch) return null;
  const words = nameMatch[1].trim().split(/\s+/);
  // "Maria Grazia Rossi": which part is the surname? Ask instead of guessing.
  if (words.length !== 2) return { intent: 'PATIENT_CREATE', confidence: .94, entities: {}, missing: ['name'] };
  const phone = rest.match(/\+?\d[\d\s./-]{5,18}\d/);
  const email = rest.match(/[^\s@,]+@[^\s@,]+\.[^\s@,]+/);
  return { intent: 'PATIENT_CREATE', confidence: .95, entities: { nome: nameCase(words[0]), cognome: nameCase(words[1]), ...(phone ? { telefono: phone[0].replace(/[\s./-]/g, '') } : {}), ...(email ? { email: email[0].toLowerCase() } : {}) }, missing: [] };
}

// ── Recalls ─────────────────────────────────────────────────────────────────
const UNIT_DAYS = { giorno: 1, giorni: 1, settimana: 7, settimane: 7 };
/** "Richiamo per Mario Rossi tra 6 mesi per controllo", "richiama Rossi fra due settimane", "metti un richiamo a Rossi il 12/03". */
export function parseRecall(text = '') {
  const q = lower(text);
  const m = q.match(new RegExp(`^(?:(?:crea|metti|aggiungi|fissa|imposta|segna)\\s+(?:un\\s+)?richiamo|richiamo|richiama)\\s+(?:a|al|alla|per|di)?\\s*(?:paziente\\s+)?([a-zà-ÿ' ]{3,60}?)\\s+(?=(?:tra|fra|entro|il\\s+\\d|\\d|${DAY_WORDS}|a\\s+(?:${MONTH_RE})))(.*)$`));
  if (!m) return null;
  const rest = m[2];
  const rel = rest.match(/^(?:tra|fra|entro)\s+(\d+|un|una|due|tre|quattro|sei|dodici|diciotto|ventiquattro)\s+(giorn[oi]|settiman[ae]|mes[ei]|ann[oi])\b/);
  const month = rest.match(new RegExp(`^a\\s+(${MONTH_RE})\\b`));
  const day = agendaMentions(rest).find((x) => x.kind === 'day');
  let due = null;
  if (rel) {
    const n = num(rel[1]);
    due = rel[2].startsWith('mes') ? { months: n } : rel[2].startsWith('ann') ? { months: 12 * n } : { days: n * UNIT_DAYS[rel[2]] };
  } else if (month) due = { month: MONTH_NAMES.indexOf(month[1]) + 1 };
  else if (day && hasDay(day.value)) due = { day: day.value };
  if (!due) return null;
  const motivo = rest.match(/\bper\s+(.{3,200})$/)?.[1]?.trim() || null;
  const categoria = motivo && /\b(?:controllo|igiene|visita|ablazione|impianto|ortodonz|clinic)/.test(motivo) ? 'clinico' : 'generico';
  return { intent: 'RECALL_CREATE', confidence: .94, entities: { patient_query: m[1].trim(), due, motivo: motivo ? motivo.charAt(0).toUpperCase() + motivo.slice(1) : null, categoria }, missing: [] };
}

// ── Payments ────────────────────────────────────────────────────────────────
const METHODS = [['contant', 'Contanti'], ['cash', 'Contanti'], ['carta', 'Carta'], ['bancomat', 'POS'], ['pos', 'POS'], ['bonifico', 'Bonifico'], ['assegno', 'Assegno']];
/** "Mario Rossi ha pagato 150 euro con carta", "registra un pagamento di 80 € in contanti per Rossi", "… ieri". */
export function parsePayment(text = '') {
  const t = clean(text);
  if (/\?\s*$/.test(t)) return null;
  const amountRe = '(\\d{1,3}(?:\\.\\d{3})*(?:,\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)\\s*(?:euro|eur|€)?';
  let m = t.match(new RegExp(`^(?:il paziente\\s+|la paziente\\s+)?(${NAME})\\s+ha\\s+(?:pagato|versato|saldato|lasciato)\\s+(?:un acconto di\\s+)?${amountRe}(.*)$`, 'i'));
  let patient, amount, rest;
  if (m) [, patient, amount, rest] = m;
  else {
    m = t.match(new RegExp(`^registra\\s+(?:un\\s+)?(?:pagamento|incasso|acconto)\\s+(?:di\\s+)?${amountRe}\\s*(.*?)\\s*(?:di|per|da)\\s+(?:paziente\\s+)?(${NAME})(?:\\s+(ieri|oggi))?$`, 'i'));
    if (!m) return null;
    [, amount, rest, patient] = m;
    rest = `${rest} ${m[4] || ''}`;
  }
  const r = lower(rest || '');
  if (/\b(?:deve|dovr|ancora da|sospes)/.test(r)) return null;
  const n = amount.includes(',') ? Number(amount.replace(/\./g, '').replace(',', '.')) : Number(amount);
  if (!Number.isFinite(n) || n <= 0) return null;
  const metodo = METHODS.find(([k]) => r.includes(k))?.[1] || null;
  return { intent: 'PAYMENT_CREATE', confidence: .95, entities: { patient_query: patient.trim(), importo: Math.round(n * 100) / 100, ...(metodo ? { metodo } : {}), ...(/\bieri\b/.test(r) ? { ieri: true } : {}) }, missing: [] };
}

/** First parser that recognises the sentence, or null. Order: most specific first. */
export function parseCoreAction(text = '') {
  return parsePayment(text) || parsePatientNote(text) || parsePatientContact(text) || parseNewPatient(text)
    || parseRecall(text) || parseAgendaBlock(text) || parseAppointmentUpdate(text);
}
