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

// Product Owner follow-up: Incassato/Da incassare must live in the SAME
// section, both clickable, and a "Da incassare" row must be markable as
// incassato right there — writing a real payments.piano_id row (never a
// cosmetic flag), which is what get_saldo_piano/SchedaPaz's own widget
// read, so this really does "aggiornare il paziente".
const pagamenti = read('src/components/Pagamenti.jsx');

test('Incassato and Da incassare are one clickable view-switch, not two separate pages', () => {
  assert.match(component, /const \[activeView, setActiveView\] = useState\('outstanding'\)/);
  assert.match(component, /onClick=\{\(\) => setActiveView\('collected'\)\}/);
  assert.match(component, /onClick=\{\(\) => setActiveView\('outstanding'\)\}/);
  assert.match(component, /activeView === 'outstanding'/);
  assert.match(component, /activeView === 'collected'/);
});

// POL-FIN-007: the "Registra incasso" form itself (stato:'pagato' write)
// moved into the shared IncassoModal.jsx (task: reuse the exact same
// flow from Piani/SchedaPaz) — Incassi.jsx keeps only the call site.
const incassoModalComponent = read('src/components/IncassoModal.jsx');

test('a "Da incassare" row can be marked incassato right there, and it is a real payment (never a flag)', () => {
  assert.match(component, /Btn ch="Incassa" ic="eur" sz="sm"/);
  assert.match(component, /openIncasso\(\{\s*\n\s*pazienteId: String\(row\.paziente_id\), lockedPianoId: row\.piano_id,/);
  assert.match(incassoModalComponent, /stato: 'pagato'/);
  assert.doesNotMatch(component, /incassata: !v\.incassata/);
});

// Product Owner follow-up round 2: three distinct buttons — "Allega foto o
// PDF" (AI reads the document, whatever it is), "Registra incasso"
// (manual amount only, no upload toggle inside it any more) and "Registra
// da incassare" (unchanged "Aggiungi da incassare" behaviour, relabelled).
// The reader never needs to classify the document up front: one row found
// routes straight into "Registra incasso" prefilled, more than one opens
// the existing multi-row review table.
test('the three Incassi buttons are distinct: allega foto/pdf, registra incasso, registra da incassare', () => {
  assert.match(component, /Btn ch="Allega foto o PDF" ic="file"/);
  assert.match(component, /Btn ch="Registra incasso" ic="eur"/);
  assert.match(component, /Btn ch="Registra da incassare" ic="add"/);
});

test('a single recognized row routes into Registra incasso prefilled; multiple rows keep the review table; the endpoint is reused, not duplicated', () => {
  assert.match(component, /endpoint="estrai-pagamenti-estratto-conto"/);
  assert.match(component, /if \(righe\.length <= 1\) \{/);
  assert.match(component, /openIncasso\(riga \? \{ importo: riga\.importo/);
  assert.doesNotMatch(component, /handleIncassoEstratto/);
  // .incassi-source-toggle itself is still used by "Registra da incassare"'s
  // own, unrelated listino/libero switch — only the incasso-specific
  // manuale/ricevuta toggle (and its labels) must be gone.
  assert.doesNotMatch(component, /Importo manuale.*Foto o PDF ricevuta/s);
});

test('Collaborazioni esterne stays reachable as its own surface, locked away from the now-unified Studio list', () => {
  assert.match(workspace, /soloEsterno/);
  assert.match(pagamenti, /soloEsterno = false/);
  assert.match(pagamenti, /!soloEsterno && tabAttiva === 'studio'/);
  assert.match(pagamenti, /soloEsterno \|\| tabAttiva === 'esterno'/);
});

test('Incassi remains touch-first and responsive', () => {
  assert.match(css, /\.incassi-sort select \{ min-height: 44px/);
  // Each row is now a container (identity/open button + a per-row "Incassa"
  // or delete action alongside it) — the 60px touch target lives on the
  // open button itself, not the outer flex row.
  assert.match(css, /\.incassi-row__open \{[^}]*min-height: 60px/s);
  assert.match(css, /@media \(max-width:719px\)[\s\S]*\.incassi-kpis \{ grid-template-columns: 1fr/);
});
