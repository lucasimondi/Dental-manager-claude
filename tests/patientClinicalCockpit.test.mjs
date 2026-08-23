import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ANATOMICAL_AREA_TYPE,
  buildAnatomicalContext,
  buildMultiTreatmentPreview,
  buildPatientCockpitModel,
  derivePatientDataHealth,
  filterTreatmentGroups,
  groupTreatmentsByArea,
  patientFinancialSummary,
  patientTreatments,
  rowsForPatient,
  treatmentSummary,
} from '../src/lib/patientCockpitModel.js';
import {
  buildPatientChatContext,
  POLIEDRON_INPUT_SOURCE,
} from '../src/lib/poliedron/patientChatContext.js';
import {
  contextualizePatientCommand,
  planContextualPatientAction,
} from '../src/lib/poliedron/contextualActionPlanner.js';

const ROOT = path.resolve(import.meta.dirname, '..');

const patient = { id: 7, studio_id: 'studio-a', nome: 'Mario', cognome: 'Rossi' };
const plans = [{
  id: 10,
  studio_id: 'studio-a',
  pazienteId: 7,
  titolo: 'Piano 13',
  sconto: 0,
  scontoTipo: 'pct',
  voci: [
    { prestazione: 'Devitalizzazione', dente: '13', prezzo: 100, eseguita: true, dataEsec: '2026-08-20' },
    { prestazione: 'Perno in fibra', dente: '13', prezzo: 120, eseguita: false },
    { prestazione: 'Corona zirconio', dente: '13', prezzo: 500, eseguita: false },
  ],
}];

test('same tooth with three treatments produces one anatomical group', () => {
  const treatments = patientTreatments(plans, patient.id, 'studio-a');
  const groups = groupTreatmentsByArea(treatments);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].area.value, '13');
  assert.equal(groups[0].treatments.length, 3);
});

test('each treatment keeps an independent completion state', () => {
  const treatments = patientTreatments(plans, patient.id, 'studio-a');
  assert.deepEqual(treatments.map((item) => item.completed), [true, false, false]);
});

test('group summary reports one completed and two remaining', () => {
  const [group] = groupTreatmentsByArea(patientTreatments(plans, patient.id, 'studio-a'));
  assert.equal(group.completedCount, 1);
  assert.equal(group.remainingCount, 2);
  assert.deepEqual(treatmentSummary(group.treatments), { total: 3, completed: 1, remaining: 2 });
});

test('care-plan filters recompute group counts from the visible treatments', () => {
  const groups = groupTreatmentsByArea(patientTreatments(plans, patient.id, 'studio-a'));
  const [todoGroup] = filterTreatmentGroups(groups, 'todo');
  const [doneGroup] = filterTreatmentGroups(groups, 'done');
  assert.deepEqual(
    [todoGroup.treatments.length, todoGroup.completedCount, todoGroup.remainingCount],
    [2, 0, 2],
  );
  assert.deepEqual(
    [doneGroup.treatments.length, doneGroup.completedCount, doneGroup.remainingCount],
    [1, 1, 0],
  );
});

test('three selected teeth produce three target contexts', () => {
  const contexts = ['36', '37', '46'].map((tooth) => buildAnatomicalContext('tooth', tooth, `Elemento ${tooth}`));
  assert.equal(contexts.length, 3);
  assert.deepEqual(contexts.map((context) => context.value), ['36', '37', '46']);
});

test('one procedure applied to three selected teeth produces three planned entries', () => {
  const contexts = ['36', '37', '46'].map((tooth) => buildAnatomicalContext('tooth', tooth, `Elemento ${tooth}`));
  const preview = buildMultiTreatmentPreview(contexts, 'Otturazione composito');
  assert.equal(preview.length, 3);
  assert.ok(preview.every((item) => item.procedure === 'Otturazione composito'));
});

test('duplicate tooth groups are never created', () => {
  const groups = groupTreatmentsByArea(patientTreatments(plans, patient.id, 'studio-a'));
  assert.equal(new Set(groups.map((group) => group.key)).size, groups.length);
});

test('patient chat context passes only the scoped patient reference', () => {
  const context = buildPatientChatContext({ patient: { ...patient, telefono: 'secret-not-forwarded' } });
  assert.deepEqual(Object.keys(context.patient).sort(), ['cognome', 'id', 'nome', 'studio_id']);
  assert.equal(context.patient.id, patient.id);
  assert.equal(context.inputSource, POLIEDRON_INPUT_SOURCE.TEXT);
});

test('selected tooth context is passed to Poliedron', () => {
  const context = buildPatientChatContext({
    patient,
    anatomicalContext: buildAnatomicalContext('tooth', '13', 'Elemento 13'),
  });
  assert.deepEqual(context.anatomicalContext, { type: 'tooth', value: '13', label: 'Elemento 13' });
});

test('face region context is passed to Poliedron', () => {
  const context = buildPatientChatContext({
    patient,
    anatomicalContext: buildAnatomicalContext('face_region', 'glabella', 'Glabella'),
  });
  assert.equal(context.anatomicalContext.type, 'face_region');
  assert.equal(context.anatomicalContext.value, 'glabella');
});

test('voice transcript is a future-compatible input source without voice capture', () => {
  const context = buildPatientChatContext({ patient, inputSource: POLIEDRON_INPUT_SOURCE.VOICE_TRANSCRIPT });
  assert.equal(context.inputSource, 'VOICE_TRANSCRIPT');
});

test('incomplete tooth data is exposed as a Data Health issue', () => {
  const treatments = patientTreatments([{
    ...plans[0],
    voci: [{ prestazione: 'Devitalizzazione', dente: '', prezzo: 100, eseguita: true }],
  }], patient.id, 'studio-a');
  const health = derivePatientDataHealth(treatments);
  assert.equal(health.issues.length, 1);
  assert.equal(health.issues[0].field, 'tooth');
  assert.equal(health.completenessPercent, null);
});

test('known completed item is not shown as incomplete', () => {
  const health = derivePatientDataHealth(patientTreatments(plans, patient.id, 'studio-a'));
  assert.equal(health.issues.length, 0);
});

test('non-dental treatments without teeth are not fabricated as dental incompleteness', () => {
  const model = buildPatientCockpitModel({
    patient,
    plans: [{
      id: 20,
      studio_id: 'studio-a',
      pazienteId: 7,
      voci: [{ prestazione: 'Mobilizzazione', dente: '', prezzo: 80, eseguita: false }],
    }],
    payments: [],
    appointments: [],
    studioId: 'studio-a',
    vertical: 'fisioterapista',
    todayIso: '2026-08-23',
  });

  test('non-dental numeric metadata is not interpreted as an FDI tooth', () => {
    const treatments = patientTreatments([{
      id: 21,
      studio_id: 'studio-a',
      pazienteId: 7,
      voci: [{ prestazione: 'Mobilizzazione', dente: '13', prezzo: 80, eseguita: false }],
    }], patient.id, 'studio-a', { dentalApplicable: false });
    assert.equal(treatments[0].area.type, ANATOMICAL_AREA_TYPE.UNASSIGNED);
    assert.equal(treatments[0].area.label, 'Contesto non specificato');
  });
  assert.equal(model.dataHealth.issues.some((issue) => issue.field === 'tooth'), false);
  assert.equal(model.treatmentGroups[0].area.label, 'Contesto non specificato');
});

test('financial summary fails closed without a canonical per-patient contract', () => {
  const financial = patientFinancialSummary({
    plans: [{ ...plans[0], sconto: 10, scontoTipo: 'pct' }],
    payments: [{ id: 1, studio_id: 'studio-a', pazienteId: 7, importo: 200 }],
    patientId: 7,
    studioId: 'studio-a',
  });
  assert.equal(financial.available, false);
  assert.equal(financial.planned, null);
  assert.match(financial.reason, /canonico per-paziente/);
});

test('patient with no treatment plan renders a safe empty model', () => {
  const model = buildPatientCockpitModel({ patient, plans: [], payments: [], appointments: [], studioId: 'studio-a', todayIso: '2026-08-23' });
  assert.deepEqual(model.treatmentSummary, { total: 0, completed: 0, remaining: 0 });
  assert.equal(model.treatmentGroups.length, 0);
});

test('patient with no future appointment renders a safe null next appointment', () => {
  const model = buildPatientCockpitModel({
    patient,
    plans: [],
    payments: [],
    appointments: [{ id: 1, studio_id: 'studio-a', pazienteId: 7, data: '2026-01-01', ora: '10:00' }],
    studioId: 'studio-a',
    todayIso: '2026-08-23',
  });
  assert.equal(model.appointments.next, null);
  assert.equal(model.appointments.last.id, 1);
});

test('cross-tenant and tenantless rows are excluded fail-closed', () => {
  const rows = [
    { id: 'same', studio_id: 'studio-a', pazienteId: 7 },
    { id: 'other', studio_id: 'studio-b', pazienteId: 7 },
    { id: 'legacy', pazienteId: 7 },
  ];
  assert.deepEqual(rowsForPatient(rows, 7, 'studio-a').map((row) => row.id), ['same']);
});

test('invalid anatomical context is rejected', () => {
  assert.equal(buildAnatomicalContext('unknown', 'x', 'X'), null);
  assert.equal(buildAnatomicalContext(ANATOMICAL_AREA_TYPE.TOOTH, '', 'Dente'), null);
});

test('mobile stylesheet has hard overflow protection and 375px coverage', () => {
  const css = fs.readFileSync(path.join(ROOT, 'src/components/PatientClinicalCockpit.css'), 'utf8');
  assert.match(css, /overflow-x:\s*hidden/);
  assert.match(css, /@media \(max-width:\s*375px\)/);
});

test('cockpit uses the singleton Poliedron event and does not implement voice capture', () => {
  const source = fs.readFileSync(path.join(ROOT, 'src/components/PatientClinicalCockpit.jsx'), 'utf8');
  assert.match(source, /openPoliedronWithPatientContext/);
  assert.doesNotMatch(source, /SpeechRecognition|MediaRecorder|getUserMedia/);
});

test('multi-select handoff forwards procedure and teeth into the canonical plan form', () => {
  const cockpitSource = fs.readFileSync(path.join(ROOT, 'src/components/PatientClinicalCockpit.jsx'), 'utf8');
  const plansSource = fs.readFileSync(path.join(ROOT, 'src/components/Piani.jsx'), 'utf8');
  const appSource = fs.readFileSync(path.join(ROOT, 'src/App.jsx'), 'utf8');
  const patientsSource = fs.readFileSync(path.join(ROOT, 'src/components/Pazienti.jsx'), 'utf8');
  assert.match(cockpitSource, /onStartCanonicalPlan\(\{ procedure, teeth: selectedTeeth \}\)/);
  assert.match(plansSource, /setSelectedDenti\(Array\.isArray\(initDraft\?\.teeth\) \? initDraft\.teeth : \[\]\)/);
  assert.match(appSource, /onNuovoPiano=\{\(id, draft\) => \{ setSchedaDashPaz\(null\); goNuovoPiano\(id, draft\); \}\}/);
  assert.match(patientsSource, /onNuovoPiano=\{\(id, draft\) => \{ setScheda\(null\); onNuovoPiano\(id, draft\); \}\}/);
});

test('patient cockpit tenant and financial access fail closed', () => {
  const source = fs.readFileSync(path.join(ROOT, 'src/components/SchedaPaz.jsx'), 'utf8');
  assert.match(source, /studioId,\s*\n\s*vertical:/);
  assert.doesNotMatch(source, /studioId:\s*si\?\.studio_id\s*\?\?/);
  assert.match(source, /\.\.\.\(canViewPatientFinance \? \[\{ id: 'paga'/);
  assert.match(source, /tab === 'paga' && canViewPatientFinance/);
});

test('non-dental cockpit does not expose odontogram treatment creation', () => {
  const model = buildPatientCockpitModel({
    patient,
    plans: [],
    payments: [],
    appointments: [],
    studioId: 'studio-a',
    vertical: 'fisioterapista',
    todayIso: '2026-08-23',
  });
  assert.equal(model.dentalApplicable, false);
  const source = fs.readFileSync(path.join(ROOT, 'src/components/PatientClinicalCockpit.jsx'), 'utf8');
  assert.match(source, /dentalApplicable \? \[\['tooth', 'Odontogramma'\]\] : \[\]/);
});

test('contextual command inherits patient and selected tooth without inventing either', () => {
  const parsed = contextualizePatientCommand(
    'Segna devitalizzazione come eseguita',
    patient,
    buildAnatomicalContext('tooth', '13', 'Elemento 13'),
  );
  assert.equal(parsed.patientText, 'Mario Rossi');
  assert.equal(parsed.items[0].toothText, '13');
});

test('contextual Poliedron action remains a non-executing Phase A plan', () => {
  const plan = planContextualPatientAction('Segna devitalizzazione 13 come eseguita', {
    patient,
    patients: [patient],
    plans,
    payments: [],
    pricelist: [{ id: 1, nome: 'Devitalizzazione', prezzo: 100 }],
    homePermissions: { activeMember: true, managementControl: true, capabilities: ['clinical.general'] },
    studioId: 'studio-a',
  });
  assert.equal(plan.requiresConfirmation, true);
  assert.ok(plan.steps.some((step) => step.type === 'MARK_TREATMENT_COMPLETED'));
  assert.equal(plan.steps.some((step) => typeof step.run === 'function'), false);
});
