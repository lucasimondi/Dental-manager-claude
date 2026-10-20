import test from 'node:test';
import assert from 'node:assert/strict';
import { salvaAcquisto, leggiAcquisti, eliminaAcquisto } from '../personal/src/lib/acquisti.js';
function database() {
  const rows = new Map();
  return { rows, from(table) {
    assert.equal(table, 'impostazioni_app');
    return {
      upsert(r) { rows.set(r.chiave, r); return { select: () => ({ single: async () => ({ data: { chiave: r.chiave } }) }) }; },
      select() { return { like: (_, prefix) => ({ order: async () => ({ data: [...rows.values()].filter((r) => r.chiave.startsWith(prefix.slice(0, -1))) }) }) }; },
      delete() { return { eq: (_, key) => ({ select: () => ({ single: async () => { rows.delete(key); return { data: { chiave: key } }; } }) }) }; },
    };
  } };
}
test('acquisti separati: modifica, ripristino ed eliminazione non toccano altre voci o impostazioni', async () => {
  const db = database(); db.rows.set('personal', { chiave: 'personal', valore: { persone: ['Esempio'] } });
  const a = await salvaAcquisto(db, { nome: 'Pane', categoria: 'Spesa' });
  const b = await salvaAcquisto(db, { nome: 'Lampadina', categoria: 'Casa' });
  await salvaAcquisto(db, { ...a, comprato: true });
  assert.equal((await leggiAcquisti(db)).find((v) => v.id === a.id).comprato, true);
  await salvaAcquisto(db, { ...a, comprato: false });
  await eliminaAcquisto(db, b.id);
  assert.deepEqual(await leggiAcquisti(db), [a]);
  assert.deepEqual(db.rows.get('personal').valore, { persone: ['Esempio'] });
});
test('salvataggio fallito non viene dichiarato riuscito; nome vuoto rifiutato', async () => {
  await assert.rejects(salvaAcquisto(database(), { nome: ' ' }), /Scrivi/);
  const db = { from: () => ({ upsert: () => ({ select: () => ({ single: async () => ({ error: { message: 'Offline' } }) }) }) }) };
  await assert.rejects(salvaAcquisto(db, { nome: 'Pane' }), /Offline/);
});
