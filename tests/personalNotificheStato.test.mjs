// POL-VITA-018 — cartelle suggerite, stato delle cartelle, notifiche sul telefono (web push).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {
  STATI, inAttesaDaTroppo, giorniDa, cartelleVisibili, salvaCartella, nomeProposto, unisciCartelle, ignoraSuggerimento, suggerisciConAI,
} from '../personal/src/lib/cartelle.js';
import { supporto, chiaveInByte, attivaNotifiche, provaNotifica, URL_NOTIFICHE } from '../personal/src/lib/notifiche.js';

const plain = (x) => JSON.parse(JSON.stringify(x));
function clientFinto(dati = {}) {
  const chiamate = [];
  const catena = (q) => {
    chiamate.push(q);
    const c = new Proxy({}, { get(_t, m) {
      if (m === 'then') return (ok) => Promise.resolve({ data: dati, error: null }).then(ok);
      return (...a) => { q.passi.push([m, ...a]); return c; };
    } });
    return c;
  };
  return {
    chiamate,
    from(tabella) { return catena({ tabella, passi: [] }); },
    rpc(nome, arg) { chiamate.push({ tabella: `rpc:${nome}`, passi: [['rpc', arg]] }); return Promise.resolve({ data: 3, error: null }); },
  };
}
const passi = (q, nome) => q.passi.filter(([p]) => p === nome).map(([, ...a]) => a);

test('stato: aperta, in attesa, chiusa; data del cambio salvata, tolto lo stato si toglie la data', async () => {
  assert.deepEqual(Object.keys(STATI), ['aperta', 'in_attesa', 'chiusa']);
  const db = clientFinto();
  await salvaCartella(db, 'Kerdos SPV', { stato: 'in_attesa' });
  const riga = passi(db.chiamate[0], 'upsert')[0][0];
  assert.equal(riga.stato, 'in_attesa');
  assert.ok(riga.stato_dal);
  const db2 = clientFinto();
  await salvaCartella(db2, 'Kerdos SPV', { stato: 'inventato' });
  assert.deepEqual([passi(db2.chiamate[0], 'upsert')[0][0].stato, passi(db2.chiamate[0], 'upsert')[0][0].stato_dal], [null, null]);
});

test('in attesa da troppo: oltre 15 giorni, i più vecchi prima; filtri per stato', () => {
  const ora = new Date('2026-10-18T10:00:00Z');
  const c = [
    { ente: 'A', stato: 'in_attesa', stato_dal: '2026-10-10T10:00:00Z', n_utili: 1 },
    { ente: 'B', stato: 'in_attesa', stato_dal: '2026-09-01T10:00:00Z', n_utili: 1 },
    { ente: 'C', stato: 'in_attesa', stato_dal: '2026-09-20T10:00:00Z', n_utili: 1 },
    { ente: 'D', stato: 'chiusa', stato_dal: '2026-01-01T10:00:00Z', n_utili: 1 },
    { ente: 'E', stato: null, n_utili: 1 },
  ];
  assert.deepEqual(inAttesaDaTroppo(c, 15, ora).map((x) => x.ente), ['B', 'C']);
  assert.equal(giorniDa('2026-09-01T10:00:00Z', ora), 47);
  assert.deepEqual(cartelleVisibili(c, { stato: 'attive' }).map((x) => x.ente).sort(), ['A', 'B', 'C', 'E']);
  assert.deepEqual(cartelleVisibili(c, { stato: 'chiusa' }).map((x) => x.ente), ['D']);
  assert.deepEqual(cartelleVisibili(c, { stato: 'in_attesa' }).map((x) => x.ente).sort(), ['A', 'B', 'C']);
});

test('suggerimenti: nome proposto, unione cartella per cartella, proposta scartata per sempre', async () => {
  assert.equal(nomeProposto({ dominio: 'optsrl.it', enti: ['OPT S.R.L.', 'Wynn\'s'] }), 'OPT S.R.L.');
  assert.equal(nomeProposto({ dominio: 'giordanocommercialisti.com', enti: ['Dott. Paolo Giordano', 'Info - Giordano Commercialisti'] }), 'Info - Giordano Commercialisti');
  assert.equal(nomeProposto({ dominio: 'prelios.com', enti: ['Giovannoni Andrea (EXT)', 'Caterisano Maria (EXT)'] }), 'Giovannoni Andrea (EXT)');
  const db = clientFinto();
  assert.equal(await unisciCartelle(db, ['Giovannoni Andrea (EXT)', 'Kerdos SPV', 'Caterisano Maria (EXT)'], ' Kerdos SPV '), 6);
  assert.deepEqual(db.chiamate.map((c) => c.passi[0][1].da), ['Giovannoni Andrea (EXT)', 'Caterisano Maria (EXT)']);
  await assert.rejects(unisciCartelle(db, ['A', 'B'], ' '), /nome/);
  const db2 = clientFinto();
  await ignoraSuggerimento(db2, 'dominio:prelios.com');
  assert.equal(db2.chiamate[0].tabella, 'suggerimenti_ignorati');
  assert.deepEqual(passi(db2.chiamate[0], 'upsert')[0][0], { chiave: 'dominio:prelios.com' });
  let corpo;
  const gruppi = await suggerisciConAI({ token: 'jwt' }, async (_u, o) => { corpo = JSON.parse(o.body); return { json: async () => ({ ok: true, gruppi: [{ nome: 'Kerdos SPV', enti: ['A', 'B'] }] }) }; });
  assert.equal(corpo.azione, 'suggerisci');
  assert.equal(gruppi.length, 1);
});

test('notifiche: su iPhone serve l\'app sulla schermata Home; chiave VAPID in byte', () => {
  assert.equal(supporto({ navigator: { userAgent: 'iPhone', standalone: false }, matchMedia: () => ({ matches: false }) }).motivo, 'installa');
  assert.equal(supporto({ navigator: { userAgent: 'Mozilla', serviceWorker: {} }, PushManager: 1, Notification: 1, matchMedia: () => ({ matches: false }) }).ok, true);
  assert.deepEqual([...chiaveInByte('AQID_-8')], [1, 2, 3, 255, 239]);
});

function telefonoFinto(permesso = 'granted') {
  const iscritto = { endpoint: 'https://web.push.apple.com/abc', toJSON: () => ({ endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: 'k', auth: 'a' } }) };
  const reg = { pushManager: { getSubscription: async () => null, subscribe: async (o) => { reg.opzioni = o; return iscritto; } } };
  return {
    reg,
    g: { navigator: { userAgent: 'iPhone', standalone: true, serviceWorker: { getRegistration: async () => null, register: async (u, o) => { reg.sw = [u, o]; return reg; } } },
      PushManager: 1, Notification: { requestPermission: async () => permesso, permission: permesso }, matchMedia: () => ({ matches: true }) },
  };
}

test('attiva: permesso con un tocco, iscrizione con la chiave del server, salvata nel database', async () => {
  const { g, reg } = telefonoFinto();
  const db = clientFinto([{ id: 'i1' }]);
  const endpoint = await attivaNotifiche(db, { g, fetchImpl: async (u) => { assert.equal(u, URL_NOTIFICHE); return { json: async () => ({ ok: true, chiave: 'AQID' }) }; } });
  assert.equal(endpoint, 'https://web.push.apple.com/abc');
  assert.deepEqual(reg.sw, ['/personal/sw-notifiche.js', { scope: '/personal/' }]);
  assert.equal(reg.opzioni.userVisibleOnly, true);
  assert.equal(db.chiamate[0].tabella, 'push_iscrizioni');
  const riga = passi(db.chiamate[0], 'upsert')[0];
  assert.deepEqual(plain(riga[0].chiavi), { p256dh: 'k', auth: 'a' });
  assert.deepEqual(riga[1], { onConflict: 'endpoint' });
  await assert.rejects(attivaNotifiche(clientFinto(), { g: telefonoFinto('denied').g }), /Permesso negato/);
});

test('prova: solo con la sessione di Luca; errore chiaro se nessun telefono è iscritto', async () => {
  let intestazioni;
  assert.equal(await provaNotifica({ token: 'jwt', endpoint: 'e' }, async (_u, o) => { intestazioni = o.headers; return { json: async () => ({ ok: true, inviate: 1 }) }; }), 1);
  assert.equal(intestazioni.Authorization, 'Bearer jwt');
  await assert.rejects(provaNotifica({ token: 'jwt' }, async () => ({ json: async () => ({ ok: true, inviate: 0 }) })), /Nessun telefono/);
  await assert.rejects(provaNotifica({ token: null }), /Sessione/);
});

test('service worker: mostra la notifica e apre l\'app; non tocca le richieste di rete', () => {
  const sw = readFileSync('public/personal/sw-notifiche.js', 'utf8');
  assert.match(sw, /addEventListener\('push'/);
  assert.match(sw, /showNotification\(/);
  assert.match(sw, /addEventListener\('notificationclick'/);
  assert.doesNotMatch(sw, /addEventListener\('fetch'/);
});

test('funzione notifiche: chiavi solo nel database, mai i clinici, una volta al giorno, prova solo per il proprietario', () => {
  const fn = readFileSync('supabase/archivio/functions/notifiche-personal/index.ts', 'utf8');
  assert.match(fn, /from\('push_chiavi'\)/);
  assert.match(fn, /json\(\{ ok: true, chiave: k\.pubblica \}\)/);
  assert.doesNotMatch(fn, /privata[^:]*\}\)\s*;?\s*$/m, 'la privata non esce mai');
  assert.doesNotMatch(fn, /json\([^)]*privata/);
  assert.match(fn, /fascicolo !== 'clinico_pazienti'/);
  assert.match(fn, /from\('push_inviate'\)/);
  assert.match(fn, /eProprietario\(req\)/);
  assert.match(fn, /email_confirmed_at/);
  assert.match(fn, /update\(\{ attiva: false \}\)/, 'iscrizioni scadute spente, non cancellate');
  assert.doesNotMatch(fn, /\.delete\(/);
});

test('migrazione 018: solo aggiunte; chiavi del server senza accesso dall\'app; suggerimenti senza clinici', () => {
  const sql = readFileSync('supabase/archivio/migrations/20261018150000_pol_vita_018_stato_suggerimenti_notifiche.sql', 'utf8');
  assert.doesNotMatch(sql, /\b(drop|delete\s+from|truncate\s+table)\b/i);
  assert.match(sql, /add column if not exists stato text/);
  assert.match(sql, /check \(stato is null or stato in \('aperta', 'in_attesa', 'chiusa'\)\)/);
  assert.match(sql, /revoke all on push_chiavi from anon, authenticated/);
  assert.doesNotMatch(sql, /create policy[^;]*on push_chiavi/);
  assert.match(sql, /create policy proprietario on push_iscrizioni/);
  const vista = sql.slice(sql.indexOf('create or replace view v_suggerimenti_cartelle'), sql.indexOf('revoke all on v_suggerimenti_cartelle'));
  assert.match(vista, /fascicolo <> 'clinico_pazienti'/);
  assert.match(vista, /gmail\|/);
  assert.match(vista, /suggerimenti_ignorati/);
});

test('script: notifiche alle 7 col riepilogo e poi al massimo ogni ora tra le 8 e le 21', () => {
  const codice = readFileSync('poliedron/archivio/Code.gs', 'utf8');
  assert.match(codice, /function digest\(\) \{\n {2}inviaNotifiche_\(true\);/);
  const elabora = codice.slice(codice.indexOf('function elabora('), codice.indexOf('function elaboraThread_('));
  assert.match(elabora, /inviaNotifiche_\(false\)/);
  const fn = codice.slice(codice.indexOf('function inviaNotifiche_('), codice.indexOf('function digest('));
  assert.match(fn, /ora < 8 \|\| ora > 21/);
  assert.match(fn, /55 \* 60 \* 1000/);
  assert.match(fn, /\/functions\/v1\/notifiche-personal/);
  const props = {};
  const ctx = { console, JSON, Date, Math, String, Number, Array, Object, RegExp, Error,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null, setProperty: (k, v) => { props[k] = v; } }) },
    Utilities: { formatDate: () => '3' }, UrlFetchApp: { fetch: () => { throw new Error('non deve chiamare di notte'); } } };
  vm.createContext(ctx);
  vm.runInContext(codice, ctx);
  ctx.logErrore_ = (r, e) => { throw e; };
  ctx.inviaNotifiche_(false); // alle 3 di notte non parte nulla
});

test('script, cartelle suggerite dall\'AI: dopo il controllo del proprietario, mai i clinici, solo cartelle esistenti', () => {
  const codice = readFileSync('poliedron/archivio/Code.gs', 'utf8');
  const doPost = codice.slice(codice.indexOf('function doPost('), codice.indexOf('function fileDelDocumento_('));
  assert.ok(doPost.indexOf("req.azione === 'suggerisci'") > doPost.indexOf('PROPRIETARIO || !utente.email_confirmed_at'));
  const ctx = { console, JSON, Date, Math, String, Number, Array, Object, RegExp, Error,
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) } };
  vm.createContext(ctx);
  vm.runInContext(codice, ctx);
  const richieste = [];
  ctx.sb_ = (p) => { richieste.push(p); return [{ ente: 'Giovannoni Andrea (EXT)', email_oggetto: 'KERDOS SPV' }, { ente: 'Caterisano Maria (EXT)', email_oggetto: 'SPV Kerdos' }]; };
  let alModello;
  ctx.claudeMessaggi_ = (b) => { alModello = JSON.stringify(b.messages); return { content: [{ type: 'text', text: JSON.stringify({ gruppi: [
    { nome: 'Kerdos SPV', enti: ['Giovannoni Andrea (EXT)', 'Caterisano Maria (EXT)', 'Inventata'], motivo: 'stessa pratica' },
    { nome: 'Solo', enti: ['Giovannoni Andrea (EXT)'], motivo: 'x' }] }) }] }; };
  const r = ctx.suggerisciCartelle_();
  assert.match(richieste[0], /fascicolo=neq\.clinico_pazienti/);
  assert.match(alModello, /KERDOS SPV/);
  assert.deepEqual(plain(r.gruppi), [{ nome: 'Kerdos SPV', motivo: 'stessa pratica', enti: ['Giovannoni Andrea (EXT)', 'Caterisano Maria (EXT)'] }]);
});

test('app: stato in cartella ed elenco, avviso di attesa, proposte da unire, notifiche in Impostazioni', () => {
  const cart = readFileSync('personal/src/sezioni/documenti/Cartelle.jsx', 'utf8');
  const idx = readFileSync('personal/src/sezioni/documenti/index.jsx', 'utf8');
  const imp = readFileSync('personal/src/sezioni/impostazioni/Impostazioni.jsx', 'utf8');
  assert.match(cart, /className="pp-stato-cartella"/);
  assert.match(cart, /className="pp-avviso-attesa"/);
  assert.match(cart, /\['attive', 'Attive'\], \['aperta', 'Aperte'\], \['in_attesa', 'In attesa'\], \['chiusa', 'Chiuse'\]/);
  assert.match(cart, /export function PaginaSuggerimenti/);
  assert.match(cart, /Non unire/);
  assert.match(idx, /'suggerimenti-cartelle'/);
  assert.match(imp, /<Sezione titolo="Notifiche sul telefono">/);
  assert.match(imp, /Aggiungi alla schermata Home/);
});
