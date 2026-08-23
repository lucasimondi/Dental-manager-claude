import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildActivityText, normalizePhoneForTel } from '../src/lib/appointmentQuickHub.js';
import { buildContext } from '../src/lib/poliedron/contextEngine.js';

const agenda = readFileSync(new URL('../src/components/Agenda.jsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../src/components/Dashboard.jsx', import.meta.url), 'utf8');
const richiami = readFileSync(new URL('../src/components/Richiami.jsx', import.meta.url), 'utf8');
const poliedron = readFileSync(new URL('../src/components/poliedron/Poliedron.jsx', import.meta.url), 'utf8');

test('Chiama builds a valid tel target without modifying the stored phone', () => {
  const stored = '+39 333-123 45 67';
  assert.equal(normalizePhoneForTel(stored), '+393331234567');
  assert.equal(stored, '+39 333-123 45 67');
  assert.equal(normalizePhoneForTel(''), null);
  assert.equal(normalizePhoneForTel('non disponibile'), null);
});

test('activity association remains optional and backward-compatible in existing text storage', () => {
  const patient = { id: 7, nome: 'Mario', cognome: 'Rossi' };
  assert.equal(buildActivityText('Chiamare per preventivo', patient), 'Mario Rossi — Chiamare per preventivo');
  assert.equal(buildActivityText('Ordinare materiale', null), 'Ordinare materiale');
  assert.match(dashboard, /Paziente \(opzionale\)/);
  assert.match(dashboard, /setTodoPatientId\(''\)/);
  assert.match(dashboard, /search=\{todoPatientSearch\}/);
  assert.match(dashboard, /onSearchChange=\{setTodoPatientSearch\}/);
  assert.match(dashboard, /buildActivityText\(todoInput, patient\)/);
});

test('Agenda quick actions route the appointment patient through existing forms and patient detail', () => {
  assert.match(agenda, /phone \? 'Chiama' : 'Numero non disponibile'/);
  assert.match(agenda, />Scheda</);
  assert.match(agenda, />Richiamo</);
  assert.match(agenda, />Attività</);
  assert.match(app, /onOpenPatient=\{\(patient\) => goSchedaPaz\(patient, 'info'\)\}/);
  assert.match(app, /initialPatientRequest=\{quickHubRecallRequest\}/);
  assert.match(richiami, /pazienteId:\s*patient\?\.id != null \? String\(patient\.id\) : ''/);
  assert.match(richiami, /setPazSearch\(''\)/);
  assert.match(app, /activityPatientRequest=\{quickHubActivityRequest\}/);
});

test('contextual Poliedron request preserves authoritative patient id and appointment context', () => {
  const marioA = { id: 'p1', nome: 'Mario', cognome: 'Rossi' };
  const marioB = { id: 'p2', nome: 'Mario', cognome: 'Rossi' };
  const appointment = { id: 'a9', pazienteId: marioB.id, data: '2026-08-24', tipo: 'Visita' };
  const context = buildContext({ page: 'agenda', currentPatient: marioB, currentAppointment: appointment });
  assert.equal(context.currentPatient.id, 'p2');
  assert.equal(context.currentAppointment.id, 'a9');
  assert.notEqual(context.currentPatient.id, marioA.id);
  assert.match(poliedron, /currentPatient:\s*externalContext\?\.patient \|\| currentPatient/);
  assert.match(poliedron, /currentAppointment:\s*externalContext\?\.appointment \|\| null/);
  assert.match(poliedron, /setOpen\(true\)/);
});

test('mini Poliedron input remains an entry point to the existing singleton and confirmation UI', () => {
  assert.match(agenda, /onPoliedronCommand\(\{ command, patient: p, appointment: menuApp \}\)/);
  assert.match(agenda, /\[menuApp\?\.id\]/);
  assert.match(agenda, /const input = event\.currentTarget/);
  assert.match(app, /externalCommandRequest=\{quickHubPoliedronRequest\}/);
  assert.match(poliedron, /processQuery\(\{/);
  assert.match(poliedron, /runActionPlan\(plan,/);
  assert.doesNotMatch(agenda, /parseCommand|buildActionPlan|runActionPlan/);
});
