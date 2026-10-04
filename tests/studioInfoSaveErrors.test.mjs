import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const appSrc = read('src/App.jsx');
const supabaseSrc = read('src/lib/supabase.js');
const impostazioniSrc = read('src/components/Impostazioni.jsx');

test('POL-UI-046: setStudioInfoSync restituisce l\'esito reale e mostra il banner di errore', () => {
  const start = appSrc.indexOf('const setStudioInfoSync = ');
  const block = appSrc.slice(start, appSrc.indexOf('\n  });', start) + 6);
  assert.match(block, /=> new Promise\(\(resolve\) => \{/);
  assert.match(block, /DB\.setStudioInfo\(next\)\.then\(\(\) => resolve\(true\), \(e\) => \{/);
  assert.match(block, /setSyncError\(`Impostazioni dello studio NON salvate: \$\{e\?\.message \|\| e\}`\);/);
  // Lo stato locale torna a prima, ma solo se nessun'altra modifica è arrivata nel frattempo.
  assert.match(block, /setStudioInfo\(\(curr\) => \(curr === next \? prev : curr\)\);/);
  assert.match(block, /resolve\(false\);/);
  assert.doesNotMatch(block, /reject/, 'non deve mai rifiutare: i chiamanti che ignorano l\'esito non devono generare unhandled rejection');
  assert.doesNotMatch(block, /\.catch\(\(e\) => console\.error\('Errore salvataggio studio info', e\)\)/, 'il vecchio errore solo-console non deve tornare');
});

test('POL-UI-046: DB.setStudioInfo fallisce in modo esplicito senza sessione o studio (fail closed)', () => {
  const start = supabaseSrc.indexOf('async setStudioInfo(obj) {');
  const block = supabaseSrc.slice(start, supabaseSrc.indexOf('\n  },', start));
  assert.match(block, /if \(!user \|\| !studioId\) throw new Error\('Sessione o studio non identificati'\);/);
  assert.doesNotMatch(block, /if \(!studioId\) return;/);
  assert.match(block, /if \(error\) \{ console\.error\('DB\.setStudioInfo', error\); throw error; \}/);
});

test('POL-UI-046: Impostazioni mostra "Salvato ✓" solo a salvataggio riuscito', () => {
  assert.match(impostazioniSrc, /const save = async \(\) => \{\s*const ok = await setStudioInfo\(si\);\s*setToast\(ok === false \? ERRORE_SALVATAGGIO : 'Salvato ✓'\);\s*\};/);
  assert.doesNotMatch(impostazioniSrc, /setStudioInfo\(si\); setToast\('Salvato ✓'\);/);
  // Scorciatoie farmaci: in caso di errore si torna alla lista precedente.
  assert.match(impostazioniSrc, /const ok = await setStudioInfo\(\(prev\) => \(\{ \.\.\.prev, farmaci_preferiti: lista \}\)\);\s*if \(ok === false\) \{\s*S\(\{ farmaci_preferiti: precedente \}\);\s*setToast\(ERRORE_SALVATAGGIO\);\s*return;\s*\}/);
});
