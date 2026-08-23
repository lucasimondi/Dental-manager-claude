/* POL-AI-005A §10 — non-writing patient resolution contract.
   Reuses the app's one existing shared, tolerant patient search
   (src/lib/ricercaPazienti.js's cercaPazienti/normalizza — already used by
   Agenda/Piani/ArchivioDocs/Pagamenti/Pazienti) instead of a second
   scorer. Never creates a patient, never writes anything; only classifies
   a piece of text against an already-loaded, already-tenant-scoped
   `patients` array the caller must supply. */

import { cercaPazienti, normalizza } from '../../ricercaPazienti.js';

export const PATIENT_RESOLUTION_STATUS = Object.freeze({
  RESOLVED: 'RESOLVED',
  AMBIGUOUS: 'AMBIGUOUS',
  NOT_FOUND: 'NOT_FOUND',
  INVALID: 'INVALID',
});

/**
 * resolvePatient(patientText, patients, { studioId }) ->
 *   { status, candidate, candidates }
 *
 * `patients` must already be the caller's own tenant-scoped, permission-
 * filtered array (exactly what every existing page already loads) — this
 * function performs no query of its own and creates no fallback tenant.
 * `studioId` is optional defense-in-depth: if a candidate carries a
 * `studioId`/`studio_id` that mismatches, it is rejected as INVALID rather
 * than silently trusted (a caller passing an already-correct array should
 * never hit this branch in practice; it exists so a future caller cannot
 * accidentally widen scope by passing an unfiltered list).
 */
export function resolvePatient(patientText, patients = [], { studioId } = {}) {
  const text = (patientText || '').trim();
  if (!text) return { status: PATIENT_RESOLUTION_STATUS.NOT_FOUND, candidate: null, candidates: [] };

  const scoped = studioId
    ? patients.filter((p) => {
      const rowStudioId = p?.studioId ?? p?.studio_id;
      return rowStudioId === undefined || rowStudioId === null || String(rowStudioId) === String(studioId);
    })
    : patients;
  if (studioId && scoped.length !== patients.length && scoped.length === 0) {
    return { status: PATIENT_RESOLUTION_STATUS.INVALID, candidate: null, candidates: [] };
  }

  const ranked = cercaPazienti(scoped, text);
  if (ranked.length === 0) return { status: PATIENT_RESOLUTION_STATUS.NOT_FOUND, candidate: null, candidates: [] };

  // A "unique strong match" is one whose normalized full name matches the
  // query text closely enough that no other candidate is plausible — the
  // exact-or-startsWith top score (100/80 from cercaPazienti) with no
  // other candidate at the same top score.
  const normalizedText = normalizza(text);
  const topMatches = ranked.filter((p) => {
    const full = normalizza(`${p.nome} ${p.cognome}`);
    return full === normalizedText || full.startsWith(normalizedText) || normalizedText.startsWith(full);
  });
  if (topMatches.length === 1) {
    return { status: PATIENT_RESOLUTION_STATUS.RESOLVED, candidate: topMatches[0], candidates: [topMatches[0]] };
  }
  if (topMatches.length > 1) {
    return { status: PATIENT_RESOLUTION_STATUS.AMBIGUOUS, candidate: null, candidates: topMatches };
  }
  // No exact/prefix match, but cercaPazienti still found tolerant matches.
  if (ranked.length === 1) {
    return { status: PATIENT_RESOLUTION_STATUS.RESOLVED, candidate: ranked[0], candidates: ranked };
  }
  return { status: PATIENT_RESOLUTION_STATUS.AMBIGUOUS, candidate: null, candidates: ranked.slice(0, 8) };
}
