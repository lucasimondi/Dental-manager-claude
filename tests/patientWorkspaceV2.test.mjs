import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const component = fs.readFileSync('src/components/PatientWorkspaceV2.jsx', 'utf8');
const demo = fs.readFileSync('src/components/PatientWorkspaceV2Demo.jsx', 'utf8');
const main = fs.readFileSync('src/main.jsx', 'utf8');
const app = fs.readFileSync('src/App.jsx', 'utf8');
const patientRecord = fs.readFileSync('src/components/SchedaPaz.jsx', 'utf8');
const css = fs.readFileSync('src/components/PatientWorkspaceV2.css', 'utf8');

test('Patient Workspace 2.0 is available only through its isolated demo route', () => {
  assert.match(main, /patient-workspace-v2-demo/);
  assert.match(main, /<PatientWorkspaceV2Demo\s*\/>/);
  assert.doesNotMatch(app, /PatientWorkspaceV2/);
  assert.doesNotMatch(patientRecord, /PatientWorkspaceV2/);
});

test('preview performs no automatic remote work', () => {
  for (const source of [component, demo]) {
    assert.doesNotMatch(source, /supabase/i);
    assert.doesNotMatch(source, /useEffect/);
    assert.doesNotMatch(source, /fetch\s*\(/);
    assert.doesNotMatch(source, /\.storage\b/);
  }
});

test('workspace keeps the required identity, KPI and navigation surfaces', () => {
  for (const label of ['Piani', 'Eseguito', 'Pagato', 'Da pagare', 'Info', 'Impianti', 'Foto', 'Documenti', 'Agenda']) {
    assert.ok(component.includes(label), `missing ${label}`);
  }
  assert.match(component, /filter\(Boolean\)/);
  assert.match(component, /Array\.isArray/);
  assert.doesNotMatch(component, /<img\b/);
});

test('responsive CSS covers compact mobile, mobile and tablet without horizontal page overflow', () => {
  assert.match(css, /overflow-x:hidden/);
  assert.match(css, /max-width:375px/);
  assert.match(css, /max-width:520px/);
  assert.match(css, /max-width:820px/);
});
