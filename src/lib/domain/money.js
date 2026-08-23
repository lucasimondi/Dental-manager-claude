/* POL-FIN-001 — money-safety helpers.
   Audit finding (see docs/architecture/POL-FIN-001-payment-plans-deadlines.md
   CURRENT_FINANCIAL_MODEL): every existing money field in this codebase
   (plans.voci[].prezzo, payments.importo, POL-003's own ledger columns)
   is a plain decimal number — Postgres `numeric(18,6)` server-side,
   plain JS `Number` client-side. That is already a safe, exact decimal
   representation at the database layer; this file does NOT change it and
   does NOT introduce integer minor-units storage anywhere (that would be
   a breaking, unauthorized change to every existing money field — see
   AGENTS.md "never change financial semantics without a Product Owner
   gate"). What plain `Number` arithmetic in JavaScript CANNOT be trusted
   for is splitting a total into several parts that must sum back to
   EXACTLY that total (installment generation) — 4000 / 8 = 500 is fine,
   but not every split divides evenly, and naive float rounding can lose
   or gain a cent across many additions. These helpers convert to integer
   cents ONLY for the duration of a split/sum computation, then convert
   back — a computation-time safety net, not a storage change. */

const CENTS_PER_UNIT = 100;

/** toCents(12.5) -> 1250. Rounds to the nearest cent — the one place a
 *  float->int boundary is crossed, done explicitly and once. */
export const toCents = (amount) => Math.round(Number(amount) * CENTS_PER_UNIT);

/** fromCents(1250) -> 12.5 */
export const fromCents = (cents) => cents / CENTS_PER_UNIT;

/** sumCents([12.5, 12.5, 25]) -> 5000 (cents) — safe integer summation. */
export const sumAmountsAsCents = (amounts) => amounts.reduce((sum, a) => sum + toCents(a), 0);

/**
 * splitEvenlyDeterministic(totalAmount, count) -> number[] (length `count`,
 * each a JS number rounded to 2 decimals)
 *
 * Splits `totalAmount` into `count` parts that sum EXACTLY back to
 * `totalAmount` (to the cent), never relying on float division alone.
 * When the total does not divide evenly into whole cents, the remainder
 * is distributed deterministically: the first `remainder` installments
 * get one extra cent each (largest-remainder-first is unnecessary here
 * since every share is otherwise identical — this is simpler and just as
 * deterministic/reproducible). Never invents money: sum(result) ===
 * totalAmount to the cent, always.
 */
export function splitEvenlyDeterministic(totalAmount, count) {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error('splitEvenlyDeterministic: count must be a positive integer');
  }
  const totalCents = toCents(totalAmount);
  const baseShare = Math.floor(totalCents / count);
  const remainder = totalCents - baseShare * count; // 0 <= remainder < count
  const shares = Array.from({ length: count }, (_, i) => baseShare + (i < remainder ? 1 : 0));
  return shares.map(fromCents);
}

/** roundMoney(x) -> x rounded to 2 decimals, via the same cents boundary
 *  every other helper here uses (never a bare `.toFixed`/`Math.round`
 *  scattered ad hoc elsewhere in new POL-FIN-001 code). */
export const roundMoney = (amount) => fromCents(toCents(amount));

/** amountsEqual(a, b) -> true if a and b are the same amount to the cent
 *  (safe equality — never `===` on two independently-computed floats). */
export const amountsEqual = (a, b) => toCents(a) === toCents(b);
