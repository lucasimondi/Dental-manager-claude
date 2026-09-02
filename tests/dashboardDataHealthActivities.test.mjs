import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/components/Dashboard.jsx', import.meta.url), 'utf8');

// POL-FIN-007: Product Owner — "anche quando poliedron segna sulle
// attività, deve essere più chiaro, mandarmi notifica in chat, e dirmi
// pazienti che non hanno dati aggiornati, inoltre poliedron deve agire
// anche quando c'è un piano lì, senza una attività eseguita su quel
// piano, così come pazienti che hanno prestazioni in piani che non
// vengono teoricamente eseguite, e dobbiamo metterlo chiaro in attività
// ma chiaro e con la cliccabili".

test('the automatic data-health scan reuses the shared, tested selector instead of a bespoke rule', () => {
  assert.match(source, /import \{ buildDataHealthActivities, ACTIVITY_KIND \} from '\.\.\/lib\/domain\/dataHealthActivities\.js';/);
  assert.match(source, /buildDataHealthActivities\(\{ patients, plans, appointments, today: t, formatDate: fmtD \}\)/);
});

test('each new Attività is inserted with its own paziente_id, one row per patient, never a bundled count', () => {
  assert.match(source, /paziente_id: entry\.pazienteId/);
  assert.doesNotMatch(source, /\$\{n\} pazient\$\{n === 1 \? 'e ha' : 'i hanno'\}/);
});

test('dedup checks the patient AND the stable per-kind marker, not just free text across the whole studio', () => {
  assert.match(source, /String\(row\.paziente_id \?\? ''\) === String\(entry\.pazienteId\) && String\(row\.testo \|\| ''\)\.includes\(entry\.dedupMarker\)/);
});

test('a patient-linked Attività row renders as a real clickable control that opens that patient', () => {
  assert.match(source, /const todoPaziente = todo\.paziente_id != null \? patients\.find\(\(p\) => String\(p\.id\) === String\(todo\.paziente_id\)\) : null;/);
  assert.match(source, /onClick=\{\(\) => onOpenPaz\(todoPaziente, 'piani'\)\}/);
});

test('new findings also post one summary notification into the persisted Poliedron chat, naming the affected patients', () => {
  assert.match(source, /import \{ getOrCreatePrimaryConversation, appendConversationMessage, createChatRequestId \} from '\.\.\/lib\/poliedron\/conversationRepository\.js';/);
  assert.match(source, /getOrCreatePrimaryConversation\(\{ client: supabase, studioId, userId: currentUserId \}\)/);
  assert.match(source, /role: 'assistant',/);
  assert.match(source, /lista\.push\(entry\.patientName\)/);
});

test('the chat notification is best-effort and never blocks or undoes the already-saved Attività rows', () => {
  assert.match(source, /setTodoList\(\(prev\) => \[\.\.\.inserite\.map\(\(x\) => x\.nuova\), \.\.\.prev\]\);/);
  const chatBlockIndex = source.indexOf('Notifica in Chat Poliedron');
  const setTodoListIndex = source.indexOf('setTodoList((prev) => [...inserite.map');
  assert.ok(setTodoListIndex >= 0 && chatBlockIndex > setTodoListIndex, 'Attività rows must be saved to state before the chat notification is attempted');
  assert.match(source, /\} catch \{ \/\* la notifica in chat è un extra: le Attività sono già salvate \*\/ \}/);
});
