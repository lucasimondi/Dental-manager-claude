import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { parseCreatePlanRequest, parseRegisterPaymentRequest } from '../src/lib/poliedron/planner/createIntent.js';
import { processQuery } from '../src/lib/poliedron/poliedraCore.js';
import { buildContext } from '../src/lib/poliedron/contextEngine.js';
import { ACTION_REGISTRY } from '../src/lib/poliedron/actionRegistry.js';
import { NAVIGATION_INDEX } from '../src/lib/poliedron/navigationIndex.js';

// POL-AI-007 — Product Owner, on top of the appointment-booking fix
// (POL-AI-006): "deve essere in grado di ... creare piani, registrare
// pagamenti, aggiungere prestazioni senza perdite di tempo". Root cause,
// same class as the appointment bug: even when a request like "crea piano
// di cura per Mario Rossi" already matched a CREATE verb in
// intentEngine.js, poliedraCore.js's generic branch fed the WHOLE leftover
// sentence to cercaPazienti() — which requires every token of its query to
// match the patient's name/CF/phone (see ricercaPazienti.js) — so a leading
// noun phrase like "piano di cura per" made the search fail for every real
// patient, every time. createIntent.js fixes this the same way
// appointmentIntent.js fixed booking: extract a clean patient reference
// first.

test('parseCreatePlanRequest recognizes real plan-creation phrasings and extracts a clean patient reference', () => {
  const crea = parseCreatePlanRequest('Crea un piano di cura per Mario Rossi');
  assert.equal(crea.patientText, 'Mario Rossi');

  const apri = parseCreatePlanRequest('Apri un nuovo preventivo per Maria Bianchi');
  assert.equal(apri.patientText, 'Maria Bianchi');

  const inizia = parseCreatePlanRequest('Inizia un piano per Luca');
  assert.equal(inizia.patientText, 'Luca');
});

test('parseCreatePlanRequest returns null rather than guessing when there is no real plan request', () => {
  assert.equal(parseCreatePlanRequest(''), null);
  assert.equal(parseCreatePlanRequest('crea piano di cura'), null); // verb+noun but no patient
  assert.equal(parseCreatePlanRequest("Cos'è un piano di cura?"), null); // question, not a command
  assert.equal(parseCreatePlanRequest('Mario Rossi ha un piano da 500 euro'), null); // no recognized verb
  assert.equal(parseCreatePlanRequest('Segna otturazione 26 di Rossi come eseguita'), null); // no plan noun
});

test('parseRegisterPaymentRequest recognizes real payment phrasings and extracts patient + amount separately', () => {
  const registra = parseRegisterPaymentRequest('Registra un pagamento di 100 euro a Mario Rossi');
  assert.equal(registra.patientText, 'Mario Rossi');
  assert.equal(registra.amount, 100);

  const segna = parseRegisterPaymentRequest('Segna un incasso di 350€ per Maria Bianchi');
  assert.equal(segna.patientText, 'Maria Bianchi');
  assert.equal(segna.amount, 350);

  const noAmount = parseRegisterPaymentRequest('Registra un pagamento per Anna');
  assert.equal(noAmount.patientText, 'Anna');
  assert.equal(noAmount.amount, null);
});

test('parseRegisterPaymentRequest returns null rather than guessing when there is no real payment request', () => {
  assert.equal(parseRegisterPaymentRequest(''), null);
  assert.equal(parseRegisterPaymentRequest('registra pagamento'), null); // verb+noun but no patient
  assert.equal(parseRegisterPaymentRequest('pagamento Rossi'), null); // no verb, only a search phrase
  assert.equal(parseRegisterPaymentRequest('Mario Rossi ha pagato 100 euro'), null); // no recognized verb
});

test('processQuery routes a real plan-creation phrase to a confirmable quote.create WORKFLOW, never a dead-end search', async () => {
  const patients = [{ id: 'p1', nome: 'Mario', cognome: 'Rossi', cf: '', telefono: '' }];
  const result = await processQuery({
    query: 'Crea un piano di cura per Mario Rossi',
    context: buildContext(),
    permissions: {},
    sources: { patients, navigationIndex: NAVIGATION_INDEX, actions: ACTION_REGISTRY },
    allowModel: false,
  });
  assert.equal(result.intent, 'WORKFLOW');
  assert.equal(result.confirmationRequired, true);
  assert.equal(result.suggestedActions[0].id, 'quote.create');
  assert.equal(result.entities.patientCandidates[0].id, 'p1');
});

test('processQuery routes a real payment-registration phrase to a confirmable payment.create WORKFLOW with the amount preserved', async () => {
  const patients = [{ id: 'p1', nome: 'Mario', cognome: 'Rossi', cf: '', telefono: '' }];
  const result = await processQuery({
    query: 'Registra un pagamento di 100 euro a Mario Rossi',
    context: buildContext(),
    permissions: {},
    sources: { patients, navigationIndex: NAVIGATION_INDEX, actions: ACTION_REGISTRY },
    allowModel: false,
  });
  assert.equal(result.intent, 'WORKFLOW');
  assert.equal(result.confirmationRequired, true);
  assert.equal(result.suggestedActions[0].id, 'payment.create');
  assert.equal(result.entities.patientCandidates[0].id, 'p1');
  assert.equal(result.entities.amount, 100);
});

test('quote.create pre-fills the real "Nuovo piano" form instead of always opening it blank', () => {
  const action = ACTION_REGISTRY.find((a) => a.id === 'quote.create');
  assert.ok(action, 'quote.create must still exist in the registry');
  assert.equal(action.riskLevel, 1); // still opens the real form for a human to fill and submit, never writes directly

  let receivedPatientId = 'not-called';
  const ctx = { openNewPlan: (patientId) => { receivedPatientId = patientId; } };
  action.navigate(ctx, { id: 42 });
  assert.equal(receivedPatientId, 42);

  // No patient recognized/selected -- falls back to the same blank
  // "Nuovo preventivo" quick action every other caller already uses,
  // never an invented patient.
  let blankRan = false;
  const blankCtx = { openNewPlan: () => { throw new Error('must not be called without a patient'); }, onNavigateNew: () => { blankRan = true; } };
  action.navigate(blankCtx, null);
  assert.equal(blankRan, true);
});

test('payment.create pre-fills the real "Registra incasso" form instead of always opening it blank', () => {
  const action = ACTION_REGISTRY.find((a) => a.id === 'payment.create');
  assert.ok(action, 'payment.create must still exist in the registry');
  assert.equal(action.riskLevel, 1); // still opens the real form for a human to review and save, never writes directly

  let received = null;
  const ctx = { openNewPayment: (payload) => { received = payload; } };
  action.navigate(ctx, { id: 42 }, { amount: 100 });
  assert.deepEqual(received, { patientId: 42, amount: 100 });

  // Amount recognized but no patient match yet -- still worth pre-filling
  // the amount rather than discarding it.
  received = null;
  action.navigate(ctx, null, { amount: 50 });
  assert.deepEqual(received, { patientId: null, amount: 50 });

  // Neither patient nor amount recognized -- falls back to the same blank
  // "Pagamento" quick action every other caller already uses.
  let blankRan = false;
  const blankCtx = { openNewPayment: () => { throw new Error('must not be called with nothing recognized'); }, onNavigateNew: () => { blankRan = true; } };
  action.navigate(blankCtx, null, {});
  assert.equal(blankRan, true);
});

test('App.jsx wires goNuovoPagamento to pre-fill Incassi via the existing autoOpenNew mechanism, and threads it to Poliedron', () => {
  const appSrc = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(appSrc, /const goNuovoPagamento = \(\{ patientId, amount \} = \{\}\) => \{/);
  assert.match(appSrc, /openNewPlan=\{goNuovoPiano\}/);
  assert.match(appSrc, /openNewPayment=\{goNuovoPagamento\}/);
  assert.match(appSrc, /autoOpenNewPrefill=\{autoOpenNew === 'paga' \? autoOpenNewPrefill : null\}/);

  const incassiSrc = fs.readFileSync(new URL('../src/components/Incassi.jsx', import.meta.url), 'utf8');
  assert.match(incassiSrc, /autoOpenNewPrefill = null/);
  assert.match(incassiSrc, /openIncasso\(autoOpenNewPrefill \|\| \{\}\)/);
});
