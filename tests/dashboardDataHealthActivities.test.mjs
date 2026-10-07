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
  assert.match(source, /import \{ buildDataHealthActivities \} from '\.\.\/lib\/domain\/dataHealthActivities\.js';/);
  assert.match(source, /buildDataHealthActivities\(\{ patients, plans, appointments, today: t, formatDate: fmtD \}\)/);
});

test('each new Attività is inserted with its own paziente_id, one row per patient, never a bundled count', () => {
  assert.match(source, /paziente_id: entry\.pazienteId/);
  assert.doesNotMatch(source, /\$\{n\} pazient\$\{n === 1 \? 'e ha' : 'i hanno'\}/);
});

test('dedup checks the patient AND the stable per-kind marker, not just free text across the whole studio', () => {
  assert.match(source, /String\(row\.paziente_id \?\? ''\) === String\(entry\.pazienteId\) && String\(row\.testo \|\| ''\)\.includes\(entry\.dedupMarker\)/);
});

test('every Attività row renders as a real clickable control — patient-linked opens that patient, otherwise opens the Attività page (POL-UI-034: "poi devono essere cliccabili")', () => {
  assert.match(source, /const todoPaziente = todo\.paziente_id != null \? patients\.find\(\(p\) => String\(p\.id\) === String\(todo\.paziente_id\)\) : null;/);
  assert.match(source, /const apriTodo = \(\) => \(todoPaziente \? onOpenPaz\(todoPaziente, todoCategoriaTab\(todo\.categoria\)\) : \(onNavigate && onNavigate\('attivita'\)\)\);/);
  assert.match(source, /<button type="button" onClick=\{apriTodo\}/);
});

test('POL-AI-TEAM-003: Home only creates the Attività rows — alerts are sent by each assistant in its own chat, not as a summary in Poliedron\'s chat', () => {
  assert.doesNotMatch(source, /getOrCreatePrimaryConversation|appendConversationMessage/);
  assert.match(source, /setTodoList\(\(prev\) => \[\.\.\.inserite\.map\(\(x\) => x\.nuova\), \.\.\.prev\]\);/);
  const controller = fs.readFileSync(new URL('../src/components/poliedron/Poliedron.jsx', import.meta.url), 'utf8');
  assert.match(controller, /buildAlerts\(\{ patients, plans, appointments, todos: alertTodos/);
  assert.match(controller, /deliverAlerts\(/);
});
