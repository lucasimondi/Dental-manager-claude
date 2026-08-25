import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const agendaSource = await readFile(new URL('../src/components/Agenda.jsx', import.meta.url), 'utf8');

test('mobile Agenda keeps its shared top controls below the safe area', () => {
  assert.match(
    agendaSource,
    /paddingTop:\s*'calc\(env\(safe-area-inset-top, 0px\) \+ 20px\)'/,
  );
});

test('mobile Agenda safe-area clearance stays centralized on the root container', () => {
  assert.equal(
    agendaSource.match(/safe-area-inset-top/g)?.length,
    1,
    'the shared Agenda root should be the only top safe-area owner',
  );
  assert.match(agendaSource, /position:\s*'absolute', inset:\s*0, boxSizing:\s*'border-box'/);
});

test('compact mobile controls expose 44px touch targets without enlarging icons', () => {
  assert.match(agendaSource, /width:\s*44, height:\s*44, padding:\s*7/);
  assert.match(agendaSource, /minWidth:\s*44, height:\s*44/);
  assert.match(agendaSource, /<Ic n="filter" s=\{13\}/);
  assert.match(agendaSource, /<Ic n="wa" s=\{14\}/);
});
