/* POL-AI-005A §9 — semantic fallback contract for Phase B.
   Phase A implements no new Model Gateway call: parseCommand() covers the
   five documented command families deterministically, with zero model
   calls (see commandParser.test.mjs's "no model call" tests). This module
   only defines and enforces the SHAPE a future Phase B may accept back
   from modelGateway.js's runModelTask() when parseCommand() returns null.

   The one rule that must never be violated: the model may return semantic
   TEXT fields for the deterministic resolvers (patientResolver.js,
   procedureResolver.js) to then match against real, authorized data — it
   may never return an authoritative database id/row directly. This keeps
   every actual identity/authorization decision inside this app's own
   deterministic, testable, tenant-scoped code, never inside a model
   response. */

export const MODEL_SEMANTIC_FIELDS = Object.freeze([
  'intent', 'patientText', 'procedureTexts', 'toothText', 'amount', 'status', 'confidence',
]);

// Any key found in a model response outside this allow-list is stripped by
// sanitizeModelSemanticOutput below; the reserved id-like keys are called
// out explicitly so a future integration cannot accidentally start trusting
// them if a provider ever starts emitting them.
const FORBIDDEN_AUTHORITATIVE_KEYS = Object.freeze([
  'patientId', 'patient_id', 'procedureId', 'procedure_id', 'planId', 'plan_id',
  'paymentId', 'payment_id', 'voiceId', 'itemId', 'id',
]);

/**
 * sanitizeModelSemanticOutput(raw) -> { ...allowed fields only }
 * Defense in depth: even if a future model integration is misconfigured
 * and returns an id-shaped field, it is dropped here before it can reach
 * any resolver — resolution always happens against this app's own
 * already-authorized data, never against a value the model asserted.
 */
export function sanitizeModelSemanticOutput(raw) {
  const output = {};
  if (!raw || typeof raw !== 'object') return output;
  for (const key of MODEL_SEMANTIC_FIELDS) {
    if (raw[key] !== undefined) output[key] = raw[key];
  }
  return output;
}

export const containsForbiddenAuthoritativeKey = (raw) => !!raw && typeof raw === 'object'
  && FORBIDDEN_AUTHORITATIVE_KEYS.some((key) => raw[key] !== undefined);
