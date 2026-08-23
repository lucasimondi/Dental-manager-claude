import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const agenda = readFileSync(new URL('../src/components/Agenda.jsx', import.meta.url), 'utf8');
const tokens = readFileSync(new URL('../src/styles/designTokens.css', import.meta.url), 'utf8');
const premium = readFileSync(new URL('../src/components/PremiumVisualSystem.css', import.meta.url), 'utf8');

test('mobile shell uses a definite dynamic viewport flex chain', () => {
  assert.match(tokens, /html,\s*body,\s*#root\s*\{[\s\S]*height:\s*100%;[\s\S]*min-height:\s*100%;[\s\S]*margin:\s*0;[\s\S]*padding:\s*0;/);
  assert.match(app, /className="app-main"/);
  assert.match(app, /height:\s*'100dvh',\s*minHeight:\s*'100dvh'/);
  assert.match(app, /flex:\s*'1 1 auto'[\s\S]*minHeight:\s*0[\s\S]*width:\s*'100%'/);
  assert.match(premium, /\.app-shell--mobile[\s\S]*height:\s*100dvh;[\s\S]*min-height:\s*100dvh;/);
});

test('mobile content reserves only the physical safe area outside Agenda', () => {
  assert.match(app, /paddingBottom:\s*isMobile\s*\?\s*\(page === 'agenda' \? 0 : 'env\(safe-area-inset-bottom, 0px\)'\)\s*:\s*28/);
  assert.match(app, /scrollPaddingBottom:\s*isMobile\s*\?\s*'calc\(94px \+ env\(safe-area-inset-bottom, 0px\)\)'/);
  assert.doesNotMatch(app, /paddingBottom:[\s\S]{0,120}92px/);
  assert.doesNotMatch(premium, /padding[^;\n]*92px/);
  assert.match(premium, /body:has\(\.home-widget-grid\) #app-scroll\s*\{[\s\S]*env\(safe-area-inset-bottom, 0px\) !important;/);
});

test('Agenda keeps its own inner scroll while other pages use app-scroll', () => {
  assert.match(app, /overflowY:\s*isMobile && page === 'agenda'\s*\?\s*'hidden'\s*:\s*'auto'/);
  assert.match(app, /display:\s*isMobile && page === 'agenda'\s*\?\s*'flex'/);
  assert.match(app, /page === 'agenda' \? 0 : 'env\(safe-area-inset-bottom, 0px\)'/);
  assert.doesNotMatch(agenda, /dockH|dock \(84px/);
});

test('Agenda mobile controls float above the scrolling grid', () => {
  assert.match(agenda, /agenda-mobile-floating-controls/);
  assert.match(agenda, /agenda-mobile-floating-month/);
  assert.match(agenda, /agenda-mobile-floating-week-strip/);
  assert.match(agenda, /agenda-mobile-grid-surface/);
  assert.match(premium, /\.agenda-mobile-floating-controls\s*\{[\s\S]*position:\s*absolute;[\s\S]*z-index:\s*30;/);
  assert.match(premium, /\.agenda-mobile-grid-surface\s*\{[\s\S]*z-index:\s*0;/);
});

test('all required mobile pages share the same app-scroll surface', () => {
  for (const page of ['home', 'agenda', 'paz', 'piani', 'paga', 'archivio', 'controllo', 'wa', 'set']) {
    assert.match(app, new RegExp(`page === '${page}'`), `${page} must render inside the shared shell`);
  }
});
