import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const component = read('src/components/Incassi.jsx');
const app = read('src/App.jsx');
const control = read('src/components/ControlloGestione.jsx');
const utils = read('src/lib/utils.js');
const css = read('src/components/PremiumVisualSystem.css');

test('Incassi uses the canonical open-balances RPC client and never recomputes plan balance', () => {
  assert.match(component, /fetchSaldiApertiStudio\(studioId\)/);
  assert.doesNotMatch(component, /totale_piano\s*-\s*totale_pagato/);
  assert.match(component, /row\.saldo_piano/);
});

test('the same Incassi component is exposed as a page and management-control tab', () => {
  assert.match(app, /page === 'incassi'.*<Incassi/s);
  assert.match(control, /id: 'incassi'/);
  assert.match(control, /<Incassi[^>]*embedded/);
});

test('navigation defaults add Incassi without replacing the five dock slots', () => {
  assert.match(utils, /\{ id: 'incassi', l: 'Incassi', ic: 'pay' \}/);
  assert.match(utils, /menuItems: \[[^\]]*'incassi'/s);
  assert.match(utils, /slots: \['home', 'agenda', DOCK_MENU_SLOT, 'paga', 'wa'\]/);
});

test('worklist supports persisted sorting, patient payment navigation, and honest states', () => {
  assert.match(component, /pol_incassi_sort:/);
  assert.match(component, /onOpenPaz\?\.\(patient, 'paga'\)/);
  assert.match(component, /LoadingState/);
  assert.match(component, /ErrorState/);
  assert.match(component, /EmptyState/);
});

test('Incassi remains touch-first and responsive', () => {
  assert.match(css, /\.incassi-sort select \{ min-height: 44px/);
  assert.match(css, /\.incassi-row \{[^}]*min-height: 60px/s);
  assert.match(css, /@media \(max-width:719px\)[\s\S]*\.incassi-kpis \{ grid-template-columns: 1fr/);
});
