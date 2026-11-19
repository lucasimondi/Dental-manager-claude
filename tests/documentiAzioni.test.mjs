import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spostaInPratica, vociPratiche, preparaInvio } from '../personal/src/lib/documentiAzioni.js';

test('sposta in pratica: aggiorna pratica_id dei documenti scelti, mai quelli dei pazienti', async () => {
  const chiamate = [];
  const db = { from: (t) => ({ update: (v) => ({ in: (k, ids) => ({ select: async () => { chiamate.push({ t, v, k, ids }); return { data: ids.map((id) => ({ id })), error: null }; } }) }) }) };
  await spostaInPratica(db, [{ id: 'a', fascicolo: 'legale' }, { id: 'b', fascicolo: 'clinico_pazienti' }], 'p1');
  assert.deepEqual(chiamate, [{ t: 'documenti', v: { pratica_id: 'p1' }, k: 'id', ids: ['a'] }]);
  await spostaInPratica(db, [{ id: 'a', fascicolo: 'legale' }], null);
  assert.deepEqual(chiamate.at(-1).v, { pratica_id: null });
  assert.deepEqual(await spostaInPratica(db, [{ id: 'b', fascicolo: 'clinico_pazienti' }], 'p1'), []);
});

test('scelta della pratica: prima le aperte, poi le chiuse; «Togli» solo se è già in una pratica', () => {
  const p = [{ id: 'a', titolo: 'Alfa', stato: 'risolta', n_documenti: 1 }, { id: 'b', titolo: 'Beta', stato: 'aperta', n_documenti: 2 }, { id: 'c', titolo: 'Gamma', stato: 'in_corso' }];
  assert.deepEqual(vociPratiche(p).map((v) => v.id), ['b', 'c', 'a']);
  const v = vociPratiche(p, 'c');
  assert.equal(v[0].id, '__nessuna');
  assert.equal(v.find((x) => x.id === 'c').attivo, true);
  assert.match(v.find((x) => x.id === 'a').meta, /chiusa/);
});

test('scarica / invia: file singoli o uno ZIP, esclusi i pazienti e i documenti senza file', async () => {
  const docs = [{ id: '1', titolo: 'Uno', drive_file_id: 'f1', fascicolo: 'legale', mime_type: 'application/pdf' }, { id: '2', titolo: 'Due', drive_file_id: 'f2', fascicolo: 'legale', mime_type: 'application/pdf' },
    { id: '3', titolo: 'Paziente', drive_file_id: 'f3', fascicolo: 'clinico_pazienti' }, { id: '4', titolo: 'Senza', fascicolo: 'altro' }];
  const prendi = async (d) => new File([`dati ${d.id}`], `${d.titolo}.pdf`, { type: 'application/pdf' });
  const singoli = await preparaInvio(docs, { formato: 'file', nome: 'x' }, prendi);
  assert.equal(singoli.fase, 'pronto'); assert.equal(singoli.files.length, 2); assert.equal(singoli.esclusi.length, 2);
  const zip = await preparaInvio(docs.slice(0, 2), { formato: 'zip', nome: 'Pratica prova' }, prendi);
  assert.equal(zip.files.length, 1); assert.match(zip.files[0].name, /Pratica prova\.zip$/);
  assert.equal((await preparaInvio([docs[2]], { formato: 'zip', nome: 'x' }, prendi)).fase, 'errore');
});

test('ovunque ci sono documenti: «•••», Scarica / invia e Pratica; pratica e Legal usano l\'elenco selezionabile', () => {
  const sel = readFileSync('personal/src/sezioni/documenti/Selezione.jsx', 'utf8');
  for (const t of ['pp-doc-menu', 'Scarica / invia', 'Sposta in una pratica', 'Invia o condividi', 'Seleziona più documenti', '<FoglioInvia']) assert.ok(sel.includes(t), t);
  assert.match(readFileSync('personal/src/sezioni/documenti/Pratica.jsx', 'utf8'), /<ElencoSelezionabile elenco=\{documenti\}/);
  assert.match(readFileSync('personal/src/sezioni/legal/Legal.jsx', 'utf8'), /<ElencoSelezionabile elenco=\{docs\}/);
  assert.match(readFileSync('personal/src/sezioni/documenti/CartelleMie.jsx', 'utf8'), /export function FoglioInvia/);
});
