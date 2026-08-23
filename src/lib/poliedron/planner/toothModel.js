/* POL-AI-005A §12/§13 — structured tooth context.
   No DB column is created here (that would be a schema change, out of
   Phase A scope per the task's explicit boundary). This is a pure,
   planning-time representation that lets an Action Plan honestly say
   "this clinical fact is real, but its tooth is not known" instead of
   forcing a fabricated value or discarding the whole fact — exactly the
   mission's "dato mancante" vs "dato certo" distinction
   (docs/mission/POLIEDRA_MISSION.md). */

export const TOOTH_STATE = Object.freeze({
  KNOWN: 'known',
  UNKNOWN_AT_ENTRY: 'unknown_at_entry',
  NOT_APPLICABLE: 'not_applicable',
  LEGACY_INCOMPLETE: 'legacy_incomplete',
});

// The canonical adult permanent FDI tooth set already used by the real
// Odontogramma component (src/components/Odontogramma.jsx ODO_ROWS:
// quadrants 1-4 x positions 1-8 = 32 teeth, no deciduous dentition).
// Reproduced by formula here instead of importing a .jsx component into a
// pure lib module, so this stays framework-agnostic and unit-testable.
export const VALID_FDI_TEETH = Object.freeze(
  [1, 2, 3, 4].flatMap((quadrant) => [1, 2, 3, 4, 5, 6, 7, 8].map((position) => quadrant * 10 + position))
);
const VALID_FDI_TEETH_SET = new Set(VALID_FDI_TEETH);

export const isValidToothNumber = (value) => VALID_FDI_TEETH_SET.has(Number(value));

/** createTooth(value) -> { value, state } — the one constructor every
 *  planner step should use, so "known" vs "unknown" is never represented
 *  ad hoc as null/undefined/empty-string in different places. */
export const createTooth = (value) => {
  if (value === null || value === undefined || value === '') {
    return Object.freeze({ value: null, state: TOOTH_STATE.UNKNOWN_AT_ENTRY });
  }
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || !isValidToothNumber(numeric)) {
    // Explicitly NOT invented/coerced to a nearby valid number — an
    // out-of-range or malformed tooth reference is legacy/incomplete data,
    // not a resolvable "known" fact.
    return Object.freeze({ value: String(value), state: TOOTH_STATE.LEGACY_INCOMPLETE });
  }
  return Object.freeze({ value: String(numeric), state: TOOTH_STATE.KNOWN });
};

export const createUnknownTooth = () => createTooth(null);
export const createNotApplicableTooth = () => Object.freeze({ value: null, state: TOOTH_STATE.NOT_APPLICABLE });

export const isToothIncomplete = (tooth) => tooth?.state === TOOTH_STATE.UNKNOWN_AT_ENTRY
  || tooth?.state === TOOTH_STATE.LEGACY_INCOMPLETE;
