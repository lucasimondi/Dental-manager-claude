import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { creaRicettaPdf } from '../src/lib/pdfDocs.js';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Ricetta: il generatore produce un PDF reale non vuoto con i campi clinici minimi', () => {
  const result = creaRicettaPdf({
    paziente: { nome: 'Ada', cognome: 'Rossi', data_nascita: '1980-02-03' },
    studio: { nome: 'Studio QA', spec: 'Odontoiatria' },
    data: '2026-08-27',
    farmaci: [{ nome: 'Farmaco QA', dosaggio: '500 mg', posologia: '1 ogni 8 ore', durata: '5 giorni' }],
  });
  const bytes = new Uint8Array(result.doc.output('arraybuffer'));
  assert.ok(bytes.byteLength > 1000);
  assert.equal(String.fromCharCode(...bytes.slice(0, 4)), '%PDF');
  assert.match(result.dataUrl, /^data:application\/pdf/);
  assert.equal(result.filename, 'ricetta_Rossi_2026-08-27.pdf');
});

test('DocMedico: l’archiviazione riuscita aggiorna la lista senza smontare anteprima e download', () => {
  const scheda = source('src/components/SchedaPaz.jsx');
  const callback = scheda.match(/onDocumentSaved=\{\(\) => \{([^}]|}(?!}))*}}/s)?.[0] || '';
  assert.match(callback, /setDocumentsReloadToken/);
  assert.doesNotMatch(callback, /setDocumentFlow\(null\)|setTab\('doc'\)/);

  const medico = source('src/components/DocMedico.jsx');
  assert.match(medico, /setPronto\(\{ dataUrl, filename, titolo: 'Ricetta medica'/);
  assert.match(medico, /setArchiviato\(true\);\s*onDocumentSaved\?\.\(saved\)/);
});

test('Errori PDF/download restano contenuti e mostrano un messaggio comprensibile', () => {
  const medico = source('src/components/DocMedico.jsx');
  const pannello = source('src/components/ui/PannelloInvioDocumento.jsx');
  assert.match(medico, /try \{[\s\S]*generaRicetta\(\)[\s\S]*catch \{/);
  assert.match(medico, /role="alert"/);
  assert.match(pannello, /Download non riuscito/);
});
