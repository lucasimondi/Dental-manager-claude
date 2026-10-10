// POL-AI agenda actions: Poliedron books, moves and cancels appointments from
// plain Italian without the model. Runs the real Edge handler (bundled with
// esbuild) against synthetic data; any model request fails the test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { parseAppointmentChange, resolveDay } from '../supabase/functions/agente-assistente/poliedron-agenda.js';
import { understandPoliedron } from '../supabase/functions/agente-assistente/poliedron-core.js';
import { studioToday } from '../supabase/functions/agente-assistente/confirmation.js';
import { processQuery } from '../src/lib/poliedron/poliedraCore.js';

let handler, script, calls, database, user, autonomia, rpcCalls, inserts;
const plus = (n) => { const d = new Date(`${studioToday()}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const D1 = plus(1), D2 = plus(2);

class Query {
  constructor(table) { this.table = table; this.filters = []; this.mode = 'many'; }
  select() { return this; } order() { return this; } limit() { return this; }
  or(expr) { const t = expr.match(/%([^%]+)%/)[1].toLowerCase(); this.filters.push((r) => `${r.nome} ${r.cognome}`.toLowerCase().includes(t)); return this; }
  eq(k, v) { this.filters.push((r) => r[k] === v); return this; }
  gte(k, v) { this.filters.push((r) => r[k] >= v); return this; }
  lte(k, v) { this.filters.push((r) => r[k] <= v); return this; }
  maybeSingle() { this.mode = 'one'; return this; } single() { this.mode = 'one'; return this; }
  insert(row) { this.inserted = row; inserts.push({ table: this.table, row }); return this; }
  then(resolve, reject) {
    return Promise.resolve().then(() => {
      if (this.inserted) return { data: null, error: null };
      let rows = this.table === 'studios' ? [{ id: 's1', nome: 'Studio test', feature_overrides: { assistente_ai: 'premium', agente_azione: autonomia } }] : database[this.table] || [];
      rows = rows.filter((r) => this.filters.every((f) => f(r)));
      return { data: this.mode === 'one' ? rows[0] || null : rows, error: null };
    }).then(resolve, reject);
  }
}

test.before(async () => {
  const bundled = await build({ entryPoints: [fileURLToPath(new URL('../supabase/functions/agente-assistente/index.ts', import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'neutral', plugins: [{ name: 'fakes', setup(b) {
    b.onResolve({ filter: /^https:\/\// }, (a) => ({ path: a.path, namespace: 'fake' }));
    b.onLoad({ filter: /.*/, namespace: 'fake' }, (a) => ({ contents: a.path.includes('server.ts') ? 'export const serve = h => globalThis.__actionsHandler(h);' : 'export const createClient = (...a) => globalThis.__actionsClient(...a);', loader: 'js' }));
  } }] });
  globalThis.__actionsHandler = (h) => handler = h;
  globalThis.Deno = { env: { get: (k) => k === 'SUPABASE_SERVICE_ROLE_KEY' ? 'test-only-signing-secret' : 'test' } };
  globalThis.__actionsClient = () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) }, from: (t) => new Query(t), rpc: async (name, args) => { rpcCalls.push({ name, args }); return { data: args.p_after.id ?? 900, error: null }; } });
  globalThis.fetch = async (_url, options) => { calls.push(JSON.parse(options.body)); const next = script.shift(); assert.ok(next, 'unexpected model request'); return { ok: true, json: async () => next }; };
  await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
});

const patient = (id, nome, cognome) => ({ id, nome, cognome, studio_id: 's1' });
const appt = (id, paziente, data, ora, extra = {}) => ({ id, paziente_id: paziente.id, data, ora: `${ora}:00`, durata: 30, tipo: 'Controllo', stato: 'confermato', note: null, operatore_id: null, studio_id: 's1', patients: { nome: paziente.nome, cognome: paziente.cognome }, ...extra });
const mario = patient(1, 'Mario', 'Test');
test.beforeEach(() => {
  script = []; calls = []; rpcCalls = []; inserts = []; autonomia = 'completo'; user = { id: 'u1', app_metadata: { studio_id: 's1' } };
  database = { studio_users: [{ user_id: 'u1', studio_id: 's1', stato: 'attivo' }], patients: [mario], appointments: [appt(10, mario, D1, '09:00')], impegni_personali: [] };
});
async function ask(content) {
  const response = await handler(new Request('https://local.test', { method: 'POST', headers: { Authorization: 'Bearer test' }, body: JSON.stringify({ messages: [{ role: 'user', content }] }) }));
  return response.json();
}

test('move: "sposta … da domani alle 9 a dopodomani alle 11" executes directly, no model call, logged', async () => {
  const out = await ask('Sposta Mario Test da domani alle 9 a dopodomani alle 11');
  assert.equal(calls.length, 0);
  assert.equal(out.core_mode, true);
  assert.match(out.text, /^Fatto\. Appuntamento modificato\nPaziente: Mario Test/);
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].args.p_before.id, 10);
  assert.equal(rpcCalls[0].args.p_after.data, D2);
  assert.equal(rpcCalls[0].args.p_after.ora, '11:00');
  assert.equal(rpcCalls[0].args.p_after.tipo, 'Controllo', 'unchanged fields are kept');
  assert.deepEqual(out.changed, ['appointments', 'richiami']);
  const log = inserts.filter((i) => i.table === 'poliedron_attivita');
  assert.equal(log.length, 1); assert.equal(log[0].row.azione, 'modifica_appuntamento'); assert.equal(log[0].row.prima.id, 10);
});

test('move with only a new time keeps the day; "anticipa … alle 8" works', async () => {
  const out = await ask('Anticipa Mario Test alle 8');
  assert.equal(calls.length, 0);
  assert.equal(rpcCalls[0].args.p_after.data, D1);
  assert.equal(rpcCalls[0].args.p_after.ora, '08:00');
  assert.match(out.text, /^Fatto\./);
});

test('cancel: "cancella l\'appuntamento di Mario Test di domani" cancels (keeps history), no model call', async () => {
  const out = await ask("Cancella l'appuntamento di Mario Test di domani");
  assert.equal(calls.length, 0);
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].args.p_after.stato, 'annullato');
  assert.equal(rpcCalls[0].args.p_after.id, 10);
  assert.match(out.text, /Appuntamento annullato/);
});

test('cancel by exact slot without a name: "togli l\'appuntamento di domani alle 9"', async () => {
  await ask("Togli l'appuntamento di domani alle 9");
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].args.p_after.stato, 'annullato');
});

test('several candidates: lists them and asks, nothing written', async () => {
  database.appointments.push(appt(11, mario, D1, '16:00'));
  const out = await ask('Togli Mario Test da domani');
  assert.equal(rpcCalls.length, 0); assert.equal(calls.length, 0);
  assert.match(out.text, /Ho trovato 2 appuntamenti di Mario Test/);
  assert.match(out.text, /09:00/); assert.match(out.text, /16:00/);
  assert.match(out.text, /Quale intendi\?/);
});

test('homonyms are never guessed', async () => {
  database.patients.push(patient(2, 'Maria', 'Test'));
  const out = await ask('Cancella appuntamento di Test domani');
  assert.equal(rpcCalls.length, 0);
  assert.match(out.text, /più pazienti/);
});

test('cancelled appointments and missing ones are reported, not invented', async () => {
  database.appointments = [appt(10, mario, D1, '09:00', { stato: 'annullato' })];
  const out = await ask('Sposta Mario Test a dopodomani alle 10');
  assert.equal(rpcCalls.length, 0);
  assert.match(out.text, /Non trovo appuntamenti di Mario Test da oggi in poi/);
});

test('occupied destination: says who occupies it and proposes free times, nothing written', async () => {
  const anna = patient(3, 'Anna', 'Altra');
  database.patients.push(anna);
  database.appointments.push(appt(12, anna, D2, '11:00'));
  const out = await ask('Sposta Mario Test a dopodomani alle 11');
  assert.equal(rpcCalls.length, 0); assert.equal(calls.length, 0);
  assert.match(out.text, /Orario occupato: c'è già l'appuntamento di Anna Altra alle 11:00/);
  assert.match(out.text, /Orari liberi/);
});

test('booking without the word "appuntamento" executes directly (PR #162 parse, now executed)', async () => {
  const out = await ask('Fissa Mario Test domani alle 10 per igiene');
  assert.equal(calls.length, 0);
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].args.p_before, null);
  assert.equal(rpcCalls[0].args.p_after.paziente_id, 1);
  assert.equal(rpcCalls[0].args.p_after.data, D1);
  assert.equal(rpcCalls[0].args.p_after.tipo, 'igiene');
  assert.match(out.text, /^Fatto\. Appuntamento creato/);
});

test('PO case: "Fissa appuntamento Giulia simondi venerdì 16 ore 17" books a Visita directly', async () => {
  database.patients.push(patient(2, 'Giulia', 'Simondi'));
  const d = new Date(`${D2}T12:00:00Z`);
  const weekday = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'][d.getUTCDay()];
  const out = await ask(`Fissa appuntamento Giulia simondi ${weekday} ${d.getUTCDate()} ore 17`);
  assert.equal(calls.length, 0, 'no model call');
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].args.p_after.paziente_id, 2);
  assert.equal(rpcCalls[0].args.p_after.data, D2);
  assert.equal(rpcCalls[0].args.p_after.ora, '17:00');
  assert.equal(rpcCalls[0].args.p_after.tipo, 'Visita');
  assert.match(out.text, /^Fatto\. Appuntamento creato\nPaziente: Giulia Simondi/);
});

test('"medio" autonomy keeps the signed summary + confirmation', async () => {
  autonomia = 'medio';
  const out = await ask('Sposta Mario Test a dopodomani alle 10');
  assert.equal(rpcCalls.length, 0);
  assert.ok(out.needsConfirmation?.token);
  assert.match(out.needsConfirmation.summary, /Modifica appuntamento/);
});

test('"consulente" cannot write: the request goes to the model path, which has no write tools', async () => {
  autonomia = 'consulente';
  script.push({ content: [{ type: 'text', text: 'Non posso modificare l\'agenda.' }] });
  await ask('Sposta Mario Test a dopodomani alle 10');
  assert.equal(rpcCalls.length, 0);
  assert.equal(calls.length, 1);
  assert.ok(!calls[0].tools.some((t) => t.name === 'modifica_appuntamento'));
});

test('missing destination asks, two commands in one message go to the model', async () => {
  const out = await ask("Sposta l'appuntamento di Mario Test");
  assert.equal(out.text, 'A quando lo sposto? Dimmi giorno e/o ora.');
  script.push({ content: [{ type: 'text', text: 'ok' }] });
  await ask('Sposta Mario Test a dopodomani alle 10 e cancella Anna domani');
  assert.equal(calls.length, 1);
  assert.equal(rpcCalls.length, 0);
});

test('parser: source vs destination, weekdays, dates and other domains', () => {
  const p = (q) => parseAppointmentChange(q);
  assert.deepEqual(p('sposta mario rossi dalle 15 alle 16').entities, { patient_query: 'mario rossi', from: { time: '15:00' }, time: '16:00' });
  assert.deepEqual(p("sposta l'appuntamento delle 15 di mario rossi a venerdì alle 3 del pomeriggio").entities, { patient_query: 'mario rossi', from: { time: '15:00' }, weekday: 5, time: '15:00' });
  assert.deepEqual(p("cancella l'appuntamento di domani alle 15 di bianchi").entities, { patient_query: 'bianchi', from: { relative_day: 1, time: '15:00' } });
  assert.deepEqual(p('sposta mario rossi di domani alle 16').missing, ['target'], 'ambiguous: asks where to move it');
  assert.equal(p('annulla il pagamento di domani'), null);
  assert.equal(p('cancella la nota di rossi di domani'), null);
  assert.equal(understandPoliedron('annulla appuntamento di Rossi').intent, 'APPOINTMENT_DELETE');
  assert.equal(understandPoliedron('metti in agenda le ferie domani').intent, 'UNKNOWN');
  // 2026-10-08 is a Thursday.
  assert.equal(resolveDay({ weekday: 4 }, '2026-10-08'), '2026-10-08');
  assert.equal(resolveDay({ weekday: 5 }, '2026-10-08'), '2026-10-09');
  assert.equal(resolveDay({ day_of_month: 5 }, '2026-10-08'), '2026-11-05');
  assert.equal(resolveDay({ day_of_month: 12, month: 3 }, '2026-10-08'), '2027-03-12');
  assert.equal(resolveDay({ day_of_month: 31, month: 2 }, '2026-10-08'), null, 'non-existent date');
  assert.equal(resolveDay({ weekday: 4, day_of_month: 9 }, '2026-10-08'), null, 'weekday contradicts the date');
});

test('app routing: agenda commands without "appuntamento" reach the server', async () => {
  let n = 0;
  const client = { functions: { invoke: async () => { n++; return { data: { text: 'Fatto.' } }; } } };
  for (const query of ['Fissa Mario Rossi domani alle 15 per igiene', 'Sposta Bianchi a venerdì alle 10', 'Togli Verdi da domani', 'Cancella Rossi lunedì alle 9']) {
    const r = await processQuery({ query, supabaseClient: client });
    assert.equal(r.intent, 'AGENDA', query);
  }
  assert.equal(n, 4);
});

// Follow-ups: "spostalo" / "cancellalo" resolve the appointment the previous
// answer was about, from a context the server signed for that answer.
async function ask2(messages, extra = {}) {
  const response = await handler(new Request('https://local.test', { method: 'POST', headers: { Authorization: 'Bearer test' }, body: JSON.stringify({ messages, ...extra }) }));
  return response.json();
}
async function readTomorrow() {
  const first = await ask2([{ role: 'user', content: 'Che appuntamenti ho domani?' }]);
  assert.equal(calls.length, 0);
  assert.equal(typeof first.conversation_context, 'string', 'a single appointment read returns a signed context');
  return [{ role: 'user', content: 'Che appuntamenti ho domani?' }, { role: 'assistant', content: first.text }, first.conversation_context];
}

test('"spostalo a dopodomani alle 11" after reading the agenda moves that appointment, no model call', async () => {
  const [u, a, token] = await readTomorrow();
  const out = await ask2([u, a, { role: 'user', content: 'Spostalo a dopodomani alle 11' }], { conversation_context: token });
  assert.equal(calls.length, 0);
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].args.p_before.id, 10);
  assert.equal(rpcCalls[0].args.p_after.data, D2);
  assert.equal(rpcCalls[0].args.p_after.ora, '11:00');
  assert.match(out.text, /^Fatto\. Appuntamento modificato/);
  assert.equal(typeof out.conversation_context, 'string', 'the moved appointment stays the subject');
});

test('"cancellalo" right after a move cancels the same appointment', async () => {
  const first = await ask2([{ role: 'user', content: 'Sposta Mario Test a dopodomani alle 11' }]);
  rpcCalls = [];
  database.appointments = [appt(10, mario, D2, '11:00')];
  const out = await ask2([{ role: 'user', content: 'Sposta Mario Test a dopodomani alle 11' }, { role: 'assistant', content: first.text }, { role: 'user', content: 'Anzi cancellalo' }], { conversation_context: first.conversation_context });
  assert.equal(calls.length, 0);
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].args.p_after.stato, 'annullato');
  assert.equal(rpcCalls[0].args.p_after.id, 10);
  assert.match(out.text, /Appuntamento annullato/);
});

test('the context is trusted only if signed, for this user, about the previous message', async () => {
  const [u, a, token] = await readTomorrow();
  const follow = { role: 'user', content: 'Cancellalo' };
  const [body, sig] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64').toString()), appointment_ids: [99] })).toString('base64') + '.' + sig;
  const cases = [
    [[u, a, follow], forged],
    [[{ role: 'user', content: 'Un altro messaggio' }, a, follow], token],
  ];
  for (const [messages, ctx] of cases) {
    script.push({ content: [{ type: 'text', text: 'Quale appuntamento?' }] });
    await ask2(messages, { conversation_context: ctx });
  }
  user = { id: 'u2', app_metadata: { studio_id: 's1' } };
  database.studio_users.push({ user_id: 'u2', studio_id: 's1', stato: 'attivo' });
  script.push({ content: [{ type: 'text', text: 'Quale appuntamento?' }] });
  await ask2([u, a, follow], { conversation_context: token });
  assert.equal(rpcCalls.length, 0, 'forged, misplaced or foreign contexts never write');
  assert.equal(calls.length, 3, 'they fall back to the model path');
});

test('a context is never a confirmation, and two candidates make "spostalo" ask', async () => {
  const [u, a, token] = await readTomorrow();
  const confirmed = await ask2([], { confirm: { token } });
  assert.match(confirmed.text, /Conferma non valida/);
  database.appointments.push(appt(11, mario, D1, '16:00'));
  const list = await ask2([{ role: 'user', content: 'Che appuntamenti ho domani?' }]);
  const out = await ask2([{ role: 'user', content: 'Che appuntamenti ho domani?' }, { role: 'assistant', content: list.text }, { role: 'user', content: 'Spostalo alle 12' }], { conversation_context: list.conversation_context });
  assert.match(out.text, /A quale appuntamento ti riferisci/);
  assert.equal(rpcCalls.length, 0);
});

test('app: the gateway sends back the last signed context and drops it when absent', async () => {
  const { runModelTask } = await import('../src/lib/poliedron/modelGateway.js');
  const bodies = [];
  const replies = [{ text: 'a', conversation_context: 'ctx-1' }, { text: 'b' }, { text: 'c' }];
  const supabaseClient = { functions: { invoke: async (_name, { body }) => { bodies.push(body); return { data: replies.shift() }; } } };
  await runModelTask({ taskType: 'ASK', input: 'uno', supabaseClient });
  await runModelTask({ taskType: 'ASK', input: 'due', supabaseClient });
  await runModelTask({ taskType: 'ASK', input: 'tre', supabaseClient });
  assert.equal(bodies[0].conversation_context, undefined);
  assert.equal(bodies[1].conversation_context, 'ctx-1');
  assert.equal(bodies[2].conversation_context, undefined);
  const r = await processQuery({ query: 'Spostalo a venerdì alle 10', supabaseClient });
  assert.equal(r.intent, 'AGENDA');
});
