// POL-VITA-016 — Personal a sezioni: ogni sezione nella sua cartella, l'app è solo la cornice.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RADICE = 'personal/src';
const SEZIONI = join(RADICE, 'sezioni');
const cartelle = readdirSync(SEZIONI).filter((d) => statSync(join(SEZIONI, d)).isDirectory());
const fileDi = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? fileDi(join(dir, f)) : [join(dir, f)]));
const sorgenti = fileDi(RADICE).filter((f) => /\.(jsx?|mjs)$/.test(f));
const leggi = (f) => readFileSync(f, 'utf8');

test('sezioni: una cartella con index.jsx per ogni sezione, tutte nel registro', () => {
  assert.deepEqual(cartelle.sort(), ['agenda', 'conti', 'documenti', 'foto', 'impostazioni', 'oggi', 'personali', 'poliedron']);
  const registro = leggi(join(SEZIONI, 'index.js'));
  for (const c of cartelle) {
    const indice = leggi(join(SEZIONI, c, 'index.jsx'));
    assert.match(indice, new RegExp(`export const ${c} = \\{\\s*id: '${c}'`), c);
    assert.match(registro, new RegExp(`import \\{ ${c} \\} from './${c}/index\\.jsx';`), c);
  }
});

test('sezioni: App.jsx è solo la cornice, senza viste né pagine delle sezioni', () => {
  const app = leggi(join(RADICE, 'App.jsx'));
  assert.ok(app.split('\n').length < 200, 'App.jsx resta piccolo');
  assert.doesNotMatch(app, /function (Vista|Pagina)\w+\(/);
  assert.doesNotMatch(app, /from '\.\/sezioni\/(?!index\.js')/, 'App usa solo il registro delle sezioni');
  assert.match(app, /pagina\(p\.tipo\)\?\.render\(p, \{ ctx, chiudi: indietro, sostituisci, email \}\)/);
});

test('sezioni: una sezione usa le altre solo attraverso il loro index.jsx', () => {
  for (const f of sorgenti.filter((x) => x.startsWith(SEZIONI + '/') && x.split('/').length > 4)) {
    for (const [, percorso] of leggi(f).matchAll(/from '(\.\.\/[^']+)'/g)) {
      const altra = percorso.match(/^\.\.\/([a-z]+)\//);
      if (altra && !['lib'].includes(altra[1]) && percorso.startsWith('../') && !percorso.startsWith('../../')) {
        assert.match(percorso, /^\.\.\/[a-z]+\/index\.jsx$/, `${f} → ${percorso}`);
      }
    }
  }
});

test('sezioni: ogni pagina aperta è registrata in una sola sezione', () => {
  const registrate = cartelle.flatMap((c) => [...leggi(join(SEZIONI, c, 'index.jsx')).matchAll(/^ {4}(\w+): \{/gm)].map((m) => m[1]));
  assert.equal(new Set(registrate).size, registrate.length, `tipo di pagina doppio: ${registrate}`);
  // apri({ tipo }), sostituisci({ tipo }) e le voci del + in App.jsx (una per riga).
  const aperte = new Set(sorgenti.flatMap((f) => [...leggi(f).matchAll(/(?:(?:apri|sostituisci)\(|^ +\w+: )\{ tipo: '(\w+)'/gm)].map((m) => m[1])));
  assert.ok(aperte.size >= 12, `trovate ${aperte.size} pagine`);
  for (const tipo of aperte) assert.ok(registrate.includes(tipo), `pagina '${tipo}' aperta ma non registrata in nessuna sezione`);
});
