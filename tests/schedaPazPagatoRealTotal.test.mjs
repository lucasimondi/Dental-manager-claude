import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src/components/SchedaPaz.jsx', 'utf8');

// Product Owner (POL-FIN-008): "ho registrato un pagamento (fabio di
// Stefano) 50 euro, nel pagato in alto nello slot pagato non c'è, poi ho
// creato un piano di 100 euro, quindi mi dice da pagare, deve comparire
// nel pagato comunque a prescindere". aggSaldi.totale_pagato (summed from
// get_saldo_piano rows) is PER-PLAN — a payment made before any plan
// existed (piano_id still NULL) is invisible to it forever, even after a
// plan is later created. "Pagato" must mean "money this patient has
// actually given us", regardless of plan linkage — same convention
// Incassi.jsx already uses for its studio-wide "Incassato" KPI.

test('SchedaPaz imports totalePagatoPaziente alongside the existing aggregateSaldi', () => {
  assert.match(source, /import \{ aggregateSaldi, totalePagatoPaziente \} from '\.\.\/lib\/domain\/incassiMath\.js'/);
});

test('the header stat bar and Situazione finanziaria card show the real patient-wide total, not the plan-scoped aggSaldi.totale_pagato', () => {
  assert.match(source, /const totalePagatoReale = totalePagatoPaziente\(patPay\);/);
  assert.match(source, /\{ l: 'Pagato', v: saldiCaricati \? fmt\(totalePagatoReale\) : '…', goTo: 'paga' \}/);
  assert.match(source, /Pagato \{saldiCaricati \? fmt\(totalePagatoReale\) : '…'\}/);
  // Must not have silently regressed back to the plan-scoped total for display.
  assert.doesNotMatch(source, /fmt\(aggSaldi\.totale_pagato\)/);
});

test('"Da pagare" (the canonical server-computed saldo_piano) is untouched — only the Pagato display changed, not the receivable formula', () => {
  assert.match(source, /const totDaPagare = aggSaldi\.saldo_piano;/);
});

test('pctPagato ("% saldato" progress bar) uses the same real total as the text next to it, so they can never visually disagree', () => {
  assert.match(source, /const pctPagato = aggSaldi\.totale_piano > 0 \? Math\.min\(100, Math\.round\(\(totalePagatoReale \/ aggSaldi\.totale_piano\) \* 100\)\) : 0;/);
});
