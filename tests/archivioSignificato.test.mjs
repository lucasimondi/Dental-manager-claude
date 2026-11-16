// POL-VITA-035 RICERCA PER SIGNIFICATO — PO 2026-11-16: "Facciamo ricerca per significato anche, e poi mergia".
// Vettori Gemini dei documenti (mai i clinici), ricerca per vicinanza, fusione con la ricerca per parole.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { cercaPerSignificato } from '../personal/src/lib/archivio.js';

const codice = readFileSync('poliedron/archivio/Code.gs', 'utf8');
const sql = readFileSync('supabase/archivio/migrations/20261116150000_pol_vita_035_significato.sql', 'utf8');
const sqlEsclusi = readFileSync('supabase/archivio/migrations/20261116151000_pol_vita_035_significato_esclusi.sql', 'utf8');
const chiedi = readFileSync('personal/src/sezioni/documenti/Chiedi.jsx', 'utf8');

const vettore = (x) => Array.from({ length: 768 }, (_, i) => (i === 0 ? x : 0.5));

function scriptFinto({ chiave = 'k', risposteGemini = [], coda = [], parole = [], significato = [] } = {}) {
  const proprieta = { GEMINI_API_KEY: chiave };
  const gemini = [];
  const chiamate = [];
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Array, Object, RegExp, Error, encodeURIComponent, isFinite,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => proprieta[k] ?? null, setProperty: (k, v) => { proprieta[k] = v; } }) },
    Utilities: { sleep() {}, formatDate: (d) => d.toISOString().slice(0, 10) },
    UrlFetchApp: { fetch: (url, o) => {
      gemini.push({ url, corpo: JSON.parse(o.payload), chiave: o.headers['x-goog-api-key'] });
      const [code, corpo] = risposteGemini.shift() || [200, null];
      const n = JSON.parse(o.payload).requests.length;
      const testo = corpo ?? JSON.stringify({ embeddings: Array.from({ length: n }, (_, i) => ({ values: vettore(i + 1) })) });
      return { getResponseCode: () => code, getContentText: () => testo };
    } },
  };
  vm.createContext(ctx);
  vm.runInContext(codice, ctx);
  ctx.logErrore_ = () => {};
  ctx.sb_ = (percorso, opzioni = {}) => {
    chiamate.push({ percorso, corpo: opzioni.body, prefer: opzioni.prefer });
    if (percorso.startsWith('rpc/documenti_senza_vettore')) return coda;
    if (percorso.startsWith('rpc/cerca_archivio_v2')) return parole;
    if (percorso.startsWith('rpc/cerca_significato')) return significato;
    return null;
  };
  return { ctx, proprieta, gemini, chiamate };
}

test('vettori dei documenti: Gemini RETRIEVAL_DOCUMENT a 768 dimensioni, normalizzati, salvati con l\'impronta', () => {
  const coda = [{ id: 'd1', testo: 'Fattura stufa pellet', impronta: 'h1' }, { id: 'd2', testo: 'Polizza casa', impronta: 'h2' }];
  const { ctx, gemini, chiamate } = scriptFinto({ coda });
  assert.equal(ctx.calcolaVettori_(Date.now() + 60000), false);
  assert.match(gemini[0].url, /models\/gemini-embedding-001:batchEmbedContents$/);
  assert.equal(gemini[0].chiave, 'k');
  assert.deepEqual(gemini[0].corpo.requests.map((r) => [r.taskType, r.outputDimensionality, r.content.parts[0].text]), [
    ['RETRIEVAL_DOCUMENT', 768, 'Fattura stufa pellet'], ['RETRIEVAL_DOCUMENT', 768, 'Polizza casa'],
  ]);
  const scrittura = chiamate.find((c) => c.percorso.startsWith('documenti_vettori?on_conflict=documento_id'));
  assert.equal(scrittura.prefer, 'resolution=merge-duplicates,return=minimal');
  assert.deepEqual(scrittura.corpo.map((r) => [r.documento_id, r.impronta, r.modello]), [['d1', 'h1', 'gemini-embedding-001'], ['d2', 'h2', 'gemini-embedding-001']]);
  const numeri = JSON.parse(scrittura.corpo[0].vettore);
  assert.equal(numeri.length, 768);
  assert.ok(Math.abs(Math.hypot(...numeri) - 1) < 1e-3, 'lunghezza 1');
});

test('vettori: quota del giorno finita → pausa di 3 ore, nessuna scrittura; senza chiave non si chiama Gemini', () => {
  const { ctx, proprieta, chiamate } = scriptFinto({ coda: [{ id: 'd1', testo: 'x', impronta: 'h' }], risposteGemini: [[429, 'Quota exceeded: EmbedContentRequestsPerDayPerProject']] });
  assert.equal(ctx.calcolaVettori_(Date.now() + 60000), true);
  assert.ok(Number(proprieta.VETTORI_PAUSA_FINO) > Date.now() + 2 * 3600e3);
  assert.equal(chiamate.some((c) => c.percorso.startsWith('documenti_vettori')), false);
  assert.equal(ctx.calcolaVettori_(Date.now() + 60000), false, 'in pausa non riprova');
  const senza = scriptFinto({ chiave: null, coda: [{ id: 'd1', testo: 'x', impronta: 'h' }] });
  assert.equal(senza.ctx.calcolaVettori_(Date.now() + 60000), false);
  assert.equal(senza.gemini.length, 0);
});

test('chat: parole + significato uniti, i documenti in entrambe in cima, quelli nuovi segnati, mai i clinici', () => {
  const { ctx, gemini, chiamate } = scriptFinto({
    parole: [{ id: 'a', fascicolo: 'utenze', titolo: 'Bolletta gas' }, { id: 'b', fascicolo: 'utenze', titolo: 'Caldaia contratto' }],
    significato: [{ id: 'b', fascicolo: 'utenze', titolo: 'Caldaia contratto' }, { id: 'c', fascicolo: 'riscaldamento', titolo: 'Fattura tecnico stufa' }, { id: 'p', fascicolo: 'clinico_pazienti', titolo: 'Referto' }],
  });
  const r = ctx.strumentoChat_('cerca_documenti', { testo: 'caldaia', da: '2025-01-01' });
  assert.deepEqual(JSON.parse(JSON.stringify(r.documenti.map((d) => [d.id, d.per_significato ?? false]))), [['b', false], ['a', false], ['c', true]]);
  assert.equal(gemini[0].corpo.requests[0].taskType, 'RETRIEVAL_QUERY');
  const cerca = chiamate.find((c) => c.percorso.startsWith('rpc/cerca_significato'));
  assert.deepEqual(JSON.parse(JSON.stringify(cerca.corpo.p_filtri)), { poco_utili: true, da: '2025-01-01' });
  assert.equal(JSON.parse(cerca.corpo.p_vettore).length, 768);
});

test('chat: senza Gemini resta la ricerca per parole', () => {
  const { ctx, gemini } = scriptFinto({ chiave: null, parole: [{ id: 'a', fascicolo: 'utenze' }] });
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.strumentoChat_('cerca_documenti', { testo: 'gas' }).documenti.map((d) => d.id))), ['a']);
  assert.equal(gemini.length, 0);
});

test('script: azione «significato» dell\'app e lotti a ogni giro di elabora', () => {
  assert.match(codice, /if \(req\.azione === 'significato'\) \{/);
  assert.match(codice, /cercaPerSignificato_\(req\.testo, filtri, 20, CAMPI_APP\)/);
  assert.match(codice, /try \{ calcolaVettori_\(Date\.now\(\) \+ 30000\); \} catch \(e\) \{ logErrore_\('vettori', e\); \}/);
  assert.match(codice, /function calcolaVettoriOra\(\)/);
  assert.doesNotMatch(codice, /AIza[0-9A-Za-z_-]{20,}/, 'nessuna chiave Gemini nel codice');
});

test('app: «Simili per significato» esclude ciò che è già mostrato e i clinici; senza sessione nessuna chiamata', async () => {
  const inviati = [];
  const fetchFinto = async (_url, o) => {
    inviati.push(JSON.parse(o.body));
    return { json: async () => ({ ok: true, documenti: [{ id: 'a', fascicolo: 'utenze' }, { id: 'c', fascicolo: 'riscaldamento' }, { id: 'p', fascicolo: 'clinico_pazienti' }] }) };
  };
  const r = await cercaPerSignificato({ token: 't', testo: ' caldaia ', filtri: { da: '2025-01-01', importo_min: 50 }, esclusi: ['a'] }, fetchFinto);
  assert.deepEqual(r.map((d) => d.id), ['c']);
  assert.deepEqual(inviati[0], { token: 't', azione: 'significato', testo: 'caldaia', filtri: { da: '2025-01-01' } });
  assert.deepEqual(await cercaPerSignificato({ token: null, testo: 'caldaia' }, fetchFinto), []);
  assert.deepEqual(await cercaPerSignificato({ token: 't', testo: 'x' }, fetchFinto), []);
  assert.equal(inviati.length, 1);
  const rotto = async () => ({ json: async () => ({ ok: false, errore: 'Gemini in pausa' }) });
  assert.deepEqual(await cercaPerSignificato({ token: 't', testo: 'caldaia' }, rotto), []);
  assert.match(chiedi, /intestazione=\{`Simili per significato · \$\{simili\.length\}`\}/);
  assert.match(chiedi, /capito\.somma/);
});

test('migrazione: solo aggiunte, RLS, mai vettori per i clinici, coda solo per lo script', () => {
  for (const s of [sql, sqlEsclusi]) {
    assert.doesNotMatch(s, /\bdrop\s+(table|column|function|view|policy|trigger|extension)\b/i);
    assert.doesNotMatch(s, /\bdelete\s+from\b/i);
  }
  assert.match(sql, /create extension if not exists vector with schema extensions/);
  assert.match(sql, /vettore\s+extensions\.vector\(768\)/);
  assert.match(sql, /using hnsw \(vettore extensions\.vector_cosine_ops\)/);
  assert.match(sql, /alter table documenti_vettori enable row level security/);
  assert.match(sql, /create policy proprietario_legge on documenti_vettori for select to authenticated using \(\(select e_proprietario\(\)\)\)/);
  assert.match(sql, /revoke insert, update, delete, truncate, references, trigger on documenti_vettori from authenticated/);
  assert.match(sql, /if new\.vettore is not null and exists \(select 1 from documenti d where d\.id = new\.documento_id and d\.fascicolo = 'clinico_pazienti'\) then\s+return null;/);
  assert.match(sql, /update documenti_vettori set vettore = null, aggiornato_il = now\(\)\s+where documento_id = new\.id/);
  assert.match(sql, /and d\.fascicolo <> 'clinico_pazienti'\s+and \(v_fasc is null/);
  assert.match(sql, /set hnsw\.ef_search = 200/);
  assert.match(sql, /revoke all on function cerca_significato\(text, jsonb, integer, real\) from public, anon;/);
  assert.match(sqlEsclusi, /and t\.stato <> 'escluso'/);
  assert.match(sqlEsclusi, /revoke all on function documenti_senza_vettore\(integer\) from public, anon, authenticated;\s+grant execute on function documenti_senza_vettore\(integer\) to service_role;/);
});
