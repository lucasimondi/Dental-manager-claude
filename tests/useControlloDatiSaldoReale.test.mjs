import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Product Owner follow-up (payments/incassi architecture audit): "Eseguito
// da incassare" (Dashboard's box, and — via totEsegDaInc — Cockpit's
// cashflow forecast) used to be computed here purely from the legacy
// per-item "incassata" flag, never reading the real payments table. It
// must now be sourced from the same canonical get_saldi_aperti_studio RPC
// (eseguito_non_pagato) that Incassi.jsx/SchedaPaz.jsx already use, so the
// number is identical everywhere it appears — this is a source-level
// regression guard (no React render harness in this repo, same convention
// as tests/planExecutionUi.test.mjs).

const source = fs.readFileSync(new URL('../src/lib/useControlloDati.js', import.meta.url), 'utf8');

test('useControlloDati fetches the canonical studio-wide open balances', () => {
  assert.match(source, /import \{ fetchSaldiApertiStudio \} from '\.\/domain\/incassiService\.js';/);
  assert.match(source, /fetchSaldiApertiStudio\(studioId\)/);
});

test('esegDaInc/totEsegDaInc are derived from saldiAperti (eseguito_non_pagato), never from the legacy incassata flag', () => {
  assert.match(source, /saldiAperti\.filter\(r => String\(r\.paziente_id\) === String\(paz\.id\) && Number\(r\.eseguito_non_pagato\) > 0\)/);
  assert.equal(/v\.eseguita && !v\.incassata/.test(source), false, 'must not recompute "eseguito da incassare" from the legacy per-item flag');
});

test('the saldi-aperti fetch is refetched when plans/payments change, so a payment registered elsewhere is reflected here', () => {
  const effectBlock = source.match(/useEffect\(\(\) => \{\s*if \(!studioId \|\| !enabled\)[\s\S]*?\}, \[studioId, enabled, plans, payments\]\);/);
  assert.ok(effectBlock, 'expected the saldiAperti effect to depend on [studioId, enabled, plans, payments]');
});

test('saldiAperti is exposed from the hook', () => {
  assert.match(source, /return \{[\s\S]*saldiAperti[\s\S]*\};/);
});
