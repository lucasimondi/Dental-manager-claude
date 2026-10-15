// PO 2026-10-15: "Ora voglio che faccia i piani di cura ed i preventivi".
// "Preventivo per Mario Rossi: igiene, otturazione 36 e 37" → the Core creates
// the plan with the listino prices, no model call. Runs the real Edge handler
// (bundled with esbuild) on synthetic data; any model request fails the test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { parsePlanCreate, matchListino, vociDaListino, titoloPiano } from '../supabase/functions/agente-assistente/poliedron-piani.js';
import { processQuery } from '../src/lib/poliedron/poliedraCore.js';

let handler, script, calls, database, user, autonomia, inserts;

class Query {
  constructor(table) { this.table = table; this.filters = []; this.mode = 'many'; }
  select() { return this; } order() { return this; } limit() { return this; }
  or(expr) { const t = expr.match(/%([^%]+)%/)[1].toLowerCase(); this.filters.push((r) => `${r.nome} ${r.cognome}`.toLowerCase().includes(t)); return this; }
  eq(k, v) { this.filters.push((r) => r[k] === v); return this; }
  gte(k, v) { this.filters.push((r) => r[k] >= v); return this; }
  lte(k, v) { this.filters.push((r) => r[k] <= v); return this; }
  maybeSingle() { this.mode = 'one'; return this; } single() { this.mode = 'one'; return this; }
  insert(row) { this.inserted = row; inserts.push({ table: this.table, row }); return this; }
  update(row) { this.updated = row; return this; }
  then(resolve, reject) {
    return Promise.resolve().then(() => {
      if (this.inserted) return { data: this.mode === 'one' ? { id: this.inserted.id ?? 1, ...this.inserted } : null, error: null };
      let rows = this.table === 'studios' ? [{ id: 's1', nome: 'Studio test', feature_overrides: { assistente_ai: 'premium', agente_azione: autonomia } }] : database[this.table] || [];
      rows = rows.filter((r) => this.filters.every((f) => f(r)));
      return { data: this.mode === 'one' ? rows[0] || null : rows, error: null };
    }).then(resolve, reject);
  }
}

test.before(async () => {
  const bundled = await build({ entryPoints: [fileURLToPath(new URL('../supabase/functions/agente-assistente/index.ts', import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'neutral', plugins: [{ name: 'fakes', setup(b) {
    b.onResolve({ filter: /^https:\/\// }, (a) => ({ path: a.path, namespace: 'fake' }));
    b.onLoad({ filter: /.*/, namespace: 'fake' }, (a) => ({ contents: a.path.includes('server.ts') ? 'export const serve = h => globalThis.__pianiHandler(h);' : 'export const createClient = (...a) => globalThis.__pianiClient(...a);', loader: 'js' }));
  } }] });
  globalThis.__pianiHandler = (h) => handler = h;
  globalThis.Deno = { env: { get: (k) => k === 'SUPABASE_SERVICE_ROLE_KEY' ? 'test-only-signing-secret' : 'test' } };
  globalThis.__pianiClient = () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) }, from: (t) => new Query(t), rpc: async () => ({ data: null, error: null }) });
  globalThis.fetch = async (_url, options) => { calls.push(JSON.parse(options.body)); const next = script.shift(); assert.ok(next, 'unexpected model request'); return { ok: true, json: async () => next }; };
  await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
});

const LISTINO = [
  { nome: 'Igiene orale professionale', prezzo: 80 }, { nome: 'Otturazione composita', prezzo: 120 },
  { nome: 'Corona in zirconio', prezzo: 650 }, { nome: 'Corona in metallo ceramica', prezzo: 550 },
  { nome: 'Impianto', prezzo: 1200 }, { nome: 'Devitalizzazione monoradicolare', prezzo: 250 }, { nome: 'Devitalizzazione pluriradicolare', prezzo: 350 },
];
test.beforeEach(() => {
  script = []; calls = []; inserts = []; autonomia = 'completo'; user = { id: 'u1', app_metadata: { studio_id: 's1' } };
  database = { studio_users: [{ user_id: 'u1', studio_id: 's1', stato: 'attivo' }], patients: [{ id: 1, nome: 'Mario', cognome: 'Rossi', studio_id: 's1' }], pricelist: [...LISTINO, ...LISTINO].map((r) => ({ ...r, studio_id: 's1' })).concat([{ nome: 'Ablazione tartaro', prezzo: 50, studio_id: 's2' }]), plans: [], appointments: [], impegni_personali: [] };
});
async function ask(content) {
  const response = await handler(new Request('https://local.test', { method: 'POST', headers: { Authorization: 'Bearer test' }, body: JSON.stringify({ messages: [{ role: 'user', content }] }) }));
  return response.json();
}
const planInsert = () => inserts.filter((i) => i.table === 'plans');

test('PO case: a preventivo with listino prices and teeth is created at once, no model call', async () => {
  const out = await ask('Preventivo per Mario Rossi: igiene, otturazione 36 e 37, corona zirconio 46');
  assert.equal(calls.length, 0, 'no model call');
  assert.equal(planInsert().length, 1);
  const row = planInsert()[0].row;
  assert.equal(row.paziente_id, 1);
  assert.equal(row.studio_id, 's1');
  assert.deepEqual(row.voci.map((v) => [v.prestazione, v.dente, v.prezzo]), [
    ['Igiene orale professionale', '', 80], ['Otturazione composita', '36', 120], ['Otturazione composita', '37', 120], ['Corona in zirconio', '46', 650],
  ]);
  assert.match(out.text, /^Fatto\. Piano di cura creato\nPaziente: Mario Rossi/);
  assert.match(out.text, /Totale: 970,00\s€/);
  assert.deepEqual(out.changed, ['plans']);
});

test('ambiguous or unknown items ask, nothing written', async () => {
  let out = await ask('Preventivo per Mario Rossi: corona 46');
  assert.equal(planInsert().length, 0);
  assert.match(out.text, /“corona”: nel listino ci sono Corona in zirconio, Corona in metallo ceramica\. Quale\?/);
  out = await ask('Preventivo per Mario Rossi: sbiancamento');
  assert.equal(planInsert().length, 0);
  assert.match(out.text, /“sbiancamento” non è nel listino: dimmi il prezzo/);
  assert.equal(calls.length, 0);
});

test('a price said in the sentence is used; quantities make one item each', async () => {
  await ask('Fai un piano di cura a Mario Rossi con 2 impianti e sbiancamento 300 euro');
  assert.equal(calls.length, 0);
  assert.deepEqual(planInsert()[0].row.voci.map((v) => [v.prestazione, v.prezzo]), [['Impianto', 1200], ['Impianto', 1200], ['Sbiancamento', 300]]);
});

test('"medio" autonomy and a same-named plan ask for confirmation before writing', async () => {
  autonomia = 'medio';
  let out = await ask('Preventivo per Mario Rossi: igiene');
  assert.equal(planInsert().length, 0);
  assert.ok(out.needsConfirmation?.token);
  assert.match(out.needsConfirmation.summary, /Crea piano di cura\nPaziente: Mario Rossi/);
  autonomia = 'completo';
  database.plans.push({ id: 5, studio_id: 's1', paziente_id: 1, titolo: 'Igiene orale professionale', data: '2026-10-01', stato: 'attivo' });
  out = await ask('Preventivo per Mario Rossi: igiene');
  assert.equal(planInsert().length, 0);
  assert.match(out.text, /ha già un piano chiamato “Igiene orale professionale”\. Confermi comunque\?/);
});

test('parser: what is and is not a plan command', () => {
  assert.equal(parsePlanCreate('Preventivo per Mario Rossi?'), null);
  assert.equal(parsePlanCreate('che preventivo ha Mario Rossi'), null);
  assert.equal(parsePlanCreate('Crea un piano per Mario Rossi'), null, 'no treatments: the form opens');
  assert.equal(parsePlanCreate('Crea un piano di cura per Mario Rossi'), null, '"di cura" is never the patient');
  const p = parsePlanCreate('Crea un preventivo per la paziente Anna Bianchi, igiene e devitalizzazione 36');
  assert.equal(p.intent, 'PLAN_CREATE');
  assert.equal(p.entities.patient_query, 'Anna Bianchi');
  assert.deepEqual(p.entities.voci.map((v) => [v.testo, v.denti]), [['igiene', []], ['devitalizzazione', ['36']]]);
  assert.equal(matchListino('impianti', LISTINO).voce.nome, 'Impianto');
  assert.equal(matchListino('devitalizzazione', LISTINO).candidati.length, 2);
  assert.equal(titoloPiano(vociDaListino([{ testo: 'igiene', denti: [], quantita: 2, prezzo: null }], LISTINO).voci), 'Igiene orale professionale');
});

test('app: a plan command with treatments goes to Poliedron; without treatments the form flow stays', async () => {
  let n = 0;
  const supabaseClient = { functions: { invoke: async () => { n++; return { data: { text: 'Fatto.' } }; } } };
  const context = { features: { assistente_ai: 'premium', agente_azione: 'completo' } };
  const r = await processQuery({ query: 'Preventivo per Mario Rossi: igiene, otturazione 36', supabaseClient, context });
  assert.equal(r.intent, 'AGENT');
  assert.equal(n, 1);
  const form = await processQuery({ query: 'Crea un piano per Mario Rossi', supabaseClient, context });
  assert.notEqual(form.intent, 'AGENT');
  assert.equal(n, 1);
});

test('real listino shape: duplicated rows merge, one name with two prices asks, "igiene" finds the hygiene entry', async () => {
  const L = [{ nome: 'Ablazione tartaro', prezzo: 50 }, { nome: 'Ablazione tartaro', prezzo: 50 }, { nome: 'Impianto osteointegrato', prezzo: 500 }, { nome: 'Impianto osteointegrato', prezzo: 800 }];
  const voci = (t) => vociDaListino(parsePlanCreate(`Preventivo per Mario Rossi: ${t}`).entities.voci, L);
  assert.deepEqual(voci('igiene').voci, [{ prestazione: 'Ablazione tartaro', prezzo: 50 }]);
  assert.match(voci('impianto osteointegrato 36').problemi[0], /ha più prezzi nel listino \(500 €, 800 €\)/);
  assert.deepEqual(voci('impianto osteointegrato 36 800 euro').voci, [{ prestazione: 'Impianto osteointegrato', prezzo: 800, dente: '36' }]);
});

test('only the own studio listino is read', async () => {
  database.pricelist = [{ nome: 'Ablazione tartaro', prezzo: 50, studio_id: 's2' }];
  const out = await ask('Preventivo per Mario Rossi: ablazione tartaro');
  assert.equal(planInsert().length, 0);
  assert.match(out.text, /non è nel listino/);
});
