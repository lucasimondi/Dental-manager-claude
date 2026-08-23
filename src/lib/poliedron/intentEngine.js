/* POL-AI-001 §9 — deterministic intent engine, provider-independent.
   Most queries never need a model call: a short list of Italian verb/
   keyword patterns already disambiguates SEARCH/NAVIGATE/CREATE/ANALYZE/
   ASK reliably for the phrasing this app's own users type (mirrors how the
   underlying agente-assistente function — formerly called directly by
   AssistenteAI.jsx, now only via Poliedron's modelGateway.js — is only
   reached for real free-form questions, not for every keystroke). ANALYZE/ASK still need
   poliedraCore to route to the model gateway for the actual answer — this
   module only classifies, it never answers. */

export const INTENT = Object.freeze({
  SEARCH: 'SEARCH',
  NAVIGATE: 'NAVIGATE',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  ANALYZE: 'ANALYZE',
  ASK: 'ASK',
  AUTOMATE: 'AUTOMATE',
});

const NAVIGATE_VERBS = /^(?:apri|vai|portami|mostra|mostrami)\b/i;
const CREATE_VERBS = /^(?:crea|nuovo|nuova|aggiungi|inserisci|prepara)\b/i;
const UPDATE_VERBS = /^(registra|modifica|aggiorna|segna)\b/i;
const ANALYZE_HINTS = /\b(quanto|quanti|quante|incassat|fatturat|margine|ebitda|break.?even|costi|saturazion)\w*/i;
const ASK_HINTS = /\?$|^(quali|chi|come mai|perch[ée])\b/i;

// Extracts a plausible amount ("300", "€300", "300 euro", "300,50") from
// free text — used only to build the confirmation preview, never to write
// data directly (see actionRegistry.js riskLevel notes).
const AMOUNT_RE = /(?:€\s?)?(\d+(?:[.,]\d{1,2})?)\s?(?:€|euro)?/;

export const extractAmount = (text) => {
  const m = AMOUNT_RE.exec(text || '');
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export const hasExplicitOperationalVerb = (query) => {
  const q = (query || '').trim();
  return CREATE_VERBS.test(q) || UPDATE_VERBS.test(q);
};

/**
 * classifyIntent(query, { navigationIndex }) -> { type, confidence, entities }
 * Pure, deterministic, no I/O — safe to unit test and to call on every
 * keystroke without debouncing concerns beyond the caller's own UI debounce.
 */
export function classifyIntent(query, { navigationIndex = [] } = {}) {
  const q = (query || '').trim();
  if (!q) return { type: null, confidence: 0, entities: {} };

  if (NAVIGATE_VERBS.test(q)) {
    const rest = q.replace(NAVIGATE_VERBS, '').trim();
    return { type: INTENT.NAVIGATE, confidence: 0.9, entities: { target: rest } };
  }

  if (CREATE_VERBS.test(q)) {
    const rest = q.replace(CREATE_VERBS, '').trim();
    return { type: INTENT.CREATE, confidence: 0.85, entities: { raw: rest } };
  }

  if (UPDATE_VERBS.test(q)) {
    const rest = q.replace(UPDATE_VERBS, '').trim();
    const amount = extractAmount(rest);
    return { type: INTENT.UPDATE, confidence: 0.8, entities: { raw: rest, amount } };
  }

  const qNorm = q.toLowerCase();
  const bareNavigationTerm = navigationIndex.some((item) =>
    item.label.toLowerCase() === qNorm || item.aliases.some((alias) => alias.toLowerCase() === qNorm)
  );
  if (bareNavigationTerm) {
    return { type: INTENT.SEARCH, confidence: 0.75, entities: { raw: q } };
  }

  if (ANALYZE_HINTS.test(q)) {
    return { type: INTENT.ANALYZE, confidence: 0.7, entities: { raw: q } };
  }

  if (ASK_HINTS.test(q)) {
    return { type: INTENT.ASK, confidence: 0.6, entities: { raw: q } };
  }

  return { type: INTENT.SEARCH, confidence: 0.5, entities: { raw: q } };
}
