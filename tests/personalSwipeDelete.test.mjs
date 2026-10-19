import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eliminaConDrive } from '../personal/src/lib/eliminazioneSwipe.js';
const docs = [{ id: 'a', drive_file_id: 'file-a' }, { id: 'b', drive_file_id: 'file-b' }];
test('swipe deletion trashes all folder files before deleting archive records', async () => {
  const calls = [];
  await eliminaConDrive(docs, {
    cestina: async (ids) => { calls.push(['drive', ids]); return { cestinati: ids, non_trovati: [] }; },
    elimina: async (ids) => calls.push(['archive', ids]),
  });
  assert.deepEqual(calls, [['drive', ['file-a', 'file-b']], ['archive', ['a', 'b']]]);
});
test('failed or incomplete Drive deletion preserves archive records', async () => {
  for (const response of [{ cestinati: ['file-a'], non_trovati: ['file-b'] }, { cestinati: [], non_trovati: [] }, null]) {
    let removed = false;
    await assert.rejects(eliminaConDrive(docs, {
      cestina: async () => { if (!response) throw new Error('offline'); return response; },
      elimina: async () => { removed = true; },
    }));
    assert.equal(removed, false);
  }
});
test('clinical documents are rejected before any Drive or archive operation', async () => {
  await assert.rejects(eliminaConDrive([{ ...docs[0], fascicolo: 'clinico_pazienti' }], {
    cestina: () => assert.fail('Drive accessed'), elimina: () => assert.fail('archive accessed'),
  }), /clinici/);
});
