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
  // POL-FIN-001
  CREATE_PAYMENT_PLAN: 'CREATE_PAYMENT_PLAN',
  RECORD_PAYMENT_AGAINST_DEADLINE: 'RECORD_PAYMENT_AGAINST_DEADLINE',
});

const ITALIAN_NUMBER_WORDS = Object.freeze({
  una: 1, un: 1, uno: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, dodici: 12,
});

const parseCount = (text) => {
  const t = (text || '').trim().toLowerCase();
  if (ITALIAN_NUMBER_WORDS[t] !== undefined) return ITALIAN_NUMBER_WORDS[t];
  const n = Number(t);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export const ITALIAN_MONTHS = Object.freeze({
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
});

/** parseExplicitDayMonth("28 agosto") -> { day: 28, month: 8 } | null.
 *  Deliberately requires BOTH a day and a month name — a bare month name
 *  ("da settembre") is genuinely ambiguous about which day, and this
 *  parser refuses to invent one (see commandParser.js's own doc comment:
 *  narrow and honest, not a general NLU date grammar). A bare month falls
 *  through to `null` here, so the whole command is not deterministically
 *  recognized and correctly falls back to the Model Gateway contract. */
const parseExplicitDayMonth = (text) => {
  const m = /^(?<day>\d{1,2})\s+(?<month>gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)$/i.exec((text || '').trim());
  if (!m) return null;
  const day = Number(m.groups.day);
  const month = ITALIAN_MONTHS[m.groups.month.toLowerCase()];
  if (day < 1 || day > 31) return null;
  return { day, month };
};

/** resolveStartDateIso(dayMonth, todayIso) -> "YYYY-MM-DD". Picks the
 *  current year if that day/month hasn't passed yet this year, otherwise
 *  next year — a deterministic, non-inventive default (never asks which
 *  year when the day+month is unambiguous relative to "today"). */
export const resolveStartDateIso = (dayMonth, todayIso) => {
  const [ty] = todayIso.split('-').map(Number);
  const pad = (n) => String(n).padStart(2, '0');
  const candidate = `${ty}-${pad(dayMonth.month)}-${pad(dayMonth.day)}`;
  return candidate >= todayIso ? candidate : `${ty + 1}-${pad(dayMonth.month)}-${pad(dayMonth.day)}`;
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

// --- POL-FIN-001 F1: "Dividi <amount clause> in <count> rate [mensili]
// [da|a partire dal <day> <month>]" — CREATE_PAYMENT_PLAN (installments).
// No patient text at all: like Workflow G, this is always resolved from
// the app's current-patient context (task §16). `<amount clause>` is
// either an explicit stated amount ("i 4.000 euro che rimangono") — cross-
// checked against the canonical outstanding balance at plan time, never
// trusted blindly — or a bare reference to the canonical balance itself
// ("il residuo", "il saldo residuo"), which carries no amount of its own
// and always defers entirely to canonical data. ---
const PATTERN_CREATE_INSTALLMENT_PLAN = /^dividi\s+(?<amountClause>.+?)\s+in\s+(?<count>[a-zàèéìòù]+|\d+)\s+rate(?:\s+mensil[ei])?(?:\s+(?:da|a\s+partire\s+dal|dal)\s+(?<startText>.+?))?\.?\s*$/i;
const RESIDUE_REFERENCE_RE = /^il\s+(?:residuo|saldo\s+residuo|importo\s+residuo)(?:\s+del\s+paziente)?$/i;

// `extractAmount` (reused, unmodified — intentEngine.js's AMOUNT_RE only
// captures up to 2 digits after a `.`/`,`, so "4.000" would otherwise
// parse as 4.00) — this strips an Italian thousands-separator dot
// ("4.000" -> "4000") ONLY within this one new command family, never
// touching intentEngine.js itself or any other caller of extractAmount.
const stripThousandsSeparator = (text) => (text || '').replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2');

const parseCreateInstallmentPlan = (value) => {
  const m = PATTERN_CREATE_INSTALLMENT_PLAN.exec(value);
  if (!m) return null;
  const count = parseCount(m.groups.count);
  if (!count) return null;
  const isResidueReference = RESIDUE_REFERENCE_RE.test(m.groups.amountClause.trim());
  const statedAmount = isResidueReference ? null : extractAmount(stripThousandsSeparator(m.groups.amountClause));
  if (!isResidueReference && statedAmount === null) return null; // neither a recognized residue phrase nor a parseable amount
  const dayMonth = m.groups.startText ? parseExplicitDayMonth(m.groups.startText) : null;
  if (m.groups.startText && !dayMonth) return null; // an unparseable start clause (e.g. bare month name) aborts deterministic parsing
  return {
    commandIntent: COMMAND_INTENT.CREATE_PAYMENT_PLAN,
    patientText: null,
    statedAmount,
    count,
    startDayMonth: dayMonth,
    rawText: value,
  };
};

// --- POL-FIN-001 F2/F3: recording a payment already received.
// "<patient> [oggi] mi ha dato <amount>" — patient named in text, no
// deadline reference (generic recording, resolved against open
// deadlines at plan time per task §17).
// "Ha pagato <amount> della rata/scadenza di <ref>" — context patient
// (like Workflow G), `<ref>` narrows to a specific deadline by month
// name (task §18's "rata di agosto" example). ---
const PATTERN_RECORD_PAYMENT_NAMED = /^(?<patient>.+?)\s+(?:oggi\s+)?mi\s+ha\s+dato\s+(?<amountText>.+?)\.?\s*$/i;
const PATTERN_RECORD_PAYMENT_DEADLINE_REF = /^ha\s+pagato\s+(?<amountText>.+?)\s+dell[a']\s*(?:rata|scadenza)\s+di\s+(?<deadlineRef>.+?)\.?\s*$/i;

const parseRecordPayment = (value) => {
  let m = PATTERN_RECORD_PAYMENT_DEADLINE_REF.exec(value);
  if (m) {
    const amount = extractAmount(stripThousandsSeparator(m.groups.amountText));
    if (amount === null) return null;
    return {
      commandIntent: COMMAND_INTENT.RECORD_PAYMENT_AGAINST_DEADLINE,
      patientText: null,
      amount,
      deadlineRefText: m.groups.deadlineRef.trim(),
      rawText: value,
    };
  }
  m = PATTERN_RECORD_PAYMENT_NAMED.exec(value);
  if (m) {
    const amount = extractAmount(stripThousandsSeparator(m.groups.amountText));
    if (amount === null) return null;
    return {
      commandIntent: COMMAND_INTENT.RECORD_PAYMENT_AGAINST_DEADLINE,
      patientText: m.groups.patient.trim(),
      amount,
      deadlineRefText: null,
      rawText: value,
    };
  }
  return null;
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

  const createInstallmentPlan = parseCreateInstallmentPlan(value);
  if (createInstallmentPlan) return createInstallmentPlan;

  const recordPayment = parseRecordPayment(value);
  if (recordPayment) return recordPayment;

  return null;
}
