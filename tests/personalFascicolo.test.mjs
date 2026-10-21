import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { tuttiDocumentiCartella, esportaFascicolo, interrogaFascicolo, azioneFascicolo } from '../personal/src/lib/fascicolo.js';

const doc = (i) => ({ id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`, titolo: `Documento ${i}`, ente: 'San Raffaele', drive_file_id: `file_${i}`, fascicolo: 'formazione' });
test('folder pagination includes 425 originals, stable ordering and low relevance; null folder is explicit', async () => {
  const rows = Array.from({ length: 425 }, (_, i) => doc(i)), ranges = [], filters = [];
  const db = { from(t) {
    assert.equal(t, 'documenti');
    const q = { select() { return q; }, neq(k, v) { filters.push([k, v]); return q; }, order(k) { assert.equal(k, 'id'); return q; }, eq(k, v) { filters.push([k, v]); return q; }, is(k, v) { filters.push([k, v]); return q; }, range(a, b) { ranges.push([a, b]); return { data: rows.slice(a, b + 1) }; } }; return q;
  } };
  assert.equal((await tuttiDocumentiCartella(db, 'San Raffaele')).length, 425);
  assert.deepEqual(ranges, [[0, 199], [200, 399], [400, 599], [425, 624]]);
  await tuttiDocumentiCartella(db, null);
  assert.ok(filters.some(([k, v]) => k === 'ente' && v === null));
  assert.ok(filters.some(([k, v]) => k === 'fascicolo' && v === 'clinico_pazienti'));
});

test('ZIP is readable by Python zipfile, CRC verified, duplicate names preserved and missing/clinical originals recorded', async () => {
  const docs = [doc(1), doc(2), { ...doc(3), drive_file_id: null }, { ...doc(4), fascicolo: 'clinico_pazienti' }];
  const calls = [];
  const r = await esportaFascicolo(docs, async (id) => { calls.push(id); return { nome: 'referto.pdf', dati: btoa('original bytes ' + id) }; });
  assert.equal(r.inclusi, 2); assert.equal(r.mancanti.length, 2); assert.equal(calls.length, 2);
  const dir = await mkdtemp(`${tmpdir()}/fascicolo-`);
  try {
    const path = `${dir}/fascicolo.zip`; await writeFile(path, Buffer.from(await r.blob.arrayBuffer()));
    const result = JSON.parse(execFileSync('python', ['-c', `import zipfile,json,sys
with zipfile.ZipFile(sys.argv[1]) as z:
 assert z.testzip() is None
 assert z.read('San Raffaele/Senza data/referto.pdf') == b'original bytes file_1'
 assert z.read('San Raffaele/Senza data/1_referto.pdf') == b'original bytes file_2'
 print(z.read('CONTENUTO.json').decode())`, path], { encoding: 'utf8' }));
    assert.equal(result.totale, 4); assert.equal(result.documenti.length, 4);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('download errors never disappear behind a complete-download claim', async () => {
  const r = await esportaFascicolo([doc(1), doc(2)], async (id) => { if (id === 'file_2') throw new Error('File inaccessibile'); return { nome: '../copia.txt', dati: btoa('abc') }; });
  assert.equal(r.inclusi, 1); assert.match(r.mancanti[0].motivo, /inaccessibile/);
});

test('AI reads every original beyond the former 10/80 limits and reduces all evidence with explicit omissions', async () => {
  const docs = Array.from({ length: 83 }, (_, i) => doc(i)), read = [], reductions = [];
  const r = await interrogaFascicolo(docs, 'Confronta le date', async (a, x) => {
    if (a === 'fascicolo_leggi') { read.push(x.id); if (x.id === doc(8).id) throw new Error('PDF non leggibile'); return { testo: x.id, parziale: x.id === doc(5).id }; }
    reductions.push(x.evidenze); return { testo: x.evidenze.join('\n') };
  });
  assert.equal(read.length, 83); assert.equal(r.letti.length, 82); assert.equal(r.esclusi.length, 1);
  assert.equal(r.letti.filter((d) => d.parziale).length, 1);
  assert.ok(reductions.every((g) => g.length <= 8));
  for (const d of r.letti) assert.ok(r.risposta.includes(d.id));
});

test('clinical sources and missing originals never reach the model; cancellation prevents the next call', async () => {
  let calls = 0;
  const r = await interrogaFascicolo([{ ...doc(1), fascicolo: 'clinico_pazienti' }, { ...doc(2), drive_file_id: null }], 'Sintesi', async () => { calls++; });
  assert.equal(calls, 0); assert.equal(r.esclusi.length, 2);
  await assert.rejects(interrogaFascicolo([doc(1)], 'Sintesi', async () => {}, () => {}, () => true), /interrotta/);
});

test('no token makes no network request; stale Apps Script errors remain actionable', async () => {
  await assert.rejects(azioneFascicolo('', 'fascicolo_leggi', {}, () => { assert.fail(); }), /Sessione/);
  await assert.rejects(azioneFascicolo('synthetic', 'fascicolo_leggi', {}, async () => ({ json: async () => { throw new Error(); } })), /Aggiornamento archivio/);
});

const source = readFileSync(new URL('../poliedron/archivio/Code.gs', import.meta.url), 'utf8');
function script(d = doc(1)) {
  const moves = [], ai = [], writes = [];
  const ctx = { console, DriveApp: { getFileById() { return { getName: () => 'original.pdf', getBlob: () => ({ getBytes: () => [1], getContentType: () => 'application/pdf' }), moveTo: (folder) => moves.push(folder) }; } } };
  vm.createContext(ctx); vm.runInContext(source, ctx);
  ctx.sb_ = (_q, op) => { if (op) { writes.push(op); return []; } return d ? [d] : []; };
  ctx.contenutoPerAnalisi_ = () => ({ type: 'document', source: { type: 'base64', data: 'YQ==' } });
  ctx.testoAI_ = (...args) => { ai.push(args); return JSON.stringify({ leggibile: true, parziale: false, risposta: 'Risposta con fonte' }); };
  ctx.personeConfigurate_ = () => []; ctx.cartellaDaPercorso_ = (p) => ({ p, getUrl: () => 'https://drive.google.com/drive/folders/synthetic' });
  return { ctx, moves, ai, writes };
}
test('server reads original, never substitutes indexed summary, and passes content to the model', () => {
  const { ctx, ai } = script({ ...doc(1), riassunto: 'DO NOT USE INDEX SUMMARY' });
  assert.equal(ctx.leggiOriginaleFascicolo_({ id: doc(1).id, domanda: 'Date?' }).ok, true);
  assert.equal(ai.length, 1); assert.equal(ai[0][1][1].type, 'document');
  assert.ok(!JSON.stringify(ai).includes('DO NOT USE INDEX SUMMARY'));
});
test('server rejects clinical labels and clinical filename heuristics before Drive/model access', () => {
  for (const d of [{ ...doc(1), fascicolo: 'clinico_pazienti' }, { ...doc(1), nome_file_originale: 'referto.pdf' }]) {
    const { ctx, ai, moves } = script(d);
    assert.throws(() => ctx.leggiOriginaleFascicolo_({ id: d.id }), /clinico/);
    assert.equal(ai.length, 0); assert.equal(moves.length, 0);
  }
});
test('Drive path is collision-safe for punctuation, same record is patched only after successful move', () => {
  const { ctx, moves, writes } = script({ ...doc(1), ente: 'A/B' });
  const r = ctx.organizzaDocumentoFascicolo_({ id: doc(1).id });
  assert.equal(r.percorso, 'Cartelle/A%2FB/Senza data'); assert.equal(moves.length, 1); assert.equal(writes.length, 1);
  assert.equal(writes[0].body.drive_cartella, r.percorso);
  const fail = script(); fail.ctx.DriveApp.getFileById = () => ({ moveTo() { throw new Error('Access denied'); } });
  assert.throws(() => fail.ctx.organizzaDocumentoFascicolo_({ id: doc(1).id }), /Access denied/);
  assert.equal(fail.writes.length, 0);
});
test('doPost owner gate blocks new endpoints before reading or sending content', () => {
  const { ctx, ai } = script();
  ctx.utenteSupabase_ = () => ({ email: 'outsider@example.test', email_confirmed_at: 'today' });
  ctx.rispostaJson_ = (x) => x;
  for (const azione of ['fascicolo_file', 'fascicolo_leggi', 'fascicolo_rispondi', 'fascicolo_drive']) {
    const r = ctx.doPost({ postData: { contents: JSON.stringify({ azione, id: doc(1).id }) } });
    assert.equal(r.ok, false); assert.match(r.errore, /autorizzato/);
  }
  assert.equal(ai.length, 0);
});
