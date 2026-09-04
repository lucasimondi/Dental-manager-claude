import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// POL-UI-023: Product Owner — "in Dashboard dobbiamo inserire sezione
// poliedron cliccabile, deve essere quindi una sezione in cui ci dà tutte
// le info, quindi dati mancanti, ecc". Before this round, the only
// Poliedron-branded Home surfaces were "Consigli Poliedron" (business
// advice) and the flat, unbranded "Attività" todo list -- the automatic
// data-health scan (anamnesi mancante, piani da accettare/mai iniziati/
// fermi, appuntamento di ieri non segnato) had no dedicated, clickable
// place surfacing ALL of it live, independent of which findings had
// already become (or been dismissed as) a todo row.
const dashboardSrc = fs.readFileSync(new URL('../src/components/Dashboard.jsx', import.meta.url), 'utf8');
const registrySrc = fs.readFileSync(new URL('../src/lib/homeWidgetRegistry.js', import.meta.url), 'utf8');

test('a new "poliedron_status" Home widget exists, visible by default, distinct from Consigli Poliedron and Attività', () => {
  assert.match(registrySrc, /id: 'poliedron_status'.*label: 'Poliedron — Controllo dati'.*defaultVisible: true/);
});

test('the widget computes data-health findings live (not from the todos table), reusing the same pure selector as the chat notification', () => {
  assert.match(dashboardSrc, /const dataHealthFindings = useMemo\(\s*\n\s*\(\) => buildDataHealthActivities\(\{ patients, plans, appointments, today: t, formatDate: fmtD \}\),/);
  // The pre-existing "Controllo dati automatico" effect that posts a chat
  // summary must reuse the very same memoized list, not recompute its own
  // second copy -- one source of truth for what counts as a finding.
  assert.match(dashboardSrc, /const entries = dataHealthFindings;/);
});

test('the section is genuinely clickable: a toggle button expands/collapses per-kind, per-patient groups', () => {
  assert.match(dashboardSrc, /const \[poliedronStatusOpen, setPoliedronStatusOpen\] = useState\(false\);/);
  assert.match(dashboardSrc, /onClick=\{\(\) => setPoliedronStatusOpen\(\(v\) => !v\)\}/);
  assert.match(dashboardSrc, /onClick=\{\(\) => setPoliedronStatusOpen\(true\)\}/);
});

test('every listed finding is clickable through to the right patient tab (anamnesi -> clinical, everything else -> piani)', () => {
  assert.match(dashboardSrc, /const dataHealthKindTab = \(kind\) => DATA_HEALTH_KIND_TAB\[kind\] \|\| 'piani';/);
  assert.match(dashboardSrc, /\[ACTIVITY_KIND\.ANAMNESI_MANCANTE\]: 'clinical',/);
  assert.match(dashboardSrc, /onClick=\{\(\) => paz && onOpenPaz\(paz, dataHealthKindTab\(kind\)\)\}/);
});

test('an all-clear state shows a positive message instead of an empty toggle', () => {
  assert.match(dashboardSrc, /Nessun dato mancante da controllare/);
});
