/* POL-AI-005B — canonical treatment-plan domain service.
   Every reducer here reproduces `src/components/Piani.jsx`'s exact
   existing business rules (byte-identical effect, not a reinterpretation)
   so a Poliedron-initiated write and a human clicking the real form
   always converge on the same state. This is the "minimum reusable
   service" the Product Owner asked for — `Piani.jsx` itself is NOT
   modified in this task (no unrelated refactor of a shipped component),
   but nothing here diverges from what it already does, and it is written
   so `Piani.jsx` could be pointed at these same functions later without
   behavior change.

   I/O functions take an explicit `db` parameter (shaped like `DB` from
   ../supabase.js: {getAll, insert, update, getById}) instead of importing
   the singleton — the same client-as-parameter convention already used by
   homeLayoutPersistence.js, so tests can inject a fake without touching
   the real Supabase client. */

import { uid, today } from '../utils.js';
import { normalizza } from '../ricercaPazienti.js';
import { sameProcedureAndTooth, findExistingTreatmentItem, PRICE_UNRESOLVED } from '../poliedron/planner/actionPlanner.js';

export { findExistingTreatmentItem, sameProcedureAndTooth };

const TREATMENT_PLAN_KEY = 'dm_pl';

/** Mirrors Piani.jsx's addVoce single-item payload exactly. Stores the
 *  RESOLVED canonical pricelist name when one was resolved (matching what
 *  `selPr` stores when a human picks from the pricelist dropdown), falling
 *  back to the raw typed text only when unresolved — this MUST stay in
 *  sync with actionPlanner.js's own `procedureNormalizedText` derivation
 *  (also canonical-name-first), or two equally-valid phrasings of the
 *  same procedure would never recognize each other as the same treatment.
 *  `price` may be the planner's PRICE_UNRESOLVED sentinel — Piani.jsx's
 *  own form already defaults an unfilled/invalid price to 0
 *  (`Number(nv.prezzo) || 0`); this reproduces that exact existing
 *  convention, not a new one. The Action Plan preview is what must never
 *  silently show PRICE_UNRESOLVED as "0" to the user — that is enforced
 *  upstream in actionPlanner.js's warnings, not here. */
export const buildTreatmentItem = ({ procedureRef, tooth, price }) => ({
  prestazione: procedureRef?.canonicalName || procedureRef?.text,
  dente: tooth?.state === 'known' ? tooth.value : '',
  prezzo: price === PRICE_UNRESOLVED ? 0 : (Number(price) || 0),
  eseguita: false,
  incassata: false,
});

/** Mirrors Piani.jsx's save() for a brand-new plan exactly (same default
 *  field shape, same uid()/today() helpers). */
export const buildNewPlan = ({ pazienteId, titolo, voci }) => ({
  id: uid(),
  pazienteId: Number(pazienteId),
  titolo,
  data: today(),
  voci,
  stato: 'attivo',
  sconto: 0,
  scontoTipo: 'pct',
  scadenzaPagamento: '',
  ortodonzia: null,
});

/** Idempotent "mark completed" — unlike Piani.jsx's toggleEseguita (which
 *  always flips the boolean, on real user request), this only ever moves
 *  an item from not-completed to completed, exactly reproducing that
 *  function's "turning on" branch (dataEsec stamped, incassata preserved,
 *  plan auto-promoted to 'concluso' once every item is done). Calling it
 *  again on an already-completed item is a genuine no-op, not a second
 *  toggle — this is what makes repeating the same Poliedron command safe. */
export const markTreatmentItemCompleted = (plan, voceIndex) => {
  const voce = plan.voci?.[voceIndex];
  if (!voce) return { plan, changed: false };
  if (voce.eseguita === true) return { plan, changed: false };
  const nuoveVoci = plan.voci.map((v, j) => (j === voceIndex ? { ...v, eseguita: true, dataEsec: today() } : v));
  const tutteEseguite = nuoveVoci.every((v) => v.eseguita);
  const nextPlan = { ...plan, voci: nuoveVoci, stato: tutteEseguite ? 'concluso' : plan.stato };
  return { plan: nextPlan, changed: true };
};

/** POL-AI-005B new, minimal capability: Piani.jsx has no existing "add an
 *  item to an already-saved plan" UI (verified — only the pre-save
 *  creation modal builds `voci`). Appends to the patient's most-recently-
 *  updated non-`concluso` plan if one exists (the natural "current active
 *  plan"), matching the same voce shape `buildTreatmentItem` produces
 *  during creation — not a parallel model, the same one generalized to an
 *  already-persisted row. */
export const pickTargetPlanForNewItem = (plans, patientId) => {
  const candidates = (plans || [])
    .filter((p) => String(p.pazienteId) === String(patientId) && p.stato !== 'concluso')
    .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
  return candidates[0] || null;
};

/** Later tooth completion (§ "Era il 46"): finds the exact previously-
 *  incomplete item (same patient/procedure, tooth still unknown) so it can
 *  be updated in place instead of a new item being created — the "later
 *  completion updates the existing item, never a duplicate" requirement. */
export const findIncompleteItemToComplete = (plans, patientId, procedureNormalizedText) => {
  for (const plan of plans || []) {
    if (String(plan.pazienteId) !== String(patientId)) continue;
    const index = (plan.voci || []).findIndex((v) => normalizza(v.prestazione) === procedureNormalizedText && !v.dente);
    if (index >= 0) return { plan, voceIndex: index };
  }
  return null;
};

export const setItemTooth = (plan, voceIndex, toothValue) => {
  const voce = plan.voci?.[voceIndex];
  if (!voce) return { plan, changed: false };
  if (voce.dente === toothValue) return { plan, changed: false };
  const nuoveVoci = plan.voci.map((v, j) => (j === voceIndex ? { ...v, dente: toothValue } : v));
  return { plan: { ...plan, voci: nuoveVoci }, changed: true };
};

// --- I/O (real writes go through here only) -------------------------------

/** Fresh, patient-scoped read — used both as the pre-write idempotency
 *  re-check (TOCTOU safety: never trust the preview's snapshot at write
 *  time) and as the post-write verification source. */
export async function loadPatientPlans(db, patientId) {
  const all = await db.getAll(TREATMENT_PLAN_KEY);
  return (all || []).filter((p) => String(p.pazienteId) === String(patientId));
}

export async function createPlan(db, planPayload) {
  return db.insert(TREATMENT_PLAN_KEY, planPayload);
}

export async function updatePlan(db, id, planPayload) {
  await db.update(TREATMENT_PLAN_KEY, id, planPayload);
  return db.getById(TREATMENT_PLAN_KEY, id);
}

export async function getPlanById(db, id) {
  return db.getById(TREATMENT_PLAN_KEY, id);
}
