import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createPatientWorkspaceRealAdapter, isPatientWorkspaceV2Enabled } from '../src/lib/patientWorkspaceRealAdapter.js';

const patient = { id: 9, nome: 'Nome molto lungo', cognome: 'Cognome molto lungo' };
const plan = (id, date, count = 3) => ({ id, pazienteId: 9, data: date, titolo: `Piano ${id}`, stato: 'attivo', voci: Array.from({ length: count }, (_, index) => ({ prestazione: `Prestazione clinica realistica molto lunga ${index}`, dente: String(11 + index), prezzo: 100 + index, eseguita: index % 2 === 0, dataEsec: index % 2 === 0 ? `2026-08-${String(index + 1).padStart(2, '0')}` : '' })) });

test('empty patient produces only empty authoritative collections', () => {
  const context = createPatientWorkspaceRealAdapter({ patient });
  assert.equal(context.provenance.source, 'REAL_ADAPTER');
  assert.equal(context.activeClinicalPlan, null);
  for (const key of ['clinicalPlans','treatments','quotes','payments','appointments','recalls','timeline']) assert.deepEqual(context[key], []);
});

test('simple patient selects newest active plan and maps real sources', () => {
  const context = createPatientWorkspaceRealAdapter({ patient, plans: [plan('old', '2026-01-01'), plan('new', '2026-08-01')], payments: [{ id: 'pay', pazienteId: 9, data: '2026-08-02', importo: 50 }] });
  assert.equal(context.activeClinicalPlan.id, 'new');
  assert.equal(context.treatments.length, 6);
  assert.equal(context.quotes[0].provenance, 'LEGACY_PLAN_PROJECTION');
  assert.ok(context.timeline.every((event) => event.sourceEntity && event.sourceId));
});

test('rich patient keeps large real shapes without synthetic rows', () => {
  const payments = Array.from({ length: 12 }, (_, index) => ({ id: `pay-${index}`, pazienteId: 9, data: `2026-07-${String(index + 1).padStart(2, '0')}`, importo: index + 1 }));
  const context = createPatientWorkspaceRealAdapter({ patient, plans: [plan('rich', '2026-08-01', 25)], payments, appointments: [{ id: 'a', pazienteId: 9, data: '2026-09-01' }], documents: [{ id: 'd', occurredAt: '2026-08-03', title: 'Consenso reale' }], recalls: [{ id: 'r', pazienteId: 9, dataScadenza: '2026-10-01' }] });
  assert.equal(context.treatments.length, 25);
  assert.equal(context.payments.length, 12);
  assert.ok(context.timeline.some((event) => event.type === 'DOCUMENT'));
  assert.ok(context.timeline.some((event) => event.type === 'RECALL'));
});

test('feature flag fails closed and both mount points use the keyed boundary', () => {
  assert.equal(isPatientWorkspaceV2Enabled({}), false);
  assert.equal(isPatientWorkspaceV2Enabled({ patientWorkspaceV2: true }), true);
  const app = fs.readFileSync('src/App.jsx', 'utf8');
  const patients = fs.readFileSync('src/components/Pazienti.jsx', 'utf8');
  const boundary = fs.readFileSync('src/components/PatientWorkspaceBoundary.jsx', 'utf8');
  assert.match(app, /PatientWorkspaceBoundary/);
  assert.match(patients, /PatientWorkspaceBoundary/);
  assert.match(boundary, /key=\{`\$\{paz\?\.id/);
  assert.match(boundary, /return <SchedaPaz/);
});

test('real-mode paths gate known demo-only operational fixtures', () => {
  const source = fs.readFileSync('src/components/PatientWorkspaceV2.jsx', 'utf8');
  assert.match(source, /!realMode && <section className="pw2-attention"/);
  assert.match(source, /if \(realMode\) return <section className="pw2-archive"/);
  assert.match(source, /\(!realMode \|\| \['economy', 'paymentPlan'\]\.includes\(quickCreate\)\)/);
});
