import test from 'node:test';
import assert from 'node:assert/strict';
import { today, previousDate, splitText, searchDiary, savePage, loadDiary, PREFIX } from '../personal/src/lib/diario.js';

test('Rome midnight and daylight saving use the writing date, not UTC', () => {
  assert.equal(today(new Date('2026-10-30T23:05:00Z')), '2026-10-31');
  assert.equal(today(new Date('2026-07-30T22:05:00Z')), '2026-07-31');
});
test('date heading continues through blank pages and changes only with a new writing day', () => {
  const pages = [{ blocks: [{ date: '2026-10-30' }] }, { blocks: [] }, { blocks: [{ date: '2026-10-30' }, { date: '2026-10-31' }] }];
  assert.equal(previousDate(pages, 0, 0), null);
  assert.equal(previousDate(pages, 2, 0), '2026-10-30');
  assert.equal(previousDate(pages, 2, 1), '2026-10-30');
});
test('pagination preserves every character including spaces and newlines', () => {
  const text = 'Una giornata speciale.\n'.repeat(150);
  const [first, rest] = splitText(text);
  assert.equal(first + rest, text);
  assert.ok(first.length <= 1801);
  assert.ok(rest.length > 0);
});
test('search returns exact text/caption target and can filter by day', () => {
  const pages = [{ id: 'a', blocks: [{ id: 'one', date: '2026-10-30', text: 'Ricordo delle figlie' }, { id: 'photo', date: '2026-10-31', caption: 'Foto FIGLIE' }] }];
  assert.equal(searchDiary(pages, 'figlie').length, 2);
  const [match] = searchDiary(pages, 'figlie', '2026-10-31');
  assert.equal(match.blockId, 'photo'); assert.equal(match.offset, 5);
  assert.equal(searchDiary(pages, '', '2026-10-30').length, 1);
  assert.equal(searchDiary(pages, '').length, 0);
});
function mockSave(reply) {
  const calls = [];
  const q = Object.fromEntries(['update', 'insert', 'eq', 'select'].map((method) => [method, (...args) => { calls.push([method, ...args]); return q; }]));
  q.maybeSingle = async () => reply;
  return { calls, from(name) { calls.push(['from', name]); return q; } };
}
test('save uses an atomic version condition and rejects missing/conflicting rows', async () => {
  const db = mockSave({ data: { aggiornato_il: 'v2' }, error: null });
  const rev = await savePage(db, { id: 'one', order: 0, blocks: [], revision: 'v1' });
  assert.equal(rev, 'v2');
  assert.deepEqual(db.calls.filter((c) => c[0] === 'eq'), [['eq', 'chiave', PREFIX + 'one'], ['eq', 'aggiornato_il', 'v1']]);
  assert.equal(db.calls.find((c) => c[0] === 'update')[1].valore.revision, undefined);
  await assert.rejects(savePage(mockSave({ data: null }), { id: 'one', revision: 'old' }), /altro dispositivo/);
  await assert.rejects(savePage(mockSave({ error: { code: '23505' } }), { id: 'one' }), /altro dispositivo/);
});
test('new page is inserted, never upserted over an existing page', async () => {
  const db = mockSave({ data: { aggiornato_il: 'v1' } });
  await savePage(db, { id: 'new', blocks: [], order: 2 });
  assert.ok(db.calls.some((c) => c[0] === 'insert'));
  assert.ok(!db.calls.some((c) => c[0] === 'update'));
});
test('loading paginates archive rows beyond first batch and sorts page order', async () => {
  let count = 0;
  const q = { select() { return q; }, like(_, prefix) { assert.equal(prefix, PREFIX + '%'); return q; }, order() { return q; }, async range(from, to) {
    assert.equal(to - from, 29); count++;
    return { data: from === 0 ? Array.from({ length: 30 }, (_, i) => ({ chiave: PREFIX + i, valore: { id: String(i), order: 30 - i, blocks: [] }, aggiornato_il: 'v1' })) : [] };
  } };
  const loaded = await loadDiary({ from: () => q });
  assert.equal(count, 2); assert.equal(loaded.length, 30); assert.equal(loaded[0].id, '29');
});
