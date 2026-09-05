import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// POL-UI-025 — Product Owner, after seeing the two "Poliedron" widgets
// scrolling on Home: "deve essere aperta in una sezione dedicata, perché
// in home poi scorrere così va bene ma troppo incasinato... crea una
// sezione apposita... magari una sezione di poliedron dedicata alla
// salute dei dati, in cui metteremo altre cose". Replaces
// poliedronStatusWidget.test.mjs and poliedronHealthScoreWidget.test.mjs,
// whose Home-widget assertions no longer apply now that both widgets
// (plus Consigli Poliedron) moved into this dedicated page.
const hubSrc = fs.readFileSync(new URL('../src/components/PoliedronHub.jsx', import.meta.url), 'utf8');
const dashboardSrc = fs.readFileSync(new URL('../src/components/Dashboard.jsx', import.meta.url), 'utf8');
const registrySrc = fs.readFileSync(new URL('../src/lib/homeWidgetRegistry.js', import.meta.url), 'utf8');
const appSrc = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const utilsSrc = fs.readFileSync(new URL('../src/lib/utils.js', import.meta.url), 'utf8');
const useConsigliSrc = fs.readFileSync(new URL('../src/lib/poliedron/useConsigli.js', import.meta.url), 'utf8');

test('the three Poliedron Home widgets are gone from the registry, not just hidden', () => {
  assert.doesNotMatch(registrySrc, /id: 'consigli_ai'/);
  assert.doesNotMatch(registrySrc, /id: 'poliedron_status'/);
  assert.doesNotMatch(registrySrc, /id: 'poliedron_health_score'/);
});

test('Home keeps a single fixed "Poliedron" teaser (page chrome, not a removable widget) linking to the dedicated page', () => {
  assert.match(dashboardSrc, /onClick=\{\(\) => onNavigate && onNavigate\('poliedron'\)\}/);
  assert.match(dashboardSrc, /className="home-poliedron-widget"/);
  // Still computed on Home so the teaser can show a real percentage, not
  // a placeholder -- but no more per-check breakdown UI there.
  assert.match(dashboardSrc, /const dataHealthScore = useMemo/);
  assert.doesNotMatch(dashboardSrc, /setExpandedHealthCheckId|setPoliedronHealthOpen|setPoliedronStatusOpen/);
});

test('App.jsx routes a new "poliedron" page to PoliedronHub, and NAV/mobile dock both know about it', () => {
  assert.match(appSrc, /const PoliedronHub = lazy\(\(\) => import\('\.\/components\/PoliedronHub\.jsx'\)\);/);
  assert.match(appSrc, /page === 'poliedron' && <PoliedronHub/);
  assert.match(utilsSrc, /\{ id: 'poliedron', l: 'Poliedron', ic: 'compass' \}/);
  assert.match(utilsSrc, /menuItems: \[.*'poliedron'.*\]/);
});

test('PoliedronHub reuses the ControlloGestione sidebar/dropdown nav pattern (management-* classes) -- no new CSS', () => {
  assert.match(hubSrc, /className="management-hub"/);
  assert.match(hubSrc, /className="management-nav"/);
  assert.match(hubSrc, /className="management-nav-mobile"/);
  assert.match(hubSrc, /className="management-hub__section"/);
});

test('the "Chat" nav entry navigates away instead of switching section (POL-UI-025: one entry point for every Poliedron surface)', () => {
  assert.match(hubSrc, /\{ id: 'chat', icon: 'chat', label: 'Chat', external: true \}/);
  assert.match(hubSrc, /if \(item\.external\) \{ onNavigate && onNavigate\('chat'\); return; \}/);
});

test('Salute dati: the score breakdown is genuinely clickable per check, and "Altri avvisi" only covers kinds NOT already represented as a score check (no duplicate patient rows)', () => {
  assert.match(hubSrc, /const \[expandedCheckId, setExpandedCheckId\] = useState\(null\);/);
  assert.match(hubSrc, /const ALTRI_AVVISI_KINDS = new Set\(\[ACTIVITY_KIND\.STALLED_TREATMENT, ACTIVITY_KIND\.YESTERDAY_APPOINTMENT_NOT_MARKED\]\);/);
  assert.doesNotMatch(hubSrc, /ALTRI_AVVISI_KINDS.*ANAMNESI_MANCANTE|ANAMNESI_MANCANTE.*ALTRI_AVVISI_KINDS/);
});

test('Consigli Poliedron moved into its own hook (usePoliedronConsigli), shared by design since a widget cannot survive a page unmount', () => {
  assert.match(useConsigliSrc, /export function usePoliedronConsigli\(\{ enabled \}\)/);
  assert.match(useConsigliSrc, /genera-consigli-ai/);
  assert.match(hubSrc, /usePoliedronConsigli\(\{ enabled: consigliAttivi \}\)/);
  // Home no longer has ANY of this state -- confirms it was moved, not duplicated.
  assert.doesNotMatch(dashboardSrc, /consigliLoading|rigeneraConsigli|segnaLettoConsiglio/);
});

test('Da chiarire lists the actual anomalous bollette (date/importo/baseline), not just a pass/fail count', () => {
  assert.match(hubSrc, /const anomalies = bolletteQualita\?\.anomalies \|\| \[\];/);
  assert.match(hubSrc, /\{fmtD\(a\.data\)\} — media storica \{a\.baseline\}€/);
});
