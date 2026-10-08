// Poliedron Core — deterministic Italian day/time parsing and appointment
// changes ("sposta…", "cancella…") without the LLM. Pure functions: identity,
// availability and permissions are always resolved server-side afterwards.
const WEEKDAY_STEMS = ['domenica', 'luned', 'marted', 'mercoled', 'gioved', 'venerd', 'sabato'];
const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const WEEKDAY = 'domenica|luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato';
const MONTH = MONTHS.join('|');
/** Words that start a day mention: used as stop-words when reading a patient name. */
export const DAY_WORDS = `oggi|domani|dopodomani|${WEEKDAY}`;
const DAY_RE = new RegExp(`\\b(?:(oggi|dopodomani|domani)|(${WEEKDAY})(?:\\s+(\\d{1,2})(?:\\s+(${MONTH}))?)?|(\\d{1,2})\\s*[/-]\\s*(\\d{1,2})(?:\\s*[/-]\\s*(\\d{2,4}))?|(?:il\\s+)?(\\d{1,2})\\s+(${MONTH})(?:\\s+(\\d{4}))?|il\\s+(\\d{1,2})(?![\\d:./]))(?![\\wà-ÿ])`, 'g');
const TIME_RE = /\b(alle|ore|alle ore|dalle|delle)\s*(\d{1,2})(?:[.:](\d{2})|\s+e\s+(mezza|mezzo|un quarto|trenta|quindici|quarantacinque))?(?:\s+(?:del|di)\s+(pomeriggio|sera))?\b/g;
const pad = (n) => String(n).padStart(2, '0');

function dayEntity(m) {
  if (m[1]) return { relative_day: { oggi: 0, domani: 1, dopodomani: 2 }[m[1]] };
  if (m[2]) {
    const weekday = WEEKDAY_STEMS.findIndex((s) => m[2].startsWith(s));
    return m[3] ? { weekday, day_of_month: Number(m[3]), ...(m[4] ? { month: MONTHS.indexOf(m[4]) + 1 } : {}) } : { weekday };
  }
  if (m[5]) return { day_of_month: Number(m[5]), month: Number(m[6]), ...(m[7] ? { year: Number(m[7]) < 100 ? 2000 + Number(m[7]) : Number(m[7]) } : {}) };
  if (m[8]) return { day_of_month: Number(m[8]), month: MONTHS.indexOf(m[9]) + 1, ...(m[10] ? { year: Number(m[10]) } : {}) };
  return { day_of_month: Number(m[11]) };
}

function timeEntity(m) {
  let h = Number(m[2]);
  const min = m[3] != null ? Number(m[3]) : { mezza: 30, mezzo: 30, trenta: 30, 'un quarto': 15, quindici: 15, quarantacinque: 45 }[m[4]] ?? 0;
  if (m[5] && h >= 1 && h < 12) h += 12;
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}

/** Every day/time mention in order, with its position: needed to tell "from" and "to" apart. */
export function agendaMentions(q = '') {
  const out = [];
  for (const m of q.matchAll(DAY_RE)) out.push({ kind: 'day', start: m.index, end: m.index + m[0].length, value: dayEntity(m) });
  for (const m of q.matchAll(TIME_RE)) {
    const time = timeEntity(m);
    if (time) out.push({ kind: 'time', start: m.index, end: m.index + m[0].length, value: time, prefix: m[1] });
  }
  return out.sort((a, b) => a.start - b.start);
}

export function parseDay(q = '') {
  const day = agendaMentions(q).find((m) => m.kind === 'day');
  return day ? { ...day.value, confidence: 1 } : null;
}

export function parseTime(q = '') {
  const time = agendaMentions(q).find((m) => m.kind === 'time');
  return time ? { time: time.value, confidence: 1 } : null;
}

export const hasDay = (e = {}) => e.relative_day != null || e.weekday != null || e.day_of_month != null;

/**
 * Day entities → YYYY-MM-DD using the studio's today. Weekdays and dates
 * without a year mean the next occurrence (today included). Returns null when
 * the date does not exist or contradicts its weekday ("venerdì 12" on a
 * Thursday): the caller must ask instead of guessing.
 */
export function resolveDay(e = {}, today) {
  if (!hasDay(e) || !/^\d{4}-\d{2}-\d{2}$/.test(today || '')) return null;
  const base = new Date(`${today}T12:00:00Z`);
  const iso = (d) => d.toISOString().slice(0, 10);
  if (e.relative_day != null) { base.setUTCDate(base.getUTCDate() + e.relative_day); return iso(base); }
  if (e.day_of_month == null) { base.setUTCDate(base.getUTCDate() + ((e.weekday - base.getUTCDay() + 7) % 7)); return iso(base); }
  const y = base.getUTCFullYear(), mo = base.getUTCMonth() + 1;
  const make = (year, month) => {
    const d = new Date(Date.UTC(year, month - 1, e.day_of_month, 12));
    return d.getUTCMonth() === month - 1 ? d : null;
  };
  let d;
  if (e.year) d = make(e.year, e.month);
  else if (e.month) { d = make(y, e.month); if (d && iso(d) < today) d = make(y + 1, e.month); }
  else { d = make(y, mo); if (!d || iso(d) < today) d = make(mo === 12 ? y + 1 : y, mo === 12 ? 1 : mo + 1); }
  if (!d || (e.weekday != null && d.getUTCDay() !== e.weekday)) return null;
  return iso(d);
}

const MOVE_RE = /\b(?:sposta|spostare|spostami|anticipa|anticipare|posticipa|posticipare|rimanda|rimandare)\b/;
const DELETE_RE = /\b(?:cancella|cancellare|elimina|eliminare|annulla|annullare|togli|togliere|rimuovi|disdici|disdire|disdetta)\b/;
// Other domains share these verbs: they stay on the mature (LLM + tools) path.
const OTHER_DOMAIN_RE = /\b(?:pagament\w*|incass\w*|pian[oi]|preventiv\w*|richiam\w*|nota|note|promemoria|impegn\w*|ferie|blocc\w*|ricett\w*|document\w*|file|foto|memoria|operazione|attivit\w*)\b/;
/** Requests about payments, plans, recalls, blocks…: not a plain appointment command. */
export const isOtherDomain = (q = '') => OTHER_DOMAIN_RE.test(q);
const NOUN_RE = /\b(?:l'|un\s+|il\s+)?(?:appuntament[oi]|prenotazion[ei])\b/g;
const NAME_STOP = new Set(['di', 'del', 'dello', 'della', 'da', 'dal', 'dalla', 'a', 'al', 'alla', 'ad', 'per', 'in', 'con', 'e', 'che', 'alle', 'ore', 'dalle', 'delle', 'agenda', 'giorno', 'paziente', 'sig', 'signor', 'signora', 'il', 'lo', 'la', 'un', 'una', 'mio', 'suo', 'tutto', 'tutti']);
const LEAD_RE = /^(?:(?:l'|il|lo|la|un|una|gli|le)\s+)?(?:(?:di|a|al|alla|per|del|della|con|da|dal|dalla)\s+)?(?:(?:il|la)\s+)?(?:(?:paziente|sig\.?|signor[ae]?)\s+)?/;
const SOURCE_DAY_PREP = /(?:^|\s)(?:di|del|dello|da|dal|dall')\s*$/;
const TARGET_DAY_PREP = /(?:^|\s)(?:a|al|ad|per|in|verso|a giorno)\s*$/;

function nameIn(segment) {
  const rest = segment.replace(NOUN_RE, ' ').replace(/\s+/g, ' ').trim().replace(LEAD_RE, '');
  const words = [];
  for (const w of rest.split(' ')) {
    if (!w || NAME_STOP.has(w) || /^(?:dall|dell|nell|all)'/.test(w) || !/^[a-zà-ÿ']+$/.test(w)) break;
    words.push(w.replace(/^l'/, ''));
  }
  const name = words.slice(0, 4).join(' ');
  return name.length >= 3 ? name : null;
}

// The name sits between the verb and the first day/time, or in a later gap
// ("cancella l'appuntamento di domani alle 15 di Bianchi").
function patientFrom(q, verbEnd, mentions) {
  const after = mentions.filter((m) => m.start >= verbEnd);
  const cuts = [verbEnd, ...after.flatMap((m) => [m.start, m.end]), q.length];
  for (let i = 0; i < cuts.length; i += 2) {
    const name = nameIn(q.slice(cuts[i], cuts[i + 1]));
    if (name) return name;
  }
  return null;
}

const merge = (items) => {
  const out = {};
  for (const m of items) {
    if (m.kind === 'day') { if (hasDay(out)) return null; Object.assign(out, m.value); }
    else { if (out.time) return null; out.time = m.value; }
  }
  return out;
};

/**
 * "Sposta Mario Rossi da domani alle 15 a venerdì alle 10", "anticipa Rossi
 * alle 9", "cancella l'appuntamento di domani alle 15 di Bianchi".
 * Returns null when the text is not a basic appointment change.
 * entities: patient_query, from {day…, time} (which appointment) and, for a
 * move, the target day/time flat in entities (same shape as create).
 */
export function parseAppointmentChange(q = '') {
  const move = q.match(MOVE_RE), del = !move && q.match(DELETE_RE);
  const verb = move || del;
  // Bulk changes ("sposta tutti gli appuntamenti di domani") stay with the model.
  if (!verb || OTHER_DOMAIN_RE.test(q) || /\btutt[ie]\b/.test(q)) return null;
  const mentions = agendaMentions(q);
  const noun = /\b(?:appuntament[oi]|prenotazion[ei])\b/.test(q);
  if (!noun && !mentions.length) return null;
  const verbEnd = verb.index + verb[0].length;
  const patient = patientFrom(q, verbEnd, mentions);
  if (!noun && !patient) return null;

  let from = [], to = [];
  if (del) from = mentions;
  else {
    for (const [i, m] of mentions.entries()) {
      const prev = mentions[i - 1];
      const adjacent = prev && !q.slice(prev.end, m.start).replace(/[\s,]/g, '');
      if (m.kind === 'day') m.role = SOURCE_DAY_PREP.test(q.slice(0, m.start)) ? 'from' : TARGET_DAY_PREP.test(q.slice(0, m.start)) ? 'to' : 'unknown';
      else if (m.prefix === 'dalle' || m.prefix === 'delle') m.role = 'from';
      // "domani alle 15" belongs together; "dalle 15 alle 16" goes from → to.
      else if (adjacent) m.role = prev.kind === 'time' && prev.role === 'from' ? 'to' : prev.role;
      else m.role = 'unknown';
    }
    const firstTo = mentions.findIndex((m) => m.role === 'to');
    for (const [i, m] of mentions.entries()) {
      // With an explicit destination ("a venerdì") what comes before it is the
      // current slot; without one, every bare mention is the destination.
      if (m.role === 'unknown') m.role = firstTo >= 0 && i < firstTo ? 'from' : 'to';
      (m.role === 'from' ? from : to).push(m);
    }
  }
  const source = merge(from), target = merge(to);
  if (!source || !target) return { intent: move ? 'APPOINTMENT_MOVE' : 'APPOINTMENT_DELETE', confidence: .94, entities: {}, missing: ['unclear'] };
  const entities = { ...(patient ? { patient_query: patient } : {}), from: source, ...target };
  // Without a name, only an exact slot ("l'appuntamento di domani alle 15") identifies it.
  const missing = !patient && !(hasDay(source) && source.time) ? ['patient'] : [];
  if (move && !hasDay(target) && !target.time) missing.push('target');
  return { intent: move ? 'APPOINTMENT_MOVE' : 'APPOINTMENT_DELETE', confidence: .94, entities, missing };
}
