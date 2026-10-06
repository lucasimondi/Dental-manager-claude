// POL-AI-010 passo 4b: preventivi e piani di cura dalla chat di Poliedron,
// sempre con conferma. The real Edge handler, external services replaced
// with synthetic data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

import { rilevaRichiamo as rilevaServer, addMesi as addMesiServer, costruisciVoci } from '../supabase/functions/agente-assistente/piani.js';
import { rilevaRichiamo as rilevaApp, addMesi as addMesiApp } from '../src/lib/utils.js';
import { processQuery } from '../src/lib/poliedron/poliedraCore.js';
import { etichettaAttivita, puoRipristinare } from '../src/lib/poliedron/attivita.js';

let handler, script, calls, database, user, plan, autonomia, claims, writes;
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
class Query {
  constructor(table) { this.table = table; this.filters = []; this.mode = 'many'; }
  select() { return this; } order() { return this; } limit() { return this; } or() { return this; }
  eq(k, v) {
    this.filters.push((r) => (typeof v === 'string' && typeof r[k] === 'object' && r[k] !== null ? sameJson(r[k], JSON.parse(v)) : r[k] === v));
    return this;
  }
  is(k, v) { this.filters.push((r) => (r[k] ?? null) === v); return this; }
  ilike(k, v) { this.filters.push((r) => String(r[k] || '').toLowerCase() === String(v).toLowerCase()); return this; }
  gte(k, v) { this.filters.push((r) => r[k] >= v); return this; }
  lte(k, v) { this.filters.push((r) => r[k] <= v); return this; }
  maybeSingle() { this.mode = 'one'; return this; } single() { this.mode = 'one'; return this; }
  insert(row) { this.inserted = row; return this; }
  update(row) { this.updated = row; return this; }
  then(resolve, reject) {
    return Promise.resolve().then(() => {
      if (this.inserted) {
        writes.push({ table: this.table, op: 'insert', row: this.inserted });
        if (this.table === 'poliedron_action_claims') {
          if (claims.has(this.inserted.id)) return { error: { code: '23505' } };
          claims.add(this.inserted.id);
        }
        if (this.table === 'plans') {
          database.plans.push({ ...this.inserted });
          return { data: this.inserted, error: null };
        }
        return { data: null, error: null };
      }
      let rows = this.table === 'studios'
        ? [{ id: 's1', nome: 'Studio test', feature_overrides: { assistente_ai: plan, agente_azione: autonomia } }]
        : database[this.table] || [];
      rows = rows.filter((r) => this.filters.every((f) => f(r)));
      if (this.updated) {
        writes.push({ table: this.table, op: 'update', row: this.updated, matched: rows.length });
        for (const r of rows) Object.assign(r, structuredClone(this.updated));
      }
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
          ? 'export const serve = h => globalThis.__pianiHandler(h);'
          : 'export const createClient = (...a) => globalThis.__pianiClient(...a);',
        loader: 'js',
      }));
    } }],
  });
  globalThis.__pianiHandler = (h) => { handler = h; };
  globalThis.Deno = { env: { get: (k) => (k === 'SUPABASE_SERVICE_ROLE_KEY' ? 'test-only-signing-secret' : 'test') } };
  globalThis.__pianiClient = () => ({
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from: (t) => new Query(t),
    rpc: async () => ({ error: { message: 'no rpc expected for plans' } }),
  });
  globalThis.fetch = async (_url, options) => {
    calls.push(JSON.parse(options.body));
    const next = script.shift();
    assert.ok(next, 'unexpected provider request');
    return { ok: true, json: async () => next };
  };
  await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
});

const MARIO = { nome: 'Mario', cognome: 'Rossi' };
test.beforeEach(() => {
  script = []; calls = []; claims = new Set(); writes = []; plan = 'premium'; autonomia = 'completo';
  user = { id: 'u1', app_metadata: { studio_id: 's1' } };
  database = {
    studio_users: [{ user_id: 'u1', studio_id: 's1', stato: 'attivo' }],
    patients: [{ id: 1, ...MARIO, studio_id: 's1' }],
    pricelist: [
      { nome: 'Igiene orale professionale', prezzo: 80, studio_id: 's1' },
      { nome: 'Otturazione composito', prezzo: 120, studio_id: 's1' },
    ],
    plans: [{
      id: 10, paziente_id: 1, studio_id: 's1', titolo: 'Conservativa', data: '2026-09-01', stato: 'attivo', sconto: 0, sconto_tipo: 'pct',
      voci: [
        { prestazione: 'Otturazione composito', dente: '36', prezzo: 120, eseguita: true, incassata: false, dataEsec: '2026-09-10' },
        { prestazione: 'Igiene orale professionale', dente: '', prezzo: 80, eseguita: false, incassata: false },
      ],
      patients: MARIO,
    }],
    payments: [], richiami: [], appointments: [], impegni_personali: [],
  };
});
async function request(body) {
  const response = await handler(new Request('https://local.test', { method: 'POST', headers: { Authorization: 'Bearer test' }, body: JSON.stringify(body) }));
  return { status: response.status, ...await response.json() };
}
const planWrites = () => writes.filter((w) => w.table === 'plans');
const toolError = (i) => JSON.parse(calls[i].messages.at(-1).content.at(-1).content).error;
const oggi = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date());

test('recall detection and dates are the same as the app', () => {
  for (const nome of ['Igiene orale professionale', 'Impianto 36', 'Implantologia', 'Otturazione', '', null]) {
    assert.deepEqual(rilevaServer(nome), rilevaApp(nome), String(nome));
  }
  assert.equal(addMesiServer('2026-10-06', 6), addMesiApp('2026-10-06', 6));
  assert.equal(addMesiServer('2026-01-15', 3), addMesiApp('2026-01-15', 3));
});

test('plan items: listino name and price, one item per tooth, unknown prices are asked', () => {
  const listino = database.pricelist;
  assert.deepEqual(costruisciVoci([{ prestazione: 'otturazione COMPOSITO', dente: 36 }, { prestazione: 'Igiene orale professionale', prezzo: 70 }], listino), [
    { prestazione: 'Otturazione composito', dente: '36', prezzo: 120, eseguita: false, incassata: false },
    { prestazione: 'Igiene orale professionale', dente: '', prezzo: 70, eseguita: false, incassata: false },
  ]);
  assert.throws(() => costruisciVoci([{ prestazione: 'Faccetta' }], listino), /non è nel listino/);
  assert.throws(() => costruisciVoci([{ prestazione: 'Otturazione composito', prezzo: -1 }], listino), /Prezzo non valido/);
  assert.throws(() => costruisciVoci([], listino), /almeno una/);
});

test('new plan: summary first, written only after "Conferma", same shape as the app form', async () => {
  script.push(use('cerca_pazienti', { query: 'Mario Rossi' }), use('crea_piano_cura', {
    paziente_id: 1, titolo: 'Riabilitazione', voci: [{ prestazione: 'Otturazione composito', dente: '46' }, { prestazione: 'Igiene orale professionale' }], sconto: 10,
  }));
  const preview = await request({ messages: [{ role: 'user', content: 'Fai un preventivo a Mario Rossi: otturazione sul 46 e igiene, sconto 10%' }] });
  assert.ok(preview.needsConfirmation?.token, 'never written directly, even with full autonomy');
  assert.match(preview.needsConfirmation.summary, /^Nuovo piano di cura\nPaziente: Mario Rossi\nTitolo: Riabilitazione\n1\. Otturazione composito \(dente 46\) — 120,00\s€\n2\. Igiene orale professionale — 80,00\s€\nTotale prestazioni: 200,00\s€\nSconto: 10%\nStato: in attesa$/);
  assert.equal(planWrites().length, 0);

  const done = await request({ confirm: { token: preview.needsConfirmation.token } });
  assert.match(done.text, /^Fatto\. Piano di cura creato\nPaziente: Mario Rossi/);
  assert.deepEqual(done.changed, ['plans']);
  const order = writes.map((w) => w.table);
  assert.ok(order.indexOf('poliedron_action_claims') < order.indexOf('plans'), 'claim before the write');
  const { row } = planWrites()[0];
  assert.ok(Number.isSafeInteger(row.id));
  assert.deepEqual({ ...row, id: undefined }, {
    id: undefined, paziente_id: 1, titolo: 'Riabilitazione', data: oggi, stato: 'attivo', sconto: 10, sconto_tipo: 'pct', studio_id: 's1', user_id: 'u1',
    voci: [
      { prestazione: 'Otturazione composito', dente: '46', prezzo: 120, eseguita: false, incassata: false },
      { prestazione: 'Igiene orale professionale', dente: '', prezzo: 80, eseguita: false, incassata: false },
    ],
  });
  const log = writes.find((w) => w.table === 'poliedron_attivita').row;
  assert.equal(log.azione, 'crea_piano_cura');
  assert.equal(log.tabella, null);

  const replay = await request({ confirm: { token: preview.needsConfirmation.token } });
  assert.match(replay.text, /già stata usata/);
  assert.equal(planWrites().length, 1);
});

test('a plan with the same title is flagged; a cancelled summary writes nothing', async () => {
  script.push(use('cerca_pazienti', { query: 'Mario' }), use('crea_piano_cura', { paziente_id: 1, titolo: 'conservativa', voci: [{ prestazione: 'Otturazione composito' }] }));
  const preview = await request({ messages: [{ role: 'user', content: 'Preventivo conservativa per Mario' }] });
  assert.match(preview.needsConfirmation.summary, /ha già un piano "Conservativa"/);
  assert.match(preview.text, /Vuoi procedere comunque\?/);
  const cancel = await request({ confirm: { token: preview.needsConfirmation.token, cancelled: true } });
  assert.match(cancel.text, /Nessuna modifica/);
  assert.equal(planWrites().length, 0);
});

test('accept a plan: only the state changes, and only if nobody changed it meanwhile', async () => {
  script.push(use('cerca_pazienti', { query: 'Mario' }), use('storico_paziente', { paziente_id: 1 }), use('aggiorna_stato_piano', { piano_id: 10, stato: 'accettato' }));
  const preview = await request({ messages: [{ role: 'user', content: 'Mario Rossi ha accettato il preventivo' }] });
  assert.match(preview.needsConfirmation.summary, /Piano: Conservativa\nStato: in attesa → accettato/);
  const done = await request({ confirm: { token: preview.needsConfirmation.token } });
  assert.match(done.text, /^Fatto\. Piano di cura aggiornato/);
  const [update] = planWrites().filter((w) => w.op === 'update');
  assert.deepEqual(update.row, { stato: 'accettato' });
  assert.equal(database.plans[0].stato, 'accettato');

  // Changed in the app between summary and confirmation → nothing written.
  script.push(use('cerca_pazienti', { query: 'Mario' }), use('storico_paziente', { paziente_id: 1 }), use('aggiorna_stato_piano', { piano_id: 10, stato: 'rifiutato' }));
  const second = await request({ messages: [{ role: 'user', content: 'Anzi, non lo accetta' }] });
  database.plans[0].stato = 'attivo';
  const stale = await request({ confirm: { token: second.needsConfirmation.token } });
  assert.match(stale.text, /modificato nel frattempo/);
  assert.equal(database.plans[0].stato, 'attivo');
});

test('executed item: today, recall as in the app, other items untouched, never twice', async () => {
  script.push(use('cerca_pazienti', { query: 'Mario' }), use('storico_paziente', { paziente_id: 1 }), use('segna_prestazione_eseguita', { piano_id: 10, voce: 2, prestazione: 'igiene' }));
  const preview = await request({ messages: [{ role: 'user', content: "Segna eseguita l'igiene di Mario Rossi" }] });
  assert.match(preview.needsConfirmation.summary, /Prestazione: Igiene orale professionale\nEseguita il: .+\nRichiamo: Igiene orale entro il .+\nNon si potrà annullare dalla chat\./);
  const prima = structuredClone(database.plans[0].voci);
  await request({ confirm: { token: preview.needsConfirmation.token } });
  const voci = database.plans[0].voci;
  assert.deepEqual(voci[0], prima[0], 'order and other items preserved (ledger lines are positional)');
  assert.deepEqual(voci[1], { ...prima[1], eseguita: true, dataEsec: oggi, richiamoTipo: 'Igiene orale', richiamoData: addMesiApp(oggi, 6) });

  calls = [];
  script.push(
    use('cerca_pazienti', { query: 'Mario' }), use('storico_paziente', { paziente_id: 1 }),
    use('segna_prestazione_eseguita', { piano_id: 10, voce: 2, prestazione: 'Igiene orale professionale' }),
    use('segna_prestazione_eseguita', { piano_id: 10, voce: 1, prestazione: 'Igiene' }),
    say('Risulta già eseguita.'),
  );
  await request({ messages: [{ role: 'user', content: "Segna di nuovo l'igiene" }] });
  assert.match(toolError(3), /già eseguita/);
  assert.match(toolError(4), /c'è "Otturazione composito"/);
});

test('plan ids the model did not read are refused; gates follow plan and autonomy', async () => {
  script.push(use('aggiorna_stato_piano', { piano_id: 10, stato: 'accettato' }), say('Prima cerco il piano.'));
  await request({ messages: [{ role: 'user', content: 'Accetta il piano 10' }] });
  assert.match(toolError(1), /storico_paziente/);
  assert.equal(planWrites().length, 0);

  for (const [p, a, expected] of [['pro', 'completo', false], ['premium', 'consulente', false], ['premium', 'medio', true], ['premium', 'completo', true]]) {
    plan = p; autonomia = a; calls = [];
    script.push(say('ok'));
    await request({ messages: [{ role: 'user', content: 'ciao' }] });
    const names = calls[0].tools.map((t) => t.name);
    for (const w of ['crea_piano_cura', 'aggiorna_stato_piano', 'segna_prestazione_eseguita']) assert.equal(names.includes(w), expected, `${p}/${a}: ${w}`);
    assert.ok(!names.includes('crea_proposta_commerciale'), 'legacy direct plan write stays hidden');
  }
});

test('chat routing: plan phrases go to Poliedron when it may write; otherwise the "Nuovo piano" form', async () => {
  let invoked = 0;
  const supabaseClient = { functions: { invoke: async () => { invoked++; return { data: { text: 'Riepilogo', needsConfirmation: { token: 't', summary: 'Nuovo piano di cura' } }, error: null }; } } };
  const premium = { features: { assistente_ai: 'premium' } };
  for (const query of ['Crea un piano di cura per Mario Rossi', 'Fai un preventivo a Mario Rossi per due otturazioni', 'Mario Rossi ha accettato il preventivo', "Segna eseguita l'igiene di Mario Rossi"]) {
    const result = await processQuery({ query, context: premium, supabaseClient });
    assert.equal(result.intent, 'AGENT', query);
    assert.equal(result.modelConfirmation.token, 't');
  }
  assert.equal(invoked, 4);
  const consulente = await processQuery({ query: 'Crea un piano di cura per Mario Rossi', context: { features: { assistente_ai: 'premium', agente_azione: 'consulente' } }, supabaseClient });
  assert.notEqual(consulente.intent, 'AGENT');
  assert.equal(invoked, 4);
});

test('app wiring: plans are refreshed after a write and labelled (not undoable) in the activity log', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const controller = readFileSync(new URL('../src/components/poliedron/Poliedron.jsx', import.meta.url), 'utf8');
  assert.match(app, /plans: \['dm_pl', setPlans\]/);
  assert.match(controller, /'payments', 'plans'\]/);
  for (const [azione, label] of [['crea_piano_cura', 'Piano di cura creato'], ['aggiorna_stato_piano', 'Piano di cura aggiornato'], ['segna_prestazione_eseguita', 'Prestazione eseguita']]) {
    assert.equal(etichettaAttivita(azione), label);
    assert.equal(puoRipristinare({ id: 'x', azione }, new Set()), false);
  }
});
