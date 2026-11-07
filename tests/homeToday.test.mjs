import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildHomeToday, isHomeTodayWidget, HOME_TODAY_REPLACED_WIDGET_IDS, toMinutes, fromMinutes } from '../src/lib/homeToday.js';
import { HOME_WIDGET_REGISTRY } from '../src/lib/homeWidgetRegistry.js';

// HOME-AGENDA-CENTRIC — dati sintetici.
const patients = [{ id: 1, nome: 'Anna', cognome: 'Prova' }, { id: 2, nome: 'Bruno', cognome: 'Test' }];
const day = '2026-11-06';
const apps = [
  { id: 'a', pazienteId: 1, data: day, ora: '09:00', durata: 30, stato: 'confermato', tipo: 'Igiene', poltronaId: 10 },
  { id: 'b', pazienteId: 2, data: day, ora: '10:15', durata: 60, stato: 'confermato', tipo: 'Chirurgia', poltronaId: 11 },
  { id: 'c', pazienteId: 1, data: day, ora: '11:30', durata: 30, stato: 'confermato' },
  { id: 'd', pazienteId: 2, data: day, ora: '12:00', durata: 30, stato: 'annullato' },
  { id: 'e', pazienteId: 2, data: '2026-11-07', ora: '09:00', durata: 30, stato: 'confermato' },
];

test('minutes helpers round-trip', () => {
  assert.equal(toMinutes('10:15'), 615);
  assert.equal(fromMinutes(615), '10:15');
  assert.equal(toMinutes(''), null);
});

test('only today, never cancelled, sorted, with current and next', () => {
  const r = buildHomeToday({ appointments: apps, patients, today: day, nowMinutes: 10 * 60 + 40 });
  assert.deepEqual(r.items.map((it) => it.a.id), ['a', 'b', 'c']);
  assert.deepEqual(r.items.map((it) => it.when), ['past', 'now', 'future']);
  assert.equal(r.current.a.id, 'b');
  assert.equal(r.current.name, 'Bruno Test');
  assert.equal(r.next.a.id, 'c');
  assert.equal(r.remaining, 2);
  assert.equal(r.columns.length, 1, 'no chairs -> one column');
});

test('one column per active chair, plus unassigned only when needed', () => {
  const r = buildHomeToday({ appointments: apps, patients, today: day, nowMinutes: 0, poltrone: [{ id: 10, nome: 'P1' }, { id: 11, nome: 'P2' }] });
  assert.deepEqual(r.columns.map((c) => c.label), ['P1', 'P2', 'Senza poltrona']);
  assert.deepEqual(r.columns.map((c) => c.items.length), [1, 1, 1]);
});

test('visible range is whole hours and always contains every appointment', () => {
  const early = [{ id: 'x', pazienteId: 1, data: day, ora: '07:20', durata: 30, stato: 'confermato' }, { id: 'y', pazienteId: 1, data: day, ora: '19:30', durata: 60, stato: 'confermato' }];
  const r = buildHomeToday({ appointments: early, patients, today: day, nowMinutes: 0 });
  assert.deepEqual(r.range, { start: 7 * 60, end: 21 * 60 });
  assert.deepEqual(buildHomeToday({ appointments: [], patients, today: day }).range, { start: 480, end: 1140 });
});

test('Home hides replaced and management-control widgets without touching the registry', () => {
  for (const id of HOME_TODAY_REPLACED_WIDGET_IDS) assert.equal(isHomeTodayWidget(HOME_WIDGET_REGISTRY.find((w) => w.id === id)), false);
  assert.ok(HOME_WIDGET_REGISTRY.filter((w) => w.permission === 'management_control').every((w) => !isHomeTodayWidget(w)));
  for (const id of ['todo', 'appuntamenti', 'richiami']) assert.equal(isHomeTodayWidget(HOME_WIDGET_REGISTRY.find((w) => w.id === id)), true);
});

test('Dashboard wires the agenda-centric Home, search and agenda button through existing handlers', () => {
  const dash = readFileSync(new URL('../src/components/Dashboard.jsx', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const pol = readFileSync(new URL('../src/components/poliedron/Poliedron.jsx', import.meta.url), 'utf8');
  assert.match(dash, /className="home-search" onClick=\{onOpenSearch\}/);
  assert.match(dash, /className="home-hero__agenda" onClick=\{\(\) => onGoAgenda && onGoAgenda\(\)\}/);
  assert.match(dash, /<HomeToday [\s\S]*onOpenAppointment=\{apriEditApp\}/);
  assert.ok(dash.indexOf('<HomeToday ') < dash.indexOf('<section className="home-attention"'));
  assert.ok(dash.indexOf('</HomeToday>') < dash.indexOf('<div className="home-workspace">'));
  assert.match(dash, /filterWidgetCatalog\(HOME_WIDGET_REGISTRY, homePermissions\)\.filter\(isHomeTodayWidget\)/);
  assert.match(app, /onPatientAction=\{openAppointmentPatientAction\} onOpenSearch=\{\(\) => setPoliedronSearchRequest\(\{ id: requestId\(\) \}\)\}/);
  assert.match(app, /searchRequest=\{poliedronSearchRequest\}/);
  assert.match(pol, /if \(!searchRequest\?\.id\) return;[\s\S]*setExternalContext\(null\);[\s\S]*setOpen\(true\);/);
});

test('green is scoped to the Home and defined for both themes', () => {
  const css = readFileSync(new URL('../src/components/HomeToday.css', import.meta.url), 'utf8');
  assert.match(css, /\.home-oggi \{[^}]*--oggi-brand: #0b7a5c;/s);
  assert.match(css, /:root\[data-theme="dark"\] \.home-oggi \{[^}]*--oggi-brand: #3cc79a;/s);
  assert.doesNotMatch(css, /^:root \{/m, 'no global token change in this step');
});

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

test('agenda summary: day and week lines from existing appointments and events', async () => {
  const { agendaSummary } = await import('../shared/agenda/summary.js');
  const apps = [{ data: '2026-10-16' }, { data: '2026-10-16' }, { data: '2026-10-20' }];
  const events = [{ start: '2026-10-15', end: '2026-10-17' }, { start: '2026-10-19', end: '2026-10-19' }];
  assert.equal(agendaSummary({ days: ['2026-10-16'], appointments: apps, events }), 'Venerdì 16 ottobre · 2 appuntamenti · 1 impegno');
  assert.equal(agendaSummary({ days: ['2026-10-18'], appointments: apps, events: [] }), 'Domenica 18 ottobre · giornata libera');
  const week = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'];
  assert.equal(agendaSummary({ days: week, appointments: apps, events }), '12–18 ottobre · 2 appuntamenti · 1 impegno');
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
