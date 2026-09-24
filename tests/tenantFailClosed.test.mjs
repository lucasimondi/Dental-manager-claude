import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Execute the actual adapter with only the SDK boundary replaced. No network,
// credentials, production records or reimplementation of adapter logic.
const source = readFileSync(new URL('../src/lib/supabase.js', import.meta.url), 'utf8')
  .replace("import { createClient } from '@supabase/supabase-js';", '')
  .replaceAll('export const ', 'const ');
const A = 'aaaaaaaa-0000-0000-0000-000000000001';
const B = 'bbbbbbbb-0000-0000-0000-000000000002';
const sessionFor = (studioId = A) => ({ user: { id: 'synthetic-user', app_metadata: { studio_id: studioId } } });
const keys = ['dm_p', 'dm_pl', 'dm_py', 'dm_a', 'dm_pr', 'dm_tp', 'dm_at', 'dm_im', 'dm_ip', 'dm_ri'];

function harness(session = sessionFor(), options = {}) {
  const calls = [];
  const state = { session };
  const client = {
    auth: {
      async getSession() {
        if (options.throws) throw new Error('Auth unavailable');
        return { data: { session: state.session }, error: options.authError || null };
      },
      async getUser() {
        return { data: { user: Object.hasOwn(options, 'user') ? options.user : state.session?.user }, error: options.userError || null };
      },
    },
    from(table) {
      const call = { table, filters: [] };
      calls.push(call);
      const q = {
        select() { return q; }, order() { return q; },
        eq(field, value) { call.filters.push([field, value]); return q; },
        insert(payload) { call.operation = 'insert'; call.payload = payload; return q; },
        update(payload) { call.operation = 'update'; call.payload = payload; return q; },
        delete() { call.operation = 'delete'; return q; },
        upsert(payload) { call.operation = 'upsert'; call.payload = payload; return q; },
        single() { return Promise.resolve({ data: { id: 7, ...call.payload }, error: options.dbError || null }); },
        maybeSingle() { return Promise.resolve({ data: { id: 7, studio_id: state.session?.user?.app_metadata?.studio_id }, error: options.dbError || null }); },
        then(resolve, reject) { return Promise.resolve({ data: [], error: options.dbError || null }).then(resolve, reject); },
      };
      return q;
    },
  };
  const context = vm.createContext({ createClient: () => client, console: { error() {} } });
  vm.runInContext(`${source}\nglobalThis.adapter = DB;`, context);
  return { db: context.adapter, calls, state };
}

const denied = { code: 'TENANT_CONTEXT_REQUIRED' };
for (const [name, session, options] of [
  ['no session', null],
  ['missing claim', { user: { id: 'synthetic-user' } }],
  ['missing user', {}],
  ['missing user id', { user: { app_metadata: { studio_id: A } } }],
  ['editable metadata only', { user: { id: 'synthetic-user', user_metadata: { studio_id: A } } }],
  ...[null, '', ' ', 'invalid', 42, {}, [], `${A} `].map(value => [`invalid claim ${JSON.stringify(value)}`, sessionFor(value)]),
  ['auth error with stale session', sessionFor(), { authError: new Error('expired') }],
  ['auth throws', sessionFor(), { throws: true }],
]) {
  test(`all adapter operations fail closed: ${name}`, async () => {
    const { db, calls } = harness(session, options);
    for (const key of keys) {
      assert.equal((await db.getAll(key)).length, 0);
      assert.equal(await db.getById(key, 7), null);
      await assert.rejects(db.insert(key, { nome: 'Synthetic' }), denied);
      await assert.rejects(db.update(key, 7, { nome: 'Synthetic' }), denied);
      await assert.rejects(db.remove(key, 7), denied);
    }
    assert.equal(await db.getStudioInfo(), null);
    await assert.rejects(db.setStudioInfo({ nome: 'Synthetic' }), denied);
    assert.equal(calls.length, 0, 'must not even construct a data request');
  });
}

for (const tenant of [A, B, '00000000-0000-0000-0000-000000000001', A.toUpperCase()]) {
  test(`valid explicit tenant preserves mapping and scopes CRUD: ${tenant}`, async () => {
    const { db, calls } = harness(sessionFor(tenant));
    for (const key of keys) {
      await db.getAll(key);
      await db.getById(key, 7);
      const saved = await db.insert(key, { nome: 'Synthetic', studio_id: B, user_id: 'spoofed' });
      assert.equal(saved.studio_id, tenant);
      await db.update(key, 7, { nome: 'Synthetic', studio_id: B });
      await db.remove(key, 7);
    }
    await db.getStudioInfo();
    await db.setStudioInfo({ studio_id: B, user_id: 'spoofed' });
    for (const call of calls) {
      if (['insert', 'upsert'].includes(call.operation)) {
        assert.equal(call.payload.studio_id, tenant);
        assert.equal(call.payload.user_id, 'synthetic-user');
      } else {
        assert.ok(call.filters.some(([k, v]) => k === 'studio_id' && v === tenant));
        if (call.operation === 'update') assert.equal(Object.hasOwn(call.payload, 'studio_id'), false);
      }
    }
    await db.insert('dm_py', { pazienteId: 12, pianoId: 4, importo: 20, _editId: 10 });
    assert.equal(calls.at(-1).payload.paziente_id, 12);
    assert.equal(calls.at(-1).payload.piano_id, 4);
    assert.equal(Object.hasOwn(calls.at(-1).payload, '_editId'), false);
  });
}

test('tenant is resolved again after A → B → logout, never cached', async () => {
  const { db, calls, state } = harness();
  await db.update('dm_py', 7, { importo: 10 });
  state.session = sessionFor(B);
  await db.remove('dm_py', 7);
  assert.equal(calls[0].filters.at(-1)[1], A);
  assert.equal(calls[1].filters.at(-1)[1], B);
  state.session = null;
  await assert.rejects(db.update('dm_py', 7, {}), denied);
  assert.equal(calls.length, 2);
});

test('author unavailable, changed user/tenant or verification error denies insert/upsert', async () => {
  for (const options of [
    { user: null }, { user: { ...sessionFor().user, id: 'other-user' } },
    { user: sessionFor(B).user }, { user: sessionFor(42).user }, { userError: new Error('revoked') },
  ]) {
    const { db, calls } = harness(sessionFor(), options);
    await assert.rejects(db.insert('dm_py', { importo: 10 }), denied);
    await assert.rejects(db.setStudioInfo({}), denied);
    assert.equal(calls.length, 0);
  }
});

test('unknown keys cannot issue writes', async () => {
  const { db, calls } = harness();
  for (const key of ['unknown', '__proto__', 'constructor']) {
    assert.equal(await db.getAll(key), null);
    assert.equal(await db.getById(key, 7), null);
    await assert.rejects(db.insert(key, {}));
    await assert.rejects(db.update(key, 7, {}));
    await assert.rejects(db.remove(key, 7));
  }
  assert.equal(calls.length, 0);
});

test('database write errors still reach callers', async () => {
  const dbError = new Error('synthetic RLS denial');
  const { db } = harness(sessionFor(), { dbError });
  for (const operation of [() => db.insert('dm_py', {}), () => db.update('dm_py', 7, {}), () => db.remove('dm_py', 7), () => db.setStudioInfo({})]) {
    await assert.rejects(operation(), error => error === dbError);
  }
});
