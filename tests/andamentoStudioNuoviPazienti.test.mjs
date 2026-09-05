import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { contaPazientiNuovi } from '../src/lib/utils.js';
import { HOME_WIDGET_REGISTRY, getHomeWidget, createDefaultHomeLayout } from '../src/lib/homeWidgetRegistry.js';

// POL-UI-026 — Product Owner: "in scheda pazienti c'è una parte superiore
// che si chiama andamento studio, indica pazienti nuovi ecc ma in realtà è
// sempre zero, sia mese che anno... controlla e fallo funzionare, rendilo
// anche widget per home, visibile ad attivazione in setup".
//
// Root cause (confirmed against production): patients.id is a sequential
// bigint PK (1, 2, 3...), never a timestamp -- but Pazienti.jsx's old
// `dataCreazione` did `new Date(Number(p.id))`, landing on 1 Jan 1970 for
// every real patient, so "startsWith(meseCorrente/annoCorrente)" (2026-xx)
// never matched: always zero. useControlloDati.js's own `nuoviMese` (feeding
// Dashboard's and PanoramicaControllo's "Pazienti totali +N questo mese")
// had the exact same bug. The real creation date was always available as
// the DB's `created_at` column -- src/lib/supabase.js's fromDb() was simply
// dropping it on every read.

const utilsSrc = fs.readFileSync(new URL('../src/lib/utils.js', import.meta.url), 'utf8');
const supabaseSrc = fs.readFileSync(new URL('../src/lib/supabase.js', import.meta.url), 'utf8');
const pazientiSrc = fs.readFileSync(new URL('../src/components/Pazienti.jsx', import.meta.url), 'utf8');
const controlloDatiSrc = fs.readFileSync(new URL('../src/lib/useControlloDati.js', import.meta.url), 'utf8');
const dashboardSrc = fs.readFileSync(new URL('../src/components/Dashboard.jsx', import.meta.url), 'utf8');

test('contaPazientiNuovi counts by the real createdAt field, never by id', () => {
  const patients = [
    { id: 103, createdAt: '2026-09-01T15:04:15.894094+00:00' }, // this month, this year
    { id: 100, createdAt: '2026-08-29T16:35:47.468289+00:00' }, // this year, not this month
    { id: 42, createdAt: '2025-12-01T00:00:00+00:00' },         // neither
    { id: 1 }, // no createdAt at all (e.g. optimistic pre-insert row) -- never counted, never guessed
  ];
  assert.equal(contaPazientiNuovi(patients, '2026-09'), 1);
  assert.equal(contaPazientiNuovi(patients, '2026'), 2);
  assert.equal(contaPazientiNuovi(patients, '2025'), 1);
  assert.equal(contaPazientiNuovi([], '2026'), 0);
  assert.equal(contaPazientiNuovi(undefined, '2026'), 0);
});

test('the old id-as-timestamp bug is gone from every call site', () => {
  assert.doesNotMatch(pazientiSrc, /new Date\(tms\)|Number\(p\.id\)/);
  assert.doesNotMatch(controlloDatiSrc, /new Date\(Number\(p\.id\)\)/);
  assert.match(pazientiSrc, /contaPazientiNuovi\(patients, meseCorrente\)/);
  assert.match(pazientiSrc, /contaPazientiNuovi\(patients, annoCorrente\)/);
  assert.match(controlloDatiSrc, /contaPazientiNuovi\(patients, t\.slice\(0, 7\)\)/);
  assert.match(controlloDatiSrc, /contaPazientiNuovi\(patients, t\.slice\(0, 4\)\)/);
  assert.match(controlloDatiSrc, /\bnuoviAnno\b/);
});

test('supabase.js surfaces created_at as createdAt (read) and never writes it back (it is DB-managed)', () => {
  assert.match(supabaseSrc, /createdAt: 'created_at'/);
  assert.doesNotMatch(supabaseSrc, /k === 'created_at'/);
  assert.match(supabaseSrc, /UI_ONLY_FIELDS = new Set\(\[[^\]]*'createdAt'[^\]]*\]\)/);
});

test('Andamento studio is now also an optional Home widget, hidden until the user turns it on themselves', () => {
  const widget = getHomeWidget('andamento_studio');
  assert.ok(widget, 'andamento_studio must exist in the registry');
  assert.equal(widget.defaultVisible, false);
  assert.ok(!widget.permission, 'no permission gate -- same audience as the Pazienti.jsx section it mirrors');
  assert.ok(!createDefaultHomeLayout().find((w) => w.id === 'andamento_studio').visible);

  assert.match(dashboardSrc, /w\.id === 'andamento_studio'/);
  assert.match(dashboardSrc, /label="Nuovi questo mese" value=\{nuoviMese\}/);
  assert.match(dashboardSrc, /label="Nuovi quest'anno" value=\{nuoviAnno\}/);
});

test('the registry stays internally consistent after adding the new widget', () => {
  assert.equal(new Set(HOME_WIDGET_REGISTRY.map((w) => w.id)).size, HOME_WIDGET_REGISTRY.length);
  const layout = createDefaultHomeLayout();
  assert.deepEqual(layout.map((w) => w.order), layout.map((_, i) => i));
});
