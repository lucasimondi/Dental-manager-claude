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
  // POL-UI-015 §3: Home now gets the same zero-inset #app-scroll treatment
  // Agenda already had — this !important rule used to force a fixed inset
  // back onto Home specifically, silently overriding App.jsx's own inline
  // padding logic (a plain inline style can never beat a stylesheet
  // !important), which was the real root cause of Home never reaching the
  // same edge-to-edge fullscreen Agenda already had. `.home-page` now owns
  // the actual content padding instead (see the mobile fullscreen test
  // below).
  assert.match(premium, /body:has\(\.home-widget-grid\) #app-scroll\s*\{\s*padding:\s*0\s*!important;/);
});

test('mobile Home is fullscreen: .home-page owns content padding, .home-hero is a sticky/floating bar, dock-clearance spacer is mobile-only', () => {
  assert.match(app, /paddingTop:\s*isMobile\s*\?\s*\(\(page === 'agenda' \|\| page === 'home'\)\s*\?\s*0\s*:/);
  assert.match(premium, /\.home-page\s*\{\s*padding:\s*0 15px env\(safe-area-inset-bottom, 0px\);\s*\}/);
  assert.match(premium, /\.home-hero\s*\{[\s\S]*position:\s*sticky;[\s\S]*top:\s*0;/);
  assert.match(premium, /\.home-dock-clearance\s*\{\s*display:\s*none;\s*\}/);
  assert.match(premium, /@media \(max-width: 600px\) \{[\s\S]*\.home-dock-clearance\s*\{\s*display:\s*block;\s*\}/);
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
  assert.match(agenda, /agenda-mobile-scroll-spacer--top/);
  assert.match(agenda, /agenda-mobile-scroll-spacer--bottom/);
  assert.match(premium, /\.agenda-mobile-scroll-spacer--top\s*\{[\s\S]*--agenda-mobile-overlay-clearance/);
  assert.match(premium, /\.agenda-mobile-scroll-spacer--bottom\s*\{[\s\S]*safe-area-inset-bottom/);
});

test('Agenda day strip follows the grid day source and uses mobile-only today styling', () => {
  assert.match(agenda, /getVisibleWeekDays\(weekStart, hiddenWeekdays\)/);
  assert.match(agenda, /getVisibleWeekDays\(ws, hiddenWeekdays\)/);
  assert.match(agenda, /gridTemplateColumns:\s*`repeat\(\$\{week\.length\}, minmax\(0, 1fr\)\)`/);
  assert.match(agenda, /agenda-mobile-day-number\$\{isToday \? ' is-today'/);
  assert.match(agenda, /background:\s*isMobile \? C\.sur : isWeekend \? C\.bg : isToday \? C\.priL : C\.sur/);
  assert.match(premium, /\.agenda-mobile-day-number\.is-today\s*\{[\s\S]*border-color:\s*var\(--danger\);[\s\S]*background:\s*transparent;/);
});

test('Agenda appointment menu clears the canonical mobile dock and scrolls internally', () => {
  assert.match(agenda, /MOBILE_DOCK_BOTTOM,\s*MOBILE_DOCK_HEIGHT/);
  assert.match(agenda, /MOBILE_APPOINTMENT_MENU_DOCK_OFFSET\s*=\s*MOBILE_DOCK_BOTTOM\s*\+\s*MOBILE_DOCK_HEIGHT/);
  assert.match(agenda, /--agenda-mobile-dock-offset/);
  assert.match(agenda, /MOBILE_APPOINTMENT_MENU_FAB_OFFSET\s*=\s*MOBILE_AGENDA_FAB_BOTTOM\s*\+\s*MOBILE_AGENDA_FAB_SIZE/);
  assert.match(agenda, /--agenda-mobile-fab-offset/);
  assert.match(premium, /\.agenda-appointment-menu-backdrop\s*\{[\s\S]*max\(var\(--agenda-mobile-dock-offset\), var\(--agenda-mobile-fab-offset\)\)[\s\S]*safe-area-inset-bottom/);
  assert.match(premium, /\.agenda-appointment-menu-sheet\s*\{[\s\S]*max-height:\s*calc\([\s\S]*100dvh[\s\S]*max\(var\(--agenda-mobile-dock-offset\), var\(--agenda-mobile-fab-offset\)\)/);
  assert.match(premium, /\.agenda-appointment-menu-actions\s*\{[\s\S]*overflow-y:\s*auto;[\s\S]*overscroll-behavior:\s*contain;/);
  assert.match(premium, /\.agenda-appointment-menu-safe-area\s*\{[\s\S]*display:\s*none;/);
});

test('all required mobile pages share the same app-scroll surface', () => {
  for (const page of ['home', 'agenda', 'paz', 'piani', 'paga', 'archivio', 'controllo', 'wa', 'set']) {
    assert.match(app, new RegExp(`page === '${page}'`), `${page} must render inside the shared shell`);
  }
});
