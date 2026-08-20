import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const component = readFileSync(new URL('../src/components/PhysioClinicalCore.jsx', import.meta.url), 'utf8');
const service = readFileSync(new URL('../src/lib/physioClinical.js', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/20260819154815_pol_fis_001_clinical_vertical_slice.sql', import.meta.url), 'utf8');

test('clinical core exposes episode workflow and always keeps free note', () => {
  for (const label of ['Overview','Anamnesi','Body map','Sedute','Timeline','Nota libera','Firma e chiudi']) assert.match(component, new RegExp(label, 'i'));
  assert.match(component, /Storico precedente/);
});

test('responsive contracts cover phone, tablet and desktop without a second app', () => {
  assert.match(component, /max-width:767px/);
  assert.match(component, /max-width:1024px/);
  assert.match(component, /min-width:1280px/);
  assert.match(component, /overflow-x:auto/);
  assert.match(component, /minHeight: 44/);
});

test('copy-forward is explicit and closed notes use amendments', () => {
  assert.match(component, /window\.confirm\('Creare una nuova bozza/);
  assert.match(service, /status: 'amendment'/);
  assert.match(migration, /closed clinical notes are immutable/);
});

test('physio implementation does not duplicate financial engine or expose public clinical URLs', () => {
  const combined = `${component}\n${service}`;
  assert.doesNotMatch(combined, /getPublicUrl/);
  assert.doesNotMatch(combined, /costo_mensile|fatturato\s*[=+-]|incassato\s*[=+-]|margine\s*[=+-]/i);
  assert.doesNotMatch(migration, /financial_cost_events|costo_mensile/);
});

test('server migration includes fail-closed membership, capabilities and tenant relationships', () => {
  assert.match(migration, /pol_fis_001_is_active_member/);
  assert.match(migration, /pol_fis_001_has_capability/);
  assert.match(migration, /FOREIGN KEY \(studio_id,episode_id\)/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/g);
});
