/* POL-AI-005A §14 — Data Health handoff design (Phase B integration,
   not wired in Phase A). src/lib/poliedron/intelligence/model.js already
   defines the real signal shape POL-AI-004 consumes:
   createSignal({type, taxonomy, severity, reason, source, sourceId,
   confidence, confidencePenalty, contactRecommended, context}), aggregated
   by studioDataHealth.js's ISSUE_KEY_BY_TYPE map. Neither file is imported
   or modified here — Phase A has no safe persistence path for this signal
   (no table/column exists to store "this tooth was unknown at entry"; see
   docs/architecture/POL-AI-005A-domain-audit.md SCHEMA_CONSTRAINTS), so
   this module only produces the same-shaped, ready-to-consume object,
   in-memory, for a Phase B integration to either persist or feed directly
   into a scanner run. */

export const CLINICAL_METADATA_INCOMPLETE_TYPE = 'CLINICAL_METADATA_INCOMPLETE';

/**
 * buildClinicalMetadataIncompleteSignal({ patientId, field, state,
 * sourceActionId, reason }) -> a createSignal()-shaped plain object.
 *
 * Phase B integration sketch (not implemented here): add
 * `CLINICAL_METADATA_INCOMPLETE_TYPE` to intelligence/model.js's
 * SIGNAL_TYPE, map it in studioDataHealth.js's ISSUE_KEY_BY_TYPE, and have
 * a Phase B scanner call `createSignal({ ...this shape })` for real,
   persisted incomplete plan items — not just freshly-planned ones.
 */
export function buildClinicalMetadataIncompleteSignal({ patientId, field, state, sourceActionId, reason }) {
  return Object.freeze({
    type: CLINICAL_METADATA_INCOMPLETE_TYPE,
    taxonomy: 'DATA_QUALITY',
    severity: 'low',
    reason: reason || `Campo "${field}" non specificato al momento della registrazione.`,
    source: 'poliedron.actionPlanner',
    sourceId: sourceActionId || null,
    confidence: 1,
    confidencePenalty: 0,
    contactRecommended: false,
    context: Object.freeze({ patientId: patientId ?? null, field, state }),
  });
}

/** Derives the incomplete-metadata signals a finalized Action Plan implies
 *  — one per step whose tooth is UNKNOWN_AT_ENTRY/LEGACY_INCOMPLETE. Pure,
 *  read-only; does not persist or send anything. */
export function deriveDataHealthSignalsFromPlan(plan) {
  if (!plan) return [];
  const signals = [];
  // The same `tooth` object reference is shared across every step built
  // for one item (CHECK_EXISTING_TREATMENT/ENSURE_TREATMENT_ITEM/
  // MARK_TREATMENT_COMPLETED) — dedupe by identity so one incomplete tooth
  // yields exactly one signal, not one per step that happened to carry it.
  const seenTeeth = new Set();
  for (const step of plan.steps) {
    const tooth = step.tooth;
    if (!tooth || seenTeeth.has(tooth)) continue;
    if (tooth.state === 'unknown_at_entry' || tooth.state === 'legacy_incomplete') {
      seenTeeth.add(tooth);
      signals.push(buildClinicalMetadataIncompleteSignal({
        patientId: plan.entities.patientId,
        field: 'tooth',
        state: tooth.state,
        sourceActionId: plan.actionId,
      }));
    }
  }
  return signals;
}
