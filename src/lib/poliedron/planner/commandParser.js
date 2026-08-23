/* POL-AI-005A §8 — deterministic command parser.
   Narrow and honest by design: this matches the five documented command
   families (and close phrasing variants) with zero Model Gateway calls,
   exactly like intentEngine.js already does for navigate/create/update
   verbs. It is NOT a general Italian NLU grammar — anything that doesn't
   match one of these shapes returns `null` and must fall back to the
   Model Gateway under the strict contract in modelFallbackContract.js
   (semantic text extraction only, never an authoritative database id).
   Reuses intentEngine.js's `extractAmount` instead of a second amount
   parser. */

import { extractAmount } from '../intentEngine.js';

export const COMMAND_INTENT = Object.freeze({
  MARK_TREATMENT_COMPLETED: 'MARK_TREATMENT_COMPLETED',
  RECORD_TREATMENT_AND_PENDING_PAYMENT: 'RECORD_TREATMENT_AND_PENDING_PAYMENT',
  CREATE_TREATMENT_PLAN: 'CREATE_TREATMENT_PLAN',
  RECORD_MULTIPLE_TREATMENTS_AND_PAYMENT: 'RECORD_MULTIPLE_TREATMENTS_AND_PAYMENT',
  // POL-AI-005B Workflow G — the tooth-specific instance of the conceptual
  // "complete missing anatomical context" family. Deliberately not
  // generalized to other anatomical contexts (face/body) — nothing in the
  // current schema/UI represents those yet, so doing so now would be
  // inventing scope, not reusing it.
  COMPLETE_MISSING_TOOTH: 'COMPLETE_MISSING_TOOTH',
});

const ITALIAN_NUMBER_WORDS = Object.freeze({ una: 1, un: 1, uno: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6 });

const parseCount = (text) => {
  const t = (text || '').trim().toLowerCase();
  if (ITALIAN_NUMBER_WORDS[t] !== undefined) return ITALIAN_NUMBER_WORDS[t];
  const n = Number(t);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// --- B / E-financial: "[Segna che] <patient> deve pagare <amount> per la
// <procedure> del <tooth>" OR "... per la <procedure>, non ricordo il
// dente" (POL-AI-005B §E: "Rossi deve pagare 180 € per la
// devitalizzazione, non ricordo il dente" — no "Segna che" prefix, no
// tooth). Both the leading "Segna che" and the trailing tooth clause are
// optional; the trailing clause is either a known tooth or an explicit
// "non ricordo il dente" — never both, and the tooth stays genuinely
// absent (not zero, not invented) when neither is present either. ---
const PATTERN_TREATMENT_AND_PAYMENT = /^(?:segna\s+che\s+)?(?<patient>.+?)\s+deve\s+pagare\s+(?<amountText>.+?)\s+per\s+la\s+(?<procedure>.+?)(?:\s+del\s+(?<tooth>\d{1,2})|,?\s*non\s+ricordo\s+il\s+dente)?\s*$/i;

// --- G: "Era il 46" / "Il dente era il 46" / "Completa con elemento 46" /
// "Quella <procedure> [che avevo segnato] era [il|sul] <tooth>" — the
// "complete missing tooth" family (Workflow G). No patient text: this
// intent is only ever resolved from the app's current-patient context
// (see actionPlanner.js's planCompleteMissingTooth /
// patientResolver.js's resolveContextualPatient), never invented from
// nothing. GENERIC/ELEMENT are tried before PROCEDURE deliberately: their
// optional prefixes are a closed, exact set ("il dente", "completa con
// elemento"), so they can only ever match their own shape; PROCEDURE's
// `.+?` capture is a true catch-all and would otherwise swallow "il
// dente" or similar filler as if it were a procedure name. ---
const PATTERN_COMPLETE_TOOTH_GENERIC = /^(?:il\s+dente\s+)?era\s+(?:il\s+|sul\s+|l['’]elemento\s+)?(?<tooth>[^\s.]+)\.?\s*$/i;
const PATTERN_COMPLETE_TOOTH_ELEMENT = /^completa\s+con\s+elemento\s+(?<tooth>[^\s.]+)\.?\s*$/i;
const PATTERN_COMPLETE_TOOTH_PROCEDURE = /^(?:quella\s+|la\s+)?(?<procedure>.+?)(?:\s+che\s+avevo\s+segnato)?\s+era\s+(?:il\s+|sul\s+|l['’]elemento\s+)?(?<tooth>[^\s.]+)\.?\s*$/i;

const parseCompleteMissingTooth = (value) => {
  let m = PATTERN_COMPLETE_TOOTH_GENERIC.exec(value) || PATTERN_COMPLETE_TOOTH_ELEMENT.exec(value);
  if (m) {
    return {
      commandIntent: COMMAND_INTENT.COMPLETE_MISSING_TOOTH,
      patientText: null,
      procedureText: null,
      toothText: m.groups.tooth,
      rawText: value,
    };
  }
  m = PATTERN_COMPLETE_TOOTH_PROCEDURE.exec(value);
  if (m) {
    return {
      commandIntent: COMMAND_INTENT.COMPLETE_MISSING_TOOTH,
      patientText: null,
      procedureText: m.groups.procedure.trim(),
      toothText: m.groups.tooth,
      rawText: value,
    };
  }
  return null;
};

// --- A / D: "Segna <procedure> [<tooth>] di <patient> come eseguita[, non ricordo il dente]" ---
const PATTERN_MARK_COMPLETED = /^segna\s+(?<procedure>.+?)\s+(?:(?<tooth>\d{1,2})\s+)?di\s+(?<patient>.+?)\s+come\s+eseguit[ao](?:,?\s*non\s+ricordo\s+il\s+dente)?\s*$/i;

// --- C: "Crea piano di cura per <patient> con <item>, <item>, ..." ---
const PATTERN_CREATE_PLAN = /^crea\s+piano\s+di\s+cura\s+per\s+(?<patient>.+?)\s+con\s+(?<itemsText>.+)$/i;
const ITEM_PATTERN = /^(?<procedure>.+?)\s+su\s+(?<teeth>[\d\s]+)$/i;

// --- E: "Oggi a <patient> ho fatto <count> <procedure> e mi deve <amount>, ma non ricordo i denti" ---
const PATTERN_MULTIPLE_TREATMENTS = /^oggi\s+a\s+(?<patient>.+?)\s+ho\s+fatto\s+(?<count>[a-zàèéìòù]+|\d+)\s+(?<procedure>.+?)\s+e\s+mi\s+deve\s+(?<amountText>.+?)(?:,?\s*ma\s+non\s+ricordo\s+i\s+denti)?\s*$/i;

const parseCreatePlan = (text) => {
  const m = PATTERN_CREATE_PLAN.exec(text);
  if (!m) return null;
  const segments = m.groups.itemsText.split(',').map((s) => s.trim()).filter(Boolean);
  const items = [];
  for (const segment of segments) {
    const im = ITEM_PATTERN.exec(segment);
    if (!im) return null; // any unrecognized segment aborts deterministic parsing entirely
    const teeth = im.groups.teeth.trim().split(/\s+/).filter(Boolean);
    for (const tooth of teeth) items.push({ procedureText: im.groups.procedure.trim(), toothText: tooth });
  }
  if (!items.length) return null;
  return {
    commandIntent: COMMAND_INTENT.CREATE_TREATMENT_PLAN,
    patientText: m.groups.patient.trim(),
    items,
    amount: null,
    executionCompleted: false,
    rawText: text,
  };
};

/**
 * parseCommand(text) -> structured parse | null
 * `null` means: no deterministic command shape matched — the caller
 * should fall back to the Model Gateway contract (semantic fields only).
 */
export function parseCommand(text) {
  const value = (text || '').trim();
  if (!value) return null;

  let m = PATTERN_TREATMENT_AND_PAYMENT.exec(value);
  if (m) {
    return {
      commandIntent: COMMAND_INTENT.RECORD_TREATMENT_AND_PENDING_PAYMENT,
      patientText: m.groups.patient.trim(),
      items: [{ procedureText: m.groups.procedure.trim(), toothText: m.groups.tooth || null }],
      amount: extractAmount(m.groups.amountText),
      executionCompleted: true,
      rawText: value,
    };
  }

  const createPlan = parseCreatePlan(value);
  if (createPlan) return createPlan;

  m = PATTERN_MULTIPLE_TREATMENTS.exec(value);
  if (m) {
    const count = parseCount(m.groups.count) || 1;
    const items = Array.from({ length: count }, () => ({ procedureText: m.groups.procedure.trim(), toothText: null }));
    return {
      commandIntent: COMMAND_INTENT.RECORD_MULTIPLE_TREATMENTS_AND_PAYMENT,
      patientText: m.groups.patient.trim(),
      items,
      amount: extractAmount(m.groups.amountText),
      executionCompleted: true,
      rawText: value,
    };
  }

  m = PATTERN_MARK_COMPLETED.exec(value);
  if (m) {
    return {
      commandIntent: COMMAND_INTENT.MARK_TREATMENT_COMPLETED,
      patientText: m.groups.patient.trim(),
      items: [{ procedureText: m.groups.procedure.trim(), toothText: m.groups.tooth || null }],
      amount: null,
      executionCompleted: true,
      rawText: value,
    };
  }

  const completeTooth = parseCompleteMissingTooth(value);
  if (completeTooth) return completeTooth;

  return null;
}
