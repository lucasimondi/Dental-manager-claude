import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const agendaSource = await readFile(new URL('../src/components/Agenda.jsx', import.meta.url), 'utf8');
const premiumCss = await readFile(new URL('../src/components/PremiumVisualSystem.css', import.meta.url), 'utf8');

test('Agenda mobile floating container owns one safe-area-aware top clearance', () => {
  assert.match(
    premiumCss,
    /\.agenda-mobile-floating-controls\s*\{[^}]*top:\s*0;[^}]*padding-top:\s*calc\(env\(safe-area-inset-top, 0px\) \+ 16px\);/s,
  );
  assert.match(agendaSource, /--agenda-mobile-overlay-clearance/);
});

test('compact controls keep their visuals but expose 44px mobile targets', () => {
  assert.match(agendaSource, /className="agenda-mobile-touch-target"/);
  assert.match(agendaSource, /width:\s*44, height:\s*44/);
  assert.match(agendaSource, /width:\s*30, height:\s*30/);
  assert.match(agendaSource, /<Ic n="filter" s=\{13\}/);
  assert.match(agendaSource, /<Ic n="wa" s=\{14\}/);
  assert.match(agendaSource, /touchSafe=\{isMobile\}/);
});

test('floating overlays preserve explicit pointer-event and z-index contracts', () => {
  assert.match(premiumCss, /\.agenda-mobile-floating-controls\s*\{[^}]*z-index:\s*30;[^}]*pointer-events:\s*none;/s);
  assert.match(premiumCss, /\.agenda-mobile-floating-controls button,[\s\S]*?pointer-events:\s*auto;/);
  assert.match(agendaSource, /position:\s*'fixed', inset:\s*0, zIndex:\s*34/);
});
