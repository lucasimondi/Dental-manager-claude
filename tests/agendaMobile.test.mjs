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
  // PO 2026-11-08: la barra cerca e agisce sul posto (RicercaAgenda); senza adattatore resta quella che apre Poliedron.
  assert.match(studio, /const mobileSearchBar = isMobile && ricerca \? \(\s*<RicercaAgenda fonte=\{fonteRicerca\}/);
  assert.match(studio, /\) : isMobile && onOpenSearch \? \(\s*<AgendaSearchBar onOpen=\{onOpenSearch\}/);
  assert.match(app, /ricerca=\{ricercaAgenda\} \/>\}/);
  assert.match(personal, /const ricerca = fonteRicerca \? <RicercaAgenda fonte=\{fonteRicerca\} \/>/);
  assert.match(studio, /\{!mobileSearchBar && <AgendaSwitch target="personal"/);
  assert.equal((studio.match(/searchBar=\{mobileSearchBar\}/g) || []).length, 3);
  assert.match(app, /onPoliedronCommand=\{openQuickHubPoliedron\} onOpenSearch=\{\(\) => setPoliedronSearchRequest\(\{ id: requestId\(\) \}\)\}/);
  assert.equal((personal.match(/searchBar=\{ricerca\}/g) || []).length, 2);
});

test('studio appointments stay filled blocks on phone too; personal events keep the transparent tone', () => {
  const shared = readFileSync(new URL('../shared/agenda/AgendaPresentation.jsx', import.meta.url), 'utf8');
  const studio = readFileSync(new URL('../src/components/Agenda.jsx', import.meta.url), 'utf8');
  const personal = readFileSync(new URL('../personal/src/sezioni/agenda/AgendaGriglia.jsx', import.meta.url), 'utf8');
  // PO 2026-11-08: "I colori di apt studio devono continuare ad essere più pieni e pro mentre i personali con le trasparenze".
  assert.match(shared, /height, background: fill, borderRadius: 6, overflow: 'hidden',/);
  assert.doesNotMatch(shared, /soft \?/);
  assert.doesNotMatch(studio, /<AppointmentBlock[^>]*\bsoft\b/);
  assert.doesNotMatch(personal, /<AppointmentBlock soft/);
  assert.match(shared, /bg: `color-mix\(in srgb, \$\{c\} 18%, var\(--agenda-tint-anchor, #fff\)\)`/);
  assert.match(shared, /isMobile && days\.length === 1 && <span className="agenda-now-pill">/);
});

test('phone agenda: no + button, tap a free slot to choose what to create; week strip also in day view', () => {
  const studio = readFileSync(new URL('../src/components/Agenda.jsx', import.meta.url), 'utf8');
  const personal = readFileSync(new URL('../personal/src/sezioni/agenda/AgendaGriglia.jsx', import.meta.url), 'utf8');
  const personalSection = readFileSync(new URL('../personal/src/sezioni/agenda/index.jsx', import.meta.url), 'utf8');
  assert.match(studio, /const toccaSlot = \(data, ora\) => \{ if \(!isMobile \|\| followUpRequest\) \{ apriNuovo\(data, ora\); return; \} setSceltaSlot\(\{ data, ora \}\); \};/);
  assert.match(studio, /apriNuovo: toccaSlot,/);
  assert.match(studio, />Appuntamento paziente<\/button>/);
  assert.match(studio, /apriNuovoImpegno\(s\.data, s\.ora\)/);
  assert.match(studio, /display: isMobile \? 'none' : undefined,\n\s+position: 'fixed',/);
  assert.match(personalSection, /senzaPiu: true/);
  assert.match(studio, /singleDay=\{false\}/);
  assert.match(personal, /singleDay=\{false\}/);
});

test('floating day events: one line per event in week view, at most two plus "+N"', () => {
  const ev = readFileSync(new URL('../shared/agenda/DayEvents.jsx', import.meta.url), 'utf8');
  assert.match(ev, /const VISIBILI_SETTIMANA = 2;/);
  assert.match(ev, /agenda-day-events--week/);
  assert.match(ev, /\+\{nascosti\}/);
  const css = readFileSync(new URL('../shared/agenda/agenda.css', import.meta.url), 'utf8');
  assert.match(css, /\.agenda-day-events--week button \{[^}]*white-space: nowrap;[^}]*text-overflow: ellipsis;/);
});
