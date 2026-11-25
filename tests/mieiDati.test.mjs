// MIEI-DATI (PO 2026-11-25): «I miei dati». Solo dati di esempio, mai quelli veri.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bloccoFatturazione, campiScheda, daCompilare, filtra, iniziali, nuovaScheda, testoPersona, testoScheda } from '../personal/src/lib/mieiDati.js';

const esempio = {
  nome: 'Esempio S.r.l.', campi: [
    { gruppo: 'fatturazione', etichetta: 'Ragione sociale', valore: 'Esempio S.r.l.' },
    { gruppo: 'fatturazione', etichetta: 'Sede legale', valore: 'Via Roma 1, 10100 Torino (TO)' },
    { gruppo: 'fatturazione', etichetta: 'Partita IVA', valore: '01234567890' },
    { gruppo: 'fatturazione', etichetta: 'Codice destinatario SDI', valore: '' },
    { gruppo: 'fatturazione', etichetta: 'PEC', valore: 'esempio@pec.it' },
    { gruppo: 'banca', etichetta: 'IBAN', valore: 'IT00X0000000000000000000000' },
  ],
  persone: [{ ruolo: 'Commercialista', nome: 'Dott.ssa Rossi', email: 'rossi@esempio.it' }],
};

test('il blocco di fatturazione mette nome e sede su righe proprie e salta i campi vuoti', () => {
  assert.equal(bloccoFatturazione(esempio), 'Esempio S.r.l.\nVia Roma 1, 10100 Torino (TO)\nPartita IVA: 01234567890\nPEC: esempio@pec.it');
  assert.equal(daCompilare(esempio), 1);
  assert.equal(bloccoFatturazione({ nome: 'Solo nome', campi: [] }), 'Solo nome');
});

test('la scheda intera e il contatto si copiano come testo leggibile', () => {
  const t = testoScheda(esempio);
  assert.match(t, /^Esempio S\.r\.l\.\n\nDATI DI FATTURAZIONE\n/);
  assert.match(t, /BANCA\nIBAN: IT00X/);
  assert.match(t, /CHI LA SEGUE\nCommercialista: Dott\.ssa Rossi email rossi@esempio\.it$/);
  assert.equal(testoPersona({ nome: 'X', pec: 'x@pec.it', telefono: '011 1' }), 'X PEC x@pec.it tel. 011 1');
});

test('schede nuove, iniziali, ricerca e pulizia prima di salvare', () => {
  const s = nuovaScheda('societa', '  Nuova   Srl ', 2);
  assert.equal(s.nome, 'Nuova Srl');
  assert.equal(s.campi[0].valore, 'Nuova Srl');
  assert.ok(s.campi.some((c) => c.etichetta === 'PEC'));
  assert.equal(nuovaScheda('boh').tipo, 'altro');
  assert.equal(iniziali('Dott. Mario Rossi'), 'MR');
  assert.equal(iniziali('Larabì s.a.s. di Simondi Luca & C.'), 'LS');
  assert.deepEqual(filtra([esempio, { nome: 'Altra', campi: [] }], 'pec rossi').map((x) => x.nome), ['Esempio S.r.l.']);
  const c = campiScheda({ nome: ' A  B ', campi: [{ gruppo: 'strano', etichetta: '', valore: ' 1 ' }], persone: [{ nome: '' }, { nome: ' Y ' }] });
  assert.deepEqual(c, { nome: 'A B', campi: [{ gruppo: 'altro', etichetta: 'Campo', valore: '1' }], persone: [{ nome: 'Y' }] });
  assert.throws(() => campiScheda({ nome: ' ' }), /nome/);
});

test('migrazione: tabella del proprietario, solo aggiunte, nessuna cancellazione', () => {
  const sql = readFileSync('supabase/archivio/migrations/20261125120000_miei_dati.sql', 'utf8');
  assert.match(sql, /create table if not exists miei_dati/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /e_proprietario\(\)/);
  assert.match(sql, /revoke all on miei_dati from anon/);
  assert.doesNotMatch(sql, /drop table|delete from|truncate miei/i);
  const lib = readFileSync('personal/src/lib/mieiDati.js', 'utf8');
  assert.doesNotMatch(lib, /\.delete\(/, 'le schede si archiviano');
  // Nessun dato vero nel repository: le schede di Luca stanno solo nel database.
  const vista = readFileSync('personal/src/sezioni/dati/MieiDati.jsx', 'utf8');
  assert.doesNotMatch(lib + vista + sql, /\b\d{11}\b|SMNLCU/);
});
