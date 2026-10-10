// Poliedron Core actions without the model: payments, notes, contacts, new
// patients, recalls, agenda blocks/holidays, appointment details and free
// slots. Runs the real Edge handler (bundled with esbuild) on synthetic data;
// any model request not scripted by a test fails it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { studioToday } from '../supabase/functions/agente-assistente/confirmation.js';
import { parseCoreAction } from '../supabase/functions/agente-assistente/poliedron-actions.js';
import { processQuery } from '../src/lib/poliedron/poliedraCore.js';

let handler, script, calls, database, user, autonomia, rpcCalls, inserts;
const plus = (n) => { const d = new Date(`${studioToday()}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const D1 = plus(1);

class Query {
  constructor(table) { this.table = table; this.filters = []; this.mode = 'many'; }
  select() { return this; } order() { return this; } limit() { return this; }
  or(expr) { const t = expr.match(/%([^%]+)%/)[1].toLowerCase(); this.filters.push((r) => `${r.nome} ${r.cognome}`.toLowerCase().includes(t)); return this; }
  eq(k, v) { this.filters.push((r) => r[k] === v); return this; }
  ilike(k, v) { this.filters.push((r) => String(r[k] || '').toLowerCase() === String(v).toLowerCase()); return this; }
  gte(k, v) { this.filters.push((r) => r[k] >= v); return this; }
  lte(k, v) { this.filters.push((r) => r[k] <= v); return this; }
  maybeSingle() { this.mode = 'one'; return this; } single() { this.mode = 'one'; return this; }
  insert(row) { this.inserted = row; inserts.push({ table: this.table, row }); return this; }
  then(resolve, reject) {
    return Promise.resolve().then(() => {
      if (this.inserted) {
        if (this.table === 'payments') { (database.payments ||= []).push(this.inserted); return { data: this.inserted, error: null }; }
        return { data: null, error: null };
      }
      let rows = this.table === 'studios' ? [{ id: 's1', nome: 'Studio test', feature_overrides: { assistente_ai: 'premium', agente_azione: autonomia } }] : database[this.table] || [];
      rows = rows.filter((r) => this.filters.every((f) => f(r)));
      return { data: this.mode === 'one' ? rows[0] || null : rows, error: null };
    }).then(resolve, reject);
  }
}

test.before(async () => {
  const bundled = await build({ entryPoints: [fileURLToPath(new URL('../supabase/functions/agente-assistente/index.ts', import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'neutral', plugins: [{ name: 'fakes', setup(b) {
    b.onResolve({ filter: /^https:\/\// }, (a) => ({ path: a.path, namespace: 'fake' }));
    b.onLoad({ filter: /.*/, namespace: 'fake' }, (a) => ({ contents: a.path.includes('server.ts') ? 'export const serve = h => globalThis.__coreActionsHandler(h);' : 'export const createClient = (...a) => globalThis.__coreActionsClient(...a);', loader: 'js' }));
  } }] });
  globalThis.__coreActionsHandler = (h) => handler = h;
  globalThis.Deno = { env: { get: (k) => k === 'SUPABASE_SERVICE_ROLE_KEY' ? 'test-only-signing-secret' : 'test' } };
  globalThis.__coreActionsClient = () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) }, from: (t) => new Query(t), rpc: async (name, args) => { rpcCalls.push({ name, args }); return { data: 700 + rpcCalls.length, error: null }; } });
  globalThis.fetch = async (_url, options) => { calls.push(JSON.parse(options.body)); const next = script.shift(); assert.ok(next, 'unexpected model request'); return { ok: true, json: async () => next }; };
  await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
});

const patient = (id, nome, cognome) => ({ id, nome, cognome, studio_id: 's1' });
const appt = (id, p, data, ora, extra = {}) => ({ id, paziente_id: p.id, data, ora: `${ora}:00`, durata: 30, tipo: 'Controllo', stato: 'confermato', note: null, operatore_id: null, studio_id: 's1', patients: { nome: p.nome, cognome: p.cognome }, ...extra });
const mario = patient(1, 'Mario', 'Test');
test.beforeEach(() => {
  script = []; calls = []; rpcCalls = []; inserts = []; autonomia = 'completo'; user = { id: 'u1', app_metadata: { studio_id: 's1' } };
  database = { studio_users: [{ user_id: 'u1', studio_id: 's1', stato: 'attivo' }], patients: [mario], appointments: [], impegni_personali: [], payments: [], plans: [] };
});
async function ask(messages, extra = {}) {
  const list = typeof messages === 'string' ? [{ role: 'user', content: messages }] : messages;
  const response = await handler(new Request('https://local.test', { method: 'POST', headers: { Authorization: 'Bearer test' }, body: JSON.stringify({ messages: list, ...extra }) }));
  return response.json();
}
const logged = () => inserts.filter((i) => i.table === 'poliedron_attivita').map((i) => i.row.azione);

test('payment: "Mario Test ha pagato 150 euro con carta" is registered directly, claim first, logged', async () => {
  const out = await ask('Mario Test ha pagato 150 euro con carta');
  assert.equal(calls.length, 0);
  assert.match(out.text, /^Fatto\. Pagamento registrato/);
  assert.equal(database.payments.length, 1);
  assert.equal(database.payments[0].metodo, 'Carta');
  assert.equal(database.payments[0].importo, 150);
  const order = inserts.map((i) => i.table);
  assert.ok(order.indexOf('poliedron_action_claims') < order.indexOf('payments'));
  assert.deepEqual(logged(), ['registra_pagamento_paziente']);
});

test('payment: same-day duplicate → summary to confirm; several open plans → asks which; nothing written', async () => {
  database.payments.push({ id: 5, paziente_id: 1, studio_id: 's1', importo: 80, data: studioToday() });
  const dup = await ask('Mario Test ha pagato 80 euro in contanti');
  assert.ok(dup.needsConfirmation?.token);
  assert.match(dup.needsConfirmation.summary, /c'è già un pagamento/);
  database.payments = [];
  database.plans = [{ id: 7, titolo: 'Ortodonzia', stato: 'attivo', paziente_id: 1, studio_id: 's1' }, { id: 8, titolo: 'Conservativa', stato: 'attivo', paziente_id: 1, studio_id: 's1' }];
  const plans = await ask('Mario Test ha pagato 80 euro');
  assert.match(plans.text, /più piani di cura aperti: Ortodonzia; Conservativa\. A quale collego il pagamento\?/);
  assert.equal(database.payments.length, 0);
  assert.equal(calls.length, 0);
});

test('note, contact, recall: executed with the patient RPC, text kept as written', async () => {
  await ask('Aggiungi una nota a Mario Test: allergico alla Penicillina');
  await ask('Il telefono di Mario Test è 333 123 4567');
  await ask('Richiamo per Mario Test tra 6 mesi per controllo igiene');
  assert.equal(calls.length, 0);
  assert.deepEqual(rpcCalls.map((c) => c.args.p_azione), ['aggiungi_nota_paziente', 'modifica_paziente', 'crea_richiamo']);
  assert.equal(rpcCalls[0].args.p_dati.testo, 'allergico alla Penicillina');
  assert.equal(rpcCalls[1].args.p_dati.telefono, '3331234567');
  const [y, m, d] = studioToday().split('-').map(Number);
  const due = new Date(Date.UTC(y, m - 1 + 6, 1, 12)); due.setUTCDate(Math.min(d, new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + 1, 0)).getUTCDate()));
  assert.equal(rpcCalls[2].args.p_dati.data_scadenza, due.toISOString().slice(0, 10));
  assert.equal(rpcCalls[2].args.p_dati.categoria, 'clinico');
  assert.deepEqual(logged(), ['aggiungi_nota_paziente', 'modifica_paziente', 'crea_richiamo']);
});

test('new patient: created directly; a homonym needs confirmation; three-word names go to the model', async () => {
  await ask('Nuovo paziente Anna Bianchi 333 7654321');
  assert.equal(rpcCalls.length, 1);
  assert.deepEqual(rpcCalls[0].args.p_dati, { nome: 'Anna', cognome: 'Bianchi', telefono: '3337654321' });
  const dup = await ask('Nuovo paziente Mario Test');
  assert.match(dup.needsConfirmation.summary, /c'è già un paziente Mario Test/);
  assert.equal(rpcCalls.length, 1);
  script.push({ content: [{ type: 'text', text: 'Qual è il cognome?' }] });
  await ask('crea il paziente Maria Grazia Rossi');
  assert.equal(calls.length, 1, 'ambiguous name split → model');
});

test('agenda block: afternoon uses the studio hours; clashing appointments are listed and need confirmation', async () => {
  database.studio_info = [{ studio_id: 's1', agenda_settings: { oraInizio: 9, oraFine: 19 } }];
  await ask('blocca domani pomeriggio per corso');
  assert.equal(rpcCalls.length, 1);
  assert.deepEqual(rpcCalls[0].args.p_dati, { titolo: 'Corso', tipo: 'personale', data_inizio: D1, data_fine: D1, tutto_il_giorno: false, ora_inizio: '14:00', ora_fine: '19:00', note: null });
  database.appointments = [appt(10, mario, D1, '15:00')];
  const clash = await ask('blocca domani pomeriggio per corso');
  assert.match(clash.needsConfirmation.summary, /1 appuntamento .* Mario Test\) che restano in agenda/);
  assert.equal(rpcCalls.length, 1);
  assert.equal(calls.length, 0);
});

test('holidays over a date range and a phone call with a default 30 minutes', async () => {
  const a = plus(3), b = plus(5);
  const dm = (iso) => `${Number(iso.slice(8))}/${Number(iso.slice(5, 7))}`;
  await ask(`Ferie dal ${dm(a)} al ${dm(b)}`);
  assert.equal(rpcCalls[0].args.p_dati.tipo, 'ferie');
  assert.equal(rpcCalls[0].args.p_dati.data_inizio, a);
  assert.equal(rpcCalls[0].args.p_dati.data_fine, b);
  assert.equal(rpcCalls[0].args.p_dati.tutto_il_giorno, true);
  await ask('Chiamata col laboratorio domani alle 12');
  assert.equal(rpcCalls[1].args.p_dati.titolo, 'Chiamata col laboratorio');
  assert.equal(rpcCalls[1].args.p_dati.ora_inizio, '12:00');
  assert.equal(rpcCalls[1].args.p_dati.ora_fine, '12:30');
});

test('appointment details: duration by name, and "confermalo" on the appointment just read', async () => {
  database.appointments = [appt(10, mario, D1, '09:00', { stato: 'da confermare' })];
  const longer = await ask("Allunga l'appuntamento di Mario Test di domani a 60 minuti");
  assert.match(longer.text, /^Fatto\. Appuntamento modificato/);
  assert.equal(rpcCalls[0].args.p_after.durata, 60);
  const read = await ask('Che appuntamenti ho domani?');
  await ask([{ role: 'user', content: 'Che appuntamenti ho domani?' }, { role: 'assistant', content: read.text }, { role: 'user', content: 'confermalo' }], { conversation_context: read.conversation_context });
  assert.equal(rpcCalls[1].args.p_after.stato, 'confermato');
  assert.equal(calls.length, 0);
});

test('free slots: "trova un posto per Mario Test domani" lists times; "alle 10 per controllo" books it', async () => {
  const first = await ask('Trova un posto per Mario Test domani');
  assert.match(first.text, /Orari liberi .*: 08:00, 08:30/);
  assert.match(first.text, /A che ora lo fisso\?/);
  const done = await ask([{ role: 'user', content: 'Trova un posto per Mario Test domani' }, { role: 'assistant', content: first.text }, { role: 'user', content: 'alle 10 per controllo' }]);
  assert.match(done.text, /^Fatto\. Appuntamento creato/);
  assert.equal(rpcCalls[0].args.p_after.ora, '10:00');
  assert.equal(rpcCalls[0].args.p_after.data, D1);
  const free = await ask('Orari liberi domani');
  assert.match(free.text, /^Orari liberi .*\(30 minuti\): 08:00/);
  assert.equal(calls.length, 0);
});

test('unknown patients and "consulente" studios go to the model; "ok" after a question is not an answer', async () => {
  script.push({ content: [{ type: 'text', text: 'Chi è?' }] });
  await ask('Sconosciuto Nessuno ha pagato 50 euro');
  autonomia = 'consulente';
  script.push({ content: [{ type: 'text', text: 'Non posso.' }] });
  await ask('Aggiungi una nota a Mario Test: prova');
  autonomia = 'completo';
  const q = await ask('Trova un posto per Mario Test domani');
  script.push({ content: [{ type: 'text', text: 'Va bene.' }] });
  await ask([{ role: 'user', content: 'Trova un posto per Mario Test domani' }, { role: 'assistant', content: q.text }, { role: 'user', content: 'ok grazie' }]);
  assert.equal(calls.length, 3);
  assert.equal(rpcCalls.length + database.payments.length, 0);
});

test('parsers stay out of other sentences', () => {
  for (const q of ['Rossi deve pagare 50 euro', 'Quanto ha pagato Rossi?', 'blocca Mario Rossi domani alle 15 per igiene', 'sposta Rossi a domani', 'cerca paziente Rossi', 'fammi vedere i richiami', 'crea un piano di cura per Rossi']) {
    assert.equal(parseCoreAction(q), null, q);
  }
});

test('app routing: the new phrases reach the server', async () => {
  let n = 0;
  const client = { functions: { invoke: async () => { n++; return { data: { text: 'ok' } }; } } };
  const premium = { features: { assistente_ai: 'premium' } };
  const phrases = ["cambia l'email di Rossi in mario@x.it", "chiudi l'agenda lunedì", 'chiamata col laboratorio domani alle 12', "allungalo a un'ora", 'confermalo', 'trova un posto per Mario Rossi giovedì', 'orari liberi giovedì'];
  for (const query of phrases) await processQuery({ query, context: premium, supabaseClient: client });
  assert.equal(n, phrases.length);
});
