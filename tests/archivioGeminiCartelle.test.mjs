// POL-VITA-019: sintesi delle cartelle, bozze e cartelle suggerite passano a Gemini con Claude in pausa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const gs = readFileSync(new URL('../poliedron/archivio/Code.gs', import.meta.url), 'utf8');
const corpo = (nome) => { const i = gs.indexOf('function ' + nome + '('); return gs.slice(i, gs.indexOf('\n}\n', i)); };

test('testoAI_ usa Claude e, con Claude in pausa, Gemini', () => {
  const f = corpo('testoAI_');
  assert.match(f, /claudeInPausa_\(\)/);
  assert.match(f, /claudeMessaggi_\(/);
  assert.match(f, /geminiChiamata_\(/);
  assert.match(f, /pausaApi_\(/);
});

for (const nome of ['analizzaCartella_', 'bozzaRisposta_', 'suggerisciCartelle_']) {
  test(nome + ' passa da testoAI_, non direttamente da Claude', () => {
    const f = corpo(nome);
    assert.match(f, /testoAI_\(/);
    assert.doesNotMatch(f, /claudeMessaggi_\(/);
  });
}

test('i clinici restano esclusi prima della chiamata', () => {
  assert.match(corpo('documentiCartella_'), /fascicolo=neq\.clinico_pazienti/);
  assert.match(corpo('bozzaRisposta_'), /eClinico_\(/);
  assert.match(corpo('suggerisciCartelle_'), /fascicolo=neq\.clinico_pazienti/);
});
