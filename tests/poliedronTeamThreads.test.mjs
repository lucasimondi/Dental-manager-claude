import test from 'node:test';
import assert from 'node:assert/strict';
import { TEAM_ASSISTANTS } from '../src/lib/poliedron/team/catalog.js';
import {
  loadTeamState, saveTeamState, teamContacts, addGroup, removeGroup, appendMessage,
  teamRequestFor, threadHistory, contactKey, MAX_THREAD_MESSAGES,
} from '../src/lib/poliedron/team/threads.js';
import { SPECIALISTI, ID_TEAM, leggiRichiestaTeam, leggiConsulti, eseguiConsulti } from '../supabase/functions/agente-assistente/team.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), m }; };
const ids = { studioId: 's1', userId: 'u1' };

test('client contacts and server team use the same assistant ids', () => {
  assert.deepEqual(TEAM_ASSISTANTS.map((a) => a.id).sort(), [...ID_TEAM].sort());
  assert.ok(SPECIALISTI.marketing && SPECIALISTI.clinical);
});
test('every client team request is accepted by the server validator', () => {
  let state = addGroup({ groups: [], threads: {}, alertsSent: {} }, { title: 'Crescita', objective: 'Più igiene', assistantIds: ['marketing', 'clinical'] }, { ...ids, id: 'g1' });
  for (const c of teamContacts(state)) assert.ok(leggiRichiestaTeam(teamRequestFor(c)), contactKey(c));
  assert.deepEqual(teamRequestFor(teamContacts(state).at(-1)), { assistente: 'clinic-manager', membri: ['marketing', 'clinical'], titolo: 'Crescita', obiettivo: 'Più igiene' });
});
test('state is kept per studio and user; invalid stored groups are dropped', () => {
  const storage = memory();
  let state = addGroup({ groups: [], threads: {}, alertsSent: {} }, { title: 'A', objective: 'B', assistantIds: ['finance'] }, { ...ids, id: 'g1' });
  state = appendMessage(state, 'group:g1', { id: '1', role: 'user', content: 'ciao' });
  saveTeamState(storage, 's1', 'u1', state);
  assert.deepEqual(loadTeamState(storage, 's1', 'u1'), { ...state, alertsSent: {} });
  assert.deepEqual(loadTeamState(storage, 's2', 'u1'), { groups: [], threads: {}, alertsSent: {} });
  assert.deepEqual(loadTeamState(storage, 's1', 'u2'), { groups: [], threads: {}, alertsSent: {} });
  storage.setItem('poliedron-team:v1:s1:u1', JSON.stringify({ groups: [{ id: 'x', title: 'X', objective: 'Y', assistantIds: ['hacker'] }], threads: {} }));
  assert.deepEqual(loadTeamState(storage, 's1', 'u1').groups, []);
  storage.setItem('poliedron-team:v1:s1:u1', '{broken');
  assert.deepEqual(loadTeamState(storage, 's1', 'u1'), { groups: [], threads: {}, alertsSent: {} });
  assert.deepEqual(loadTeamState({ getItem() { throw new Error('blocked'); } }, 's1', 'u1'), { groups: [], threads: {}, alertsSent: {} });
});
test('removing a group deletes its conversation; threads are bounded', () => {
  let state = addGroup({ groups: [], threads: {}, alertsSent: {} }, { title: 'A', objective: 'B', assistantIds: ['agenda'] }, { ...ids, id: 'g1' });
  state = appendMessage(state, 'group:g1', { id: '1', role: 'user', content: 'x' });
  assert.deepEqual(removeGroup(state, 'g1'), { groups: [], threads: {}, alertsSent: {} });
  for (let i = 0; i < MAX_THREAD_MESSAGES + 5; i++) state = appendMessage(state, 'assistant:agenda', { id: String(i), role: 'user', content: 'x' });
  assert.equal(state.threads['assistant:agenda'].length, MAX_THREAD_MESSAGES);
});
test('history excludes failed messages and extra fields', () => {
  const h = threadHistory([
    { role: 'user', content: 'a', failed: true },
    { role: 'user', content: 'b' },
    { role: 'assistant', content: 'c', pareri: [{ x: 1 }] },
  ]);
  assert.deepEqual(h, [{ role: 'user', content: 'b' }, { role: 'assistant', content: 'c' }]);
});
test('consultations: only members, no duplicates, attributed and time-bounded', async () => {
  assert.deepEqual(leggiConsulti({ consulti: [{ specialista: 'finance', domanda: ' x ' }, { specialista: 'finance', domanda: 'y' }, { specialista: 'agenda', domanda: 'z' }, { specialista: 'marketing', domanda: '' }] }, ['finance', 'marketing']), [{ specialista: 'finance', domanda: 'x' }]);
  const out = await eseguiConsulti(
    [{ specialista: 'finance', domanda: 'a' }, { specialista: 'agenda', domanda: 'b' }],
    (id, _q, signal) => (id === 'finance' ? Promise.resolve('Margine ok') : new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('timeout'))))),
    { timeoutMs: 20 },
  );
  assert.deepEqual(out.map((p) => [p.specialista, p.stato, p.parere]), [['finance', 'ok', 'Margine ok'], ['agenda', 'non_disponibile', null]]);
});
