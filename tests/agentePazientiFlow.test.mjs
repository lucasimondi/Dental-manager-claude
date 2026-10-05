// POL-AI-010 step 2: the real Edge handler, external services replaced with synthetic data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

let handler, script, calls, database, user, plan, autonomia, rpcCalls, claims;
class Query {
  constructor(table) { this.table = table; this.filters = []; this.mode = 'many'; }
  select() { return this; } order() { return this; } limit() { return this; } or() { return this; }
  eq(k, v) { this.filters.push((r) => r[k] === v); return this; }
  ilike(k, v) { this.filters.push((r) => String(r[k] || '').toLowerCase() === String(v).toLowerCase()); return this; }
  gte(k, v) { this.filters.push((r) => r[k] >= v); return this; }
  lte(k, v) { this.filters.push((r) => r[k] <= v); return this; }
  maybeSingle() { this.mode = 'one'; return this; } single() { this.mode = 'one'; return this; }
  insert(row) { this.inserted = row; return this; }
  then(resolve, reject) {
    return Promise.resolve().then(() => {
      if (this.inserted) {
        if (this.table === 'poliedron_action_claims') {
          if (claims.has(this.inserted.id)) return { error: { code: '23505' } };
          claims.add(this.inserted.id);
        }
        return { data: null, error: null };
      }
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
          ? 'export const serve = h => globalThis.__pazHandler(h);'
          : 'export const createClient = (...a) => globalThis.__pazClient(...a);',
        loader: 'js',
      }));
    } }],
  });
  globalThis.__pazHandler = (h) => { handler = h; };
  globalThis.Deno = { env: { get: (k) => (k === 'SUPABASE_SERVICE_ROLE_KEY' ? 'test-only-signing-secret' : 'test') } };
  globalThis.__pazClient = () => ({
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from: (t) => new Query(t),
    rpc: async (name, args) => {
      rpcCalls.push({ name, args });
      if (claims.has(args.p_id)) return { error: { message: 'duplicate key value violates unique constraint' } };
      claims.add(args.p_id);
      return { data: 500, error: null };
    },
  });
  globalThis.fetch = async (_url, options) => {
    calls.push(JSON.parse(options.body));
    const next = script.shift();
    assert.ok(next, 'unexpected provider request');
    return { ok: true, json: async () => next };
  };
  await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
});

test.beforeEach(() => {
  script = []; calls = []; rpcCalls = []; claims = new Set(); plan = 'premium'; autonomia = 'completo';
  user = { id: 'u1', app_metadata: { studio_id: 's1' } };
  database = {
    studio_users: [{ user_id: 'u1', studio_id: 's1', stato: 'attivo' }],
    patients: [{ id: 1, nome: 'Mario', cognome: 'Rossi', studio_id: 's1', telefono: null, email: null, consenso_whatsapp: false }],
    appointments: [], impegni_personali: [], richiami: [],
  };
});
async function request(body) {
  const response = await handler(new Request('https://local.test', { method: 'POST', headers: { Authorization: 'Bearer test' }, body: JSON.stringify(body) }));
  return { status: response.status, ...await response.json() };
}
const toolNames = (i = 0) => calls[i].tools.map((t) => t.name);

test('patient update: lookup → executed directly, one RPC with only the changed fields, before/after summary', async () => {
  script.push(use('cerca_pazienti', { query: 'Mario Rossi' }), use('modifica_paziente', { paziente_id: 1, telefono: '333 1112222', consenso_whatsapp: true }));
  const done = await request({ messages: [{ role: 'user', content: 'Mario Rossi ha dato il consenso WhatsApp, il suo numero è 333 1112222' }] });
  assert.equal(done.needsConfirmation, undefined);
  assert.match(done.text, /^Fatto\. Scheda di Mario Rossi aggiornata/);
  assert.match(done.text, /Telefono: — → 333 1112222/);
  assert.match(done.text, /Consenso WhatsApp: no → sì/);
  assert.deepEqual(done.changed, ['patients']);
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].name, 'poliedron_execute_pazienti_v1');
  assert.equal(rpcCalls[0].args.p_azione, 'modifica_paziente');
  assert.deepEqual(rpcCalls[0].args.p_dati, { paziente_id: 1, telefono: '333 1112222', consenso_whatsapp: true });
  assert.deepEqual(rpcCalls[0].args.p_before, { telefono: null, consenso_whatsapp: false });
  assert.equal(calls.length, 2, 'no model call after the write');
});

test('several clear actions in one message are all executed, each by its own atomic RPC', async () => {
  script.push(
    use('cerca_pazienti', { query: 'Mario Rossi' }),
    { content: [
      { type: 'tool_use', id: 'a', name: 'aggiungi_nota_paziente', input: { paziente_id: 1, testo: 'Allergico alla penicillina' } },
      { type: 'tool_use', id: 'b', name: 'crea_richiamo', input: { paziente_id: 1, data_scadenza: '2099-04-01', motivo: 'Igiene' } },
    ] },
  );
  const done = await request({ messages: [{ role: 'user', content: 'Nota allergia penicillina a Mario Rossi e richiamo igiene ad aprile 2099' }] });
  assert.equal(rpcCalls.length, 2);
  assert.notEqual(rpcCalls[0].args.p_id, rpcCalls[1].args.p_id, 'each write has its own claim id');
  assert.match(done.text, /Nota aggiunta nella scheda di Mario Rossi[\s\S]*Richiamo creato per Mario Rossi/);
  assert.deepEqual(done.changed.sort(), ['patients', 'richiami']);
  assert.equal(calls.length, 2);
});

test('medio autonomy keeps the summary + confirmation before any write', async () => {
  autonomia = 'medio';
  script.push(use('cerca_pazienti', { query: 'Mario' }), use('aggiungi_nota_paziente', { paziente_id: 1, testo: 'Nota' }));
  const preview = await request({ messages: [{ role: 'user', content: 'Nota per Mario' }] });
  assert.ok(preview.needsConfirmation?.token);
  assert.equal(rpcCalls.length, 0);
  const done = await request({ confirm: { token: preview.needsConfirmation.token } });
  assert.match(done.text, /^Fatto\. Nota aggiunta/);
  assert.equal(rpcCalls.length, 1);
});

test('new patient: duplicate name is flagged in the summary, never silently created', async () => {
  script.push(use('cerca_pazienti', { query: 'Mario Rossi' }), use('crea_paziente', { nome: ' Mario ', cognome: 'Rossi', email: 'mario@example.test' }));
  const preview = await request({ messages: [{ role: 'user', content: 'Crea il paziente Mario Rossi' }] });
  assert.match(preview.needsConfirmation.summary, /Nuovo paziente\nMario Rossi/);
  assert.match(preview.needsConfirmation.summary, /c'è già un paziente Mario Rossi/);
  assert.match(preview.text, /Vuoi crearlo comunque\?/);
  assert.equal(rpcCalls.length, 0, 'a possible duplicate is never created without the user deciding');
  const cancel = await request({ confirm: { token: preview.needsConfirmation.token, cancelled: true } });
  assert.match(cancel.text, /Nessuna modifica/);
  assert.equal(rpcCalls.length, 0);
});

test('a patient id the model did not look up is refused; invalid data never reaches the database', async () => {
  script.push(
    use('aggiungi_nota_paziente', { paziente_id: 1, testo: 'Nota' }),
    use('cerca_pazienti', { query: 'Mario' }),
    use('crea_richiamo', { paziente_id: 1, data_scadenza: '2000-01-01' }),
    say('Mi serve una data futura per il richiamo.'),
  );
  const result = await request({ messages: [{ role: 'user', content: 'Nota e richiamo per Mario' }] });
  assert.equal(result.needsConfirmation, undefined);
  assert.match(JSON.parse(calls[1].messages.at(-1).content[0].content).error, /Cerca prima il paziente/);
  assert.match(JSON.parse(calls[3].messages.at(-1).content[0].content).error, /passata/);
  assert.equal(rpcCalls.length, 0);
});

test('plan and autonomy gates: pro and consulente get no patient writes; premium gets all of them', async () => {
  for (const [p, a, expectWrites] of [['pro', 'completo', false], ['premium', 'consulente', false], ['premium', 'completo', true]]) {
    plan = p; autonomia = a; calls = [];
    script.push(say('ok'));
    await request({ messages: [{ role: 'user', content: 'ciao' }] });
    const names = toolNames();
    assert.ok(names.includes('scheda_paziente'), `${p}/${a}: scheda_paziente readable`);
    for (const w of ['crea_paziente', 'modifica_paziente', 'aggiungi_nota_paziente', 'crea_richiamo', 'crea_promemoria', 'crea_impegno_personale']) {
      assert.equal(names.includes(w), expectWrites, `${p}/${a}: ${w}`);
    }
    assert.ok(!names.includes('registra_pagamento') && !names.includes('compila_ricetta_medica'), 'payments/documents not in this step');
  }
});

test('a patient confirmation issued before a downgrade writes nothing afterwards', async () => {
  autonomia = 'medio';
  script.push(use('cerca_pazienti', { query: 'Mario' }), use('crea_promemoria', { testo: 'Chiamare Mario', paziente_id: 1 }));
  const preview = await request({ messages: [{ role: 'user', content: 'Ricordami di chiamare Mario' }] });
  assert.match(preview.needsConfirmation.summary, /Nuova attività: Chiamare Mario\nPaziente: Mario Rossi/);
  plan = 'pro';
  const done = await request({ confirm: { token: preview.needsConfirmation.token } });
  assert.match(done.text, /Nessuna modifica eseguita/);
  assert.equal(rpcCalls.length, 0);
});
