// PO: "Il nome del documento deve essere il nome paziente.pdf" — per ogni PDF, non solo
// ricetta e documenti medici: archivio, Scheda 2.0, fatture/rimborsi, preventivi, consensi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nomeFilePaziente, nomeFileDaNome } from '../src/lib/documenti/pdfLayout.js';
import { normalizePatientDocument } from '../src/lib/patientWorkspaceDocuments.js';

test('nome file dal nome completo dell\'archivio', () => {
  assert.equal(nomeFileDaNome('Mario Rossi'), 'Mario Rossi.pdf');
  assert.equal(nomeFileDaNome('  Anna   De Luca '), 'Anna De Luca.pdf');
  assert.equal(nomeFileDaNome('Rossi/Bianchi: "x"'), 'Rossi Bianchi x.pdf');
  assert.equal(nomeFileDaNome(''), 'Paziente.pdf');
  assert.equal(nomeFileDaNome(null), 'Paziente.pdf');
  assert.equal(nomeFilePaziente({ nome: 'Mario', cognome: 'Rossi' }), nomeFileDaNome('Mario Rossi'));
});

test('i documenti della Scheda 2.0 portano il nome del paziente', () => {
  assert.equal(normalizePatientDocument({ id: 1, tipo: 'ricetta', paziente_nome: 'Mario Rossi' }, 'documenti_medici').patientName, 'Mario Rossi');
});

test('nessun PDF del paziente usa più nomi tipo "ricetta_rossi_2026-10-13.pdf"', () => {
  const siti = {
    'src/components/ArchivioDocs.jsx': /nomeFileDaNome\(doc\.paziente_nome\)/,
    'src/components/DocFiscale.jsx': /const nomeFile = nomeFilePaziente\(paz\);/,
    'src/components/PdfView.jsx': /const nomeFile = nomeFilePaziente\(paz\);/,
    'src/lib/pdfConsenso.js': /const filename = nomeFilePaziente\(paziente\);/,
    'src/components/PatientWorkspaceDocuments.jsx': /const fileNameFor = \(document\) => nomeFileDaNome\(document\.patientName\);/,
  };
  for (const [file, atteso] of Object.entries(siti)) {
    const src = readFileSync(file, 'latin1');
    assert.match(src, atteso, file);
    assert.doesNotMatch(src, /_\$\{[^}]*\}\.pdf`\.toLowerCase\(\)/, `${file}: nome file vecchio stile`);
  }
});
