/* POL-AI-006 — deterministic appointment-booking intent parser.
   Same spirit as commandParser.js/prescriptionWorkflow.js: a narrow,
   closed vocabulary, zero Model Gateway calls, never a guess it isn't
   reasonably sure about. Before this module, chat had ZERO recognition of
   booking phrasing at all — "Fissa un appuntamento a Mario Rossi domani
   alle 15" fell through to a plain federated SEARCH (see intentEngine.js's
   CREATE_VERBS, anchored to crea/nuovo/aggiungi/inserisci/prepara — none
   of which match "fissa"/"prenota"/"metti"). This still does not write an
   appointment directly (Phase 1 — see actionRegistry.js riskLevel notes):
   it resolves patient/date/time so the real Nuovo Appuntamento form
   (QuickBookingModal.jsx) can open already filled in, real free slots
   computed by computeFreeSlots() exactly as always — the human still picks
   the final slot and clicks "Conferma appuntamento". */

import { normalizza } from '../../ricercaPazienti.js';

const QUESTION_PATTERN = /^(?:come|cosa|cos['’]?e|perch[ée]|quando|dove|quali?|posso|si pu[oò])\b|\?$/i;

// Closed vocabulary, mirrors intentEngine.js's CREATE_VERBS (crea/nuovo)
// plus the booking-specific verbs it doesn't cover (fissa/prenota/metti/
// pianifica/programma/segna/prendi). "Nuovo appuntamento ..." is
// deliberately included: it is the single most natural way to ask for
// this in Italian and previously matched nothing more specific than a
// bare create-intent with no date/time recognition at all.
const APPOINTMENT_VERBS = new Set([
  'fissa', 'fissare', 'fissiamo', 'prenota', 'prenotare', 'prenotiamo',
  'metti', 'mettere', 'pianifica', 'pianificare', 'programma', 'programmare',
  'crea', 'creare', 'segna', 'segnare', 'prendi', 'prendere', 'aggiungi',
  'nuovo', 'nuova',
]);
const APPOINTMENT_NOUNS = new Set(['appuntamento', 'appuntamenti', 'prenotazione', 'prenotazioni']);
const CONNECTORS = new Set([
  'a', 'per', 'con', 'al', 'alla', 'allo', 'dal', 'dalla', 'col',
  'un', 'uno', 'una', 'il', 'lo', 'la', 'le', 'gli',
]);
const TIME_CONNECTORS = new Set(['alle', 'ore']);
const RELATIVE_DAYS = Object.freeze({ oggi: 0, domani: 1, dopodomani: 2 });
// Index === Date#getDay() (0 = Sunday), accents stripped via normalizza().
const WEEKDAYS = Object.freeze(['domenica', 'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato']);

const pad2 = (n) => String(n).padStart(2, '0');
const toYMD = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const addDays = (base, days) => {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + days);
  return d;
};

const stripPunctuation = (raw) => (raw || '').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

function resolveDateToken(rawToken, now) {
  const norm = normalizza(stripPunctuation(rawToken));
  if (Object.prototype.hasOwnProperty.call(RELATIVE_DAYS, norm)) return toYMD(addDays(now, RELATIVE_DAYS[norm]));
  const weekdayIndex = WEEKDAYS.indexOf(norm);
  if (weekdayIndex >= 0) {
    const delta = (weekdayIndex - now.getDay() + 7) % 7;
    return toYMD(addDays(now, delta));
  }
  const explicit = /^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/.exec(stripPunctuation(rawToken));
  if (explicit) {
    const day = Number(explicit[1]);
    const month = Number(explicit[2]);
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;
    let year = explicit[3] ? Number(explicit[3]) : now.getFullYear();
    if (year < 100) year += 2000;
    let candidate = new Date(year, month - 1, day);
    if (!explicit[3]) {
      const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (candidate < todayOnly) candidate = new Date(year + 1, month - 1, day);
    }
    return toYMD(candidate);
  }
  return null;
}

function resolveTimeToken(rawToken) {
  const m = /^(\d{1,2})(?:[:.](\d{2}))?$/.exec(stripPunctuation(rawToken));
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${pad2(hour)}:${pad2(minute)}`;
}

/**
 * parseAppointmentRequest(text, { now }) ->
 *   { patientText, dateText, timeText, date, time, rawText } | null
 * `date`/`time` are resolved (YYYY-MM-DD / HH:MM) or null when no
 * recognized date/time phrase is present — never invented. Returns `null`
 * when no booking verb + "appuntamento"/"prenotazione" noun is found, or
 * when no patient reference remains after removing verb/noun/date/time/
 * connector tokens (never guesses a patient from nothing).
 */
export function parseAppointmentRequest(text, { now = new Date() } = {}) {
  const value = (text || '').trim();
  if (!value || QUESTION_PATTERN.test(value)) return null;

  const tokens = value.split(/\s+/).map((raw) => ({ raw, normalized: normalizza(stripPunctuation(raw)) }));

  const hasVerb = tokens.some((t) => APPOINTMENT_VERBS.has(t.normalized));
  const nounIndex = tokens.findIndex((t) => APPOINTMENT_NOUNS.has(t.normalized));
  if (!hasVerb || nounIndex < 0) return null;

  const consumed = new Set([nounIndex]);
  let dateText = null;
  let date = null;
  let timeText = null;
  let time = null;

  tokens.forEach((t, index) => {
    if (index <= nounIndex || date !== null) return;
    const resolved = resolveDateToken(t.raw, now);
    if (resolved) { date = resolved; dateText = t.raw; consumed.add(index); }
  });

  tokens.forEach((t, index) => {
    if (index <= nounIndex || consumed.has(index) || time !== null) return;
    if (!TIME_CONNECTORS.has(t.normalized)) return;
    const next = tokens[index + 1];
    if (!next) return;
    const resolved = resolveTimeToken(next.raw);
    if (resolved) { time = resolved; timeText = next.raw; consumed.add(index); consumed.add(index + 1); }
  });

  const patientTokens = tokens.filter((t, index) =>
    index > nounIndex && !consumed.has(index) && t.normalized && !CONNECTORS.has(t.normalized));
  const patientText = patientTokens.map((t) => t.raw).join(' ').trim().replace(/^[,.\s]+|[,.\s]+$/g, '');
  if (!patientText) return null;

  return { patientText, dateText, timeText, date, time, rawText: value };
}
