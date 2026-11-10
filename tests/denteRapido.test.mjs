// PO 2026-11-10: tocco prolungato sul dente — segna eseguito, assente, annulla.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { segnaEseguite, ripristinaPiani, vociDaFareDente, statoDente, dentiAssenti, impostaDenteAssente, appuntamentoDelGiorno, avanzamentoCure, messaggioEseguite, STATO_DENTE } from '../src/lib/domain/denteRapido.js';
import { creaPressioneLunga } from '../src/lib/pressioneLunga.js';

const piani = () => [
  { id: 1, pazienteId: 7, titolo: 'Piano A', stato: 'accettato', voci: [
    { prestazione: 'Otturazione', dente: '36', prezzo: 80, eseguita: false },
    { prestazione: 'Endo', dente: '36', prezzo: 250, eseguita: false },
    { prestazione: 'Igiene', dente: '', prezzo: 60, eseguita: false },
  ] },
  { id: 2, pazienteId: 7, titolo: 'Piano B', stato: 'attivo', voci: [{ prestazione: 'Corona', dente: '36', prezzo: 600, eseguita: true, dataEsec: '2026-01-02' }] },
  { id: 3, pazienteId: 9, titolo: 'Altro paziente', stato: 'attivo', voci: [{ prestazione: 'Otturazione', dente: '36', prezzo: 80, eseguita: false }] },
];

test('le voci da fare del dente sono solo del paziente e non ancora eseguite', () => {
  const v = vociDaFareDente(piani(), 7, 36);
  assert.deepEqual(v.map(x => [x.planId, x.index, x.prestazione]), [[1, 0, 'Otturazione'], [1, 1, 'Endo']]);
});

test('segna eseguito: eseguita, data di oggi, operatore e seduta; annulla ripristina', () => {
  const prima = piani();
  const r = segnaEseguite(prima, [{ planId: 1, index: 0 }, { planId: 1, index: 1 }], { data: '2026-11-10', operatoreId: 4, appuntamentoId: 99 });
  assert.equal(r.n, 2);
  const v = r.plans[0].voci;
  assert.deepEqual([v[0].eseguita, v[0].dataEsec, v[0].operatoreId, v[0].appuntamentoId], [true, '2026-11-10', 4, 99]);
  assert.equal(v[1].eseguita, true);
  assert.equal(v[2].eseguita, false, 'le altre voci restano com\'erano');
  assert.equal(r.plans[2], prima[2], 'gli altri piani non cambiano');
  assert.deepEqual(ripristinaPiani(r.plans, r.prima), prima);
  assert.equal(segnaEseguite(prima, [{ planId: 2, index: 0 }], { data: '2026-11-10' }).n, 0, 'una voce già eseguita non conta');
  assert.equal(messaggioEseguite(36, 2), 'Dente 36: 2 prestazioni eseguite');
  assert.equal(messaggioEseguite(36, 1), 'Dente 36: 1 prestazione eseguita');
});

test('colore del dente: assente > da fare > eseguito > sano', () => {
  assert.equal(statoDente({ done: 1, pending: 1 }, true), STATO_DENTE.ASSENTE);
  assert.equal(statoDente({ done: 1, pending: 1 }, false), STATO_DENTE.DA_FARE);
  assert.equal(statoDente({ done: 1, pending: 0 }, false), STATO_DENTE.ESEGUITO);
  assert.equal(statoDente({ done: 0, pending: 0 }, false), STATO_DENTE.SANO);
});

test('dente assente salvato nelle annotazioni esistenti senza toccare le note', () => {
  const paz = { id: 7, annotazioni: [{ testo: 'Nota', data: '2026-01-01' }] };
  const a = impostaDenteAssente(paz, 36, true, '2026-11-10');
  assert.deepEqual([...dentiAssenti(a)], [36]);
  assert.equal(a.annotazioni[0].testo, 'Nota');
  assert.equal(a.annotazioni[1].testo, undefined, 'senza testo: non compare tra le note');
  assert.deepEqual([...dentiAssenti(impostaDenteAssente(a, 36, false))], []);
  assert.deepEqual([...dentiAssenti({ annotazioni: null })], []);
});

test('seduta di oggi e avanzamento del piano', () => {
  const apps = [{ id: 1, pazienteId: 7, data: '2026-11-10', ora: '15:00' }, { id: 2, pazienteId: 7, data: '2026-11-10', ora: '09:00', stato: 'annullato' }, { id: 3, pazienteId: 7, data: '2026-11-11', ora: '09:00' }];
  assert.equal(appuntamentoDelGiorno(apps, 7, '2026-11-10').id, 1);
  assert.equal(appuntamentoDelGiorno(apps, 8, '2026-11-10'), null);
  assert.deepEqual(avanzamentoCure(piani(), 7), { eseguite: 1, totale: 4 });
});

test('pressione lunga: 600 ms, annullata se il dito si sposta > 10 px, click successivo assorbito', () => {
  let t = null, lunghi = [];
  const timers = { setTimeout: (fn) => { t = fn; return 1; }, clearTimeout: () => { t = null; } };
  const p = creaPressioneLunga({ onLungo: k => lunghi.push(k), timers });
  p.giu(36, { button: 0, clientX: 0, clientY: 0 }); t(); 
  assert.deepEqual(lunghi, [36]);
  assert.equal(p.consumaClick(), true); assert.equal(p.consumaClick(), false);
  p.giu(36, { button: 0, clientX: 0, clientY: 0 }); p.muovi({ clientX: 11, clientY: 0 });
  assert.equal(t, null, 'spostamento oltre 10 px: annullata');
  p.giu(36, { button: 0, clientX: 0, clientY: 0 }); p.su();
  assert.equal(t, null); assert.equal(p.consumaClick(), false, 'tocco breve: il click resta');
  let bloccato = false;
  p.menu(46, { preventDefault: () => { bloccato = true; } });
  assert.equal(bloccato, true); assert.deepEqual(lunghi, [36, 46]);
});

test('odontogramma: tocco breve seleziona, tocco prolungato apre il menu, legenda sopra', () => {
  const src = readFileSync(new URL('../src/components/PatientDentalOverview.jsx', import.meta.url), 'utf8');
  assert.match(src, /const tocco = d => \{ if \(press\.consumaClick\(\)\) return; toggle\(d\); \};/);
  assert.match(src, /\{\.\.\.press\.bind\(d\)\} onClick=\{\(\)=>tocco\(d\)\}/);
  assert.ok(src.indexOf('<LegendaDenti />') < src.indexOf('patient-dental-chart"'), 'legenda sopra l\'odontogramma');
  const css = readFileSync(new URL('../src/components/PatientDentalOverview.css', import.meta.url), 'utf8');
  for (const c of ['#FDE7D6', '#C2410C', '#1D4ED8', 'dashed', '-webkit-touch-callout:none', 'scale(.95)']) assert.ok(css.includes(c), c);
});
