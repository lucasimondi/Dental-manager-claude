// PASSWORD-PERSONALI (PO 2026-11-08): "password deve essere un registro su cui registro e devono vedersi".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pulisciVoce, corrispondePassword, linkSito, messaggioErrorePassword, aggiungiPassword } from '../shared/password/password.js';

test('registro password: campi puliti, titolo obbligatorio, password conservata così com\'è', () => {
  assert.deepEqual(pulisciVoce({ titolo: ' Banca ', utente: ' luca ', segreto: ' a b ' }), { titolo: 'Banca', utente: 'luca', segreto: ' a b ' });
  assert.throws(() => pulisciVoce({ titolo: '   ' }), /nome del servizio/);
  assert.throws(() => pulisciVoce({ titolo: 'x', segreto: 'a'.repeat(1001) }), /troppo lungo/);
});

test('la ricerca non guarda mai dentro la password', () => {
  const v = { titolo: 'Banca Intesa', utente: 'luca@x.it', sito: 'intesa.it', segreto: 'segretissima' };
  assert.equal(corrispondePassword(v, 'intesa'), true);
  assert.equal(corrispondePassword(v, 'banca luca'), true);
  assert.equal(corrispondePassword(v, 'segretissima'), false);
});

test('link al sito solo http(s); errori del database leggibili', async () => {
  assert.equal(linkSito('intesa.it'), 'https://intesa.it/');
  assert.ok(!linkSito('javascript:alert(1)').startsWith('javascript:'));
  assert.match(messaggioErrorePassword({ code: 'PGRST205', message: 'Could not find the table public.password_personali in the schema cache' }), /dopo l'aggiornamento/);
  await assert.rejects(() => aggiungiPassword({}, { titolo: 'x' }), /Studio non disponibile/);
});

test('pagina Password uguale in Studio e Personal, password nascosta finché non si tocca l\'occhio', () => {
  const page = readFileSync('shared/password/PasswordPage.jsx', 'utf8');
  assert.match(page, /\{vedi \? \(voce\.segreto \|\| '—'\) : '••••••••'\}/);
  assert.match(page, /aria-label="Copia password"/);
  assert.match(readFileSync('src/App.jsx', 'utf8'), /page === 'password' && <PasswordPage key=\{passwordNuova\} nuovaSubito=\{passwordNuova > 0\} db=\{supabase\}/);
  assert.match(readFileSync('personal/src/sezioni/password/Password.jsx', 'utf8'), /<PasswordPage db=\{studioDb\}/);
  assert.match(readFileSync('src/lib/utils.js', 'utf8'), /\{ id: 'password', l: 'Password', ic: 'lock' \}/);
  assert.match(readFileSync('personal/src/sezioni/altro/index.jsx', 'utf8'), /\['password', 'Password', 'password', 'pulsante'\]/);
});
