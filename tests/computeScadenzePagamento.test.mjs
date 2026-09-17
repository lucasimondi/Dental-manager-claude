import test from 'node:test';
import assert from 'node:assert/strict';
import { computeScadenzePagamento } from '../src/lib/domain/scadenzePagamentoService.js';

// Product Owner: "mi dà due scadenze di pagamento (Capraro e Savalli) ma poi
// quando si va sulla scheda loro non hanno da pagare". The old logic listed
// ANY plan with a scadenzaPagamento date, regardless of whether it had
// already been paid off — a stale deadline stayed forever, even after full
// payment. The fix checks the plan's real residual (its total minus
// payments actually linked to it via piano_id, same source get_saldo_piano
// uses server-side) and drops the deadline once nothing is left to pay.

const paz1 = { id: 1, nome: 'Mario', cognome: 'Capraro' };
const paz2 = { id: 2, nome: 'Anna', cognome: 'Savalli' };

test('a fully-paid plan with a scadenza date is excluded — exact reported scenario', () => {
  const plans = [{ id: 10, pazienteId: 1, scadenzaPagamento: '2026-09-10', voci: [{ prezzo: 200 }] }];
  const payments = [{ id: 1, pazienteId: 1, pianoId: 10, importo: 200, stato: 'pagato' }];
  const result = computeScadenzePagamento(plans, [paz1], payments);
  assert.deepEqual(result, []);
});

test('a plan with no payments linked yet still shows its full amount as due', () => {
  const plans = [{ id: 11, pazienteId: 2, scadenzaPagamento: '2026-09-20', voci: [{ prezzo: 300 }] }];
  const result = computeScadenzePagamento(plans, [paz2], []);
  assert.equal(result.length, 1);
  assert.equal(result[0].importo, 300);
  assert.equal(result[0].paz, paz2);
});

test('a partially-paid plan shows only the real residual, not the full plan total', () => {
  const plans = [{ id: 12, pazienteId: 1, scadenzaPagamento: '2026-09-15', voci: [{ prezzo: 500 }] }];
  const payments = [{ id: 2, pazienteId: 1, pianoId: 12, importo: 150, stato: 'pagato' }];
  const result = computeScadenzePagamento(plans, [paz1], payments);
  assert.equal(result.length, 1);
  assert.equal(result[0].importo, 350);
});

test('an unassigned payment (pianoId null) does not reduce a specific plan\'s residual — it must be assigned first (POL-FIN-008)', () => {
  const plans = [{ id: 13, pazienteId: 1, scadenzaPagamento: '2026-09-12', voci: [{ prezzo: 100 }] }];
  const payments = [{ id: 3, pazienteId: 1, pianoId: null, importo: 100, stato: 'pagato' }];
  const result = computeScadenzePagamento(plans, [paz1], payments);
  assert.equal(result.length, 1);
  assert.equal(result[0].importo, 100);
});

test('a payment linked to a different plan does not offset this one', () => {
  const plans = [
    { id: 14, pazienteId: 1, scadenzaPagamento: '2026-09-11', voci: [{ prezzo: 100 }] },
    { id: 15, pazienteId: 1, scadenzaPagamento: '2026-09-13', voci: [{ prezzo: 100 }] },
  ];
  const payments = [{ id: 4, pazienteId: 1, pianoId: 14, importo: 100, stato: 'pagato' }];
  const result = computeScadenzePagamento(plans, [paz1], payments);
  assert.equal(result.length, 1);
  assert.equal(result[0].pl.id, 15);
});

test('a plan without a scadenzaPagamento date is never included', () => {
  const plans = [{ id: 16, pazienteId: 1, voci: [{ prezzo: 100 }] }];
  const result = computeScadenzePagamento(plans, [paz1], []);
  assert.deepEqual(result, []);
});

test('a plan whose patient no longer exists is skipped rather than throwing', () => {
  const plans = [{ id: 17, pazienteId: 999, scadenzaPagamento: '2026-09-11', voci: [{ prezzo: 100 }] }];
  const result = computeScadenzePagamento(plans, [paz1], []);
  assert.deepEqual(result, []);
});

test('results are sorted by scadenza date, earliest first', () => {
  const plans = [
    { id: 18, pazienteId: 1, scadenzaPagamento: '2026-09-20', voci: [{ prezzo: 100 }] },
    { id: 19, pazienteId: 2, scadenzaPagamento: '2026-09-05', voci: [{ prezzo: 100 }] },
  ];
  const result = computeScadenzePagamento(plans, [paz1, paz2], []);
  assert.deepEqual(result.map((r) => r.pl.id), [19, 18]);
});

test('a case-insensitive/unpaid stato does not count toward the residual', () => {
  const plans = [{ id: 20, pazienteId: 1, scadenzaPagamento: '2026-09-11', voci: [{ prezzo: 100 }] }];
  const payments = [{ id: 5, pazienteId: 1, pianoId: 20, importo: 100, stato: 'in_attesa' }];
  const result = computeScadenzePagamento(plans, [paz1], payments);
  assert.equal(result.length, 1);
  assert.equal(result[0].importo, 100);
});
