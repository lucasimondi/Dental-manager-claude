import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// PO 2026-11-03: "I colori etichette di agenda sia personale che poliedra devono essere anche meno opachi, rendila ancora più pro".
test('agenda labels: shared full-tone events for Studio and Personal', () => {
  const shared = readFileSync('shared/agenda/AgendaPresentation.jsx', 'utf8');
  const css = readFileSync('shared/agenda/agenda.css', 'utf8');
  assert.match(shared, /export function eventTone\(co\)/);
  assert.match(shared, /color-mix\(in srgb, \$\{c\} 34%, #fff\)/);
  assert.doesNotMatch(shared, /co \+ '35'|\$\{co\}AA/, 'no washed-out alpha tints');
  assert.match(shared, /border: `1\.5px dashed \$\{t\.border\}`, borderLeft: `3px solid \$\{t\.border\}`/);
  assert.match(css, /var\(--event-color\) 30%, #fff\)/);
});
