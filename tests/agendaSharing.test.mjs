import test from 'node:test';
import assert from 'node:assert/strict';
import { agendaVisible, agendaVisibility, hasVisibleAgenda, keepOccupiedWeekends } from '../shared/agenda/visibility.js';
import { rigaImpegno, rigaAppuntamento, generaDateRipetizione } from '../personal/src/lib/agenda.js';

test('past and new events default to both agendas; explicit exclusions survive', () => {
  for (const row of [{}, { data: '2020-01-01' }, {visibile_studio:null,visibile_personal:null}]) {
    assert.deepEqual(agendaVisibility(row), {visibile_studio:true,visibile_personal:true});
  }
  assert.equal(agendaVisible({visibileStudio:false}, 'studio'), false);
  assert.equal(agendaVisible({visibile_personal:false}, 'personal'), false);
  assert.equal(agendaVisible({visibile_studio:false}, 'personal'), true);
  assert.equal(hasVisibleAgenda({visibile_studio:false,visibile_personal:false}), false);
});

test('both writers persist independent choices and reject hiding from both calendars', () => {
  const event = {titolo:'Evento',data_inizio:'2026-10-25'};
  const app = {paziente_id:1,data:'2026-10-25',ora:'09:00'};
  for (const [writer, input] of [[rigaImpegno,event],[rigaAppuntamento,app]]) {
    assert.deepEqual(agendaVisibility(writer(input)), {visibile_studio:true,visibile_personal:true});
    assert.equal(writer({...input,visibile_personal:false}).visibile_personal,false);
    assert.equal(writer({...input,visibile_studio:false}).visibile_studio,false);
    assert.throws(() => writer({...input,visibile_personal:false,visibile_studio:false}), /agenda/);
  }
  const series = generaDateRipetizione('2026-10-25','2026-11-08','settimanale');
  assert.ok(series.map(data => rigaImpegno({...event,data_inizio:data,visibile_studio:false})).every(e=>!e.visibile_studio && e.visibile_personal));
});

test('work week reveals only occupied weekend days in the current week, including DST and multi-day events', () => {
  const start=new Date(2026,9,19,12);
  const hidden=[0,6,3];
  assert.deepEqual(keepOccupiedWeekends(start,hidden),hidden);
  assert.deepEqual(keepOccupiedWeekends(start,hidden,[{data:'2026-10-25'}]),[6,3]);
  assert.deepEqual(keepOccupiedWeekends(start,hidden,[{data:'2026-10-24'}]),[0,3]);
  assert.deepEqual(keepOccupiedWeekends(start,hidden,[{data:'2026-11-01'},{data:'2026-10-25',stato:'annullato'}]),hidden);
  assert.deepEqual(keepOccupiedWeekends(start,hidden,[],[{data_inizio:'2026-10-23',data_fine:'2026-10-26'}]),[3]);
  assert.deepEqual(keepOccupiedWeekends(start,hidden,[],[{dataInizio:'2026-10-25',dataFine:'2026-10-25'}]),[6,3]);
  assert.deepEqual(hidden,[0,6,3]);
});

test('an excluded Sunday never opens a hidden day on the normal calendar', () => {
  const sunday={data:'2026-10-25',visibile_studio:false};
  const visible=[sunday].filter(a=>agendaVisible(a,'studio'));
  assert.deepEqual(keepOccupiedWeekends(new Date(2026,9,19,12),[0,6],visible),[0,6]);
});
