import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// POL-PERF-001: l'avvio dell'app non deve scaricare librerie pesanti che
// servono solo in schermate specifiche (grafici, PDF, pagine pubbliche).
const main = fs.readFileSync('src/main.jsx', 'utf8');
const dashboard = fs.readFileSync('src/components/Dashboard.jsx', 'utf8');
const charts = fs.readFileSync('src/components/DashboardCharts.jsx', 'utf8');
const vite = fs.readFileSync('vite.config.js', 'utf8');

test('le pagine pubbliche sono caricate solo quando si apre il loro indirizzo', () => {
  for (const page of ['PrenotaOnline', 'FirmaConsenso', 'StoriaClinicaRemota', 'PatientWorkspaceV2Demo', 'PatientWorkspaceRealPreview']) {
    assert.doesNotMatch(main, new RegExp(`^import ${page}\\b`, 'm'), `${page} importata in modo statico`);
    assert.match(main, new RegExp(`const ${page} = lazyWithRetry\\(\\(\\) => import\\('./components/${page}\\.jsx'\\)`));
  }
  assert.match(main, /<Suspense fallback=\{<LoadingScreen \/>\}>\{elementoRadice\}<\/Suspense>/);
});

test('la Home non importa recharts: i grafici sono in un modulo caricato quando si aprono', () => {
  assert.doesNotMatch(dashboard, /from 'recharts'/);
  assert.match(dashboard, /const DashboardCharts = lazyWithRetry\(\(\) => import\('\.\/DashboardCharts\.jsx'\)/);
  assert.match(dashboard, /\{mostraGraficiDash && \(\s*<Suspense/);
  assert.match(charts, /from 'recharts'/);
  for (const serie of ['andamentoMensile', 'incassoPerPrestazione', 'incassoPerGiorno', 'speseMensili', 'speseCategoria']) {
    assert.match(charts, new RegExp(`data=\\{${serie}\\}`));
  }
});

test('React e gli helper di Vite hanno chunk propri, separati da grafici e PDF', () => {
  assert.match(vite, /manualChunks\(id\)/);
  assert.match(vite, /vite\/preload-helper.*return 'vite-helpers'/);
  assert.match(vite, /\(react\|react-dom\|scheduler\).*return 'react'/);
  assert.match(vite, /return 'jspdf'/);
  assert.match(vite, /return 'pdfjs'/);
  assert.match(vite, /return 'recharts'/);
});
