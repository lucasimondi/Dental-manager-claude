// Run after npm run build -- --manifest: check the actual production import graph.
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
const manifest = JSON.parse(readFileSync('dist/.vite/manifest.json', 'utf8'));
const entry = 'personal/index.html';
assert.ok(manifest[entry]?.isEntry, 'Personal build entry exists');
const initial = new Set();
function visit(key) {
  if (initial.has(key)) return;
  assert.ok(manifest[key], `missing manifest entry: ${key}`);
  initial.add(key);
  for (const dependency of manifest[key].imports || []) visit(dependency);
}
visit(entry);
const files = new Set([...initial].map((key) => manifest[key].file));
for (const screen of [
  'oggi/Oggi', 'documenti/Documenti', 'agenda/Agenda', 'conti/Conti',
  'personali/Personali', 'foto/Foto', 'legal/Legal', 'poliedron/Poliedron',
  'impostazioni/Impostazioni',
]) {
  const path = `personal/src/sezioni/${screen}.jsx`;
  assert.ok(manifest[path]?.isDynamicEntry, `${path} must be an on-demand entry`);
  assert.ok(!files.has(manifest[path].file), `${path} leaked into cold startup`);
}
const bytes = [...files].filter((file) => file.endsWith('.js')).reduce((n, file) => n + statSync(`dist/${file}`).size, 0);
console.log(`Personal cold startup JS: ${bytes} bytes before compression; all 9 screen implementations deferred.`);
