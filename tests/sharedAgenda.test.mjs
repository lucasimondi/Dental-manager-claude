import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readAgendaLocation, agendaDestination } from '../shared/agenda/navigation.js';
import { getVisibleWeekDays } from '../shared/agenda/visibleDays.js';

test('agenda switch carries day and view without session, patient or clinical data', () => {
  for (const view of ['giorno','settimana','mese']) {
    const url = new URL(agendaDestination('personal', '2026-10-16', view, {hostname:'preview.example',origin:'https://preview.example'}));
    assert.equal(url.pathname, '/personal/');
    assert.deepEqual(readAgendaLocation(url.search), {requested:true,day:'2026-10-16',view});
    assert.deepEqual([...url.searchParams.keys()], ['agenda','agendaDate','agendaView']);
  }
});
test('production switch goes to the existing Studio and Personal origins; previews stay isolated', () => {
  assert.equal(new URL(agendaDestination('studio','2026-10-16','mese',{hostname:'personal.poliedrasoft.it',origin:'https://personal.poliedrasoft.it'})).href,'https://personal.poliedrasoft.it/studio?agenda=1&agendaDate=2026-10-16&agendaView=mese');
  assert.equal(new URL(agendaDestination('personal','2026-10-16','mese',{hostname:'dental-manager-acmeproduction.vercel.app',origin:'https://dental-manager-acmeproduction.vercel.app'})).origin,'https://personal.poliedrasoft.it');
  assert.equal(new URL(agendaDestination('studio','2026-10-16','mese',{hostname:'localhost',origin:'http://localhost:5173'})).origin,'http://localhost:5173');
});
test('malformed calendar links never initialize an invalid date or unsupported view', () => {
  for (const date of ['2026-02-30','invalid','2026-13-01','<script>']) assert.equal(readAgendaLocation(`?agenda=1&agendaDate=${encodeURIComponent(date)}&agendaView=anno`).day,null);
  assert.equal(readAgendaLocation('?agendaDate=2026-10-16&agendaView=giorno').requested,false);
  assert.equal(readAgendaLocation('?agenda=1&agendaView=anno').view,null);
});
test('both applications consume original neutral presentation; no CSS replica or Studio dependency in shared', () => {
  const shared=readFileSync('shared/agenda/AgendaPresentation.jsx','utf8');
  for(const file of ['src/components/Agenda.jsx','personal/src/sezioni/agenda/AgendaGriglia.jsx']) {
    const src=readFileSync(file,'utf8');
    assert.match(src,/shared\/agenda\/AgendaPresentation.jsx/);
    for(const name of ['DayStrip','ViewPicker','TimeGrid','MonthCalendar','AppointmentBlock','EventBlock','AgendaSwitch','MonthDetailCard','MonthToolbar','CalendarEmptyState']) assert.ok(src.includes(`<${name}`),`${file}: ${name}`);
    assert.doesNotMatch(src,/function (DayStrip|TimeGrid|MonthCalendar|AppointmentBlock|EventBlock)\(/);
  }
  assert.doesNotMatch(shared,/supabase|from ['"].*src\//i);
  assert.doesNotMatch(readFileSync('personal/src/personal.css','utf8'),/\.ag-(pagina|striscia|app|scorri|impegno)\s*\{/);
});
test('shared visible days keep configured hidden weekdays without collapsing an empty week', () => {
  const monday=new Date('2026-10-12T12:00');
  assert.deepEqual(getVisibleWeekDays(monday,[0,6]).map(d=>d.getDay()),[1,2,3,4,5]);
  assert.equal(getVisibleWeekDays(monday,[0,1,2,3,4,5,6]).length,7);
});

test('month navigation preserves selected day separately from visible month across applications', () => {
  const url = new URL(agendaDestination('personal','2026-10-16','mese',{hostname:'localhost',origin:'http://localhost:5173'},'2026-11-01'));
  assert.deepEqual(readAgendaLocation(url.search),{requested:true,day:'2026-10-16',view:'mese',month:'2026-11-01'});
  assert.equal(readAgendaLocation('?agendaMonth=2026-02-30').month,undefined);
});

test('Studio on the Personal domain bypasses only the root redirect and uses the existing Studio SPA', () => {
  const config=JSON.parse(readFileSync('vercel.json','utf8'));
  const studio=new URL(agendaDestination('studio','2026-10-16','giorno',{hostname:'personal.poliedrasoft.it',origin:'https://personal.poliedrasoft.it'}));
  assert.equal(studio.pathname,'/studio');
  assert.equal(config.redirects.some(r=>r.source===studio.pathname),false);
  assert.ok(config.rewrites.some(r=>r.source==='/(.*)'&&r.destination==='/index.html'));
  const back=new URL(agendaDestination('personal','2026-10-16','giorno',{hostname:studio.hostname,origin:studio.origin}));
  assert.equal(back.href,'https://personal.poliedrasoft.it/personal/?agenda=1&agendaDate=2026-10-16&agendaView=giorno');
});

// PR #209: the quick weekend toggle never hides a day the studio keeps open
// until the user actually uses it.
import { agendaHiddenWeekdays, weekendsHiddenState } from '../src/lib/agendaVisibleDays.js';
test('Studio weekend toggle: configured closing days by default, both only on request', () => {
  assert.deepEqual(agendaHiddenWeekdays({ configured: [0], view: 'settimana' }), [0], 'closed on Sunday only: Saturday stays visible');
  assert.equal(weekendsHiddenState({ configured: [0] }), false);
  assert.deepEqual(agendaHiddenWeekdays({ configured: [0, 6], view: 'settimana' }), [0, 6]);
  assert.equal(weekendsHiddenState({ configured: [0, 6] }), true);
  assert.deepEqual(agendaHiddenWeekdays({ configured: [], view: 'settimana' }), []);
  assert.deepEqual(agendaHiddenWeekdays({ configured: [3], view: 'settimana_lavoro' }), [3, 0, 6], 'work week keeps the studio closing days too');
  assert.deepEqual(agendaHiddenWeekdays({ configured: [0], view: 'settimana', override: true }), [0, 6]);
  assert.deepEqual(agendaHiddenWeekdays({ configured: [0, 6, 3], view: 'settimana', override: false }), [3]);
});
