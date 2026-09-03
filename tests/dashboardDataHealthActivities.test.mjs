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

// POL-FIN-007d: Product Owner — "li io ci metto anche attività da svolgere
// oltre i dati mancanti ... deve essere più chiaro e facile il fatto che
// siano attività e dati mancanti da completare". Manual todos and
// auto-generated data-health findings must now be explicitly tagged
// (todos.origine, migration 20260903100000) and rendered as two clearly
// separate, distinctly labeled sections — not inferred from paziente_id,
// which was only ever a reliable signal by accident.

test('every insert is explicitly tagged with its own origine — never left to the DB default alone', () => {
  assert.match(source, /origine: 'controllo_dati'/);
  assert.match(source, /origine: 'manuale'/);
});

test('the widget splits todos by origine, not by paziente_id', () => {
  assert.match(source, /const isDatiMancanti = \(x\) => x\.origine === 'controllo_dati';/);
  assert.match(source, /const todoManualiAttivi = todoAttivi\.filter\(\(x\) => !isDatiMancanti\(x\)\);/);
  assert.match(source, /const todoDatiAttivi = todoAttivi\.filter\(isDatiMancanti\);/);
});

test('manual and data-health todos render as two visually distinct, separately labeled sections', () => {
  assert.match(source, />Attività da svolgere /);
  assert.match(source, /Dati da completare \{todoDatiAttivi\.length/);
  // The data-health card is visually flagged (warning accent) and explains
  // itself, so it never reads as just another manual task.
  assert.match(source, /borderLeft: `3px solid \$\{C\.war\}`/);
  assert.match(source, /Rilevati automaticamente da Poliedron: piani o appuntamenti con dati mancanti da confermare, non attività aggiunte da te\./);
});

test('both sections reuse the same row renderer — the split is presentation only, not a duplicated implementation', () => {
  assert.match(source, /const renderTodoRow = \(todo\) => \{/);
  assert.match(source, /\{todoManualiAttivi\.map\(renderTodoRow\)\}/);
  assert.match(source, /\{todoDatiAttivi\.map\(renderTodoRow\)\}/);
});

const migration = fs.readFileSync(new URL('../supabase/migrations/20260903100000_pol_fin_007d_todos_origine.sql', import.meta.url), 'utf8');

test('REGRESSION GUARD: the origine migration is additive with a safe default, never a breaking schema change', () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS origine text NOT NULL DEFAULT 'manuale'/);
  assert.match(migration, /CHECK \(origine IN \('manuale', 'controllo_dati'\)\)/);
  assert.match(migration, /UPDATE public\.todos SET origine = 'controllo_dati' WHERE paziente_id IS NOT NULL;/);
});
