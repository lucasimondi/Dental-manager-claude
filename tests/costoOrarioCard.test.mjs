import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Product Owner report (verbatim): "Quando clicco su costi (ore) non
// carica". Root cause: CostoOrarioCard destructures only
// { studioId, refreshKey } but its "Ore" edit modal references
// `labelPostazioni` -- a variable that only exists in the OUTER Costi()
// component's scope, never passed down. Clicking "Ore" sets editConfig
// to true, the modal renders, and `labelPostazioni` throws
// ReferenceError: not defined -- a 100% reproducible crash on every
// click, in every studio, since CostoOrarioCard was introduced. POL-UI-022
// (making the Panoramica drill-down reach this card) didn't cause this --
// it just made the card reachable from a second, more visible path,
// surfacing a bug nobody had hit before via the sidebar tab either.
const source = fs.readFileSync(new URL('../src/components/Costi.jsx', import.meta.url), 'utf8');

test('CostoOrarioCard receives labelPostazioni as a prop instead of reaching into the outer Costi() closure', () => {
  assert.match(source, /function CostoOrarioCard\(\{ studioId, refreshKey, labelPostazioni \}\)/);
  assert.match(source, /<CostoOrarioCard studioId=\{studioId\} refreshKey=\{refreshKey\} labelPostazioni=\{labelPostazioni\} \/>/);
});

test('the "Ore" edit modal never references an out-of-scope labelPostazioni', () => {
  const cardBody = source.slice(
    source.indexOf('function CostoOrarioCard'),
    source.indexOf('function ConfermaEstrazione'),
  );
  // Every remaining use of labelPostazioni inside the card must resolve to
  // its own prop, not an identifier with no local binding.
  assert.match(cardBody, /\{labelPostazioni\}/);
  assert.match(cardBody, /\$\{labelPostazioni\}/);
});
