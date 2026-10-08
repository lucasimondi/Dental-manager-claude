// POL-AI-010 passo 4a: pagamenti dalla chat di Poliedron, sempre con conferma.
// The real Edge handler, external services replaced with synthetic data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

import { normalizzaImporto, scegliPiano, nuovoIdPagamento } from '../supabase/functions/agente-assistente/pagamenti.js';
import { processQuery, agentCanWrite } from '../src/lib/poliedron/poliedraCore.js';
import { etichettaAttivita, puoRipristinare } from '../src/lib/poliedron/attivita.js';

let handler, script, calls, database, user, plan, autonomia, claims, inserts;
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
        inserts.push({ table: this.table, row: this.inserted });
        if (this.table === 'poliedron_action_claims') {
          if (claims.has(this.inserted.id)) return { error: { code: '23505' } };
          claims.add(this.inserted.id);
        }
        if (this.table === 'payments') {
          (database.payments ||= []).push(this.inserted);
          return { data: this.inserted, error: null };
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
    rpc: async () => ({ error: { message: 'no rpc expected for payments' } }),
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
  script = []; calls = []; claims = new Set(); inserts = []; plan = 'premium'; autonomia = 'completo';
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
    payments: [], appointments: [], impegni_personali: [], richiami: [],
  };
});
async function request(body) {
  const response = await handler(new Request('https://local.test', { method: 'POST', headers: { Authorization: 'Bearer test' }, body: JSON.stringify(body) }));
  return { status: response.status, ...await response.json() };
}
const toolNames = (i = 0) => calls[i].tools.map((t) => t.name);
const paymentRows = () => inserts.filter((i) => i.table === 'payments');
const toolError = (i) => JSON.parse(calls[i].messages.at(-1).content.at(-1).content).error;

test('amounts: Italian and plain formats, never zero, negative or absurd', () => {
  assert.equal(normalizzaImporto('1.234,50'), 1234.5);
  assert.equal(normalizzaImporto('12.5'), 12.5);
  assert.equal(normalizzaImporto('€ 200'), 200);
  assert.equal(normalizzaImporto(99.999), 100);
  for (const bad of [0, -5, 'abc', null, 2_000_000]) assert.throws(() => normalizzaImporto(bad), /Importo/);
  const id = nuovoIdPagamento();
  assert.ok(Number.isSafeInteger(id) && id > 1_700_000_000_000);
});

test('plan link follows the app rule: one open plan auto, several → ask, none → null', () => {
  const piani = database.plans;
  assert.equal(scegliPiano(piani.filter((p) => p.paziente_id === 1)).id, 10);
  assert.throws(() => scegliPiano(piani.filter((p) => p.paziente_id === 2)), /più piani di cura aperti[\s\S]*piano_id 20[\s\S]*piano_id 21/);
  assert.equal(scegliPiano(piani.filter((p) => p.paziente_id === 2), 21).id, 21);
  assert.throws(() => scegliPiano(piani.filter((p) => p.paziente_id === 1), 11), /concluso/);
  assert.throws(() => scegliPiano(piani.filter((p) => p.paziente_id === 1), 20), /non è di questo paziente/);
  assert.equal(scegliPiano([]), null);
});

test('clear payment executes directly under full Safe Autonomy, with claim before insert', async () => {
  script.push(use('cerca_pazienti', { query: 'Mario Rossi' }), use('registra_pagamento_paziente', { paziente_id: 1, importo: 150, metodo: 'Carta', nota: 'Acconto impianto' }));
  const done = await request({ messages: [{ role: 'user', content: 'Mario Rossi ha pagato 150 euro con carta' }] });
  assert.equal(done.needsConfirmation, undefined);
  assert.ok(paymentRows().length === 1, 'clear payment is written directly');
  const order = inserts.map((i) => i.table);
  assert.ok(order.indexOf('poliedron_action_claims') < order.indexOf('payments'), 'claim before the write');
  assert.equal(paymentRows().length, 1);
  // The executed write is reported as done (not as an error after the insert),
  // logged in the activity register and refreshed in the app.
  assert.match(done.text, /^Fatto\. Pagamento registrato/);
  assert.equal(calls.length, 2, 'no extra model turn after a successful write');
  assert.deepEqual(done.changed, ['payments']);
  const log = inserts.filter((i) => i.table === 'poliedron_attivita');
  assert.equal(log.length, 1);
  assert.equal(log[0].row.azione, 'registra_pagamento_paziente');
});

test('several open plans: the agent must ask which one; nothing is proposed by guessing', async () => {
  script.push(
    use('cerca_pazienti', { query: 'Anna Verdi' }),
    use('registra_pagamento_paziente', { paziente_id: 2, importo: '80,00' }),
    say('Anna Verdi ha due piani aperti: Ortodonzia o Conservativa?'),
  );
  const result = await request({ messages: [{ role: 'user', content: 'Registra un pagamento di 80 euro per Anna Verdi' }] });
  assert.equal(result.needsConfirmation, undefined);
  assert.match(toolError(2), /più piani di cura aperti/);
  assert.equal(paymentRows().length, 0);
});

test('a same-day duplicate is flagged; a cancelled summary writes nothing', async () => {
  database.payments.push({ id: 5, paziente_id: 1, studio_id: 's1', importo: 150, data: new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date()) });
  script.push(use('cerca_pazienti', { query: 'Mario' }), use('registra_pagamento_paziente', { paziente_id: 1, importo: 150 }));
  const preview = await request({ messages: [{ role: 'user', content: 'Mario ha pagato 150' }] });
  assert.match(preview.needsConfirmation.summary, /c'è già un pagamento di 150,00\s€ in questa data/);
  assert.match(preview.text, /Confermi comunque\?/);
  const cancel = await request({ confirm: { token: preview.needsConfirmation.token, cancelled: true } });
  assert.match(cancel.text, /Nessuna modifica/);
  assert.equal(paymentRows().length, 0);
});

test('invalid input and unknown patients never reach the database', async () => {
  script.push(
    use('registra_pagamento_paziente', { paziente_id: 1, importo: 50 }),
    use('cerca_pazienti', { query: 'Mario' }),
    use('registra_pagamento_paziente', { paziente_id: 1, importo: 50, data: '2999-01-01' }),
    use('registra_pagamento_paziente', { paziente_id: 1, importo: -3 }),
    use('registra_pagamento_paziente', { paziente_id: 1, importo: 50, metodo: 'Bitcoin' }),
    say('Mi servono dati validi.'),
  );
  await request({ messages: [{ role: 'user', content: 'Mario ha pagato' }] });
  assert.match(toolError(1), /Cerca prima il paziente/);
  assert.match(toolError(3), /futuro/);
  assert.match(toolError(4), /Importo non valido/);
  assert.match(toolError(5), /Metodo non valido/);
  assert.equal(paymentRows().length, 0);
});

test('gates: pro and consulente never get the payment tool; a downgrade voids a pending confirmation', async () => {
  for (const [p, a, expected] of [['pro', 'completo', false], ['premium', 'consulente', false], ['premium', 'medio', true], ['premium', 'completo', true]]) {
    plan = p; autonomia = a; calls = [];
    script.push(say('ok'));
    await request({ messages: [{ role: 'user', content: 'ciao' }] });
    assert.equal(toolNames().includes('registra_pagamento_paziente'), expected, `${p}/${a}`);
  }
  plan = 'premium'; autonomia = 'completo';
  database.payments.push({ id: 77, paziente_id: 1, studio_id: 's1', importo: 40, data: new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date()) });
  script.push(use('cerca_pazienti', { query: 'Mario' }), use('registra_pagamento_paziente', { paziente_id: 1, importo: 40 }));
  const preview = await request({ messages: [{ role: 'user', content: 'Mario ha pagato 40' }] });
  assert.ok(preview.needsConfirmation?.token);
  plan = 'pro';
  const done = await request({ confirm: { token: preview.needsConfirmation.token } });
  assert.match(done.text, /Nessuna modifica eseguita/);
  assert.equal(paymentRows().length, 0);
});

test('chat routing: payment phrases go to Poliedron only when the agent may write; otherwise the form', async () => {
  let invoked = 0;
  const supabaseClient = { functions: { invoke: async () => { invoked++; return { data: { text: 'Controlla il riepilogo', needsConfirmation: { token: 't', summary: 'Registra pagamento' } }, error: null }; } } };
  const premium = { features: { assistente_ai: 'premium' } };
  assert.equal(agentCanWrite(premium), true);
  for (const query of ['Registra un pagamento di 100 euro per Mario Rossi', 'Mario Rossi ha pagato 120 euro con carta', 'Segna un incasso di 350€ per Maria Bianchi']) {
    const result = await processQuery({ query, context: premium, supabaseClient });
    assert.equal(result.intent, 'AGENT', query);
    assert.equal(result.modelConfirmation.token, 't');
  }
  assert.equal(invoked, 3);
  // Consulente keeps the "Registra incasso" form; keystroke previews never call the model.
  const consulente = await processQuery({ query: 'Registra un pagamento di 100 euro per Mario Rossi', context: { features: { assistente_ai: 'premium', agente_azione: 'consulente' } }, supabaseClient, allowModel: false });
  assert.notEqual(consulente.intent, 'AGENT');
  await processQuery({ query: 'Registra un pagamento di 100 euro per Mario Rossi', context: premium, supabaseClient, allowModel: false });
  assert.equal(invoked, 3);
});

test('app wiring: payments are refreshed after a write and labelled (not undoable) in the activity log', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const controller = readFileSync(new URL('../src/components/poliedron/Poliedron.jsx', import.meta.url), 'utf8');
  assert.match(app, /payments: \['dm_py', setPayments\]/);
  assert.match(controller, /'impegni_personali', 'payments'\]/);
  assert.equal(etichettaAttivita('registra_pagamento_paziente'), 'Pagamento registrato');
  assert.equal(puoRipristinare({ id: 'x', azione: 'registra_pagamento_paziente' }, new Set()), false);
});
