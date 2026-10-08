// POL-WA-003d: server half of the Embedded Signup / Coexistence flow, with Meta
// and Supabase simulated. The WABA must be subscribed to our app before the
// number is saved, otherwise Meta would deliver none of its messages.
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.META_APP_ID = 'app';
process.env.META_APP_SECRET = 'test-only-secret';
process.env.SUPABASE_ANON_KEY = 'anon';
const { default: handler } = await import('../api/whatsapp-embedded-signup.js');

let calls, replies;
const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });
globalThis.fetch = async (url, options = {}) => {
  const u = String(url);
  calls.push({ url: u, method: options.method || 'GET', headers: options.headers || {} });
  if (u.includes('/oauth/access_token')) return replies.token;
  if (u.includes('/subscribed_apps')) return replies.subscribe;
  if (u.includes('/phone_numbers')) return replies.phones;
  if (u.includes('/rest/v1/whatsapp_config')) return replies.db;
  throw new Error(`unexpected ${u}`);
};

async function call(body) {
  const res = { statusCode: 0, body: null, status(s) { this.statusCode = s; return this; }, json(b) { this.body = b; return this; } };
  await handler({ method: 'POST', headers: { authorization: 'Bearer user-jwt' }, body }, res);
  return res;
}

test.beforeEach(() => {
  calls = [];
  replies = {
    token: reply(200, { access_token: 'business-token' }),
    subscribe: reply(200, { success: true }),
    phones: reply(200, { data: [{ id: 'P1' }] }),
    db: reply(201, [{ studio_id: 's1', waba_id: 'W1', phone_number_id: 'P1', attivo: true }]),
  };
});

test('connects: subscribes the WABA to our app, then saves the number with the user JWT', async () => {
  const res = await call({ studio_id: 's1', code: 'c', waba_id: 'W1', phone_number_id: 'P1' });
  assert.equal(res.statusCode, 200);
  const sub = calls.find((c) => c.url.includes('/subscribed_apps'));
  assert.match(sub.url, /\/W1\/subscribed_apps$/);
  assert.equal(sub.method, 'POST');
  assert.equal(sub.headers.authorization, 'Bearer business-token');
  const db = calls.findIndex((c) => c.url.includes('/rest/v1/whatsapp_config'));
  assert.ok(calls.indexOf(sub) < db, 'subscription happens before saving');
  assert.equal(calls[db].headers.authorization, 'Bearer user-jwt', 'RLS stays the authority');
});

test('subscription refused by Meta: nothing is saved and the user is told to retry', async () => {
  replies.subscribe = reply(400, { error: { message: 'denied' } });
  const res = await call({ studio_id: 's1', code: 'c', waba_id: 'W1', phone_number_id: 'P1' });
  assert.equal(res.statusCode, 502);
  assert.match(res.body.error, /ricezione dei messaggi/);
  assert.equal(calls.some((c) => c.url.includes('/rest/v1/')), false);
  replies.subscribe = reply(200, { success: false });
  assert.equal((await call({ studio_id: 's1', code: 'c', waba_id: 'W1', phone_number_id: 'P1' })).statusCode, 502);
});

test('missing IDs still fail closed before any subscription or write', async () => {
  replies.phones = reply(200, { data: [{ id: 'P1' }, { id: 'P2' }] });
  const res = await call({ studio_id: 's1', code: 'c', waba_id: 'W1' });
  assert.equal(res.statusCode, 409);
  assert.equal(calls.some((c) => c.url.includes('/subscribed_apps') || c.url.includes('/rest/v1/')), false);
});
