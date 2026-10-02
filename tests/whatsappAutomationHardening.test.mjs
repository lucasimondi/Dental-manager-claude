import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// POL-WA-002: package.json is "type": "module", so the Vercel proxy must be an
// ES module. The CommonJS version crashed on every request with
// FUNCTION_INVOCATION_FAILED (verified on production before the fix).
test('Vercel WhatsApp proxy loads as an ES module and forwards GET verbatim', async (t) => {
  const mod = await import('../api/whatsapp-webhook.js');
  assert.equal(typeof mod.default, 'function');
  assert.equal(mod.config?.api?.bodyParser, false, 'raw body needed for the Meta HMAC signature');

  const chiamate = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    chiamate.push({ url, init });
    return { status: 403, text: async () => 'Forbidden' };
  });
  const risposta = { codice: null, corpo: null };
  const res = {
    status(c) { risposta.codice = c; return this; },
    send(b) { risposta.corpo = b; return this; },
  };
  await mod.default({ method: 'GET', url: '/api/whatsapp-webhook?hub.mode=subscribe&hub.challenge=1', headers: {} }, res);
  assert.equal(chiamate.length, 1);
  assert.match(chiamate[0].url, /\/functions\/v1\/whatsapp-webhook\?hub\.mode=subscribe&hub\.challenge=1$/);
  assert.deepEqual(risposta, { codice: 403, corpo: 'Forbidden' });
});

test('Vercel WhatsApp proxy forwards the POST body byte-for-byte with the signature', async (t) => {
  const mod = await import('../api/whatsapp-webhook.js');
  let inoltrato;
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    inoltrato = init;
    return { status: 200, text: async () => 'OK' };
  });
  const corpo = Buffer.from('{"a": 1,  "b":"è"}');
  const req = {
    method: 'POST',
    url: '/api/whatsapp-webhook',
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': 'sha256=abc' },
    async *[Symbol.asyncIterator]() { yield corpo.subarray(0, 5); yield corpo.subarray(5); },
  };
  const res = { status() { return this; }, send() { return this; } };
  await mod.default(req, res);
  assert.ok(Buffer.from(inoltrato.body).equals(corpo), 'body must not be re-serialized');
  assert.equal(inoltrato.headers['x-hub-signature-256'], 'sha256=abc');
});

test('Edge Function leaves room for adaptive thinking before the reply text', () => {
  const src = read('supabase/functions/whatsapp-webhook/index.ts');
  assert.doesNotMatch(src, /max_tokens:\s*512/);
  const m = src.match(/const MAX_TOKENS_AI = (\d+);/);
  assert.ok(m && Number(m[1]) >= 2048, 'max_tokens too low for a thinking model');
  // POL-WA-003a: one Claude call site, inside the tool loop.
  assert.match(src, /max_tokens: MAX_TOKENS_AI/);
  assert.match(src, /output_config: \{ effort: "low" \}/);
});

test('WhatsApp settings follow the POL-WA-002 permissions and never show the raw Supabase URL', () => {
  const src = read('src/components/Impostazioni.jsx');
  assert.doesNotMatch(src, /supabase\.co\/functions\/v1\/whatsapp-webhook/);
  assert.match(src, /\/api\/whatsapp-webhook/);
  assert.match(src, /const waPuoModificareNumero = !!isSuperAdmin;/);
  assert.match(src, /disabled=\{!waPuoModificareNumero\}/);
  // A studio owner saves only the on/off flag, never the number binding.
  assert.match(src, /:\s*\{ attivo: waForm\.attivo \}/);
  assert.match(read('src/App.jsx'), /<Impostazioni [^\n]*isSuperAdmin=\{isSuperAdmin\}/);
});
