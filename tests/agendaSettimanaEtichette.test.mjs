// PO 2026-11-08: vista sempre in settimana, menu vista sopra gli impegni flottanti,
// modulo appuntamento scorrevole fino in fondo con tastiera, etichette come negli impegni.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('nessun passaggio verso il giorno; APP-UNICA: niente più tasti che portano all\'altra app dal dock o dall\'agenda', () => {
  for (const f of ['src/components/poliedron/PoliedronMobileDock.jsx', 'personal/src/App.jsx', 'src/components/Agenda.jsx']) {
    const src = read(f);
    assert.doesNotMatch(src, /agendaDestination\([^;\n]{0,140}'giorno'/, f);
    assert.doesNotMatch(src, /aria-label="Apri (Personal|Studio)"/, f);
  }
});

test('la barra mobile (ricerca, mese, menu vista) sta sopra gli impegni flottanti', () => {
  assert.match(read('shared/agenda/agenda.css'), /\.agenda-mobile-chrome\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*3/);
});

test('lo sfondo del modulo segue l\'area visibile quando compare la tastiera', async () => {
  const src = read('src/components/ui/Modal.jsx');
  assert.match(src, /useEffect\(\(\) => fitToVisualViewport\(backdropRef\.current\), \[\]\)/);
  const fn = src.slice(src.indexOf('export function fitToVisualViewport')).replace('export function', 'function');
  const fit = new Function(`${fn}; return fitToVisualViewport;`)();
  const handlers = {};
  const vv = { height: 500, offsetTop: 0, addEventListener: (e, h) => { handlers[e] = h; }, removeEventListener: (e) => { delete handlers[e]; } };
  const el = { style: { top: '0px', bottom: '0px' } };
  const stop = fit(el, { innerHeight: 800, visualViewport: vv });
  assert.equal(el.style.bottom, '300px');
  vv.height = 800; handlers.resize();
  assert.equal(el.style.bottom, '0px', 'senza tastiera torna il valore di partenza');
  assert.equal(el.style.top, '0px');
  stop();
  assert.deepEqual(Object.keys(handlers), []);
});

test('appuntamento Studio: etichette come negli impegni, colori di palette pieni', () => {
  const agenda = read('src/components/Agenda.jsx');
  assert.match(agenda, /className=\{`appointment-label\$\{attiva \? ' attiva' : ''\}`\}/);
  assert.match(agenda, /<LabelSwatches className="appointment-label-colors"[^\n]*custom=\{false\}/);
  assert.match(read('src/components/PremiumVisualSystem.css'), /\.appointment-label\.attiva\s*\{\s*background:var\(--c\)/);
});
