import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/components/Agenda.jsx', import.meta.url), 'utf8');

// Product Owner (POL-UI-042): "non è possibile aggiungere appuntamento se
// hai creato paziente in stessa sessione dal popup ma ti ritorna l'elenco
// scorrimento per selezionare il paziente in questione". Root cause:
// App.jsx's makeSyncSetter swaps a newly-created item's client-side temp
// id for the server-assigned id asynchronously, with no signal to the
// still-open appointment form holding the old id in form.pazienteId — so
// SelettorePaziente can no longer find a match and reverts to search mode.
// creaPazienteRapido must remember the pending quick-created patient and a
// useEffect must reconcile form.pazienteId to the real id once the swap
// happens, matched by name (since the temp id is gone from `patients`).

test('creaPazienteRapido remembers the pending quick-created patient (tempId, nome, cognome) for later reconciliation', () => {
  assert.match(source, /const pendingQuickPatientRef = useRef\(null\);/);
  assert.match(source, /pendingQuickPatientRef\.current = \{ tempId: String\(id\), nome, cognome \};/);
});

test('a useEffect watching patients reconciles form.pazienteId to the real server id once the temp id disappears', () => {
  assert.match(source, /useEffect\(\(\) => \{\s*const pending = pendingQuickPatientRef\.current;/);
  assert.match(source, /if \(!pending\) return;/);
  assert.match(source, /if \(String\(form\.pazienteId\) !== pending\.tempId\) \{ pendingQuickPatientRef\.current = null; return; \}/);
  assert.match(source, /if \(patients\.some\(\(p\) => String\(p\.id\) === pending\.tempId\)\) return;/);
  assert.match(source, /const reale = patients\.find\(\(p\) => p\.nome === pending\.nome && p\.cognome === pending\.cognome\);/);
  assert.match(source, /F\(\{ pazienteId: String\(reale\.id\) \}\);/);
  assert.match(source, /pendingQuickPatientRef\.current = null;\s*\}\s*\}, \[patients\]\);/);
});

test('reconciliation only fires while pazienteId still points at the pending temp id (does not clobber a manual re-selection)', () => {
  // The bail-out clears the ref whenever pazienteId no longer matches the
  // remembered tempId, so switching the selection manually stops any
  // later reconciliation from overwriting it.
  assert.match(source, /if \(String\(form\.pazienteId\) !== pending\.tempId\) \{ pendingQuickPatientRef\.current = null; return; \}/);
});
