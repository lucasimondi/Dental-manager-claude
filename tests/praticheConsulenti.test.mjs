import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { campiConsulente, consulentiSuggeriti, linkWhatsAppA, linkTelefono, linkGmailConsulenti, nomeMittente } from '../personal/src/lib/consulenti.js';

test('il consulente si ripulisce e si controlla prima di salvare', () => {
  const c = campiConsulente({ nome: '  Avv.  Mario   Rossi ', email: ' Mario@Studio.IT ', telefono: '333 123 4567', ruolo: 'Avvocato' });
  assert.equal(c.nome, 'Avv. Mario Rossi');
  assert.equal(c.email, 'mario@studio.it');
  assert.equal(c.pec, null);
  assert.throws(() => campiConsulente({ nome: '' }), /nome/);
  assert.throws(() => campiConsulente({ nome: 'X', email: 'non-valida' }), /Email/);
  assert.throws(() => campiConsulente({ nome: 'X', telefono: '12' }), /Telefono/);
});

test('dalla scheda si propongono solo i consulenti non ancora inseriti', () => {
  const parti = [
    { nome: 'Avv. Mario Rossi', ruolo: 'avvocato di Luca' },
    { nome: 'Mario Rossi', ruolo: 'difensore' },
    { nome: 'Banca X', ruolo: 'creditore' },
    { nome: 'Dott. Bianchi', ruolo: 'CTU' },
    { nome: 'Geom. Verdi', ruolo: 'geometra' },
  ];
  const s = consulentiSuggeriti(parti, [{ nome: 'Verdi' }]);
  assert.deepEqual(s, [{ nome: 'Avv. Mario Rossi', ruolo: 'Avvocato' }, { nome: 'Dott. Bianchi', ruolo: 'Perito / CTP' }]);
});

test('collegamenti di contatto: telefono, WhatsApp con prefisso italiano, ricerca Gmail', () => {
  assert.equal(linkTelefono('+39 333 123 4567'), 'tel:+393331234567');
  assert.equal(linkWhatsAppA('333 123 4567'), 'https://wa.me/393331234567');
  assert.equal(linkWhatsAppA('+41 79 123 45 67'), 'https://wa.me/41791234567');
  assert.equal(linkGmailConsulenti([{ email: null }]), null);
  const u = decodeURIComponent(linkGmailConsulenti([{ email: 'a@b.it', pec: 'a@pec.it' }, { email: 'a@b.it' }]));
  assert.match(u, /#search\/from:a@b\.it OR to:a@b\.it OR from:a@pec\.it OR to:a@pec\.it$/);
  assert.equal(nomeMittente('"Studio Rossi" <info@rossi.it>'), 'Studio Rossi');
});

test('la pratica ha le schede Consulenti ed Email; i consulenti non si cancellano', () => {
  const vista = readFileSync('personal/src/sezioni/documenti/Pratica.jsx', 'utf8');
  assert.match(vista, /\['consulenti', 'Consulenti'/);
  assert.match(vista, /\['email', 'Email'/);
  const lib = readFileSync('personal/src/lib/consulenti.js', 'utf8');
  assert.doesNotMatch(lib, /\.delete\(/);
  assert.match(lib, /tolto_il: new Date\(\)\.toISOString\(\)/);
  const sql = readFileSync('supabase/archivio/migrations/20261119200000_pratiche_consulenti.sql', 'utf8');
  assert.match(sql, /fascicolo is distinct from 'clinico_pazienti'/);
  assert.match(sql, /security invoker/);
});
