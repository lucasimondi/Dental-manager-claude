import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('mobile agenda: search on top, then month and days, in Studio and Personal; no app switch pill on phone', () => {
  const shared = readFileSync(new URL('../shared/agenda/AgendaPresentation.jsx', import.meta.url), 'utf8');
  const studio = readFileSync(new URL('../src/components/Agenda.jsx', import.meta.url), 'utf8');
  const personal = readFileSync(new URL('../personal/src/sezioni/agenda/AgendaGriglia.jsx', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const strip = shared.slice(shared.indexOf('export function DayStrip'));
  assert.ok(strip.indexOf('{compact && searchBar}') < strip.indexOf('agenda-mobile-floating-toolbar'), 'search bar renders before the toolbar');
  assert.ok(strip.indexOf('agenda-mobile-floating-toolbar') < strip.indexOf('agenda-mobile-floating-week-strip'), 'days strip stays under the toolbar');
  assert.match(studio, /const mobileSearchBar = isMobile && onOpenSearch \?/);
  assert.match(studio, /\{!mobileSearchBar && <AgendaSwitch target="personal"/);
  assert.equal((studio.match(/searchBar=\{mobileSearchBar\}/g) || []).length, 3);
  assert.match(app, /onPoliedronCommand=\{openQuickHubPoliedron\} onOpenSearch=\{\(\) => setPoliedronSearchRequest\(\{ id: requestId\(\) \}\)\}/);
  assert.equal((personal.match(/searchBar=\{ricerca\}/g) || []).length, 2);
});

test('phone agenda uses soft appointment blocks; desktop keeps the filled block', () => {
  const shared = readFileSync(new URL('../shared/agenda/AgendaPresentation.jsx', import.meta.url), 'utf8');
  const studio = readFileSync(new URL('../src/components/Agenda.jsx', import.meta.url), 'utf8');
  const personal = readFileSync(new URL('../personal/src/sezioni/agenda/AgendaGriglia.jsx', import.meta.url), 'utf8');
  assert.match(shared, /soft \? \{ background: tone\.bg, borderLeft: `3px solid \$\{fill\}`, borderRadius: 8/);
  assert.match(shared, /: \{ background: fill, borderRadius: 6 \}/);
  assert.match(studio, /<AppointmentBlock touchScroll=\{isMobile\} soft=\{isMobile\}/);
  assert.match(personal, /<AppointmentBlock soft /);
  assert.match(shared, /isMobile && days\.length === 1 && <span className="agenda-now-pill">/);
});
