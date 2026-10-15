// POL-VITA-004 — calcoli dell'agenda di Personal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { elementiDelGiorno, colonne, grigliaMese, giorniSettimana, piuGiorni, coloreEvento, ETICHETTE_PREDEFINITE } from '../personal/src/lib/agenda.js';
import { rigaImpegno } from '../personal/src/lib/studio.js';
import { normalizza } from '../personal/src/lib/impostazioni.js';

test('giorno: appuntamenti ed eventi a orario, eventi di tutto il giorno e scadenze separati', () => {
  const g = '2026-10-20';
  const el = elementiDelGiorno(g, {
    appuntamenti: [{ id: 1, data: g, ora: '09:00', durata: 60 }, { id: 2, data: '2026-10-21', ora: '09:00' }],
    impegni: [
      { id: 7, data_inizio: g, data_fine: g, tutto_il_giorno: false, ora_inizio: '08:30', ora_fine: '09:30' },
      { id: 8, data_inizio: '2026-10-19', data_fine: '2026-10-22', tutto_il_giorno: true },
    ],
    scadenze: [{ id: 's', data: g }, { id: 't', data: '2026-10-25' }],
  });
  assert.deepEqual(el.aOrario.map((x) => x.id), ['e7', 'a1']);
  assert.deepEqual(el.tuttoIlGiorno.map((x) => x.id), [8]);
  assert.deepEqual(el.scadenze.map((x) => x.id), ['s']);
});

test('colonne: gli elementi sovrapposti si dividono la larghezza, quelli separati no', () => {
  const r = colonne([{ id: 'a', inizio: 540, fine: 600 }, { id: 'b', inizio: 570, fine: 630 }, { id: 'c', inizio: 700, fine: 730 }]);
  assert.deepEqual(r.map((x) => [x.id, x.col, x.colonne]), [['a', 0, 2], ['b', 1, 2], ['c', 0, 1]]);
});

test('mese e settimana partono da lunedì', () => {
  const m = grigliaMese('2026-10-15');
  assert.equal(m.length, 42);
  assert.equal(m[0], '2026-09-28');
  assert.deepEqual(giorniSettimana('2026-10-15'), ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
  assert.equal(piuGiorni('2026-10-31', 1), '2026-11-01');
});

test('evento → riga di impegni_personali come la usa l\'agenda dello studio', () => {
  assert.deepEqual(rigaImpegno({ titolo: ' Calcetto ', tipo: 'sport', colore: '#059669', data_inizio: '2026-10-20', ora_inizio: '20:00', ora_fine: '21:30' }), {
    titolo: 'Calcetto', tipo: 'sport', colore: '#059669', data_inizio: '2026-10-20', data_fine: '2026-10-20',
    tutto_il_giorno: false, ora_inizio: '20:00', ora_fine: '21:30', note: null,
  });
  const ferie = rigaImpegno({ titolo: 'Ferie', tutto_il_giorno: true, data_inizio: '2026-08-01', data_fine: '2026-08-15', ora_inizio: '09:00' });
  assert.equal(ferie.ora_inizio, null);
  assert.equal(ferie.data_fine, '2026-08-15');
  assert.equal(rigaImpegno({ titolo: '', data_inizio: '2026-01-02', data_fine: '2026-01-01' }).data_fine, '2026-01-02');
});

test('etichette: predefinite, colore valido, colore dell\'evento prima di quello dell\'etichetta', () => {
  assert.deepEqual(normalizza({}).etichette, ETICHETTE_PREDEFINITE);
  assert.equal(normalizza({ etichette: [{ nome: 'Barca', colore: 'rosso' }] }).etichette[0].colore, '#64748b');
  assert.equal(coloreEvento({ tipo: 'sport' }, ETICHETTE_PREDEFINITE), '#059669');
  assert.equal(coloreEvento({ tipo: 'sport', colore: '#111111' }, ETICHETTE_PREDEFINITE), '#111111');
});
