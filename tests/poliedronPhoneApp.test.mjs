import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isPoliedronAppPath, phoneViewport, joinDictation, speechErrorMessage, submitChatDraft } from '../src/lib/poliedron/phoneApp.js';

test('dedicated launch matches only Poliedron entry, leaving public links and manager untouched', () => {
  for (const path of ['/poliedron', '/poliedron/', '/poliedron/index.html']) assert.equal(isPoliedronAppPath(path), true);
  for (const path of ['/', '/poliedron-fake', '/poliedron/patient', '/prenota/studio', '/firma/token']) assert.equal(isPoliedronAppPath(path), false);
});

test('keyboard viewport shrinks the shell; pinch zoom and invalid readings are ignored', () => {
  assert.deepEqual(phoneViewport({ height: 402.4, offsetTop: 12.6, scale: 1 }), { height: 402, top: 13 });
  assert.equal(phoneViewport({ height: 400, scale: 2 }), null);
  assert.equal(phoneViewport({ height: 0 }), null);
  assert.equal(phoneViewport(null), null);
});

test('dictation appends editable text without exceeding composer limit; failure guidance is actionable', () => {
  assert.equal(joinDictation('Appuntamento  ', '  domani alle dieci '), 'Appuntamento domani alle dieci');
  assert.equal(joinDictation('', 'Crea un richiamo'), 'Crea un richiamo');
  assert.equal(joinDictation('a'.repeat(16000), 'b').length, 16000);
  assert.match(speechErrorMessage('not-allowed'), /non autorizzato/);
  assert.equal(speechErrorMessage('aborted'), '');
});

test('composer renders immediately, rejects duplicate taps, preserves a newly typed draft and restores rejected text', async () => {
  let resolve;
  let draft = 'Sposta appuntamento';
  let pending = null;
  let calls = 0;
  const lock = { current: false };
  const context = {
    text: draft, lock,
    send: () => { calls++; return new Promise((r) => { resolve = r; }); },
    clear: () => { draft = ''; }, restore: (value) => { draft ||= value; },
    pending: (value) => { pending = value; }, done: () => { pending = null; },
    fail: () => assert.fail('unexpected exception'),
  };
  const first = submitChatDraft(context);
  assert.equal(draft, '');
  assert.equal(pending, 'Sposta appuntamento');
  assert.equal(await submitChatDraft(context), false);
  assert.equal(calls, 1);
  draft = 'Nuovo messaggio';
  resolve(true);
  assert.equal(await first, true);
  assert.equal(draft, 'Nuovo messaggio');
  assert.equal(lock.current, false);
  const rejected = submitChatDraft({ ...context, text: 'Richiamo', send: async () => false });
  assert.equal(await rejected, false);
  assert.equal(draft, 'Richiamo');
});

test('an uncertain send unlocks composer and restores text without replaying an action', async () => {
  let draft = 'Nota clinica';
  let calls = 0;
  let errors = 0;
  const lock = { current: false };
  const accepted = await submitChatDraft({ text: draft, lock,
    send: async () => { calls++; throw new Error('network'); },
    clear: () => { draft = ''; }, restore: (v) => { draft ||= v; },
    pending: () => {}, done: () => {}, fail: () => errors++,
  });
  assert.equal(accepted, false);
  assert.equal(draft, 'Nota clinica');
  assert.equal(calls, 1);
  assert.equal(errors, 1);
  assert.equal(lock.current, false);
});

test('install manifest has distinct identity, chat start URL and scope compatible with existing modules', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/poliedron.webmanifest', import.meta.url)));
  assert.equal(manifest.id, '/poliedron/');
  assert.equal(manifest.start_url, '/poliedron/');
  assert.equal(manifest.scope, '/');
  for (const icon of manifest.icons) assert.ok(readFileSync(new URL(`../public${icon.src}`, import.meta.url)).length > 0);
});
