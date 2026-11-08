import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { aggiungiNota, aggiornaNota, eliminaNota, leggiNote, pulisciTesto, dividiNota, messaggioErroreNote, areaNota } from '../shared/note/note.js';

// Client finto: registra le chiamate, nessun database reale.
function fakeDb(rows = []) {
  const calls = [];
  const q = (table) => {
    const call = { table, ops: [] }; calls.push(call);
    const res = { data: null, error: null };
    const chain = new Proxy({}, { get: (_, op) => op === 'then'
      ? (ok, ko) => Promise.resolve(op === 'then' && call.ops[0]?.[0] === 'select' && call.ops.length > 1 && !call.ops.some(o => o[0] === 'single') ? { data: rows, error: null } : { data: { id: 'n1', ...(call.ops.find(o => o[0] === 'insert' || o[0] === 'update')?.[1] || {}) }, error: null }).then(ok, ko)
      : (...args) => { call.ops.push([op, ...args]); return chain; } });
    return chain;
  };
  return { from: q, calls };
}

test('note text is trimmed, required and bounded; first line is the title', () => {
  assert.equal(pulisciTesto('  ciao\r\nmondo  '), 'ciao\nmondo');
  assert.throws(() => pulisciTesto('   '), /Scrivi qualcosa/);
  assert.throws(() => pulisciTesto('x'.repeat(4001)), /troppo lunga/);
  assert.deepEqual(dividiNota('Spesa\nlatte\npane'), { titolo: 'Spesa', corpo: 'latte\npane' });
  assert.equal(areaNota('sconosciuta').id, 'personale');
});

test('note writes carry the session studio, never an author, and only owned fields', async () => {
  const db = fakeDb([{ id: 'a' }]);
  assert.deepEqual(await leggiNote(db), [{ id: 'a' }]);
  await aggiungiNota(db, { studioId: 's1', testo: ' Idea ', area: 'idee' });
  const ins = db.calls[1].ops.find(o => o[0] === 'insert')[1];
  assert.deepEqual(ins, { studio_id: 's1', testo: 'Idea', area: 'idee' });
  await assert.rejects(() => aggiungiNota(db, { studioId: null, testo: 'x' }), /Studio non disponibile/);
  await aggiornaNota(db, 'n1', { fissata: 1 });
  const upd = db.calls[2].ops.find(o => o[0] === 'update')[1];
  assert.equal(upd.fissata, true); assert.ok(upd.updated_at); assert.ok(!('user_id' in upd) && !('studio_id' in upd));
  await eliminaNota(db, 'n1');
  assert.deepEqual(db.calls[3].ops.find(o => o[0] === 'eq'), ['eq', 'id', 'n1']);
});

test('missing table gives a clear message instead of a technical error', () => {
  assert.match(messaggioErroreNote({ code: 'PGRST205', message: "Could not find the table 'public.note_personali' in the schema cache" }), /aggiornamento del database/);
  assert.equal(messaggioErroreNote({ message: 'rete assente' }), 'rete assente');
});

test('Note is wired in Studio (page, search, dock) and Personal (section, dock) on the same table', () => {
  const app = readFileSync('src/App.jsx', 'utf8');
  assert.match(app, /page === 'note' && <NotePage key=\{noteScrivi\} scriviSubito=\{noteScrivi > 0\} db=\{supabase\} studioId=\{session\?\.user\?\.app_metadata\?\.studio_id\} \/>/);
  assert.match(readFileSync('src/lib/utils.js', 'utf8'), /\{ id: 'note', l: 'Note', ic: 'edit' \}/);
  assert.match(readFileSync('personal/src/sezioni/note/Note.jsx', 'utf8'), /<NotePage db=\{studioDb\} studioId=\{studioId\} scriviSubito=\{ctx\?\.sotto === 'scrivi'\} \/>/);
  assert.match(readFileSync('shared/note/note.js', 'utf8'), /from\('note_personali'\)/);
});
