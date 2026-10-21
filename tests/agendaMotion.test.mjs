import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutAgendaDay } from '../shared/agenda/geometry.js';
import { readFileSync } from 'node:fs';

test('timed personal events share columns with appointments instead of disappearing behind them', () => {
  const result=layoutAgendaDay([{id:1,ora:'09:00',durata:60}], [{id:1,ora_inizio:'09:00',ora_fine:'09:45'}]);
  assert.equal(result.length,2);
  assert.ok(result.every(x=>x.totalCols===2));
  assert.notEqual(result[0].col,result[1].col);
  assert.equal(result.filter(x=>x.a.agendaEvent).length,1);
});
test('both adapters use the same Personal-derived timeline, with no touch appointment drag', () => {
  for(const path of ['src/components/Agenda.jsx','personal/src/sezioni/agenda/AgendaGriglia.jsx']){
    const source=readFileSync(path,'utf8');
    assert.match(source,/useTimeline/);
    assert.match(source,/DayEvents/);
  }
  const presentation=readFileSync('shared/agenda/AgendaPresentation.jsx','utf8');
  assert.match(presentation,/onTouchStart=\{touchScroll \? undefined : onMoveTouch\}/);
  assert.match(presentation,/onMouseDown=\{touchScroll \? undefined : onMoveMouse\}/);
  assert.match(presentation,/touchAction: readOnly \|\| touchScroll \? 'pan-y'/);
});
