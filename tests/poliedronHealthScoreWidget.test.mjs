import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// POL-UI-024: Product Owner — "In Dashboard crea widget che dica la
// salute dei dati gestionale (deve avere una percentuale) e questo viene
// controllato da poliedron che scannerizza tutti i dati mancanti dei
// pazienti: anagrafica ... anamnesi e un doc privacy ... se hanno fatto
// impianti bisogna aver compilato il modulo impianti con passaporto
// implantare ... Se le spese sono aggiornate ... spese condominiali se
// assicurazione annuale".
const dashboardSrc = fs.readFileSync(new URL('../src/components/Dashboard.jsx', import.meta.url), 'utf8');
const registrySrc = fs.readFileSync(new URL('../src/lib/homeWidgetRegistry.js', import.meta.url), 'utf8');
const appSrc = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('a new "poliedron_health_score" Home widget exists, visible by default', () => {
  assert.match(registrySrc, /id: 'poliedron_health_score'.*label: 'Poliedron — Salute dati gestionale'.*defaultVisible: true/);
});

test('Dashboard computes the score via the pure selector, fetching only the two missing pieces of data it needs (documenti_medici, implants)', () => {
  assert.match(dashboardSrc, /supabase\.from\('documenti_medici'\)\.select\('paziente_id, tipo'\)/);
  assert.match(dashboardSrc, /implants = \[\]/);
  assert.match(dashboardSrc, /const dataHealthScore = useMemo\(\(\) => computeDataHealthScore\(\{/);
  // pdf_base64 is the large blob column on documenti_medici -- must never
  // be pulled into Dashboard just to check which patients have a doc.
  assert.doesNotMatch(dashboardSrc, /\.select\([^)]*pdf_base64/);
});

test('App.jsx passes the already-in-memory implants array into Dashboard (no new fetch needed for it)', () => {
  assert.match(appSrc, /<Dashboard patients=\{patients\}.*implants=\{implants\}/);
});

test('the four spese-based checks are gated on the management_control permission, matching where `spese` itself is fetched', () => {
  assert.match(dashboardSrc, /financialDataAvailable: homePermissions\.managementControl/);
});

test('the widget shows a real percentage with a colored status and an expandable per-check breakdown', () => {
  assert.match(dashboardSrc, /if \(w\.id === 'poliedron_health_score'\) \{/);
  assert.match(dashboardSrc, /Non ci sono ancora abbastanza dati per calcolare un punteggio\./);
  assert.match(dashboardSrc, /const \[poliedronHealthOpen, setPoliedronHealthOpen\] = useState\(false\);/);
  assert.match(dashboardSrc, /const \[expandedHealthCheckId, setExpandedHealthCheckId\] = useState\(null\);/);
});

test('each per-patient check drills through to the patient record on the right tab (privacy -> doc, impianti -> impl, pagamenti -> paga)', () => {
  assert.match(dashboardSrc, /privacy: 'doc',/);
  assert.match(dashboardSrc, /impianti: 'impl',/);
  assert.match(dashboardSrc, /pagamenti: 'paga',/);
  assert.match(dashboardSrc, /onClick=\{\(\) => paz && onOpenPaz\(paz, dataHealthScoreCheckTab\(check\.id\)\)\}/);
});
