// POL-VITA-009 — l'agenda (Giorno e Settimana) si scorre in orizzontale trascinando la griglia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { direzione, esito, SOGLIA_PX } from '../personal/src/lib/swipeAgenda.js';

test('direzione: decisa solo dopo qualche pixel, verticale se il gesto è diagonale', () => {
  assert.equal(direzione(3, 4), null);
  assert.equal(direzione(-30, 5), 'orizzontale');
  assert.equal(direzione(20, 19), 'verticale', 'in diagonale resta lo scorrimento delle ore');
  assert.equal(direzione(2, 40), 'verticale');
});

test('esito: oltre la soglia o con un colpo veloce cambia; sinistra = avanti', () => {
  assert.equal(esito(-SOGLIA_PX - 1, 600), 1);
  assert.equal(esito(SOGLIA_PX + 1, 600), -1);
  assert.equal(esito(-40, 600), 0, 'trascinamento corto e lento: torna al suo posto');
  assert.equal(esito(-40, 50), 1, 'colpo veloce');
  assert.equal(esito(-10, 5), 0, 'troppo corto anche se veloce');
});

test('app: il gesto è sulla griglia di Giorno e Settimana, non sul Mese', () => {
  const src = readFileSync('personal/src/sezioni/agenda/AgendaGriglia.jsx', 'utf8');
  assert.match(src, /useTimeline\(\{[^\n]*onNavigate: navigate, enabled: view !== 'mese'/);
  assert.match(src, /className="agenda-mobile-grid-surface"[^>]*\{\.\.\.swipe\}/);
  assert.match(src, /navigate = n => setGiorno\(piuGiorni\(giorno, n \* \(weekly \? 7 : 1\)\)\)/);
});
