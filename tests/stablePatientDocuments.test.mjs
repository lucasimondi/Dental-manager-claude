import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const stable = fs.readFileSync('src/components/SchedaPaz.jsx', 'utf8');
const app = fs.readFileSync('src/App.jsx', 'utf8');
const archive = fs.readFileSync('src/components/ArchivioDocs.jsx', 'utf8');
const boundary = fs.readFileSync('src/components/PatientWorkspaceBoundary.jsx', 'utf8');

test('stable patient record exposes the Documenti tab without changing existing tabs', () => {
  for (const id of ['info', 'piani', 'paga', 'app', 'doc']) assert.match(stable, new RegExp(`id: '${id}'`));
  assert.match(stable, /tab === 'doc'/);
  assert.match(stable, /Nuova ricetta/);
  assert.match(stable, /Nuovo consenso/);
});

test('documents remain lazy and PDF/storage are not loaded by SchedaPaz mount', () => {
  assert.match(stable, /lazy\(\(\) => import\('\.\/PatientWorkspaceDocuments\.jsx'\)\)/);
  assert.match(stable, /\{tab === 'doc' &&/);
  assert.doesNotMatch(stable, /\.storage\b|loadPatientDocumentPdf|Promise\.all/);
  assert.doesNotMatch(stable, /fallback=\{null\}/);
});

test('real DocMedico receives the current patient and one-shot request payload', () => {
  assert.match(stable, /<DocMedico/);
  assert.match(stable, /paz=\{paz\}/);
  assert.match(stable, /initialType=\{documentFlow === 'ricetta' \? 'ricetta' : undefined\}/);
  assert.match(stable, /initialPrefill=\{documentFlow === 'ricetta' \? initialDocumentRequest\?\.prefill : undefined\}/);
  assert.match(stable, /requestId=\{documentFlow === 'ricetta' \? initialDocumentRequest\?\.requestId : undefined\}/);
  assert.match(stable, /onDocumentRequestHandled/);
});

test('historical medical and fiscal generators remain lazy and patient-scoped', () => {
  assert.match(stable, /lazy\(\(\) => import\('\.\/DocMedico\.jsx'\)\)/);
  assert.match(stable, /lazy\(\(\) => import\('\.\/DocFiscale\.jsx'\)\)/);
  assert.match(stable, /Documento medico/);
  assert.match(stable, /Fattura \/ rimborso/);
  assert.match(stable, /<DocFiscale paz=\{paz\} plans=\{plans\} si=\{si\}/);
});

test('real consent flow is reused and unsupported signing remains explicit', () => {
  assert.match(stable, /PatientWorkspaceConsentFlow/);
  const documents = fs.readFileSync('src/components/PatientWorkspaceDocuments.jsx', 'utf8');
  assert.match(documents, /consenso_modelli/);
  assert.match(documents, /Firma non avviabile/);
  assert.match(documents, /disabled>Invia alla firma/);
});

test('App and ArchivioDocs route doc requests through the stable fallback boundary', () => {
  assert.match(app, /tab: 'doc'/);
  assert.match(app, /initialDocumentRequest=\{schedaDashPaz\.documentRequest\}/);
  assert.match(app, /onApriDocMedico=\{\(p\) => goSchedaPaz\(p, 'doc'\)\}/);
  assert.match(archive, /onApriDocMedico/);
  assert.match(boundary, /return <SchedaPaz key=\{`\$\{paz\?\.id/);
  assert.match(boundary, /initialDocumentRequest\?\.requestId/);
});

test('patient state reset remains keyed at both stable mount boundaries', () => {
  assert.match(app, /key=\{schedaDashPaz\.paz\.id\}/);
  const patients = fs.readFileSync('src/components/Pazienti.jsx', 'utf8');
  assert.match(patients, /key=\{scheda\.id\}/);
});

test('hotfix does not activate PatientWorkspaceV2', () => {
  assert.doesNotMatch(stable, /PatientWorkspaceV2/);
  assert.match(boundary, /if \(!isPatientWorkspaceV2Enabled\(features\)\) return <SchedaPaz/);
});

test('photos and implants are restored as tab-scoped lazy modules', () => {
  assert.match(stable, /lazy\(\(\) => import\('\.\/PatientPhotos\.jsx'\)\)/);
  assert.match(stable, /lazy\(\(\) => import\('\.\/PatientImplants\.jsx'\)\)/);
  assert.match(stable, /tab === 'foto'/);
  assert.match(stable, /tab === 'impl'/);
  assert.match(app, /implants=\{implants\}/);
  assert.match(app, /setImplants=\{setImplantsSync\}/);
});
