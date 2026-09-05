import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { parseAppointmentRequest } from '../src/lib/poliedron/planner/appointmentIntent.js';
import { processQuery } from '../src/lib/poliedron/poliedraCore.js';
import { buildContext } from '../src/lib/poliedron/contextEngine.js';
import { ACTION_REGISTRY } from '../src/lib/poliedron/actionRegistry.js';
import { NAVIGATION_INDEX } from '../src/lib/poliedron/navigationIndex.js';

// POL-AI-006 — Product Owner: "deve essere in grado di segnare un
// appuntamento in agenda... senza perdite di tempo, ora ho provato con
// appuntamento ma non riesce risolvi". Root cause: intentEngine.js's
// CREATE_VERBS is anchored to crea/nuovo/aggiungi/inserisci/prepara --
// none of which match "fissa"/"prenota"/"metti", so a real booking
// request like "Fissa un appuntamento a Mario Rossi domani alle 15" fell
// through to a plain federated SEARCH that could never open the booking
// form, let alone with anything pre-filled.

const now = new Date(2026, 8, 5); // Saturday 2026-09-05, matches the session's "today"

test('parseAppointmentRequest recognizes real booking phrasings and resolves date/time deterministically', () => {
  const fissa = parseAppointmentRequest('Fissa un appuntamento a Mario Rossi domani alle 15', { now });
  assert.equal(fissa.patientText, 'Mario Rossi');
  assert.equal(fissa.date, '2026-09-06');
  assert.equal(fissa.time, '15:00');

  const prenota = parseAppointmentRequest('Prenota un appuntamento per Maria Bianchi venerdì alle 10:30', { now });
  assert.equal(prenota.patientText, 'Maria Bianchi');
  assert.equal(prenota.date, '2026-09-11'); // next Friday after Sat 2026-09-05
  assert.equal(prenota.time, '10:30');

  const explicit = parseAppointmentRequest('Metti un appuntamento a Luca il 12/09 alle 9', { now });
  assert.equal(explicit.patientText, 'Luca');
  assert.equal(explicit.date, '2026-09-12');
  assert.equal(explicit.time, '09:00');

  const noDateTime = parseAppointmentRequest('Prenota un appuntamento per Anna', { now });
  assert.equal(noDateTime.patientText, 'Anna');
  assert.equal(noDateTime.date, null);
  assert.equal(noDateTime.time, null);
});

test('parseAppointmentRequest returns null rather than guessing when there is no real booking request', () => {
  assert.equal(parseAppointmentRequest('', { now }), null);
  assert.equal(parseAppointmentRequest('crea appuntamento', { now }), null); // verb+noun but no patient
  assert.equal(parseAppointmentRequest("Che cos'è un appuntamento?", { now }), null); // question, not a command
  assert.equal(parseAppointmentRequest('Segna otturazione 26 di Rossi come eseguita', { now }), null); // no appointment noun
  assert.equal(parseAppointmentRequest('Mario Rossi ha mal di denti', { now }), null); // no verb, no noun
});

test('processQuery routes a real booking phrase to a confirmable appointment.create WORKFLOW, never a dead-end search', async () => {
  const patients = [{ id: 'p1', nome: 'Mario', cognome: 'Rossi', cf: '', telefono: '' }];
  const result = await processQuery({
    query: 'Fissa un appuntamento a Mario Rossi domani alle 15',
    context: buildContext(),
    permissions: {},
    sources: { patients, navigationIndex: NAVIGATION_INDEX, actions: ACTION_REGISTRY },
    allowModel: false,
  });
  assert.equal(result.intent, 'WORKFLOW');
  assert.equal(result.confirmationRequired, true);
  assert.equal(result.suggestedActions[0].id, 'appointment.create');
  assert.equal(result.entities.patientCandidates[0].id, 'p1');
  assert.equal(result.entities.appointmentTime, '15:00');
  assert.match(result.entities.appointmentDate, /^\d{4}-\d{2}-\d{2}$/);
});

test('appointment.create pre-fills the real QuickBookingModal instead of always opening it blank', () => {
  const action = ACTION_REGISTRY.find((a) => a.id === 'appointment.create');
  assert.ok(action, 'appointment.create must still exist in the registry');
  assert.equal(action.riskLevel, 1); // still opens the real form for a human to confirm, never writes directly

  let received = null;
  const ctx = { openBooking: (payload) => { received = payload; } };
  action.navigate(ctx, { id: 42 }, { date: '2026-09-06', time: '15:00' });
  assert.deepEqual(received, { patientId: 42, data: '2026-09-06', ora: '15:00' });

  // Every other caller (Dashboard/PatientQuickActions tiles) still opens it
  // blank -- no payload, no patient, no date/time invented.
  let receivedBlank = 'not-called';
  const blankCtx = { openBooking: (payload) => { receivedBlank = payload; } };
  action.navigate(blankCtx, null, {});
  assert.deepEqual(receivedBlank, { patientId: null, data: undefined, ora: undefined });
});

test('QuickBookingModal and its App.jsx wiring accept a pre-filled patient/date/time, degrading gracefully if the slot is not actually free', () => {
  const modalSrc = fs.readFileSync(new URL('../src/components/QuickBookingModal.jsx', import.meta.url), 'utf8');
  assert.match(modalSrc, /initialData = null, initialOra = null/);
  assert.match(modalSrc, /useState\(initialData \|\| today\(\)\)/);
  assert.match(modalSrc, /useState\(initialOra \|\| ''\)/);
  // The existing reconciliation effect (freeSlots-driven) is untouched --
  // an unavailable requested slot is cleared and replaced by the nearest
  // real free one, never silently double-booked.
  assert.match(modalSrc, /if \(ora && !freeSlots\.some\(\(s\) => s\.ora === ora\)\) setOra\(''\);/);

  const appSrc = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(appSrc, /openBooking=\{\(payload\) => setPoliedronBookingOpen\(payload \|\| true\)\}/);
  assert.match(appSrc, /initialData=\{typeof poliedronBookingOpen === 'object' \? poliedronBookingOpen\?\.data : undefined\}/);
  assert.match(appSrc, /initialOra=\{typeof poliedronBookingOpen === 'object' \? poliedronBookingOpen\?\.ora : undefined\}/);
});

test('Chat gives a direct way back to any other allowed module (Product Owner: "da chat devi comunque dare possibilità di tornare indietro ad altri moduli")', () => {
  const chatPageSrc = fs.readFileSync(new URL('../src/components/poliedron/PoliedronChatPage.jsx', import.meta.url), 'utf8');
  assert.match(chatPageSrc, /navItems = \[\],\s*\n\s*onNavigate,/);
  assert.match(chatPageSrc, /className="poliedron-chat__nav"/);
  assert.match(chatPageSrc, /onNavigate\?\.\(destination\)/);

  const controllerSrc = fs.readFileSync(new URL('../src/components/poliedron/Poliedron.jsx', import.meta.url), 'utf8');
  assert.match(controllerSrc, /navItems=\{navigationIndex\.filter\(\(item\) => item\.id !== 'chat'\)\}/);
  assert.match(controllerSrc, /onNavigate=\{setPage\}/);

  const cssSrc = fs.readFileSync(new URL('../src/components/PremiumVisualSystem.css', import.meta.url), 'utf8');
  assert.match(cssSrc, /\.poliedron-chat__nav \{/);
});
