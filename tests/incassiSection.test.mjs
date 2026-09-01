import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const component = read('src/components/Incassi.jsx');
const app = read('src/App.jsx');
const workspace = read('src/components/FinancialWorkspace.jsx');
const control = read('src/components/ControlloGestione.jsx');
const utils = read('src/lib/utils.js');
const css = read('src/components/PremiumVisualSystem.css');

test('Incassi uses the canonical open-balances RPC client and never recomputes plan balance', () => {
  assert.match(component, /fetchSaldiApertiStudio\(studioId\)/);
  assert.doesNotMatch(component, /totale_piano\s*-\s*totale_pagato/);
  assert.match(component, /row\.saldo_piano/);
});

test('Incassi and Pagamenti share one financial workspace while control keeps the analytical view', () => {
  assert.match(app, /page === 'paga' \|\| page === 'incassi'.*<FinancialWorkspace/s);
  assert.match(workspace, /<Incassi[^>]*embedded/);
  assert.match(workspace, /<Pagamenti[^>]*embedded/);
  assert.match(control, /id: 'incassi'/);
  assert.match(control, /<Incassi[^>]*embedded/);
});

test('navigation exposes one Incassi destination', () => {
  assert.match(utils, /\{ id: 'paga', l: 'Incassi', ic: 'pay' \}/);
  assert.doesNotMatch(utils, /\{ id: 'incassi', l: 'Incassi'/);
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
