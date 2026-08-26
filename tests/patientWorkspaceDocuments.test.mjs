import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { aggregateDocumentTimeline, loadPatientDocumentMetadata, mergePatientDocuments } from '../src/lib/patientWorkspaceDocuments.js';
import { createPatientWorkspaceContext } from '../src/lib/patientWorkspaceDomain.js';

const workspaceSource = readFileSync(new URL('../src/components/PatientWorkspaceV2.jsx', import.meta.url), 'utf8');
const documentsSource = readFileSync(new URL('../src/components/PatientWorkspaceDocuments.jsx', import.meta.url), 'utf8');
const documentAdapterSource = readFileSync(new URL('../src/lib/patientWorkspaceDocuments.js', import.meta.url), 'utf8');
const medicalSource = readFileSync(new URL('../src/components/DocMedico.jsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const patientSource = readFileSync(new URL('../src/components/SchedaPaz.jsx', import.meta.url), 'utf8');

function queryResult(data) {
  const chain = { select: () => chain, eq: () => chain, order: async () => ({ data, error: null }) };
  return chain;
}

test('patient document metadata stays patient-scoped, light, sequential and excludes PDFs', async () => {
  const calls = [];
  const client = { from(table) { calls.push(table); return queryResult(table === 'documenti_medici' ? [{ id: 1, tipo: 'ricetta', titolo: 'Ricetta', paziente_id: 7, data: '2026-08-25' }] : []); } };
  const documents = await loadPatientDocumentMetadata(client, 7);
  assert.deepEqual(calls, ['documenti_medici', 'documenti_fiscali']);
  assert.equal(documents[0].category, 'prescriptions');
  assert.ok(!documentsSource.match(/select\([^)]*pdf_base64[^)]*\).*order/s));
  assert.ok(documentAdapterSource.includes("select('pdf_base64')"));
});

test('document tab is lazy and real prescription adapter preassigns the current patient', () => {
  assert.ok(workspaceSource.includes("tab === 'doc' ? <PatientWorkspaceDocuments"));
  assert.ok(workspaceSource.includes('<DocMedico paz={patient} si={studioInfo} initialType="ricetta"'));
  assert.ok(medicalSource.includes('onDocumentSaved?.(saved)'));
  for (const field of ['Farmaco', 'Dosaggio', 'Posologia', 'Durata', 'Note']) assert.ok(medicalSource.includes(field));
  assert.ok(workspaceSource.includes("React.lazy(() => import('./DocMedico.jsx'))"));
  assert.ok(!workspaceSource.includes("kind === 'prescription' && <form"));
});

test('consent flow reuses active consent templates and explicitly blocks unsupported signing persistence', () => {
  assert.ok(documentsSource.includes("from('consenso_modelli')"));
  assert.ok(documentsSource.includes("eq('attivo', true)"));
  assert.ok(documentsSource.includes('Nessun record o backend parallelo è stato creato'));
  assert.ok(documentsSource.includes('Invia alla firma</button>'));
});

test('workspace context exposes documents, prescriptions and consents from one read model', () => {
  const documents = mergePatientDocuments([{ id: 1, tipo: 'ricetta', paziente_id: 7 }], [], []);
  const context = createPatientWorkspaceContext({ documents, prescriptions: documents, consents: [] });
  assert.equal(context.documents, documents);
  assert.equal(context.prescriptions, documents);
  assert.deepEqual(context.consents, []);
  assert.ok(workspaceSource.includes('documents.filter((item) => item.category'));
});

test('timeline aggregates document source identities without a new event store', () => {
  const documents = mergePatientDocuments([{ id: 12, tipo: 'ricetta', data: '2026-08-25' }, { id: 13, tipo: 'consenso', titolo: 'Consenso implantologia', data: '2026-08-24' }]);
  const events = aggregateDocumentTimeline(documents);
  assert.deepEqual(events.map((event) => event.type), ['PRESCRIPTION_CREATED', 'CONSENT_SIGNED']);
  assert.equal(events[0].sourceId, 12);
  assert.ok(workspaceSource.includes('<Timeline documentEvents={documentTimeline}'));
});

test('production patient route remains isolated', () => {
  assert.ok(!appSource.includes('PatientWorkspaceV2'));
  assert.ok(!patientSource.includes('PatientWorkspaceV2'));
  assert.ok(workspaceSource.includes('Scheda Paziente 2.0 · Preview'));
});

test('mobile document and consent actions remain touch-friendly and safe-area aware', () => {
  const css = readFileSync(new URL('../src/components/PatientWorkspaceV2.css', import.meta.url), 'utf8');
  assert.ok(css.includes('@media(max-width:520px)'));
  assert.ok(css.includes('.pw2-doc-list button{min-height:48px}'));
  assert.ok(css.includes('env(safe-area-inset-bottom)'));
  assert.ok(css.includes('100dvh'));
});
