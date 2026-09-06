/* POL-AI-007 — deterministic plan/payment creation intent parser.
   Same spirit as appointmentIntent.js (POL-AI-006): a narrow, closed
   vocabulary, zero Model Gateway calls, never a guess it isn't reasonably
   sure about. Before this module, "Crea un piano di cura per Mario Rossi"
   or "Registra un pagamento di 100 euro a Mario Rossi" fell through to the
   generic CREATE/UPDATE branch in poliedraCore.js, which hands the WHOLE
   remaining sentence straight to cercaPazienti() — and cercaPazienti()
   requires every token of its query to match the patient's name/CF/phone
   (see ricercaPazienti.js), so a leading noun phrase like "un piano di
   cura per" or "un pagamento di 100 euro a" made the patient search fail
   for every real patient, every time (§ same root cause class as the
   appointment bug, different surface). This still does not write a
   plan/payment directly (Level 1, same as appointment.create — see
   actionRegistry.js riskLevel notes): it resolves patient (and, for
   payments, the amount) so the real "Nuovo piano"/"Registra incasso"
   forms already shipped in Piani.jsx/IncassoModal.jsx can open already
   filled in — the human still reviews and submits. */

import { normalizza } from '../../ricercaPazienti.js';

const QUESTION_PATTERN = /^(?:come|cosa|cos['’]?e|perch[ée]|quando|dove|quali?|posso|si pu[oò])\b|\?$/i;

const stripPunctuation = (raw) => (raw || '').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

const PLAN_VERBS = new Set([
  'crea', 'creare', 'apri', 'aprire', 'inizia', 'iniziare', 'prepara', 'preparare',
  'fai', 'fare', 'facciamo', 'nuovo', 'nuova', 'aggiungi', 'aggiungere',
]);
const PLAN_NOUNS = new Set(['piano', 'preventivo', 'preventivi']);
// "piano di cura"/"piano cura" is the single most natural way a treatment
// plan is named in this app (see actionRegistry.js's own
// CREATE_ACTION_KEYWORDS regex) — "di"/"cura" right after the noun is
// treated as part of it, never consumed as patient-reference text.
const PLAN_NOUN_SUFFIX = new Set(['di', 'cura']);

const PAYMENT_VERBS = new Set([
  'registra', 'registrare', 'segna', 'segnare', 'inserisci', 'inserire',
  'aggiungi', 'aggiungere', 'metti', 'mettere', 'incassa', 'incassare',
  'crea', 'creare', 'fai', 'fare',
]);
const PAYMENT_NOUNS = new Set(['pagamento', 'pagamenti', 'incasso', 'incassi', 'versamento', 'versamenti']);

const CONNECTORS = new Set([
  'a', 'per', 'con', 'al', 'alla', 'allo', 'dal', 'dalla', 'col',
  'un', 'uno', 'una', 'il', 'lo', 'la', 'le', 'gli', 'di', 'da',
]);
const AMOUNT_WORDS = new Set(['euro', 'eur']);

function resolveAmountToken(rawToken) {
  const cleaned = stripPunctuation(rawToken);
  const m = /^(\d+(?:[.,]\d{1,2})?)$/.exec(cleaned);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function extractPatientText(tokens, nounIndex, consumed) {
  const patientTokens = tokens.filter((t, index) =>
    index > nounIndex && !consumed.has(index) && t.normalized &&
    !CONNECTORS.has(t.normalized) && !AMOUNT_WORDS.has(t.normalized));
  return patientTokens.map((t) => t.raw).join(' ').trim().replace(/^[,.\s]+|[,.\s]+$/g, '');
}

/**
 * parseCreatePlanRequest(text) -> { patientText, rawText } | null
 * Recognizes a plan-creation verb + "piano"/"preventivo" noun; whatever
 * remains (net of connectors) is the patient reference. Returns `null`
 * when no verb+noun is found, or no patient reference remains — never an
 * invented patient.
 */
export function parseCreatePlanRequest(text) {
  const value = (text || '').trim();
  if (!value || QUESTION_PATTERN.test(value)) return null;

  const tokens = value.split(/\s+/).map((raw) => ({ raw, normalized: normalizza(stripPunctuation(raw)) }));

  const hasVerb = tokens.some((t) => PLAN_VERBS.has(t.normalized));
  const nounIndex = tokens.findIndex((t) => PLAN_NOUNS.has(t.normalized));
  if (!hasVerb || nounIndex < 0) return null;

  const consumed = new Set([nounIndex]);
  let cursor = nounIndex + 1;
  while (cursor < tokens.length && PLAN_NOUN_SUFFIX.has(tokens[cursor].normalized)) {
    consumed.add(cursor);
    cursor += 1;
  }

  const patientText = extractPatientText(tokens, nounIndex, consumed);
  if (!patientText) return null;

  return { patientText, rawText: value };
}

/**
 * parseRegisterPaymentRequest(text) ->
 *   { patientText, amount, amountText, rawText } | null
 * Recognizes a payment-registration verb + "pagamento"/"incasso"/
 * "versamento" noun; extracts an optional amount from its own tokens
 * (mirrors appointmentIntent.js's per-token date/time resolution — not a
 * second implementation of intentEngine.js's free-text extractAmount,
 * which can't tell the app which tokens to exclude from the patient
 * reference) and treats whatever remains (net of connectors/amount words)
 * as the patient reference. Returns `null` when no verb+noun is found, or
 * no patient reference remains.
 */
export function parseRegisterPaymentRequest(text) {
  const value = (text || '').trim();
  if (!value || QUESTION_PATTERN.test(value)) return null;

  const tokens = value.split(/\s+/).map((raw) => ({ raw, normalized: normalizza(stripPunctuation(raw)) }));

  const hasVerb = tokens.some((t) => PAYMENT_VERBS.has(t.normalized));
  const nounIndex = tokens.findIndex((t) => PAYMENT_NOUNS.has(t.normalized));
  if (!hasVerb || nounIndex < 0) return null;

  const consumed = new Set([nounIndex]);
  let amount = null;
  let amountText = null;
  tokens.forEach((t, index) => {
    if (index <= nounIndex || amount !== null) return;
    const resolved = resolveAmountToken(t.raw);
    if (resolved === null) return;
    amount = resolved;
    amountText = t.raw;
    consumed.add(index);
    const next = tokens[index + 1];
    if (next && AMOUNT_WORDS.has(next.normalized)) consumed.add(index + 1);
  });

  const patientText = extractPatientText(tokens, nounIndex, consumed);
  if (!patientText) return null;

  return { patientText, amount, amountText, rawText: value };
}
