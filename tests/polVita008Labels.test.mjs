import test from 'node:test';
import assert from 'node:assert/strict';
import { rigaImpegno, ETICHETTE_PREDEFINITE } from '../personal/src/lib/agenda.js';

for (const label of ETICHETTE_PREDEFINITE) {
  test('event label ' + label.id, () => {
    const row = rigaImpegno({ titolo: 'Evento', tipo: label.id, data_inizio: '2026-10-16', ora_inizio: '17:00', ora_fine: '20:00' });
    assert.ok(['personale', 'ferie', 'chiamata', 'altro'].includes(row.tipo));
    assert.equal(row.etichetta, label.id);
  });
}

test('changing an existing label', () => {
  const row = rigaImpegno({ tipo: 'sport', etichetta: 'famiglia', data_inizio: '2026-10-16' });
  assert.equal(row.etichetta, 'sport');
});
