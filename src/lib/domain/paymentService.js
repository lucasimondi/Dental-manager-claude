/* POL-AI-005B — canonical payment domain service.
   Mirrors src/components/Pagamenti.jsx's real `save()` payload shape.
   One deliberate, documented divergence: a human recording a payment
   through that form defaults `stato: 'pagato'` (money already received);
   an AI-initiated `ENSURE_PENDING_PAYMENT` step is recording that a
   patient OWES money, not that it was collected, so it defaults to the
   same app's existing `'sospeso'` status instead — a real, pre-existing
   enum value (see Pagamenti.jsx's Stato select), not an invented one. */

import { uid, today } from '../utils.js';
import { findLikelyDuplicatePendingPayment } from '../poliedron/planner/actionPlanner.js';

export { findLikelyDuplicatePendingPayment };

const PAYMENT_KEY = 'dm_py';

export const buildPendingPayment = ({ pazienteId, amount, metodo = 'Contanti', nota = '' }) => ({
  id: uid(),
  pazienteId: Number(pazienteId),
  data: today(),
  importo: Number(amount) || 0,
  metodo,
  nota,
  stato: 'sospeso',
});

/** POL-FIN-001 — a payment the patient has actually handed over right now
 *  ("Mario oggi mi ha dato 500 euro"), as opposed to `buildPendingPayment`
 *  above (money still owed). `stato: 'pagato'` is the exact same enum
 *  value Pagamenti.jsx's human form already defaults to, and the ONLY
 *  status `computePatientFinancialSummary`'s `totalCollected` counts
 *  (matching POL-003's own canonical ledger rule — see
 *  patientFinancialSummary.js's own header comment). */
export const buildCollectedPayment = ({ pazienteId, amount, metodo = 'Contanti', nota = '' }) => ({
  id: uid(),
  pazienteId: Number(pazienteId),
  data: today(),
  importo: Number(amount) || 0,
  metodo,
  nota,
  stato: 'pagato',
});

export async function loadPatientPayments(db, patientId) {
  const all = await db.getAll(PAYMENT_KEY);
  return (all || []).filter((p) => String(p.pazienteId) === String(patientId));
}

export async function createPayment(db, paymentPayload) {
  return db.insert(PAYMENT_KEY, paymentPayload);
}

export async function getPaymentById(db, id) {
  return db.getById(PAYMENT_KEY, id);
}
