// PO 2026-11-10: nuova scheda paziente e scheda seduta aperta dall'Agenda.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('seduta: 4 passi che salvano lo stato dell\'appuntamento, «Prenotato» resta «confermato»', () => {
  const src = read('src/components/AppointmentSessionPanel.jsx');
  for (const [stato, label] of [['confermato', 'Prenotato'], ['arrivato', 'Arrivato'], ['in_poltrona', 'In poltrona'], ['concluso', 'Concluso']]) assert.match(src, new RegExp(`stato: '${stato}', label: '${label}'`));
  assert.match(src, /setAppointments\(cur => cur\.map\(a => String\(a\.id\) === String\(appointment\.id\) \? \{ \.\.\.a, stato \} : a\)\)/);
  assert.match(src, /globalThis\.confirm\?\.\(`Disdire/);
  assert.match(src, /'✓ Eseguito' : 'Segna eseguito'/);
  assert.match(src, /useEsecuzioneRapida\(\{ patientId: patient\.id/, 'stessa funzione del tocco prolungato');
  assert.match(src, /Concludi seduta e incassa/); assert.match(src, /Apri scheda completa/);
});

test('Agenda: con la scheda appuntamento si apre il pannello seduta, il modulo esistente resta dentro', () => {
  const src = read('src/components/Agenda.jsx');
  assert.match(src, /if \(renderAppointmentWorkspace && p\) return \(/);
  assert.match(src, /renderDettagli=\{\(\) => renderAppointmentWorkspace\(p, menuApp, \(\) => setMenuApp\(null\), setWorkspaceBusy\)\}/);
  assert.match(src, /onApriScheda=\{onOpenPatient \? \(\) => runPatientAction\(onOpenPatient\) : null\}/);
  assert.match(read('src/App.jsx'), /<Agenda plans=\{plans\} setPlans=\{setPlansSync\}/);
  const css = read('src/components/AppointmentSessionPanel.css');
  assert.match(css, /\.seduta-sheet \{[^}]*width:480px/);
  assert.match(css, /@media \(max-width:640px\) \{ \.seduta-sheet \{ width:100vw/);
});

test('scheda paziente: un solo tasto primario #155E75, tasti alti 44 px, nessun gradiente', () => {
  const src = read('src/components/SchedaPaz.jsx'), css = read('src/components/SchedaPazV3.css');
  assert.equal((src.match(/scheda-v3-primario/g) || []).length, 1);
  assert.match(css, /\.scheda-v3-azioni > button, \.scheda-v3-azioni > a \{[^}]*min-height:44px/);
  assert.match(css, /\.scheda-v3-azioni > \.scheda-v3-primario \{ background:#155E75/);
  assert.doesNotMatch(css, /gradient\(/);
  assert.match(css, /\.scheda-v3-tabs button\.is-active \{[^}]*border-bottom-color:#0F766E/);
  assert.match(css, /\.scheda-v3 \{ background:#F4F6F8; font-family:Inter/);
  assert.match(src, /className=\{saldiCaricati && totDaPagare > 0 \? 'is-dovuto' : ''\}/);
  assert.match(src, /\{avanz\.eseguite\} di \{avanz\.totale\} eseguite/);
  assert.doesNotMatch(src, /useEffect|supabase\./, 'la guardia della scheda paziente resta valida');
});
