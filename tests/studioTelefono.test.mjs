// STUDIO-TELEFONO (PO 2026-11-27): Start dello Studio sul telefono e icone a colori.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { appDiStart, GRUPPI_START, EVENTO_START } from '../src/lib/startStudio.js';
import { idIconaStudio, DISEGNI_STUDIO } from '../src/lib/iconeStudio.js';
import { NAV } from '../src/lib/utils.js';

test('Start shows only the apps the studio already sees, in groups, plus Home Studio and Personale', () => {
  const nav = NAV.filter((n) => !['spese', 'controllo', 'agenteai'].includes(n.id)); // piano senza queste funzioni
  const gruppi = appDiStart(nav);
  const ids = gruppi.flatMap(([, voci]) => voci.map((v) => v.id));
  assert.ok(ids.includes('studio') && ids.includes('perte'), 'Home Studio e Personale ci sono sempre');
  for (const nascosta of ['spese', 'controllo', 'agenteai']) assert.ok(!ids.includes(nascosta), `${nascosta} non compare`);
  assert.equal(new Set(ids).size, ids.length, 'nessuna app due volte');
  assert.deepEqual(gruppi.map(([t]) => t), GRUPPI_START.map(([t]) => t).filter((t) => t !== 'Gestione' || ids.includes('archivio') || ids.includes('home')));
  assert.equal(gruppi.at(-1)[1][0].id, 'set', 'Impostazioni in fondo');
});

test('Start search filters by name, accents ignored', () => {
  const ids = appDiStart(NAV, 'attivita').flatMap(([, v]) => v.map((x) => x.id));
  assert.deepEqual(ids, ['attivita']);
  assert.deepEqual(appDiStart(NAV, 'zzz'), []);
});

test('every Studio menu entry and dock slot has a colour icon', () => {
  for (const n of NAV) assert.ok(idIconaStudio(n.id), `icona per ${n.id}`);
  for (const id of ['studio', 'perte', 'nuovoAppuntamento', 'nuovoPaziente', 'ricetta', 'nuovoIncasso']) assert.ok(DISEGNI_STUDIO[idIconaStudio(id)], id);
  for (const d of Object.values(DISEGNI_STUDIO)) assert.doesNotMatch(d, /<script|on\w+=|href=|xlink/i, 'solo disegno statico');
});

test('dock Start and Home «Tutte le app» use the same event, opened only on the phone in App', () => {
  assert.equal(EVENTO_START, 'studio:apri-start');
  const app = readFileSync('src/App.jsx', 'utf8');
  assert.match(app, /\{startAperto && isMobile && \(/);
  assert.match(app, /<StartStudio nav=\{navVisibile\} onApri=\{navigateFromPoliedron\}/);
  assert.match(readFileSync('src/components/StudioHome.jsx', 'utf8'), /return isMobile \? <StudioHomeTelefono \{\.\.\.props\} \/> : <StudioHomeComputer \{\.\.\.props\} \/>;/);
});
