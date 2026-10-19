import test from 'node:test';
import assert from 'node:assert/strict';
import { campiLegal, salvaPraticaLegal, collegaLegal, scadenzaLegal } from '../personal/src/lib/legal.js';
function dbFinto(data, error = null) {
  const calls = []; const q = {};
  for (const k of ['from', 'insert', 'update', 'eq', 'is', 'neq', 'select']) q[k] = (...args) => { calls.push([k, ...args]); return q; };
  q.single = async () => ({ data, error });
  return { db: q, calls };
}
test('Legal richiede titolo e stati validi e non accetta campi finanziari', () => {
  assert.throws(() => campiLegal({ titolo: ' ', stato: 'aperta', urgenza: 'media' }));
  assert.throws(() => campiLegal({ titolo: 'Pratica', stato: 'pagata', urgenza: 'media' }));
  assert.deepEqual(campiLegal({ titolo: ' Test ', note: ' Nota ', stato: 'aperta', urgenza: 'alta', importo: 100 }), { titolo: 'Test', note: 'Nota', stato: 'aperta', urgenza: 'alta' });
});
test('creazione Legal nel fascicolo canonico; modifica non forza fascicolo', async () => {
  for (const id of [null, 'pratica']) {
    const { db, calls } = dbFinto({ id: 'pratica' });
    await salvaPraticaLegal(db, id, { titolo: 'Test', stato: 'aperta', urgenza: 'media' });
    const row = calls.find(([k]) => k === (id ? 'update' : 'insert'))[1];
    assert.equal(row.fascicolo, id ? undefined : 'legale');
    if (id) assert.ok(calls.some(([k, c, v]) => k === 'eq' && c === 'id' && v === id));
  }
});
test('collegamento non sostituisce una pratica esistente ed esclude clinici', async () => {
  const { db, calls } = dbFinto(null, { message: 'Nessuna riga aggiornata' });
  await assert.rejects(collegaLegal(db, 'doc', 'pratica'), /Nessuna riga/);
  assert.ok(calls.some(([k, c, v]) => k === 'is' && c === 'pratica_id' && v === null));
  assert.ok(calls.some(([k, c, v]) => k === 'neq' && c === 'fascicolo' && v === 'clinico_pazienti'));
});
test('scadenza Legal non crea importi o movimenti e restituisce errori', async () => {
  const { db, calls } = dbFinto({ id: 'termine' });
  await scadenzaLegal(db, 'p', '2026-11-02', 'Contattare avvocato');
  const row = calls.find(([k]) => k === 'insert')[1];
  assert.equal(row.pratica_id, 'p'); assert.equal(row.completata, false); assert.equal(row.importo, undefined);
  assert.deepEqual(calls.filter(([k]) => k === 'from').map(([, t]) => t), ['scadenze']);
  const fail = dbFinto(null, { message: 'Accesso negato' });
  await assert.rejects(salvaPraticaLegal(fail.db, null, { titolo: 'Test', stato: 'aperta', urgenza: 'media' }), /Accesso negato/);
});
