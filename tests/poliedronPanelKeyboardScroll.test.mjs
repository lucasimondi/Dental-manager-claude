import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { computeMobilePanelViewportRect } from '../src/lib/poliedron/poliedronPanelViewport.js';

const panelSource = readFileSync(new URL('../src/components/poliedron/PoliedronPanel.jsx', import.meta.url), 'utf8');

// Product Owner (POL-UI-041): "Quando clicco su poliedron icona esce il
// menu poliedron, e scrollabile ma su mobile per visualizzare tutto
// bisogna togliere tastiera. Facciamo che sia scrollabile fino a poter
// selezionare anche con la tastiera attiva tutte le varie azioni veloci,
// quindi scrollabile fino in fondo".
//
// Root cause: the mobile panel used `position: fixed; inset: 0` — sized
// to the full LAYOUT viewport, which iOS Safari never shrinks for an
// on-screen keyboard (the keyboard just overlaps the bottom of that fixed
// box). The scrollable content area inside only had as much real scroll
// range as its own content height, with no awareness that part of its
// space was covered — so once the keyboard covered the last quick
// actions, no amount of scrolling could bring them into view; dismissing
// the keyboard was the only way to see them.
//
// Fixed with window.visualViewport (real per-browser visible height,
// including iOS Safari — unlike env(keyboard-inset-height), which is a
// Chromium/VirtualKeyboard-API-only feature always 0px on iOS), sizing
// the fixed container to the actual visible area instead of the full
// layout viewport, so the flex column's own overflow-y:auto content
// naturally reaches everything within the space really visible above the
// keyboard.

test('computeMobilePanelViewportRect returns null with no visualViewport (desktop / unsupported browsers), keeping the old full-viewport behavior', () => {
  assert.equal(computeMobilePanelViewportRect(null), null);
  assert.equal(computeMobilePanelViewportRect(undefined), null);
});

test('computeMobilePanelViewportRect reports the real visible top/height from visualViewport, not the full layout viewport', () => {
  // No keyboard: visualViewport matches the full layout viewport.
  assert.deepEqual(computeMobilePanelViewportRect({ offsetTop: 0, height: 844 }), { top: 0, height: 844 });
  // Keyboard open: visualViewport height shrinks to the space still visible above it.
  assert.deepEqual(computeMobilePanelViewportRect({ offsetTop: 0, height: 544 }), { top: 0, height: 544 });
  // A missing offsetTop (some engines omit it when zero) must not produce NaN/undefined.
  assert.deepEqual(computeMobilePanelViewportRect({ height: 500 }), { top: 0, height: 500 });
});

test('the mobile container sizes itself from the live visualViewport rect instead of a fixed inset:0', () => {
  assert.match(panelSource, /import \{ computeMobilePanelViewportRect \} from '\.\.\/\.\.\/lib\/poliedron\/poliedronPanelViewport\.js'/);
  assert.match(panelSource, /const \[viewportRect, setViewportRect\] = useState/);
  assert.match(panelSource, /window\.visualViewport\.addEventListener\('resize', update\)/);
  assert.match(panelSource, /window\.visualViewport\.addEventListener\('scroll', update\)/);
  assert.match(panelSource, /top: viewportRect \? viewportRect\.top : 0/);
  assert.match(panelSource, /height: viewportRect \? viewportRect\.height : undefined/);
  // Cleanup must actually remove both listeners, not just one.
  assert.match(panelSource, /window\.visualViewport\.removeEventListener\('resize', update\)/);
  assert.match(panelSource, /window\.visualViewport\.removeEventListener\('scroll', update\)/);
});

test('the visualViewport listener is only wired up on mobile — desktop keeps its own separate, unaffected layout', () => {
  const effectBlock = panelSource.match(/useEffect\(\(\) => \{\s*\n\s*if \(!isMobile[\s\S]*?\}, \[isMobile\]\);/);
  assert.ok(effectBlock, 'expected a mobile-only useEffect wiring the visualViewport listener');
});
