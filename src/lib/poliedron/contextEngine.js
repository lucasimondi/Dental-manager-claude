/* POL-AI-001 §13-14 — context engine.
   Builds the "current situation" snapshot Poliedron uses as a HINT for
   intent recognition and entity pre-fill (§13) — never as the authority
   for permissions/validation/canonical IDs (§14: those stay server-side
   and inside the existing form components, unchanged by this task). */

export function buildContext({
  page,
  vertical,
  studioId,
  currentPatient,
  anatomicalContext,
  inputSource,
  capabilities,
  isStudioAdmin,
  features,
} = {}) {
  return Object.freeze({
    page: page || null,
    vertical: vertical || 'dentistico',
    studioId: studioId || null,
    currentPatient: currentPatient || null,
    anatomicalContext: anatomicalContext || null,
    inputSource: inputSource || 'TEXT',
    date: new Date().toISOString().slice(0, 10),
    capabilities: Array.isArray(capabilities) ? capabilities : [],
    isStudioAdmin: !!isStudioAdmin,
    features: features || {},
  });
}

/* §13 example: on the patient's own page, "nuovo pagamento 300" should not
   ask for the patient again. This only ever SUGGESTS a patientId as a
   hint for the action-preview UI to pre-fill; actionRegistry's own
   navigate() handlers still open the real, unchanged form — the human (or
   the form's own validation) has the final say, exactly as §14 requires. */
export function inferPatientHint(context) {
  return context?.currentPatient || null;
}
