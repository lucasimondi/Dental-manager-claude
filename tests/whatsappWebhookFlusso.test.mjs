// End-to-end test of the whatsapp-webhook Edge Function (POL-WA-003a) with
// Supabase, Meta and Claude replaced by in-memory fakes. The real index.ts is
// bundled with esbuild; only the network and database are simulated.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { dataDomaniStudio, oraAdessoStudio } from '../supabase/functions/whatsapp-webhook/logica.js';

const APP_SECRET = 'segreto-di-test';
const STUDIO = 's-1';
const PNID = 'PNID-1';
const PAZ_TEL = '393331112222';
const traGiorni = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const D1 = traGiorni(10);
const D2 = traGiorni(11);

// ── fake Supabase ──────────────────────────────────────────────────────
function creaDb() {
  const db = {
    tables: {
      whatsapp_config: [{ id: 'c1', studio_id: STUDIO, phone_number_id: PNID, attivo: true }],
      studios: [{ id: STUDIO, nome: 'Studio Bianchi', feature_overrides: { whatsapp_automatico: true } }],
      studio_info: [{ studio_id: STUDIO, nome: 'Studio Bianchi', via: 'Via Roma 1', comune: 'Milano', tel: '02 123', agenda_settings: { oraInizio: 9, oraFine: 12, slotMin: 30, durataDefault: 30 } }],
      app_types: [{ studio_id: STUDIO, nome: 'Igiene', durata: 45 }],
      patients: [{ id: 101, studio_id: STUDIO, nome: 'Mario', cognome: 'Rossi', telefono: '+39 333 111 2222' }],
      appointments: [
        { id: 501, studio_id: STUDIO, paziente_id: 101, data: D1, ora: '09:00', durata: 30, tipo: 'Controllo', stato: 'confermato', operatore_id: null },
      ],
      impegni_personali: [],
      richiami: [],
      whatsapp_messages: [],
      whatsapp_conversazioni: [],
      richieste_prenotazione: [],
      todos: [],
    },
    rpcCalls: [],
    rpc: { whatsapp_saldo_paziente_v1: [{ piano_id: 1, titolo: 'Piano 1', totale_piano: 500, totale_pagato: 200, saldo_piano: 300, scadenza_pagamento: null }] },
    seq: 1,
  };

  class Q {
    constructor(table) { this.table = table; this.filters = []; this.op = 'select'; this.payload = null; this.ord = []; this.lim = null; this.mode = 'many'; this.returning = false; }
    rows() { return db.tables[this.table] || (db.tables[this.table] = []); }
    select() { if (this.op !== 'select') this.returning = true; return this; }
    eq(c, v) { this.filters.push((r) => String(r[c]) === String(v)); return this; }
    is(c, v) { this.filters.push((r) => (v === null ? r[c] == null : r[c] === v)); return this; }
    neq(c, v) { this.filters.push((r) => r[c] != null && String(r[c]) !== String(v)); return this; }
    gte(c, v) { this.filters.push((r) => r[c] >= v); return this; }
    lte(c, v) { this.filters.push((r) => r[c] <= v); return this; }
    ilike(c, p) { const suf = p.replace(/^%/, '').toLowerCase(); this.filters.push((r) => String(r[c] || '').replace(/\D/g, '').toLowerCase().endsWith(suf)); return this; }
    or(expr) {
      const parti = expr.split(',').map((x) => x.split('.'));
      this.filters.push((r) => parti.some(([c, op, v]) => (op === 'is' ? r[c] == null : String(r[c]) !== v && r[c] != null)));
      return this;
    }
    order(c, o = {}) { this.ord.push([c, o.ascending !== false]); return this; }
    limit(n) { this.lim = n; return this; }
    maybeSingle() { this.mode = 'maybe'; return this; }
    single() { this.mode = 'single'; return this; }
    insert(p) { this.op = 'insert'; this.payload = p; return this; }
    update(p) { this.op = 'update'; this.payload = p; return this; }
    upsert(p, o) { this.op = 'upsert'; this.payload = p; this.conflict = o?.onConflict?.split(','); return this; }
    run() {
      const rows = this.rows();
      let out;
      if (this.op === 'insert') {
        // UNIQUE (appuntamento_id) of whatsapp_promemoria
        if (this.table === 'whatsapp_promemoria' && rows.some((x) => x.appuntamento_id === this.payload.appuntamento_id)) {
          return { data: null, error: { message: 'duplicate key value violates unique constraint' } };
        }
        out = [].concat(this.payload).map((r) => ({ id: r.id ?? db.seq++, creato_il: new Date(Date.now() + db.seq).toISOString(), ...r }));
        rows.push(...out);
      } else if (this.op === 'update') {
        out = rows.filter((r) => this.filters.every((f) => f(r)));
        out.forEach((r) => Object.assign(r, this.payload));
      } else if (this.op === 'upsert') {
        const p = this.payload;
        let r = rows.find((x) => this.conflict.every((c) => x[c] === p[c]));
        if (r) Object.assign(r, p); else { r = { id: `conv-${db.seq++}`, ai_pausa_fino: null, serve_staff: false, ...p }; rows.push(r); }
        out = [r];
      } else {
        out = rows.filter((r) => this.filters.every((f) => f(r)));
        for (const [c, asc] of [...this.ord].reverse()) out = [...out].sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1));
        if (this.lim != null) out = out.slice(0, this.lim);
      }
      const copia = out.map((r) => ({ ...r }));
      if (this.mode === 'maybe') return { data: copia[0] || null, error: null };
      if (this.mode === 'single') return { data: copia[0] || null, error: copia[0] ? null : { message: 'no rows' } };
      return { data: copia, error: null };
    }
    then(res, rej) { try { res(this.run()); } catch (e) { rej(e); } }
  }
  db.client = {
    from: (t) => new Q(t),
    rpc: async (name, args) => {
      db.rpcCalls.push({ name, args });
      if (name === 'whatsapp_cron_segreto_valido') return { data: args.p_segreto === 'cron-ok', error: null };
      return { data: db.rpc[name] || [], error: null };
    },
  };
  // Client "utente" (login dello staff): RLS simulata sullo studio del token.
  db.clientUtente = (authorization) => {
    const studio = { 'Bearer staff-A': STUDIO, 'Bearer staff-B': 's-2' }[authorization] || null;
    return {
      auth: { getUser: async () => ({ data: { user: studio ? { id: authorization } : null }, error: null }) },
      from: (t) => { const q = new Q(t); q.filters.push((r) => studio && r.studio_id === studio); return q; },
    };
  };
  return db;
}

// ── fake Meta + Claude ─────────────────────────────────────────────────
function creaRete() {
  const rete = { claude: [], copione: [], inviati: [] };
  rete.fetch = async (url, init) => {
    if (String(url).startsWith('https://api.anthropic.com/')) {
      const body = JSON.parse(init.body);
      rete.claude.push(body);
      const prossima = rete.copione.shift();
      if (!prossima) throw new Error('Claude chiamato oltre il copione');
      if (prossima.http) return { ok: false, status: prossima.http, text: async () => 'errore', json: async () => ({}) };
      return { ok: true, status: 200, json: async () => prossima };
    }
    if (String(url).startsWith('https://graph.facebook.com/')) {
      const body = JSON.parse(init.body);
      rete.inviati.push(body);
      return { ok: true, status: 200, json: async () => ({ messages: [{ id: `wamid.out.${rete.inviati.length}` }] }) };
    }
    throw new Error(`fetch inatteso: ${url}`);
  };
  return rete;
}

const testo = (t) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: t }] });
const usa = (id, name, input) => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id, name, input }] });

let handler;
let db;
let rete;

async function caricaFunzione() {
  const dir = mkdtempSync(join(tmpdir(), 'wa-fn-'));
  const out = join(dir, 'fn.mjs');
  const entry = fileURLToPath(new URL('../supabase/functions/whatsapp-webhook/index.ts', import.meta.url));
  const res = await build({
    entryPoints: [entry], bundle: true, format: 'esm', platform: 'neutral', write: false,
    plugins: [{
      name: 'fake-supabase',
      setup(b) {
        b.onResolve({ filter: /^https:\/\/esm\.sh\/@supabase/ }, () => ({ path: 'fake', namespace: 'fake' }));
        b.onLoad({ filter: /.*/, namespace: 'fake' }, () => ({ contents: 'export const createClient = (...a) => globalThis.__fakeCreateClient(...a);', loader: 'js' }));
      },
    }],
  });
  writeFileSync(out, res.outputFiles[0].text);
  globalThis.Deno = {
    env: { get: (k) => ({ WHATSAPP_APP_SECRET: APP_SECRET, WHATSAPP_VERIFY_TOKEN: 'vt', WHATSAPP_ACCESS_TOKEN: 'tok', ANTHROPIC_API_KEY: 'k', SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y', SUPABASE_ANON_KEY: 'anon' })[k] },
    serve: (h) => { handler = h; },
  };
  globalThis.__fakeCreateClient = (url, key, opts) => {
    const authorization = opts?.global?.headers?.Authorization;
    if (authorization) return db.clientUtente(authorization);
    return { from: (t) => db.client.from(t), rpc: (...a) => db.client.rpc(...a) };
  };
  await import(pathToFileURL(out).href);
}

function richiesta(payload, { firma = true } = {}) {
  const body = JSON.stringify(payload);
  const sig = 'sha256=' + createHmac('sha256', firma ? APP_SECRET : 'sbagliato').update(body).digest('hex');
  return new Request('https://fn.local/whatsapp-webhook', { method: 'POST', body, headers: { 'x-hub-signature-256': sig } });
}
const msgPaziente = (id, body, from = PAZ_TEL) => ({ entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: PNID }, messages: [{ from, id, type: 'text', text: { body } }] } }] }] });
const ecoStaff = (id, body) => ({ entry: [{ changes: [{ field: 'smb_message_echoes', value: { metadata: { phone_number_id: PNID }, message_echoes: [{ from: '39020000', to: PAZ_TEL, id, type: 'text', text: { body } }] } }] }] });

test.before(async () => {
  db = creaDb();
  rete = creaRete();
  globalThis.fetch = (...a) => rete.fetch(...a);
  await caricaFunzione();
});
test.beforeEach(() => { db = creaDb(); rete = creaRete(); });

test('patient books through the assistant: free slot checked, request lands in the Agenda list, never auto-confirmed', async () => {
  rete.copione.push(
    usa('t1', 'orari_disponibili', { data: D1 }),
    usa('t2', 'proponi_richiesta_appuntamento', { tipo: 'prenota', data: D1, ora: '10:00', motivo: 'pulizia' }),
    testo('Perfetto Mario, ho girato la richiesta allo studio: le confermiamo qui a breve 😊'),
  );
  const res = await handler(richiesta(msgPaziente('wamid.1', 'Vorrei prenotare una pulizia')));
  assert.equal(res.status, 200);

  // orari_disponibili: 09:00 is taken by appointment 501, so it is not offered
  const risultatoSlot = JSON.parse(rete.claude[1].messages.at(-1).content[0].content);
  assert.equal(risultatoSlot.orari_liberi.includes('09:00'), false);
  assert.equal(risultatoSlot.orari_liberi.includes('10:00'), true);

  const [r] = db.tables.richieste_prenotazione;
  assert.equal(r.origine, 'whatsapp');
  assert.equal(r.tipo_richiesta, 'prenota');
  assert.equal(r.paziente_id, 101);
  assert.deepEqual(r.date_preferite, [D1]);
  assert.equal(r.ora_preferita, '10:00');
  assert.equal(r.nome, 'Mario');
  assert.equal(db.tables.appointments.length, 1, 'the assistant never writes the agenda');

  assert.equal(rete.inviati.length, 1);
  assert.equal(rete.inviati[0].to, PAZ_TEL);
  const origini = db.tables.whatsapp_messages.map((m) => `${m.direzione}:${m.origine}`);
  assert.deepEqual(origini, ['in:paziente', 'out:assistente']);
  assert.match(rete.claude[0].system, /Mario Rossi/);
});

test('a taken slot is refused with alternatives', async () => {
  rete.copione.push(
    usa('t1', 'proponi_richiesta_appuntamento', { tipo: 'prenota', data: D1, ora: '09:00' }),
    testo('Quell orario è occupato, va bene alle 10:00?'),
  );
  await handler(richiesta(msgPaziente('wamid.1', 'alle 9')));
  const out = JSON.parse(rete.claude[1].messages.at(-1).content[0].content);
  assert.match(out.errore, /non è più libero/);
  assert.ok(out.alternative.includes('10:00'));
  assert.equal(db.tables.richieste_prenotazione.length, 0);
});

test('the conversation history is sent back to Claude', async () => {
  rete.copione.push(testo('Buongiorno! Come posso aiutarla?'), testo('Certo, le spiego subito.'));
  await handler(richiesta(msgPaziente('wamid.1', 'Buongiorno')));
  await handler(richiesta(msgPaziente('wamid.2', 'Avrei una domanda')));
  assert.deepEqual(rete.claude[1].messages.map((m) => m.role), ['user', 'assistant', 'user']);
  assert.equal(rete.claude[1].messages[2].content, 'Avrei una domanda');
});

test('Meta redelivering the same message does not produce a second reply', async () => {
  rete.copione.push(testo('Ciao!'));
  await handler(richiesta(msgPaziente('wamid.1', 'Ciao')));
  await handler(richiesta(msgPaziente('wamid.1', 'Ciao')));
  assert.equal(rete.claude.length, 1);
  assert.equal(rete.inviati.length, 1);
});

test('when staff writes from the phone the assistant pauses on that conversation', async () => {
  await handler(richiesta(ecoStaff('wamid.s1', 'Buongiorno Mario, la richiamo io')));
  const conv = db.tables.whatsapp_conversazioni[0];
  assert.ok(Date.parse(conv.ai_pausa_fino) > Date.now() + 3 * 3600000);
  assert.equal(db.tables.whatsapp_messages[0].origine, 'staff');

  await handler(richiesta(msgPaziente('wamid.2', 'Grazie, aspetto')));
  assert.equal(rete.claude.length, 0, 'no AI call while paused');
  assert.equal(rete.inviati.length, 0, 'no reply while paused');
  assert.equal(db.tables.whatsapp_messages.at(-1).origine, 'paziente', 'the patient message is still logged');
});

test('an invalid signature is rejected before reading the database', async () => {
  const res = await handler(richiesta(msgPaziente('wamid.1', 'Ciao'), { firma: false }));
  assert.equal(res.status, 403);
  assert.equal(db.tables.whatsapp_messages.length, 0);
});

test('studios without the module get no reply', async () => {
  db.tables.studios[0].feature_overrides = {};
  const res = await handler(richiesta(msgPaziente('wamid.1', 'Ciao')));
  assert.equal(res.status, 200);
  assert.equal(rete.claude.length, 0);
  assert.equal(db.tables.whatsapp_messages.length, 0);
});

test('if the AI fails the patient gets a kind fallback and staff gets a WhatsApp activity', async () => {
  rete.copione.push({ http: 529 });
  await handler(richiesta(msgPaziente('wamid.1', 'Ho un dolore fortissimo')));
  assert.match(rete.inviati[0].text.body, /la ricontatteremo/);
  const [todo] = db.tables.todos;
  assert.equal(todo.categoria, 'WHATSAPP');
  assert.equal(todo.paziente_id, 101);
  assert.equal(db.tables.whatsapp_conversazioni[0].serve_staff, true);
});

test('an unknown number never gets personal data', async () => {
  rete.copione.push(usa('t1', 'saldo_paziente', {}), usa('t2', 'prossimi_appuntamenti_paziente', {}), testo('Per questi dati la facciamo ricontattare.'));
  await handler(richiesta(msgPaziente('wamid.1', 'Quanto devo pagare?', '393009998888')));
  assert.equal(db.rpcCalls.length, 0);
  for (const i of [1, 2]) assert.match(JSON.parse(rete.claude[i].messages.at(-1).content[0].content).errore, /non associato/);
});

test('a recognised patient gets their own balance from the service-role RPC', async () => {
  rete.copione.push(usa('t1', 'saldo_paziente', {}), testo('Le restano 300 euro sul Piano 1.'));
  await handler(richiesta(msgPaziente('wamid.1', 'Quanto devo ancora pagare?')));
  assert.deepEqual(db.rpcCalls, [{ name: 'whatsapp_saldo_paziente_v1', args: { p_studio_id: STUDIO, p_paziente_id: 101 } }]);
  const out = JSON.parse(rete.claude[1].messages.at(-1).content[0].content);
  assert.equal(out.totale_da_pagare_euro, 300);
});

test("moving an appointment only works on the patient's own appointment", async () => {
  db.tables.appointments.push({ id: 999, studio_id: STUDIO, paziente_id: 202, data: D2, ora: '11:00', stato: 'confermato' });
  rete.copione.push(
    usa('t1', 'proponi_richiesta_appuntamento', { tipo: 'sposta', appuntamento_id: 999, data: D1, ora: '10:00' }),
    usa('t2', 'proponi_richiesta_appuntamento', { tipo: 'disdici', appuntamento_id: 501 }),
    testo('Ho girato la disdetta allo studio.'),
  );
  await handler(richiesta(msgPaziente('wamid.1', 'devo disdire')));
  assert.match(JSON.parse(rete.claude[1].messages.at(-1).content[0].content).errore, /non trovato/);
  const [r] = db.tables.richieste_prenotazione;
  assert.equal(r.tipo_richiesta, 'disdici');
  assert.equal(r.appuntamento_id, 501);
  assert.equal(r.ora_preferita, '09:00');
});

// ── POL-WA-003b: promemoria, risposte, conferma dallo staff ─────────────
const cron = (segreto) => new Request('https://fn.local/whatsapp-webhook/promemoria', { method: 'POST', body: '{}', headers: { 'x-cron-secret': segreto } });
const invia = (corpo, authorization = 'Bearer staff-A') => new Request('https://fn.local/whatsapp-webhook/invia', {
  method: 'POST', body: JSON.stringify(corpo), headers: authorization ? { authorization, 'content-type': 'application/json' } : { 'content-type': 'application/json' },
});

function preparaPromemoria() {
  const domani = dataDomaniStudio();
  Object.assign(db.tables.whatsapp_config[0], { promemoria_attivi: true, promemoria_ora: oraAdessoStudio(), promemoria_template: 'promemoria_appuntamento', promemoria_lingua: 'it' });
  db.tables.patients[0].consenso_whatsapp = true;
  db.tables.patients.push(
    { id: 102, studio_id: STUDIO, nome: 'Anna', cognome: 'Verdi', telefono: '3339998888', consenso_whatsapp: false },
    { id: 103, studio_id: STUDIO, nome: 'Luca', cognome: 'Neri', telefono: '', consenso_whatsapp: true },
  );
  db.tables.appointments.push(
    { id: 601, studio_id: STUDIO, paziente_id: 101, data: domani, ora: '10:00', stato: 'confermato' },
    { id: 602, studio_id: STUDIO, paziente_id: 102, data: domani, ora: '11:00', stato: 'confermato' },
    { id: 603, studio_id: STUDIO, paziente_id: 103, data: domani, ora: '12:00', stato: 'confermato' },
    { id: 604, studio_id: STUDIO, paziente_id: 101, data: domani, ora: '15:00', stato: 'annullato' },
  );
  return domani;
}

test('the reminder job refuses calls without the Vault secret', async () => {
  preparaPromemoria();
  const res = await handler(cron('sbagliato'));
  assert.equal(res.status, 403);
  assert.equal(rete.inviati.length, 0);
});

test('reminders go only to consenting patients with a usable number, once per appointment', async () => {
  preparaPromemoria();
  const res = await handler(cron('cron-ok'));
  const esito = await res.json();
  assert.equal(esito.inviati, 1);
  assert.equal(esito.saltati, 2); // Anna (no consent), Luca (no phone); the cancelled one is not even read
  assert.equal(rete.inviati.length, 1);
  const [t] = rete.inviati;
  assert.equal(t.type, 'template');
  assert.equal(t.to, '393331112222');
  assert.equal(t.template.name, 'promemoria_appuntamento');
  assert.equal(t.template.language.code, 'it');
  const params = t.template.components[0].parameters.map((p) => p.text);
  assert.equal(params[0], 'Mario');
  assert.equal(params[1], 'Studio Bianchi');
  assert.match(params[2], /^domani, /);
  assert.equal(params[3], '10:00');

  const [p] = db.tables.whatsapp_promemoria;
  assert.equal(p.stato, 'inviato');
  assert.equal(p.appuntamento_id, 601);
  assert.equal(p.wa_message_id, 'wamid.out.1');
  const storico = db.tables.whatsapp_messages.at(-1);
  assert.equal(storico.origine, 'sistema');
  assert.match(storico.contenuto, /le ricordiamo il suo appuntamento/);

  await handler(cron('cron-ok'));
  assert.equal(rete.inviati.length, 1, 'no second reminder for the same appointment');
});

test('no reminders outside the hour chosen by the studio', async () => {
  preparaPromemoria();
  db.tables.whatsapp_config[0].promemoria_ora = (oraAdessoStudio() + 3) % 24;
  await handler(cron('cron-ok'));
  assert.equal(rete.inviati.length, 0);
});

test("a 'Confermo' button reply is recorded on the reminder and the assistant answers", async () => {
  preparaPromemoria();
  await handler(cron('cron-ok'));
  rete.copione.push(testo('Grazie Mario, la aspettiamo domani!'));
  const risposta = { entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: PNID }, messages: [
    { from: PAZ_TEL, id: 'wamid.r1', type: 'button', button: { text: 'Confermo' }, context: { id: 'wamid.out.1' } },
  ] } }] }] };
  await handler(richiesta(risposta));
  const [p] = db.tables.whatsapp_promemoria;
  assert.equal(p.risposta, 'confermato');
  assert.ok(p.risposto_il);
  // the reminder is part of the history Claude sees
  assert.match(rete.claude[0].messages[0].content, /Confermo/);
  assert.equal(rete.inviati.length, 2);
});

test('a free-text "devo spostarlo" after a reminder is recorded too', async () => {
  preparaPromemoria();
  await handler(cron('cron-ok'));
  rete.copione.push(testo('Nessun problema, guardo gli orari liberi.'));
  await handler(richiesta(msgPaziente('wamid.r2', 'Devo spostarlo, scusate')));
  assert.equal(db.tables.whatsapp_promemoria[0].risposta, 'da_spostare');
});

test('staff confirmation: login required, only own studio requests, WhatsApp origin only', async () => {
  db.tables.richieste_prenotazione.push(
    { id: 1, studio_id: STUDIO, nome: 'Mario', telefono: PAZ_TEL, origine: 'whatsapp', tipo_richiesta: 'prenota', date_preferite: [D1], ora_preferita: '10:00' },
    { id: 2, studio_id: STUDIO, nome: 'Anna', telefono: '3330000000', origine: 'pagina_pubblica', tipo_richiesta: 'prenota', date_preferite: [D1] },
    { id: 3, studio_id: 's-2', nome: 'Altro', telefono: '3331111111', origine: 'whatsapp', tipo_richiesta: 'prenota', date_preferite: [D1] },
  );
  assert.equal((await handler(invia({ richiesta_id: 1, data: D1, ora: '10:00' }, null))).status, 401);
  assert.equal((await handler(invia({ richiesta_id: 1, data: D1, ora: '10:00' }, 'Bearer sconosciuto'))).status, 401);
  assert.equal((await handler(invia({ richiesta_id: 3, data: D1, ora: '10:00' }))).status, 404, 'another studio request is invisible');
  assert.equal((await handler(invia({ richiesta_id: 2, data: D1, ora: '10:00' }))).status, 400);
  assert.equal((await handler(invia({ richiesta_id: 1, data: D1, ora: '25:00' }))).status, 400);
  assert.equal(rete.inviati.length, 0);

  const res = await handler(invia({ richiesta_id: 1, data: D1, ora: '10:30' }));
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  const corpo = await res.json();
  assert.deepEqual(corpo, { ok: true, inviato: true, errore: null });
  assert.equal(rete.inviati[0].to, PAZ_TEL);
  assert.match(rete.inviati[0].text.body, /le confermiamo l'appuntamento di .* alle 10:30/);
  assert.equal(db.tables.whatsapp_messages.at(-1).origine, 'sistema');
});

test('a cancellation confirmation uses the stored appointment, not client input', async () => {
  db.tables.richieste_prenotazione.push({ id: 9, studio_id: STUDIO, nome: 'Mario', telefono: PAZ_TEL, origine: 'whatsapp', tipo_richiesta: 'disdici', date_preferite: [D1], ora_preferita: '09:00' });
  await handler(invia({ richiesta_id: 9, data: D2, ora: '18:00' }));
  assert.match(rete.inviati[0].text.body, /abbiamo annullato il suo appuntamento di .* alle 09:00/);
});

test('the browser preflight is answered for the staff path', async () => {
  const res = await handler(new Request('https://fn.local/whatsapp-webhook/invia', { method: 'OPTIONS' }));
  assert.equal(res.status, 200);
  assert.match(res.headers.get('access-control-allow-headers'), /authorization/);
});
