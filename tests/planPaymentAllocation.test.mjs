import test from 'node:test';
import assert from 'node:assert/strict';
import { allocatedPaymentForItem } from '../src/lib/domain/planPaymentAllocation.js';

test('attributes collected payments FIFO across plans and items for warning only', () => {
  const plans = [
    { id: 1, pazienteId: 9, data: '2026-01-01', voci: [{ prezzo: 100 }, { prezzo: 50 }], sconto: 0, scontoTipo: 'pct' },
    { id: 2, pazienteId: 9, data: '2026-02-01', voci: [{ prezzo: 80 }], sconto: 0, scontoTipo: 'pct' },
  ];
  const payments = [{ pazienteId: 9, importo: 170, stato: 'pagato' }];
  assert.equal(allocatedPaymentForItem(plans, payments, 1, 0), 100);
  assert.equal(allocatedPaymentForItem(plans, payments, 1, 1), 50);
  assert.equal(allocatedPaymentForItem(plans, payments, 2, 0), 20);
});

test('excludes suspended payments and applies the plan discount proportionally', () => {
  const plans = [{ id: 1, pazienteId: 9, data: '2026-01-01', voci: [{ prezzo: 100 }, { prezzo: 100 }], sconto: 50, scontoTipo: 'pct' }];
  const payments = [{ pazienteId: 9, importo: 60, stato: 'pagato' }, { pazienteId: 9, importo: 100, stato: 'sospeso' }];
  assert.equal(allocatedPaymentForItem(plans, payments, 1, 0), 50);
  assert.equal(allocatedPaymentForItem(plans, payments, 1, 1), 10);
});
