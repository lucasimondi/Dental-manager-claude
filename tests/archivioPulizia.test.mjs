// PO 2026-10-18: "facciamo che gli si possa chiedere di analizzare documenti e risolverli in massa …
// si possano cancellare anche le mail indietro e i documenti allegati che non servono".
// Decisioni di Luca: email nel Cestino di Gmail; documenti dei pazienti solo se li chiede.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { eseguiProposta, elementiScelti, esitoProposta, titoloProposta } from '../personal/src/lib/pulizia.js';

const codice = readFileSync('poliedron/archivio/Code.gs', 'utf8');
const plain = (x) => JSON.parse(JSON.stringify(x));

function scriptFinto({ righe = {}, risposteGemini = [] } = {}) {
  const query = [], cestinate = [], chiamate = [];
  const proprieta = { API_PAUSA_FINO: String(Date.now() + 3600e3), GEMINI_API_KEY: 'k' };
  const ctx = {
    console, JSON, Date, Math, String, Number, Array, Object, RegExp, Error, encodeURIComponent,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => proprieta[k] ?? null, setProperty: (k, v) => { proprieta[k] = v; } }) },
    Utilities: { sleep: () => {}, formatDate: (d) => d.toISOString().slice(0, 10) },
    GmailApp: { getMessageById: (id) => ({ moveToTrash: () => cestinate.push(id) }) },
    UrlFetchApp: { fetch: (url, o) => {
      chiamate.push(JSON.parse(o.payload));
      const r = risposteGemini.shift();
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: r } }] }) };
    } },
  };
  vm.createContext(ctx);
  vm.runInContext(codice, ctx);
  ctx.sb_ = (q) => { query.push(q); const k = Object.keys(righe).find((p) => q.startsWith(p)); return k ? (typeof righe[k] === 'function' ? righe[k](q) : righe[k]) : []; };
  ctx.logErrore_ = () => {};
  return { ctx, query, cestinate, chiamate };
}

const DOCS = [
  { id: 'd1', titolo: 'Depliant – Ikea – primavera', fascicolo: 'pubblicita', drive_file_id: 'f1' },
  { id: 'd2', titolo: 'Referto paziente Rossi', fascicolo: 'clinico_pazienti', drive_file_id: 'f2' },
];

test('proposte: senza criteri niente; i clinici esclusi dalla query se Luca non li chiede', () => {
  const { ctx, query } = scriptFinto({ righe: { 'documenti?select=': DOCS.slice(0, 1) } });
  const c = { proposte: [], pazientiChiesti: false };
  assert.match(ctx.strumentoChat_('proponi_eliminazione', {}, c).errore, /Servono dei criteri/);
  const r = ctx.strumentoChat_('proponi_eliminazione', { fascicolo: 'pubblicita', prima_del: '2020-01-01', testo: 'depliant', descrizione: 'Depliant vecchi' }, c);
  assert.equal(r.trovati, 1);
  assert.match(query.at(-1), /fascicolo=eq\.pubblicita&fascicolo=neq\.clinico_pazienti/);
  assert.match(query.at(-1), /email_data=lt\.2020-01-01/);
  assert.match(query.at(-1), /or=\(titolo\.ilike\.\*depliant\*/);
  assert.equal(c.proposte.length, 1);
  assert.deepEqual(plain(c.proposte[0]).elementi, [{ id: 'd1', titolo: 'Depliant – Ikea – primavera', fascicolo: 'pubblicita', drive_file_id: 'f1' }]);
  assert.match(r.nota, /non è stato ancora fatto nulla/);
});

test('proposte: i pazienti entrano solo se chiesti, e i loro titoli non vanno mai al modello', () => {
  const { ctx, query } = scriptFinto({ righe: { 'documenti?select=': DOCS } });
  const c = { proposte: [], pazientiChiesti: true };
  const r = ctx.strumentoChat_('proponi_eliminazione', { fascicolo: 'clinico_pazienti', prima_del: '2012-01-01' }, c);
  assert.doesNotMatch(query.at(-1), /neq\.clinico_pazienti/);
  assert.equal(r.di_cui_clinici, 1);
  assert.doesNotMatch(JSON.stringify(r), /Rossi/);
  assert.equal(c.proposte[0].elementi.length, 2, 'all\'app sì, perché Luca deve vedere cosa elimina');
  // Rianalisi: mai i clinici, anche se chiesti.
  const c2 = { proposte: [], pazientiChiesti: true };
  ctx.strumentoChat_('proponi_rianalisi', { testo: 'x' }, c2);
  assert.deepEqual(c2.proposte[0].elementi.map((e) => e.id), ['d1']);
  // Senza la parola "pazienti" nella domanda, il fascicolo clinico resta fuori.
  const { ctx: ctx3, query: q3 } = scriptFinto({ righe: { 'documenti?select=': [] } });
  ctx3.strumentoChat_('proponi_eliminazione', { fascicolo: 'clinico_pazienti' }, { proposte: [], pazientiChiesti: false });
  assert.match(q3.at(-1), /fascicolo=neq\.clinico_pazienti/);
});

test('pratiche: proposta di chiudere quelle ferme, mai le cliniche', () => {
  const { ctx, query } = scriptFinto({ righe: { 'v_pratiche?': [{ id: 'p1', titolo: 'Enel – via Roma', fascicolo: 'utenze' }] } });
  const c = { proposte: [], pazientiChiesti: false };
  assert.equal(ctx.strumentoChat_('proponi_risolvi_pratiche', { ferme_da_mesi: 24 }, c).trovati, 1);
  assert.match(query.at(-1), /stato=in\.\(aperta,in_corso\)&fascicolo=neq\.clinico_pazienti/);
  assert.match(query.at(-1), /ultima_attivita=lt\.\d{4}-\d{2}-\d{2}/);
  assert.equal(c.proposte[0].tipo, 'risolvi_pratiche');
});

test('email: nel Cestino solo se tutti i suoi allegati archiviati vengono eliminati; mai i caricati', () => {
  const { ctx, cestinate } = scriptFinto({ righe: {
    'documenti?select=id,gmail_message_id&id=in.': [
      { id: '11111111-1111-1111-1111-111111111111', gmail_message_id: 'mA' },
      { id: '22222222-2222-2222-2222-222222222222', gmail_message_id: 'mB' },
      { id: '33333333-3333-3333-3333-333333333333', gmail_message_id: 'caricato:x' },
    ],
    'documenti?select=id&gmail_message_id=eq.mA': [{ id: '11111111-1111-1111-1111-111111111111' }],
    'documenti?select=id&gmail_message_id=eq.mB': [{ id: '22222222-2222-2222-2222-222222222222' }, { id: '44444444-4444-4444-4444-444444444444' }],
  } });
  const r = ctx.cestinaEmail_(['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'non-un-id']);
  assert.deepEqual(plain(r), { ok: true, cestinate: 1, tenute: 1 });
  assert.deepEqual(cestinate, ['mA']);
  const post = codice.slice(codice.indexOf('function doPost('), codice.indexOf('function fileDelDocumento_('));
  assert.ok(post.indexOf("req.azione === 'cestina_email'") > post.indexOf('PROPRIETARIO || !utente.email_confirmed_at'), 'solo il proprietario verificato');
  assert.match(codice, /moveToTrash\(\)/);
  assert.doesNotMatch(codice, /\.deleteThread|\.delete\(\)|Gmail\.Users\.Messages\.remove/, 'mai eliminazione definitiva');
});

test('chat con Gemini: chiama gli strumenti, restituisce testo e proposte', () => {
  const { ctx, chiamate } = scriptFinto({
    righe: { 'documenti?select=': DOCS.slice(0, 1) },
    risposteGemini: [
      [{ functionCall: { name: 'proponi_eliminazione', args: { fascicolo: 'pubblicita', descrizione: 'Pubblicità' } }, thoughtSignature: 'sig' }],
      [{ text: 'Ho trovato 1 depliant: confermi?' }],
    ],
  });
  ctx.claudeInPausa_ = () => true;
  const r = ctx.chiediPoliedron_({ domanda: 'Elimina i depliant', storia: [{ ruolo: 'utente', testo: 'ciao' }, { ruolo: 'assistente', testo: 'ciao!' }] });
  assert.equal(r.risposta, 'Ho trovato 1 depliant: confermi?');
  assert.equal(r.proposte.length, 1);
  assert.equal(chiamate.length, 2);
  assert.deepEqual(chiamate[0].contents.map((c) => c.role), ['user', 'model', 'user']);
  assert.ok(chiamate[0].tools[0].functionDeclarations.some((f) => f.name === 'proponi_rianalisi'));
  assert.ok(!('parameters' in chiamate[0].tools[0].functionDeclarations.find((f) => f.name === 'riepilogo_archivio')), 'niente schema vuoto');
  assert.equal(chiamate[1].contents.at(-2).parts[0].thoughtSignature, 'sig', 'le parti del modello tornano invariate');
  assert.equal(chiamate[1].contents.at(-1).parts[0].functionResponse.name, 'proponi_eliminazione');
});

test('app: eliminazione confermata → prima Cestino di Drive e Gmail, poi archivio; rianalisi mai dei clinici', async () => {
  const passi = [];
  const fetchFinto = globalThis.fetch;
  globalThis.fetch = async (_u, o) => { const b = JSON.parse(o.body); passi.push(b.azione); return { json: async () => (b.azione === 'cestina' ? { ok: true, cestinati: b.ids, non_trovati: [] } : { ok: true, cestinate: 1, tenute: 0 }) }; };
  const db = {
    rpc: async () => { passi.push('archivio'); return { data: { eliminato: true }, error: null }; },
    from: () => { const q = { update: (c) => { passi.push(['update', c]); return q; }, in: () => q, neq: (k, v) => { passi.push(['neq', k, v]); return q; }, then: (r) => r({ error: null }) }; return q; },
  };
  try {
    const proposta = { tipo: 'elimina', n: 2, elementi: [{ id: 'a', drive_file_id: 'fa' }, { id: 'b', drive_file_id: 'fb' }] };
    const r = await eseguiProposta({ proposta, elementi: elementiScelti(proposta, new Set(['b'])), db, token: 't' });
    assert.deepEqual(passi, ['cestina', 'cestina_email', 'archivio']);
    assert.equal(esitoProposta(proposta, r), '1 documento eliminato · 1 file nel Cestino di Drive · 1 email nel Cestino di Gmail');
    passi.length = 0;
    const ri = { tipo: 'rianalizza', n: 2, elementi: [{ id: 'x', fascicolo: 'utenze' }, { id: 'y', fascicolo: 'clinico_pazienti' }] };
    assert.deepEqual(elementiScelti(ri).map((e) => e.id), ['x']);
    await eseguiProposta({ proposta: ri, elementi: elementiScelti(ri), db, token: 't' });
    assert.deepEqual(passi, [['update', { da_analizzare: true }], ['neq', 'fascicolo', 'clinico_pazienti']]);
    assert.equal(titoloProposta({ tipo: 'risolvi_pratiche' }, 3), 'Segnare 3 pratiche risolte');
  } finally { globalThis.fetch = fetchFinto; }
});

test('app: tasto Risolta sulle pratiche e proposte confermabili nella chat', () => {
  const ui = readFileSync('personal/src/ui.jsx', 'utf8');
  assert.match(ui, /export function ElencoPratiche\(\{ elenco, onApri, onRisolvi \}\)/);
  assert.match(ui, /✓ Risolta/);
  assert.match(readFileSync('personal/src/sezioni/documenti/Documenti.jsx', 'utf8'), /onRisolvi=\{\(p\) => esegui\(async \(\) => \{ await cambiaStatoPratica\(archivioDb, p\.id, 'risolta'\)/);
  assert.match(readFileSync('personal/src/sezioni/oggi/Oggi.jsx', 'utf8'), /onRisolvi=/);
  const chat = readFileSync('personal/src/sezioni/poliedron/Poliedron.jsx', 'utf8');
  assert.match(chat, /<Proposta key=\{j\} proposta=\{p\}/);
  assert.match(chat, /Anche le email da cui arrivano/);
  assert.match(chat, /disabled=\{!scelti\.length \|\| stato\?\.lavoro\}/);
});
