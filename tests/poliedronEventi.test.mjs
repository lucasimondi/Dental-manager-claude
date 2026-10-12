// POL-AI-011: one structured event per Poliedron answer (Core vs model) for the
// "Come risponde Poliedron" dashboard. Runs the real Edge handler (bundled with
// esbuild) on synthetic data and checks that no chat text or patient data is
// ever recorded.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { rigaEvento, nomeAzione } from '../supabase/functions/agente-assistente/poliedron-eventi.js';
import { riepilogoStatistiche, etichettaAzione } from '../src/lib/poliedron/statistiche.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
let handler, script, database, user, inserts;

class Query {
  constructor(table) { this.table = table; this.filters = []; this.mode = 'many'; }
  select() { return this; } order() { return this; } limit() { return this; }
  or(expr) { const t = expr.match(/%([^%]+)%/)[1].toLowerCase(); this.filters.push((r) => `${r.nome} ${r.cognome}`.toLowerCase().includes(t)); return this; }
  eq(k, v) { this.filters.push((r) => r[k] === v); return this; }
  ilike() { return this; } gte() { return this; } lte() { return this; }
  maybeSingle() { this.mode = 'one'; return this; } single() { this.mode = 'one'; return this; }
  insert(row) { this.inserted = row; inserts.push({ table: this.table, row }); return this; }
  then(resolve, reject) {
    return Promise.resolve().then(() => {
      if (this.inserted) return { data: { id: 900, ...this.inserted }, error: null };
      let rows = this.table === 'studios' ? [{ id: 's1', nome: 'Studio test', feature_overrides: { assistente_ai: 'premium' } }] : database[this.table] || [];
      rows = rows.filter((r) => this.filters.every((f) => f(r)));
      return { data: this.mode === 'one' ? rows[0] || null : rows, error: null };
    }).then(resolve, reject);
  }
}

test.before(async () => {
  const bundled = await build({ entryPoints: [fileURLToPath(new URL('../supabase/functions/agente-assistente/index.ts', import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'neutral', plugins: [{ name: 'fakes', setup(b) {
    b.onResolve({ filter: /^https:\/\// }, (a) => ({ path: a.path, namespace: 'fake' }));
    b.onLoad({ filter: /.*/, namespace: 'fake' }, (a) => ({ contents: a.path.includes('server.ts') ? 'export const serve = h => globalThis.__eventiHandler(h);' : 'export const createClient = (...a) => globalThis.__eventiClient(...a);', loader: 'js' }));
  } }] });
  globalThis.__eventiHandler = (h) => handler = h;
  globalThis.Deno = { env: { get: (k) => k === 'SUPABASE_SERVICE_ROLE_KEY' ? 'test-only-signing-secret' : 'test' } };
  globalThis.__eventiClient = () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) }, from: (t) => new Query(t), rpc: async () => ({ data: 701, error: null }) });
  globalThis.fetch = async () => { const next = script.shift(); assert.ok(next, 'unexpected model request'); return { ok: true, json: async () => next }; };
  await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
});

test.beforeEach(() => {
  script = []; inserts = []; user = { id: 'u1', app_metadata: { studio_id: 's1' } };
  database = { studio_users: [{ user_id: 'u1', studio_id: 's1', stato: 'attivo' }], patients: [{ id: 1, nome: 'Mario', cognome: 'Test', studio_id: 's1' }], appointments: [], impegni_personali: [], payments: [], plans: [] };
});
async function ask(text, extra = {}) {
  const response = await handler(new Request('https://local.test', { method: 'POST', headers: { Authorization: 'Bearer test' }, body: JSON.stringify({ messages: [{ role: 'user', content: text }], ...extra }) }));
  return response.json();
}
const eventi = () => inserts.filter((i) => i.table === 'poliedron_eventi').map((i) => i.row);
const FIELDS = ['studio_id', 'user_id', 'percorso', 'intento', 'esito', 'azioni', 'provider', 'durata_ms'];

test('a Core action records one event: route core, intent, outcome — no text, no patient data', async () => {
  const out = await ask('Mario Test ha pagato 150 euro con carta');
  assert.match(out.text, /^Fatto\./);
  const [e, ...rest] = eventi();
  assert.equal(rest.length, 0);
  assert.deepEqual(Object.keys(e).sort(), [...FIELDS].sort());
  assert.equal(e.percorso, 'core'); assert.equal(e.intento, 'PAYMENT_CREATE'); assert.equal(e.esito, 'eseguito');
  assert.deepEqual(e.azioni, []); assert.equal(e.provider, null); assert.equal(e.studio_id, 's1'); assert.equal(e.user_id, 'u1');
  assert.doesNotMatch(JSON.stringify(e), /Mario|Test|150|carta/i);
});

test('a Core question records "chiarimento"', async () => {
  await ask('Fissa un appuntamento per Mario Test domani');
  const [e] = eventi();
  assert.equal(e.percorso, 'core'); assert.equal(e.intento, 'APPOINTMENT_CREATE'); assert.equal(e.esito, 'chiarimento');
});

test('the model path records the tools it called (names only) and the provider', async () => {
  script.push({ content: [{ type: 'tool_use', id: 't1', name: 'cerca_pazienti', input: { query: 'Mario Test' } }] });
  script.push({ content: [{ type: 'text', text: 'Mario Test ha 0 appuntamenti in programma.' }] });
  const out = await ask('Che cosa sai di Mario Test e dei suoi ultimi trattamenti?');
  assert.match(out.text, /appuntamenti/);
  const [e, ...rest] = eventi();
  assert.equal(rest.length, 0);
  assert.equal(e.percorso, 'modello'); assert.deepEqual(e.azioni, ['cerca_pazienti']); assert.equal(e.provider, 'anthropic'); assert.equal(e.esito, 'risposta');
  assert.equal(e.intento, null);
  assert.doesNotMatch(JSON.stringify(e), /Mario|trattament/i);
});

test('a tool name the model invented is not stored as such', async () => {
  script.push({ content: [{ type: 'tool_use', id: 't1', name: 'mario_test_allergico', input: {} }] });
  script.push({ content: [{ type: 'text', text: 'Non posso farlo.' }] });
  await ask('Che cosa sai di Mario Test e dei suoi ultimi trattamenti?');
  assert.deepEqual(eventi()[0].azioni, ['non_consentito']);
});

test('a confirmation records route "conferma"; a cancelled one "non_eseguito"', async () => {
  await ask('x', { confirm: { token: 'not-a-valid-token' } });
  assert.deepEqual(eventi().map((e) => [e.percorso, e.esito]), [['conferma', 'risposta']]);
});

test('no session, no studio member or an input error: nothing is recorded', async () => {
  user = null;
  await ask('Mario Test ha pagato 150 euro');
  database.studio_users = [];
  user = { id: 'u1', app_metadata: { studio_id: 's1' } };
  await ask('Mario Test ha pagato 150 euro');
  database.studio_users = [{ user_id: 'u1', studio_id: 's1', stato: 'attivo' }];
  await ask('ciao', { team: { assistente: 'nessuno' } });
  assert.equal(eventi().length, 0);
});

test('a failing event write never changes the answer', async () => {
  const original = Query.prototype.insert;
  Query.prototype.insert = function insert(row) { if (this.table === 'poliedron_eventi') throw new Error('table missing'); return original.call(this, row); };
  try {
    const out = await ask('Mario Test ha pagato 150 euro con carta');
    assert.match(out.text, /^Fatto\. Pagamento registrato/);
  } finally { Query.prototype.insert = original; }
});

test('rigaEvento: custom actions keep only their category, odd names are not stored, input errors are skipped', () => {
  assert.equal(nomeAzione('azione_Invia-Mail'), 'azione_personalizzata');
  assert.equal(nomeAzione('Strano Nome'), 'altro');
  const row = rigaEvento({ text: 'ok', changed: ['appointments'] }, { studioId: 's1', userId: 'u1', azioni: ['crea_appuntamento', 'crea_appuntamento', 'azione_x'], intento: 'not valid', provider: 'gemini' }, 1234.6);
  assert.deepEqual(row.azioni, ['crea_appuntamento', 'azione_personalizzata']);
  assert.equal(row.intento, null); assert.equal(row.provider, null); assert.equal(row.esito, 'eseguito'); assert.equal(row.durata_ms, 1235);
  assert.equal(rigaEvento({ error: 'Messaggi non validi' }, { studioId: 's1', userId: 'u1' }), null);
  assert.equal(rigaEvento({ needsConfirmation: {} }, { studioId: 's1', userId: 'u1' }).esito, 'conferma');
  assert.equal(rigaEvento({ text: 'Operazione annullata.' }, { studioId: 's1', userId: 'u1', conferma: true, annullata: true }).esito, 'non_eseguito');
});

test('dashboard summary: share of requests closed by the Core, confirmations excluded', () => {
  assert.equal(riepilogoStatistiche({ totale: 0 }), null);
  const s = riepilogoStatistiche({
    giorni: 30, totale: 12, percorsi: { core: 6, modello: 3, essenziale: 1, conferma: 2 }, esiti: { eseguito: 5 },
    intenti_core: [{ intento: 'PAYMENT_CREATE', n: 4 }], azioni_modello: [{ azione: 'crea_piano_cura', n: 2 }],
    intenti_passati_al_modello: [{ intento: 'APPOINTMENT_MOVE', n: 1 }], modello_senza_azioni: 1,
  });
  assert.equal(s.richieste, 10); assert.equal(s.core.pct, 60); assert.equal(s.modello.pct, 30); assert.equal(s.essenziale.pct, 10);
  assert.deepEqual(s.intentiCore, [{ etichetta: 'Registrare un pagamento', n: 4 }]);
  assert.deepEqual(s.azioniModello, [{ etichetta: 'Creare un piano di cura', n: 2 }]);
  assert.deepEqual(s.passateAlModello, [{ etichetta: 'Spostare un appuntamento', n: 1 }]);
  assert.equal(etichettaAzione('sconosciuta'), 'sconosciuta');
});

test('migration: RLS on, own-user inserts only, no text columns, caller permissions, 180-day retention', () => {
  const sql = read('../supabase/migrations/20261012120000_pol_ai_011_poliedron_eventi.sql');
  assert.match(sql, /ALTER TABLE public\.poliedron_eventi ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON public\.poliedron_eventi FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT SELECT, INSERT ON public\.poliedron_eventi TO authenticated/);
  assert.doesNotMatch(sql, /GRANT[^;]*(UPDATE|DELETE)[^;]*poliedron_eventi/);
  assert.match(sql, /FOR INSERT TO authenticated WITH CHECK \(\s*user_id = \(SELECT auth\.uid\(\)\) AND EXISTS/);
  assert.match(sql, /su\.stato = 'attivo'/);
  const table = sql.slice(sql.indexOf('CREATE TABLE public.poliedron_eventi'), sql.indexOf('CREATE INDEX'));
  assert.doesNotMatch(table, /\b(testo|content|text_|messaggio|paziente|patient)\w*\s+(text|jsonb)/i);
  assert.doesNotMatch(table, /\bjsonb\b/);
  assert.match(sql, /poliedron_statistiche_v1[\s\S]*SECURITY INVOKER/);
  assert.match(sql, /Accesso allo studio non consentito/);
  assert.match(sql, /cron\.schedule\('poliedron-eventi-pulizia'[\s\S]*interval '180 days'/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.poliedron_statistiche_v1\(uuid, integer\) FROM PUBLIC, anon/);
});

test('app wiring: the activity panel reads the aggregates through the RPC, for the current studio', () => {
  const poliedron = read('../src/components/poliedron/Poliedron.jsx');
  assert.match(poliedron, /rpc\('poliedron_statistiche_v1', \{ p_studio: studioId, p_giorni: 30 \}\)/);
  assert.match(poliedron, /loadActivityStats=\{loadPoliedronStats\}/);
  assert.match(read('../src/components/poliedron/PoliedronChatPage.jsx'), /<PoliedronAttivita load=\{loadActivity\} loadStats=\{loadActivityStats\}/);
  const panel = read('../src/components/poliedron/PoliedronAttivita.jsx');
  assert.match(panel, /riepilogoStatistiche\(s\)/);
  assert.match(panel, /\{loadStats && <ComeRisponde loadStats=\{loadStats\} \/>\}/);
});
