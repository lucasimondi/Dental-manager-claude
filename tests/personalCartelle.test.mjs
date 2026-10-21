// POL-VITA-016 — Cartelle in Documenti: una cartella per ente con periodo, contatti, etichette,
// promemoria, sintesi dell'AI e bozza di risposta (solo bozza). Mai i documenti clinici.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {
  periodoCartella, cartelleVisibili, contattiCartella, etichettePulite, icsPromemoria, nuovoPromemoria, rinominaCartella,
  salvaCartella, sciogliCartella, analizzaCartella, bozzaRisposta,
} from '../personal/src/lib/cartelle.js';
import { condividi } from '../personal/src/lib/condividi.js';

const plain = (x) => JSON.parse(JSON.stringify(x));

function clientFinto(dati = []) {
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
    rpc(nome, arg) { chiamate.push({ tabella: `rpc:${nome}`, passi: [['rpc', arg]] }); return Promise.resolve({ data: 8, error: null }); },
  };
}
const passi = (q, nome) => q.passi.filter(([p]) => p === nome).map(([, ...a]) => a);

test('periodo della cartella: da mese a mese, un mese solo, nessuna data', () => {
  assert.equal(periodoCartella('2022-04-06', '2023-03-16'), 'apr 2022 – mar 2023');
  assert.equal(periodoCartella('2023-03-01', '2023-03-16'), 'mar 2023');
  assert.equal(periodoCartella(null, '2023-03-16'), 'mar 2023');
  assert.equal(periodoCartella(null, null), '');
});

test('cartelle visibili: le più recenti prima, le sole poco utili nascoste, filtro per nome ed etichetta', () => {
  const c = [
    { ente: 'OPT S.R.L.', n: 40, n_utili: 0, al: '2012-12-10', etichette: [] },
    { ente: 'Kerdos SPV', n: 8, n_utili: 8, al: '2023-03-16', etichette: ['Da pagare'] },
    { ente: 'Enel Energia', n: 30, n_utili: 30, al: '2024-01-02', etichette: [] },
  ];
  assert.deepEqual(cartelleVisibili(c).map((x) => x.ente), ['Enel Energia', 'Kerdos SPV']);
  assert.deepEqual(cartelleVisibili(c, { anchePocoUtili: true }).map((x) => x.ente), ['Enel Energia', 'Kerdos SPV', 'OPT S.R.L.']);
  assert.deepEqual(cartelleVisibili(c, { testo: 'kerd' }).map((x) => x.ente), ['Kerdos SPV']);
  assert.deepEqual(cartelleVisibili(c, { testo: 'pagare' }).map((x) => x.ente), ['Kerdos SPV']);
  assert.deepEqual(cartelleVisibili(c, { etichetta: 'Da pagare' }).map((x) => x.ente), ['Kerdos SPV']);
});

test('contatti: nome ed email dal mittente, contati e ordinati; i caricati dall\'app non sono contatti', () => {
  const r = contattiCartella([
    { email_mittente: '"Giovannoni Andrea (EXT)" <Andrea.Giovannoni@prelios.com>', email_data: '2022-04-06T10:00:00Z' },
    { email_mittente: 'Giovannoni Andrea (EXT) <andrea.giovannoni@prelios.com>', data_documento: '2022-05-01' },
    { email_mittente: 'maria.caterisano@prelios.com', email_data: '2023-03-16T10:00:00Z' },
    { email_mittente: 'Caricato dall\'app' },
  ]);
  assert.deepEqual(plain(r), [
    { nome: 'Giovannoni Andrea (EXT)', email: 'andrea.giovannoni@prelios.com', n: 2, ultimo: '2022-05-01' },
    { nome: 'maria.caterisano@prelios.com', email: 'maria.caterisano@prelios.com', n: 1, ultimo: '2023-03-16' },
  ]);
});

test('etichette pulite: niente doppioni, spazi o vuoti, al massimo 12', () => {
  assert.deepEqual(etichettePulite([' Da  pagare ', 'Da pagare', '', null, 'Chiusa']), ['Da pagare', 'Chiusa']);
  assert.equal(etichettePulite(Array.from({ length: 20 }, (_, i) => `e${i}`)).length, 12);
});

test('promemoria: è una scadenza con la cartella (Agenda, Oggi, riepilogo); data obbligatoria', async () => {
  const db = clientFinto({ id: 's1' });
  await nuovoPromemoria(db, 'Kerdos SPV', { data: '2026-11-15', descrizione: ' Rispondere ', importo: '1.200,50' });
  assert.equal(db.chiamate[0].tabella, 'scadenze');
  assert.deepEqual(passi(db.chiamate[0], 'insert')[0][0], { data: '2026-11-15', descrizione: 'Rispondere', importo: 1200.5, completata: false, cartella: 'Kerdos SPV' });
  const db2 = clientFinto({});
  await nuovoPromemoria(db2, 'Kerdos SPV', { data: '2026-11-15', descrizione: '' });
  assert.equal(passi(db2.chiamate[0], 'insert')[0][0].descrizione, 'Promemoria – Kerdos SPV');
  assert.equal(passi(db2.chiamate[0], 'insert')[0][0].importo, null);
  await assert.rejects(nuovoPromemoria(db, 'X', { data: '15/11' }), /Data/);
});

test('rinomina e unione con la funzione del database; togli la cartella senza toccare i clinici', async () => {
  const db = clientFinto();
  assert.equal(await rinominaCartella(db, 'Giovannoni Andrea (EXT)', ' Kerdos SPV '), 8);
  assert.deepEqual(db.chiamate[0].passi[0], ['rpc', { da: 'Giovannoni Andrea (EXT)', a: 'Kerdos SPV' }]);
  assert.equal(await rinominaCartella(db, 'Kerdos SPV', 'Kerdos SPV'), 0);
  await assert.rejects(rinominaCartella(db, 'Kerdos SPV', '  '), /nome/);
  const db2 = clientFinto([]);
  await sciogliCartella(db2, 'Kerdos SPV');
  assert.deepEqual(passi(db2.chiamate[0], 'update'), [[{ ente: null }]]);
  assert.deepEqual(passi(db2.chiamate[0], 'neq'), [['fascicolo', 'clinico_pazienti']]);
  const db3 = clientFinto({});
  await salvaCartella(db3, 'Kerdos SPV', { etichette: ['Da pagare', 'Da pagare'], note: '  ' });
  assert.equal(db3.chiamate[0].tabella, 'cartelle_ente');
  const riga = passi(db3.chiamate[0], 'upsert')[0][0];
  assert.deepEqual([riga.ente, riga.etichette, riga.note], ['Kerdos SPV', ['Da pagare'], null]);
});

test('AI: sintesi e bozza chieste allo script con il token; errori chiari', async () => {
  const corpi = [];
  const fetchFinto = async (_u, o) => { corpi.push(JSON.parse(o.body)); return { json: async () => ({ ok: true, analisi: { sintesi: 'x' } }) }; };
  await analizzaCartella({ token: 'jwt', ente: 'Kerdos SPV' }, fetchFinto);
  await bozzaRisposta({ token: 'jwt', ente: 'Kerdos SPV', istruzioni: 'chiedi rateizzazione' }, fetchFinto);
  assert.deepEqual(corpi.map((c) => [c.azione, c.ente]), [['cartella', 'Kerdos SPV'], ['bozza', 'Kerdos SPV']]);
  assert.equal(corpi[1].istruzioni, 'chiedi rateizzazione');
  await assert.rejects(analizzaCartella({ token: null, ente: 'X' }, fetchFinto), /Sessione/);
  await assert.rejects(analizzaCartella({ token: 'jwt', ente: 'X' }, async () => ({ json: async () => ({ ok: false, errore: 'Poliedron AI è ferma' }) })), /ferma/);
});

test('calendario del telefono: file .ics di tutto il giorno con avviso alle 9', () => {
  const ics = icsPromemoria({ data: '2026-11-15', descrizione: 'Rispondere, con calma', cartella: 'Kerdos SPV' }, new Date('2026-10-18T10:00:00Z'));
  assert.match(ics, /DTSTART;VALUE=DATE:20261115/);
  assert.match(ics, /DTEND;VALUE=DATE:20261116/);
  assert.match(ics, /SUMMARY:Rispondere\\, con calma/);
  assert.match(ics, /TRIGGER:PT9H/);
  assert.match(ics, /\r\n/);
});

test('condividi più file insieme col foglio del sistema', async () => {
  const visti = [];
  const nav = { canShare: ({ files }) => files.length > 0, share: async (d) => { visti.push(d.files.length); } };
  assert.equal(await condividi({ titolo: '2 documenti', files: [{ name: 'a' }, { name: 'b' }] }, nav), 'files');
  assert.equal(await condividi({ titolo: 'uno', file: { name: 'a' } }, nav), 'file');
  assert.deepEqual(visti, [2, 1]);
});

test('app: Documenti si apre sulle cartelle, a icone o in elenco; selezione con Condividi e Cartella', () => {
  const doc = ['Documenti', 'Selezione'].map((f) => readFileSync(`personal/src/sezioni/documenti/${f}.jsx`, 'utf8')).join('\n');
  const cart = readFileSync('personal/src/sezioni/documenti/Cartelle.jsx', 'utf8');
  const app = readFileSync('personal/src/sezioni/documenti/index.jsx', 'utf8');
  assert.match(doc, /useState\(sotto === 'enti' \? 'cartelle' : sotto \|\| 'cartelle'\)/);
  assert.match(doc, /\['cartelle', 'Cartelle'\], \['recenti', 'Recenti'\]/);
  assert.match(doc, /<span>\{statoCondividi \|\| 'Condividi'\}<\/span>/);
  assert.match(doc, /setFoglio\('cartella'\)/);
  assert.match(doc, /d\.fascicolo !== 'clinico_pazienti'/, 'i clinici non si preparano per la condivisione');
  assert.match(cart, /setModo\('griglia'\)/);
  assert.match(cart, /setModo\('righe'\)/);
  for (const a of ['Sintesi catalogo', 'Rispondi', 'Promemoria', 'Modifica', 'Elimina']) assert.match(cart, new RegExp(`<span>${a}</span>`));
  assert.match(cart, /Togli solo la cartella/);
  assert.match(cart, /<ConfermaElimina n=\{documenti\.length\}/);
  assert.match(cart, /Non invia nulla/);
  assert.match(app, /cartella: \{ titolo: 'Cartella', render: [^\n]*<PaginaCartella/);
  assert.match(app, /'senza-cartella': \{ render:/);
});

test('migrazione 014: solo aggiunte, tabella nuova (quella vecchia "cartelle" non si tocca), vista senza clinici', () => {
  const sql = readFileSync('supabase/archivio/migrations/20261018090000_pol_vita_014_cartelle.sql', 'utf8');
  assert.doesNotMatch(sql, /\b(drop|delete\s+from|truncate\s+table)\b/i);
  assert.match(sql, /create table if not exists cartelle_ente/);
  assert.doesNotMatch(sql, /(table|on|into|update)\s+cartelle\b(?!_ente)/i);
  assert.match(sql, /add column if not exists cartella text/);
  assert.match(sql, /d\.fascicolo <> 'clinico_pazienti'/);
  assert.match(sql, /security_invoker = true/);
  assert.match(sql, /revoke all on v_cartelle from anon/);
  assert.match(sql, /security invoker set search_path = public/);
  assert.match(sql, /revoke execute on function rinomina_cartella\(text, text\) from public, anon/);
});

// Lo script vero in una VM: cosa arriva al modello e cosa si scrive.
function scriptFinto({ documenti = [], messaggio } = {}) {
  const codice = readFileSync('poliedron/archivio/Code.gs', 'utf8');
  const richieste = [];
  const alModello = [];
  const bozze = [];
  const inviate = [];
  const ctx = {
    console, JSON, Date, Math, String, Number, Array, Object, RegExp, Error, encodeURIComponent,
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
    Utilities: { formatDate: (d) => d.toISOString().slice(0, 10) },
    GmailApp: {
      getMessageById: () => ({ ...messaggio, createDraftReply: (t) => bozze.push(t), reply: (t) => inviate.push(t), send: () => inviate.push('send') }),
      sendEmail: () => inviate.push('sendEmail'),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(codice, ctx);
  ctx.sb_ = (percorso, o = {}) => { richieste.push({ percorso, metodo: o.method || 'get', corpo: o.body }); return percorso.startsWith('documenti?') ? documenti : []; };
  ctx.claudeMessaggi_ = (body) => {
    alModello.push(JSON.stringify(body.messages));
    const json = body.output_config ? JSON.stringify({ sintesi: 'Cessione del credito a Kerdos SPV.', punti: ['Conteggio esposizione 004'], da_fare: ['Rispondere'], promemoria: [{ data: '2099-01-10', descrizione: 'Termine' }, { data: '2001-01-01', descrizione: 'Passata' }] }) : 'Gentile dottoressa,\n…\nLuca Simondi';
    return { content: [{ type: 'text', text: json }] };
  };
  ctx.logErrore_ = () => {};
  return { ctx, richieste, alModello, bozze, inviate };
}

test('script, sintesi: chiede solo documenti non clinici, salva la sintesi, tiene solo date future', () => {
  const docs = [{ id: 'd1', titolo: 'Conteggio esposizione 004', email_mittente: 'Caterisano', email_data: '2023-03-16T10:00:00Z' }];
  const { ctx, richieste, alModello } = scriptFinto({ documenti: docs });
  const r = ctx.analizzaCartella_({ ente: 'Kerdos SPV' });
  assert.equal(r.ok, true);
  assert.match(richieste[0].percorso, /ente=eq\.Kerdos%20SPV&fascicolo=neq\.clinico_pazienti/);
  assert.match(alModello[0], /Conteggio esposizione 004/);
  const salva = richieste.find((x) => x.percorso.startsWith('cartelle_ente?on_conflict=ente'));
  assert.equal(salva.metodo, 'post');
  assert.deepEqual(plain(JSON.parse(salva.corpo.sintesi).promemoria), [{ data: '2099-01-10', descrizione: 'Termine' }]);
  assert.deepEqual(plain(ctx.analizzaCartella_({ ente: '  ' })), { ok: false, errore: 'Cartella mancante' });
});

test('script, bozza: solo bozza in Gmail (nulla inviato), mai su email cliniche, mai sui caricati', () => {
  const docs = [{ gmail_message_id: 'caricato:1' }, { gmail_message_id: 'm1', email_oggetto: 'Conteggio', email_mittente: 'Caterisano' }];
  const msg = { getSubject: () => 'CONTEGGIO ESPOSIZIONE 004', getFrom: () => 'maria@prelios.com', getTo: () => 'luca@x.it', getCc: () => '', getPlainBody: () => 'Gentile dottore, in allegato il conteggio.' };
  const { ctx, bozze, inviate, alModello } = scriptFinto({ documenti: docs, messaggio: msg });
  const r = ctx.bozzaRisposta_({ ente: 'Kerdos SPV', istruzioni: 'chiedi rateizzazione' });
  assert.equal(r.ok, true);
  assert.equal(bozze.length, 1);
  assert.deepEqual(inviate, []);
  assert.match(alModello[0], /chiedi rateizzazione/);
  const clinico = scriptFinto({ documenti: docs, messaggio: { ...msg, getSubject: () => 'Referto OPT paziente Rossi' } });
  assert.equal(clinico.ctx.bozzaRisposta_({ ente: 'X' }).ok, false);
  assert.equal(clinico.bozze.length, 0);
  assert.equal(clinico.alModello.length, 0);
  const soloCaricati = scriptFinto({ documenti: [{ gmail_message_id: 'caricato:1' }], messaggio: msg });
  assert.equal(soloCaricati.ctx.bozzaRisposta_({ ente: 'X' }).ok, false);
  const codice = readFileSync('poliedron/archivio/Code.gs', 'utf8');
  const fn = codice.slice(codice.indexOf('function bozzaRisposta_('), codice.indexOf('function utenteSupabase_('));
  assert.doesNotMatch(fn, /sendEmail|\.reply\(|\.send\(|forward/);
  const doPost = codice.slice(codice.indexOf('function doPost('), codice.indexOf('function fileDelDocumento_('));
  assert.ok(doPost.indexOf("req.azione === 'cartella'") > doPost.indexOf('PROPRIETARIO || !utente.email_confirmed_at'));
  assert.ok(doPost.indexOf("req.azione === 'bozza'") > doPost.indexOf('PROPRIETARIO || !utente.email_confirmed_at'));
});
