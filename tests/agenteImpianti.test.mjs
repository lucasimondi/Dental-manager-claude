// Implant label import: real HTTP handler; synthetic DB and providers only.
// The real Edge handler, external services replaced with synthetic data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

import { normalizzaImpianti, prepareImpianti, executeImpianti, STRUMENTO_IMPIANTI } from '../supabase/functions/agente-assistente/impianti.js';

let handler, script, calls, database, user, plan, autonomia, claims, inserts, clinical, insertFails, verifyFails, revoked;
class Query {
  constructor(table) { this.table = table; this.filters = []; this.mode = 'many'; }
  select() { return this; } order() { return this; } limit() { return this; } or() { return this; }
  eq(k, v) { this.filters.push((r) => r[k] === v); return this; }
  ilike(k, v) { this.filters.push((r) => String(r[k] || '').toLowerCase() === String(v).toLowerCase()); return this; }
  gte(k, v) { this.filters.push((r) => r[k] >= v); return this; }
  lte(k, v) { this.filters.push((r) => r[k] <= v); return this; }
  maybeSingle() { this.mode = 'one'; return this; } single() { this.mode = 'one'; return this; }
  insert(row) { this.inserted = row; return this; }
  update(row) { this.updated = row; return this; }
  then(resolve, reject) {
    return Promise.resolve().then(() => {
      if (this.updated) { for (const r of database[this.table] || []) if (this.filters.every(f => f(r))) Object.assign(r, this.updated); return { error: null }; }
      if (this.inserted) {
        inserts.push({ table: this.table, row: this.inserted });
        if (this.table === 'poliedron_action_claims') {
          if (claims.has(this.inserted.id)) return { error: { code: '23505' } };
          claims.add(this.inserted.id);
        }
        if (this.table === 'poliedra_connector_requests') { database.poliedra_connector_requests.push({ status: 'pending', ...this.inserted }); return { error: null }; }
        if (this.table === 'implants') {
          if (insertFails) return { error: { message: 'synthetic insert failure' } };
          const rows = this.inserted.map((r, i) => ({ ...r, id: 700 + database.implants.length + i }));
          database.implants.push(...rows);
          return { data: null, error: null };
        }
        if (this.table === 'payments') {
          (database.payments ||= []).push(this.inserted);
          return { data: this.inserted, error: null };
        }
        return { data: null, error: null };
      }
      if (this.table === 'implants' && verifyFails && database.implants.length) return { error: { message: 'synthetic read failure' } };
      let rows = this.table === 'studios'
        ? [{ id: 's1', nome: 'Studio test', feature_overrides: { assistente_ai: plan, agente_azione: autonomia } }]
        : database[this.table] || [];
      rows = rows.filter((r) => this.filters.every((f) => f(r)));
      return { data: this.mode === 'one' ? rows[0] || null : rows, error: null };
    }).then(resolve, reject);
  }
}
const use = (name, input) => ({ content: [{ type: 'tool_use', id: crypto.randomUUID(), name, input }] });
const say = (text) => ({ content: [{ type: 'text', text }] });

test.before(async () => {
  const bundled = await build({
    entryPoints: [fileURLToPath(new URL('../supabase/functions/agente-assistente/index.ts', import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'neutral',
    plugins: [{ name: 'fakes', setup(b) {
      b.onResolve({ filter: /^https:\/\// }, (a) => ({ path: a.path, namespace: 'fake' }));
      b.onLoad({ filter: /.*/, namespace: 'fake' }, (a) => ({
        contents: a.path.includes('server.ts')
          ? 'export const serve = h => globalThis.__pagHandler(h);'
          : 'export const createClient = (...a) => globalThis.__pagClient(...a);',
        loader: 'js',
      }));
    } }],
  });
  globalThis.__pagHandler = (h) => { handler = h; };
  globalThis.Deno = { env: { get: (k) => (k === 'SUPABASE_SERVICE_ROLE_KEY' ? 'test-only-signing-secret' : 'test') } };
  globalThis.__pagClient = () => ({
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from: (t) => new Query(t),
    rpc: async (name) => name === 'has_studio_capability_v1' ? { data: clinical, error: null } : { error: { message: 'unsupported RPC' } },
  });
  globalThis.fetch = async (_url, options) => {
    if (String(_url).endsWith("/user/oauth/grants")) return { ok: true, json: async () => revoked ? [] : [{ client: { id: CONNECTOR_ID } }] };
    calls.push(JSON.parse(options.body));
    const next = script.shift();
    assert.ok(next, 'unexpected provider request');
    return { ok: true, json: async () => next };
  };
  await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
});

test.beforeEach(() => {
  revoked = false; clinical = true; insertFails = false; verifyFails = false; script = []; calls = []; claims = new Set(); inserts = []; plan = 'premium'; autonomia = 'completo';
  user = { id: 'u1', app_metadata: { studio_id: 's1' } };
  database = {
    studio_users: [{ user_id: 'u1', studio_id: 's1', stato: 'attivo' }],
    patients: [
      { id: 1, nome: 'Mario', cognome: 'Rossi', studio_id: 's1' },
      { id: 2, nome: 'Anna', cognome: 'Verdi', studio_id: 's1' },
    ],
    plans: [
      { id: 10, paziente_id: 1, studio_id: 's1', titolo: 'Impianto 36', stato: 'attivo', data: '2026-09-01' },
      { id: 11, paziente_id: 1, studio_id: 's1', titolo: 'Igiene 2025', stato: 'concluso', data: '2025-01-10' },
      { id: 20, paziente_id: 2, studio_id: 's1', titolo: 'Ortodonzia', stato: 'accettato', data: '2026-02-01' },
      { id: 21, paziente_id: 2, studio_id: 's1', titolo: 'Conservativa', stato: 'attivo', data: '2026-08-01' },
    ],
    poliedra_connector_clients: [{ client_id: CONNECTOR_ID, provider: 'chatgpt', enabled: true, resource_uri: 'https://clinic.example/api/mcp' }], poliedra_connector_requests: [], implants: [], payments: [], appointments: [], impegni_personali: [], richiami: [],
  };
});
async function request(body, token = "test") {
  const response = await handler(new Request('https://local.test', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) }));
  return { status: response.status, ...await response.json() };
}
const toolNames = (i = 0) => calls[i].tools.map((t) => t.name);
const toolError = (i) => JSON.parse(calls[i].messages.at(-1).content.at(-1).content).error;

const entry = { dente: '16', data_inserimento: '2024-04-10', marca: 'Marca test', modello: 'Serie test REF TEST-10', lotto: 'LOT-TEST', diametro: '4.0', lunghezza: '11 mm' };
const input = () => ({ paziente_id: 1, impianti: [{ ...entry }, { ...entry, dente: '26' }] });
const client = () => ({ from: t => new Query(t), rpc: async () => ({ data: clinical, error: null }) });
const prepare = (value = input(), studio = 's1', seen = new Set([1])) => prepareImpianti(client(), value, studio, { patients: seen });
const proposal = async () => ({ id: crypto.randomUUID(), studioId: 's1', userId: 'u1', impianti: await prepare() });
const photoRequest = () => ({ messages: [{ role: 'user', content: 'Trascrivi questa etichetta per Mario Rossi sui denti 16 e 26, chirurgia del 10 aprile 2024' }], allegato: { nome: 'etichetta-test.jpg', media_type: 'image/jpeg', data: 'aGk=' } });
const modelReadAndWrite = () => script.push(use('cerca_pazienti', { query: 'Mario Rossi' }), use(STRUMENTO_IMPIANTI.name, input()));

test('normalization validates all rows before access, preserves lot and normalizes mm', () => {
  const rows = normalizzaImpianti(input());
  assert.equal(rows.length, 2); assert.equal(rows[0].diametro, '4 mm'); assert.equal(rows[0].lotto, 'LOT-TEST');
  for (const patch of [{ dente: '16,26' }, { dente: '99' }, { data_inserimento: '2024-02-30' }, { data_inserimento: '2099-01-01' }, { data_inserimento: '' }, { lotto: '' }, { diametro: 'abc' }, { lunghezza: '0 mm' }]) {
    assert.throws(() => normalizzaImpianti({ ...input(), impianti: [{ ...entry, ...patch }] }));
  }
  assert.throws(() => normalizzaImpianti({ ...input(), impianti: [entry, entry] }), /due volte/);
  assert.throws(() => normalizzaImpianti({ ...input(), paziente_id: '1' }), /paziente/);
});
test('preparation is read-only and demands observed patient, tenant and clinical capability', async () => {
  const p = await prepare(); assert.match(p.summary, /Nuovi: 2/); assert.equal(inserts.length, 0);
  await assert.rejects(() => prepare(input(), 's1', new Set()), /Cerca prima/);
  await assert.rejects(() => prepare(input(), ''), /Studio/);
  await assert.rejects(() => prepare(input(), 'other'), /verificare/);
  clinical = false; await assert.rejects(() => prepare(), /clinico/); assert.equal(inserts.length, 0);
});
test('confirmed batch writes both teeth once with explicit scope and independent read-back', async () => {
  const p = await proposal(); const out = await executeImpianti(client(), p);
  assert.deepEqual(out.changed, ['implants']); assert.equal(out.records.implants.length, 2);
  assert.deepEqual(database.implants.map(r => r.dente), ['16', '26']);
  const batch = inserts.find(x => x.table === 'implants').row;
  assert.equal(batch.length, 2); assert.ok(batch.every(r => r.studio_id === 's1' && r.user_id === 'u1' && r.paziente_id === 1 && !('id' in r)));
  await assert.rejects(() => executeImpianti(client(), p), /già utilizzata/); assert.equal(database.implants.length, 2);
});
test('new request skips exact existing entries and blocks differing same site/date', async () => {
  await executeImpianti(client(), await proposal());
  const out = await executeImpianti(client(), await proposal());
  assert.match(out.text, /Nuovi: 0; già presenti: 2/); assert.equal(database.implants.length, 2);
  database.implants[0].lotto = 'DIFFERENT';
  await assert.rejects(() => prepare(), /differenti/); assert.equal(database.implants.length, 2);
});
test('permission revoked or conflicting write after preview blocks before claim/write', async () => {
  const p = await proposal(); clinical = false;
  await assert.rejects(() => executeImpianti(client(), p), /clinico/); assert.equal(inserts.length, 0);
  clinical = true;
  database.implants.push({ ...entry, id: 900, paziente_id: 1, studio_id: 's1', lotto: 'OTHER' });
  await assert.rejects(() => executeImpianti(client(), p), /differenti/); assert.equal(inserts.length, 0);
});
test('lost write response/read-back is not success, claim is consumed, no auto replay', async () => {
  const p = await proposal(); verifyFails = true;
  await assert.rejects(() => executeImpianti(client(), p), /verificare/);
  assert.equal(database.implants.length, 2); assert.ok(claims.has(p.id));
  verifyFails = false;
  await assert.rejects(() => executeImpianti(client(), p), /già utilizzata/); assert.equal(database.implants.length, 2);
});
test('failed bulk insert reports uncertainty and never creates a partial tooth', async () => {
  const p = await proposal(); insertFails = true;
  await assert.rejects(() => executeImpianti(client(), p), /Esito non confermato/);
  assert.equal(database.implants.length, 0); assert.ok(claims.has(p.id));
});
test('photo reaches model, signed clinical review then authenticated confirm refreshes implants', async () => {
  modelReadAndWrite(); const preview = await request(photoRequest());
  assert.ok(preview.needsConfirmation?.token); assert.equal(database.implants.length, 0);
  assert.ok(calls.some(c => c.messages.some(m => Array.isArray(m.content) && m.content.some(b => b.type === 'image'))));
  assert.match(preview.needsConfirmation.summary, /Dente 16[\s\S]*Dente 26/);
  const done = await request({ confirm: { token: preview.needsConfirmation.token } });
  assert.equal(done.uncertain, undefined); assert.deepEqual(done.changed, ['implants']); assert.equal(done.records.implants.length, 2);
  const repeat = await request({ confirm: { token: preview.needsConfirmation.token } });
  assert.equal(repeat.uncertain, true); assert.equal(database.implants.length, 2);
});
test('cancel and changed autonomy cannot write a signed preview', async () => {
  modelReadAndWrite(); let preview = await request(photoRequest());
  const cancel = await request({ confirm: { token: preview.needsConfirmation.token, cancelled: true } });
  assert.match(cancel.text, /annullata/); assert.equal(database.implants.length, 0);
  modelReadAndWrite(); preview = await request(photoRequest()); autonomia = 'consulente';
  await request({ confirm: { token: preview.needsConfirmation.token } }); assert.equal(database.implants.length, 0);
});
test('handler missing placement date asks for it without writing or proposing an invented date', async () => {
  script.push(use('cerca_pazienti', { query: 'Mario Rossi' }), use(STRUMENTO_IMPIANTI.name, { ...input(), impianti: [{ ...entry, data_inserimento: '' }] }), say('In quale data è stato inserito?'));
  const out = await request(photoRequest());
  assert.equal(out.needsConfirmation, undefined); assert.match(out.text, /quale data/); assert.equal(database.implants.length, 0);
});
test('handler rechecks clinical authority on confirmation and reports uncertainty for read failure', async () => {
  modelReadAndWrite(); const preview = await request(photoRequest()); clinical = false;
  const denied = await request({ confirm: { token: preview.needsConfirmation.token } });
  assert.match(denied.text, /clinico/); assert.equal(database.implants.length, 0);
  clinical = true; modelReadAndWrite(); const second = await request(photoRequest()); verifyFails = true;
  const uncertain = await request({ confirm: { token: second.needsConfirmation.token } });
  assert.equal(uncertain.uncertain, true); assert.deepEqual(uncertain.changed, ['implants']); assert.equal(database.implants.length, 2);
});
test('oversized clinical summary is refused before issuing an unusable confirmation', async () => {
  const entries = Array.from({ length: 32 }, (_, i) => ({ ...entry, dente: `${1 + Math.floor(i / 8)}${1 + i % 8}`, marca: 'M'.repeat(200), modello: 'S'.repeat(200), lotto: 'L'.repeat(200) }));
  script.push(use('cerca_pazienti', { query: 'Mario Rossi' }), use(STRUMENTO_IMPIANTI.name, { paziente_id: 1, impianti: entries }), say('Dividi gli impianti in due richieste.'));
  const out = await request(photoRequest());
  assert.equal(out.needsConfirmation, undefined); assert.match(out.text, /Dividi/); assert.equal(database.implants.length, 0);
});

const CONNECTOR_ID = '00000000-0000-4000-8000-000000000011';
const connectorToken = () => 'e30.' + Buffer.from(JSON.stringify({ client_id: CONNECTOR_ID, aud: ['authenticated', 'https://clinic.example/api/mcp'], app_metadata: { studio_id: 's1' } })).toString('base64url') + '.synthetic';
const connectorCall = (name, args = {}) => request({ connector: { operation: 'call', name, arguments: args } }, connectorToken());
test('external connector exposes reviewed tools without any model/provider call', async () => {
  const out = await request({ connector: { operation: 'tools' } }, connectorToken());
  assert.ok(out.tools.some(t => t.name === 'prepara_impianti'));
  assert.ok(out.tools.every(t => !/execute|sql/i.test(t.name)));
  assert.equal(calls.length, 0); assert.equal(inserts.filter(x => ['implants','plans','payments','appointments'].includes(x.table)).length, 0);
});
test('external photo fields become one private review request; only first-party approval writes', async () => {
  const draft = await connectorCall('prepara_impianti', input());
  assert.equal(draft.status, 'pending'); assert.ok(draft.review_url.includes('/connector/review?id='));
  assert.equal(draft.proposal_token, undefined); assert.equal(database.implants.length, 0);
  const refused = await request({ confirm: { connector_request_id: draft.richiesta_id } }, connectorToken());
  assert.equal(refused.status, 500); assert.equal(database.implants.length, 0);
  const done = await request({ confirm: { connector_request_id: draft.richiesta_id } });
  assert.equal(done.uncertain, undefined); assert.equal(done.records.implants.length, 2);
  const status = await connectorCall('stato_richiesta', { richiesta_id: draft.richiesta_id });
  assert.equal(status.status, 'done'); assert.equal(status.proposal_token, undefined);
  const repeat = await request({ confirm: { connector_request_id: draft.richiesta_id } });
  assert.equal(repeat.status, 500); assert.equal(database.implants.length, 2); assert.equal(calls.length, 0);
});
test('revoked grant, disabled client, changed clinical capability block both preparation and review', async () => {
  const draft = await connectorCall('prepara_impianti', input()); revoked = true;
  assert.ok((await connectorCall('prepara_impianti', input())).error);
  assert.ok((await request({ confirm: { connector_request_id: draft.richiesta_id } })).error);
  revoked = false; clinical = false;
  assert.ok((await connectorCall('prepara_impianti', input())).error);
  assert.ok((await request({ confirm: { connector_request_id: draft.richiesta_id } })).error);
  clinical = true; database.poliedra_connector_clients[0].enabled = false;
  assert.ok((await request({ confirm: { connector_request_id: draft.richiesta_id } })).error);
  assert.equal(database.implants.length, 0);
});
test('first-party cancellation consumes the request and a stale clinical preview cannot execute', async () => {
  let draft = await connectorCall('prepara_impianti', input());
  const cancelled = await request({ confirm: { connector_request_id: draft.richiesta_id, cancelled: true } });
  assert.match(cancelled.text, /annullata/); assert.equal(database.poliedra_connector_requests[0].status, 'cancelled');
  draft = await connectorCall('prepara_impianti', input());
  database.implants.push({ ...entry, diametro: '4 mm', id: 900, paziente_id: 1, studio_id: 's1' });
  const stale = await request({ confirm: { connector_request_id: draft.richiesta_id } });
  assert.match(stale.error, /cambiati/); assert.equal(database.implants.length, 1);
  const cancelledStale = await request({ confirm: { connector_request_id: draft.richiesta_id, cancelled: true } });
  assert.match(cancelledStale.text, /annullata/); assert.equal(database.implants.length, 1);
});
test('ordinary sessions, wrong resource and hidden requests cannot use structured connector calls', async () => {
  assert.ok((await request({ connector: { operation: 'tools' } })).error);
  const draft = await connectorCall('prepara_impianti', input());
  database.poliedra_connector_requests[0].user_id = 'other-user';
  assert.ok((await request({ confirm: { connector_request_id: draft.richiesta_id } })).error);
  assert.equal(database.implants.length, 0);
});

test('explicit chat confirmation saves immutable draft once without first-party navigation', async () => {
 const draft = await connectorCall('prepara_impianti', input());
 assert.equal(database.implants.length,0);
 assert.ok((await connectorCall('conferma_richiesta',{richiesta_id:draft.richiesta_id})).error);
 const done = await connectorCall('conferma_richiesta',{richiesta_id:draft.richiesta_id,decisione:'Conferma'});
 assert.equal(done.status,'done'); assert.equal(database.implants.length,2); assert.equal(done.proposal_token,undefined);
 const replay = await connectorCall('conferma_richiesta',{richiesta_id:draft.richiesta_id,decisione:'Conferma'});
 assert.ok(replay.error); assert.equal(database.implants.length,2);
});
test('chat cancellation, wrong client and revoked grant never register implants', async () => {
 const draft = await connectorCall('prepara_impianti', input());
 database.poliedra_connector_requests[0].client_id='00000000-0000-4000-8000-000000000099';
 assert.ok((await connectorCall('conferma_richiesta',{richiesta_id:draft.richiesta_id,decisione:'Conferma'})).error);
 database.poliedra_connector_requests[0].client_id=CONNECTOR_ID; revoked=true;
 assert.ok((await connectorCall('conferma_richiesta',{richiesta_id:draft.richiesta_id,decisione:'Conferma'})).error);
 revoked=false;
 const cancelled=await connectorCall('conferma_richiesta',{richiesta_id:draft.richiesta_id,decisione:'Annulla'});
 assert.equal(cancelled.status,'cancelled'); assert.equal(database.implants.length,0);
});
