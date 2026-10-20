import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
const leggi = (p) => readFileSync(p, 'utf8');

test('Personal: section metadata does not eagerly import screen implementations', () => {
  for (const sezione of readdirSync('personal/src/sezioni', { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const source = leggi(`personal/src/sezioni/${sezione.name}/index.jsx`);
    assert.doesNotMatch(source, /import\s*\{[^}]+\}\s*from\s*['"]\.\/[^'"]+\.jsx['"]/);
    assert.match(source, /differito\(\(\) => import\(/);
  }
});

test('Personal: home controls render before summary and Studio connection completes', () => {
  const source = leggi('personal/src/sezioni/oggi/Oggi.jsx');
  assert.match(source, /if \(!dati\) return <>\{comandi\}/);
  assert.ok(source.indexOf('setDati({') < source.indexOf('await sessioneStudio()'));
  assert.match(source, /return \(\) => \{ vivo = false; \}/);
});
