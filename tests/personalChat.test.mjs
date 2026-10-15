// POL-VITA-005 — chat Poliedron in Personal: AI (Apps Script + Claude) o sola ricerca.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chiediPoliedron, partiRisposta, URL_CARICAMENTO } from '../personal/src/lib/archivio.js';

const codeGs = readFileSync('poliedron/archivio/Code.gs', 'utf8');
const sezione = (da, a) => codeGs.slice(codeGs.indexOf(da), codeGs.indexOf(a));
const doPost = sezione('function doPost(', 'function fileDelDocumento_(');
const chat = sezione('const CHAT_MAX_GIRI', 'function claudeMessaggi_(');
const app = readFileSync('personal/src/App.jsx', 'utf8');
const ID = '0b6f2a7e-1c3d-4e5f-8a9b-0c1d2e3f4a5b';

test('chat: domanda allo script con token, documento aperto e ultimi 6 messaggi, senza preflight', async () => {
  let richiesta;
  const fetchFinto = async (url, o) => { richiesta = { url, ...o }; return { json: async () => ({ ok: true, risposta: 'Ecco.' }) }; };
  const storia = Array.from({ length: 9 }, (_, i) => ({ ruolo: i % 2 ? 'assistente' : 'utente', testo: `m${i}` }));
  const r = await chiediPoliedron({ token: 'jwt', domanda: 'Bollette luce?', documentoId: ID, storia }, fetchFinto);
  assert.equal(r, 'Ecco.');
  assert.equal(richiesta.url, URL_CARICAMENTO);
  assert.match(richiesta.headers['Content-Type'], /^text\/plain/);
  const corpo = JSON.parse(richiesta.body);
  assert.equal(corpo.azione, 'chiedi');
  assert.equal(corpo.token, 'jwt');
  assert.equal(corpo.documento_id, ID);
  assert.equal(corpo.storia.length, 6);
  assert.equal(corpo.storia.at(-1).testo, 'm8');
});

test('chat: errori chiari (sessione, script, risposta non JSON), mai una risposta finta', async () => {
  await assert.rejects(chiediPoliedron({ domanda: 'x' }, async () => assert.fail('nessuna chiamata')), /Sessione scaduta/);
  await assert.rejects(chiediPoliedron({ token: 't', domanda: 'x' }, async () => ({ json: async () => ({ ok: false, errore: 'Accesso non autorizzato' }) })), /Accesso non autorizzato/);
  await assert.rejects(chiediPoliedron({ token: 't', domanda: 'x' }, async () => ({ json: async () => { throw new Error('html'); } })), /non raggiungibile/);
});

test('chat: i riferimenti [[doc:ID|titolo]] diventano link apribili', () => {
  assert.deepEqual(partiRisposta(`Vedi [[doc:${ID}|Bolletta luce]] e basta.`), [
    { testo: 'Vedi ' }, { doc: ID, titolo: 'Bolletta luce' }, { testo: ' e basta.' },
  ]);
  assert.deepEqual(partiRisposta(`[[doc:${ID}]]`), [{ doc: ID, titolo: 'documento' }]);
  assert.deepEqual(partiRisposta('Nessun documento.'), [{ testo: 'Nessun documento.' }]);
  assert.deepEqual(partiRisposta('[[doc:non-un-id|x]]'), [{ testo: '[[doc:non-un-id|x]]' }]);
});

test('script: la chat risponde solo al proprietario verificato', () => {
  assert.ok(doPost.indexOf("req.azione === 'chiedi'") > doPost.indexOf('PROPRIETARIO || !utente.email_confirmed_at'));
});

test('script: i documenti clinici dei pazienti non arrivano mai al modello', () => {
  assert.match(chat, /senzaClinici_\(docs \|\| \[\]\)/); // ricerca
  assert.match(chat, /d\.fascicolo === 'clinico_pazienti'\) return \{ errore/); // dettaglio e documento aperto
  assert.match(chat, /s\.documento\.fascicolo !== 'clinico_pazienti'/); // scadenze
  assert.match(chat, /fascicolo=neq\.clinico_pazienti/); // pratiche
  // Il documento aperto passa dallo stesso strumento filtrato.
  assert.match(chat, /strumentoChat_\('documento', \{ id: req\.documento_id \}\)/);
});

test('script: strumenti di sola lettura, nessun invio, chiave solo nelle Proprietà script', () => {
  assert.doesNotMatch(chat, /method: '(patch|delete)'|GmailApp|MailApp|sendEmail|setTrashed/);
  assert.doesNotMatch(chat, /method: 'post'(?!, body: \{ q:)/); // solo l'RPC di ricerca
  assert.match(chat, /prepara solo il testo come bozza/);
  assert.match(codeGs, /'x-api-key': p\.ANTHROPIC_API_KEY/);
  assert.doesNotMatch(codeGs, /sk-ant-/);
});

test('app: AI con ripiego sulla sola ricerca e richiesta sul documento aperto', () => {
  assert.match(app, /Poliedron AI/);
  assert.match(app, /Solo ricerca/);
  assert.match(app, /chiediPoliedron\(/);
  assert.match(app, /Chiedi a Poliedron su questo documento/);
});
