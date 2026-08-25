import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const component = fs.readFileSync('src/components/PatientWorkspaceV2.jsx', 'utf8');
const demo = fs.readFileSync('src/components/PatientWorkspaceV2Demo.jsx', 'utf8');
const main = fs.readFileSync('src/main.jsx', 'utf8');
const app = fs.readFileSync('src/App.jsx', 'utf8');
const patientRecord = fs.readFileSync('src/components/SchedaPaz.jsx', 'utf8');
const css = fs.readFileSync('src/components/PatientWorkspaceV2.css', 'utf8');
const registry = fs.readFileSync('src/lib/patientWorkspaceActionRegistry.js', 'utf8');

test('Patient Workspace 2.0 is available only through its isolated demo route', () => {
  assert.match(main, /patient-workspace-v2-demo/);
  assert.match(main, /<PatientWorkspaceV2Demo\s*\/>/);
  assert.doesNotMatch(app, /PatientWorkspaceV2/);
  assert.doesNotMatch(patientRecord, /PatientWorkspaceV2/);
});

test('preview performs no automatic remote work', () => {
  for (const source of [component, demo, registry]) {
    assert.doesNotMatch(source, /supabase/i);
    assert.doesNotMatch(source, /useEffect/);
    assert.doesNotMatch(source, /fetch\s*\(/);
    assert.doesNotMatch(source, /\.storage\b/);
    assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/);
  }
});

test('Round 3 exposes five compact quick actions and canonical shared action registry', () => {
  for (const label of ['Prestazione', 'Piano clinico', 'Preventivo', 'Ricetta', 'Consenso']) assert.ok(component.includes(label));
  for (const action of ['CREATE_CLINICAL_PLAN', 'ADD_TREATMENT', 'UPDATE_TREATMENT_STATUS', 'CREATE_QUOTE', 'SEND_QUOTE', 'PRINT_QUOTE', 'CREATE_PRESCRIPTION', 'CREATE_CONSENT', 'SEND_CLINICAL_SUMMARY']) {
    assert.match(registry, new RegExp(`${action}: \\{ id: '${action}'`));
  }
  assert.match(component, /PATIENT_WORKSPACE_ACTIONS/);
});

test('Round 3 prototypes the plan to quote workflow, sharing and Polyedron confirmation', () => {
  for (const text of ['Piano clinico pronto', 'Genera preventivo →', 'Preventivo pronto', 'Anteprima messaggio', 'Invia WhatsApp', 'Prova con Polyedron', 'Nessuna azione è stata eseguita.', 'Conferma', 'Modifica', 'Annulla']) assert.ok(component.includes(text), `missing ${text}`);
  assert.match(component, /selectedQuoteItems/);
  assert.match(component, /setQuoteReady\(true\)/);
  assert.match(component, /shareMessage/);
});

test('workspace keeps the required identity, KPI and navigation surfaces', () => {
  for (const label of ['Piani', 'Eseguito', 'Pagato', 'Da pagare', 'Info', 'Impianti', 'Foto', 'Documenti', 'Agenda']) {
    assert.ok(component.includes(label), `missing ${label}`);
  }
  assert.match(component, /filter\(Boolean\)/);
  assert.match(component, /Array\.isArray/);
  assert.doesNotMatch(component, /<img\b/);
});

test('Round 2 keeps creation actions distinct and prototype-only', () => {
  for (const label of ['Aggiungi prestazione', 'Nuovo piano clinico', 'Nuovo preventivo']) {
    assert.ok(component.includes(label), `missing ${label}`);
  }
  for (const kind of ['service', 'plan', 'quote']) assert.match(component, new RegExp(`setQuickCreate\\('${kind}'\\)`));
  for (const site of ['Dente', 'Quadrante', 'Arcata', 'Generale', 'Nessuna']) assert.ok(component.includes(site));
  for (const status of ['Proposta', 'Pianificata', 'In corso', 'Eseguita']) assert.ok(component.includes(status));
  assert.match(component, /Prototype · nessun salvataggio/);
  assert.match(component, /Preventivo dal piano clinico/);
  assert.match(component, /Piano clinico/);
});

test('clinical situation is treatment-driven and odontogram remains an entry point', () => {
  assert.match(component, /clinicalRows = model\.items\.map/);
  assert.match(component, /Apri piano clinico/);
  assert.match(component, /Odontogramma/);
  assert.match(component, /Modulo clinico in preparazione/);
  assert.doesNotMatch(component, /tone-indigo|tone-amber|tone-teal|tone-violet|tone-blue/);
  assert.match(demo, /Corona zirconia/);
  assert.match(demo, /stato: 'in_corso'/);
});

test('responsive CSS covers compact mobile, mobile and tablet without horizontal page overflow', () => {
  assert.match(css, /overflow-x:hidden/);
  assert.match(css, /max-width:375px/);
  assert.match(css, /max-width:520px/);
  assert.match(css, /max-width:820px/);
});
