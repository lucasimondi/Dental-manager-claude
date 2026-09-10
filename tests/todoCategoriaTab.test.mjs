import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { TODO_CATEGORIA_TAB, todoCategoriaTab, TODO_CATEGORIE } from '../src/lib/utils.js';

const dashboard = readFileSync(new URL('../src/components/Dashboard.jsx', import.meta.url), 'utf8');
const attivita = readFileSync(new URL('../src/components/Attivita.jsx', import.meta.url), 'utf8');
const poliedronHub = readFileSync(new URL('../src/components/PoliedronHub.jsx', import.meta.url), 'utf8');

// Product Owner: "le attività quando ci clicco sopra devono poter essere
// lette tutte quindi popup che permette di fare quello che dice l'attività
// direttamente, se anamnesi popup anamnesi, ecc" (POL-UI-037).

test('todoCategoriaTab routes ANAMNESI_MANCANTE to the Anamnesi tab, everything else to Piani di Cura', () => {
  assert.equal(todoCategoriaTab('ANAMNESI_MANCANTE'), 'clinical');
  assert.equal(todoCategoriaTab('YESTERDAY_APPOINTMENT_NOT_MARKED'), 'piani');
  assert.equal(todoCategoriaTab('PLAN_AWAITING_ACCEPTANCE_DECISION'), 'piani');
  assert.equal(todoCategoriaTab('PLAN_NEVER_STARTED'), 'piani');
  assert.equal(todoCategoriaTab('STALLED_TREATMENT'), 'piani');
  assert.equal(todoCategoriaTab('DA_ORDINARE'), 'piani');
  assert.equal(todoCategoriaTab(undefined), 'piani');
  assert.equal(todoCategoriaTab(null), 'piani');
});

test('every TODO_CATEGORIE key resolves to a valid target via todoCategoriaTab (no silent typo in TODO_CATEGORIA_TAB keys)', () => {
  for (const key of Object.keys(TODO_CATEGORIA_TAB)) {
    assert.ok(key in TODO_CATEGORIE, `TODO_CATEGORIA_TAB has a stray key not in TODO_CATEGORIE: ${key}`);
  }
});

test('Dashboard.jsx Home widget opens the patient on the category-specific tab, not always "piani"', () => {
  assert.match(dashboard, /todoCategoriaTab, pazientiNuoviIn \} from '\.\.\/lib\/utils'/);
  assert.match(dashboard, /onOpenPaz\(todoPaziente, todoCategoriaTab\(todo\.categoria\)\)/);
});

test('Attivita.jsx also opens the category-specific tab from its own Attività list', () => {
  assert.match(attivita, /todoCategoriaTab, RICHIAMO_CATEGORIE/);
  assert.match(attivita, /onOpenPaz\(paz, todoCategoriaTab\(tItem\.categoria\)\)/);
});

test('PoliedronHub "Altri avvisi" also opens the category-specific tab (same helper, no separate hardcoded "piani")', () => {
  assert.match(poliedronHub, /todoCategoriaTab \} from '\.\.\/lib\/utils'/);
  assert.match(poliedronHub, /onOpenPaz\(paz, todoCategoriaTab\(entry\.kind\)\)/);
});
