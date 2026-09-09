import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const utils = readFileSync(new URL('../src/lib/utils.js', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../src/components/Dashboard.jsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const attivita = readFileSync(new URL('../src/components/Attivita.jsx', import.meta.url), 'utf8');
const poliedronHub = readFileSync(new URL('../src/components/PoliedronHub.jsx', import.meta.url), 'utf8');
const activityKindSrc = readFileSync(new URL('../src/lib/domain/dataHealthActivities.js', import.meta.url), 'utf8');

// Product Owner: "Attività e promemoria: dobbiamo mettere in modo che siano
// classificate con etichette visibili: tipo ordinare, anamnesi mancante,
// piano, dati mancanti ecc, e poi deve esserci una sezione attività in modo
// che sia tutto più chiaro" (POL-UI-034).

test('TODO_CATEGORIE covers every automatic ACTIVITY_KIND plus the manual-only categories, each with label/icona/colore', () => {
  const kindKeys = [...activityKindSrc.matchAll(/^\s*([A-Z_]+):/gm)].map((m) => m[1]);
  assert.ok(kindKeys.length >= 5, 'sanity check: ACTIVITY_KIND should have at least 5 entries');
  const categorieMatch = utils.match(/export const TODO_CATEGORIE = \{[\s\S]*?\n\};/);
  assert.ok(categorieMatch, 'TODO_CATEGORIE must exist in utils.js');
  const block = categorieMatch[0];
  for (const kind of kindKeys) {
    assert.match(block, new RegExp(`${kind}: \\{ label:`), `TODO_CATEGORIE must have an entry for ACTIVITY_KIND.${kind}`);
  }
  for (const manualKey of ['DA_ORDINARE', 'DATI_MANCANTI', 'AMMINISTRATIVO', 'GENERICO']) {
    assert.match(block, new RegExp(`${manualKey}: \\{ label:`), `TODO_CATEGORIE must have a manual-only ${manualKey} category`);
  }
  for (const entry of block.matchAll(/\{ label: '[^']*', icona: '([^']*)', colore: '([^']*)' \}/g)) {
    assert.match(entry[1], /^[a-z]+$/, 'icona must be a plain Ic.jsx key');
    assert.match(entry[2], /^#[0-9A-Fa-f]{6}$/, 'colore must be a hex color');
  }
});

test('auto-generated data-health todos persist their ACTIVITY_KIND as categoria, no longer discarding entry.kind', () => {
  assert.match(dashboard, /testo: entry\.message, fatto: false, data: t, paziente_id: entry\.pazienteId, categoria: entry\.kind/);
});

test('the manual "+ Nuova attività" modal lets the user pick a categoria, wired into addTodo()', () => {
  assert.match(dashboard, /const \[todoCategoria, setTodoCategoria\] = useState\('GENERICO'\)/);
  assert.match(dashboard, /testo: buildActivityText\(todoInput, patient\), fatto: false, data: t, categoria: todoCategoria/);
  assert.match(dashboard, /<Fld label="Categoria">\s*<Sel value=\{todoCategoria\}/);
  assert.match(dashboard, /Object\.entries\(TODO_CATEGORIE\)\.map\(\(\[id, cat\]\) => <option key=\{id\} value=\{id\}>\{cat\.label\}<\/option>\)/);
});

test('the Home "Attività" widget shows a visible category badge on each row that has one', () => {
  assert.match(dashboard, /const todoCat = todo\.categoria \? TODO_CATEGORIE\[todo\.categoria\] : null;/);
  assert.match(dashboard, /todoCat && <div[\s\S]{0,80}<Ic n=\{todoCat\.icona\}[\s\S]{0,40}<Bdg ch=\{todoCat\.label\} co=\{todoCat\.colore\} \/><\/div>/);
});

test('a migration adds the categoria column to public.todos', () => {
  const files = readdirSync(new URL('../supabase/migrations/', import.meta.url));
  const migrationFile = files.find((f) => f.includes('pol_ui_034_todos_categoria'));
  assert.ok(migrationFile, 'expected a pol_ui_034 migration adding todos.categoria');
  const sql = readFileSync(new URL(`../supabase/migrations/${migrationFile}`, import.meta.url), 'utf8');
  assert.match(sql, /ALTER TABLE public\.todos ADD COLUMN IF NOT EXISTS categoria text;/);
});

test('a dedicated "Attività" page exists, routed from App.jsx and reachable from NAV, mirroring the Richiami pattern', () => {
  assert.match(app, /const Attivita = lazy\(\(\) => import\('\.\/components\/Attivita\.jsx'\)\);/);
  assert.match(app, /\{page === 'attivita' && <Attivita patients=\{patients\} onOpenPaz=\{goSchedaPaz\} \/>\}/);
  assert.match(utils, /\{ id: 'attivita', l: 'Attività', ic: 'clip' \}/);
});

test('Attività page filters todos by category and lets the user create/complete/delete them directly against Supabase', () => {
  assert.match(attivita, /supabase\.from\('todos'\)\.select\('\*'\)/);
  assert.match(attivita, /supabase\.from\('todos'\)\.insert\(\[nuova\]\)/);
  assert.match(attivita, /supabase\.from\('todos'\)\.update\(\{ fatto: !t\.fatto \}\)\.eq\('id', t\.id\)/);
  assert.match(attivita, /supabase\.from\('todos'\)\.delete\(\)\.eq\('id', id\)/);
  assert.match(attivita, /filtroCategoria === 'tutte' \|\| t\.categoria === filtroCategoria/);
  assert.match(attivita, /import \{ C, today, TODO_CATEGORIE \} from '\.\.\/lib\/utils'/);
});

test('PoliedronHub reads its avviso label/icon from the shared TODO_CATEGORIE instead of a duplicated local map', () => {
  assert.doesNotMatch(poliedronHub, /const DATA_HEALTH_KIND_TITLE/);
  assert.doesNotMatch(poliedronHub, /const DATA_HEALTH_KIND_ICON/);
  assert.match(poliedronHub, /TODO_CATEGORIE\[kind\]\?\.icona \|\| 'warn'/);
  assert.match(poliedronHub, /TODO_CATEGORIE\[kind\]\?\.label \|\| kind/);
});
