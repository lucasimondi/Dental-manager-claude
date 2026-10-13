// Certificato riposo (PO 2026-10-13): stesso testo del certificato scritto dal
// medico, con i dati anagrafici presi dalla scheda del paziente.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCertificatoRiposoPdf, testoCertificatoRiposo, datiAnagraficiPaziente, giorniRiposoValidi } from '../src/lib/documenti/certificatoRiposo.js';

const si = { nome: 'Dott. Test', spec: 'Medico · Chirurgo Orale', iscr: 'Iscr. 1', addr1: 'Via Roma 1', tel: '0123' };
const paziente = { id: 7, nome: 'Mario', cognome: 'Rossi', dataNascita: '1983-05-23', luogoNascita: 'Cisternino (BR)', indirizzo: 'Corso Francia 155B', cap: '12100', comune: 'Cuneo', cf: 'rssmra83e23c741b' };
const source = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('text: visit, rest days (singular/plural)', () => {
  const [visita, riposo] = testoCertificatoRiposo({ studio: si, paziente, dataVisita: '2026-10-12', giorni: 1 });
  assert.equal(visita, 'Il sottoscritto Dott. Test, Medico · Chirurgo Orale, certifica di aver visitato in data 12/10/2026 il/la Sig./Sig.ra Mario Rossi.');
  assert.equal(riposo, 'In base alla visita da me effettuata nel giorno 12 ottobre 2026 il paziente necessita di almeno un giorno di riposo.');
  assert.match(testoCertificatoRiposo({ studio: si, paziente, dataVisita: '2026-10-12', giorni: 3 })[1], /almeno 3 giorni di riposo\.$/);
});

test('personal data from the patient record; missing fields are skipped', () => {
  assert.deepEqual(datiAnagraficiPaziente(paziente), ['Mario Rossi', 'Nato/a a Cisternino (BR) il 23/05/1983', 'Residente in Corso Francia 155B', '12100 Cuneo', 'RSSMRA83E23C741B']);
  assert.deepEqual(datiAnagraficiPaziente({ nome: 'Mario', cognome: 'Rossi', dataNascita: '1983-05-23' }), ['Mario Rossi', 'Nato/a il 23/05/1983']);
});

test('rest days must be 1..365', () => {
  assert.equal(giorniRiposoValidi('2'), 2);
  for (const v of ['', '0', '-1', 'abc', '400']) assert.equal(giorniRiposoValidi(v), null, v);
});

test('PDF: title, text, "In fede", personal data; archived among certificates', () => {
  const pdf = buildCertificatoRiposoPdf({ si, paziente, data: '2026-10-12', dataVisita: '2026-10-12', giorni: 1, note: '' });
  assert.equal(pdf.filename, 'Mario Rossi.pdf');
  assert.equal(pdf.tipoDoc, 'certificato');
  assert.equal(pdf.titolo, 'Certificato riposo');
  const bytes = Buffer.from(pdf.dataUrl.split(',')[1], 'base64').toString('latin1');
  for (const t of ['CERTIFICATO DI RIPOSO', 'giorno di riposo', 'In fede', 'Nato/a a Cisternino', 'Corso Francia 155B', 'RSSMRA83E23C741B']) assert.ok(bytes.includes(t), t);
});

test('wiring: document type, patient form field, DB mapping, migration', () => {
  const doc = source('src/components/DocMedico.jsx');
  assert.match(doc, /id: 'riposo', icona: 'clip', label: 'Certificato riposo'/);
  assert.match(doc, /else if \(tipo === 'riposo'\) generaCertificatoRiposo\(\);/);
  assert.match(source('src/components/PazienteFormModal.jsx'), /label="Luogo di nascita"/);
  assert.match(source('src/lib/supabase.js'), /luogoNascita: 'luogo_nascita'/);
  assert.match(source('supabase/migrations/20261013090000_pol_doc_riposo_luogo_nascita.sql'), /ADD COLUMN IF NOT EXISTS luogo_nascita text/);
});
