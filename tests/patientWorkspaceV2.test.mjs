import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const component = fs.readFileSync('src/components/PatientWorkspaceV2.jsx', 'utf8');
const demo = fs.readFileSync('src/components/PatientWorkspaceV2Demo.jsx', 'utf8');
const main = fs.readFileSync('src/main.jsx', 'utf8');
const app = fs.readFileSync('src/App.jsx', 'utf8');
const patientRecord = fs.readFileSync('src/components/SchedaPaz.jsx', 'utf8');
const css = fs.readFileSync('src/components/PatientWorkspaceV2.css', 'utf8');
const registry = fs.readFileSync('src/lib/patientWorkspaceActionRegistry.js', 'utf8');
const domain = fs.readFileSync('src/lib/patientWorkspaceDomain.js', 'utf8');
const audit = fs.readFileSync('docs/audits/POL-PATIENT-WORKSPACE-DOMAIN-AUDIT.md', 'utf8');

test('Patient Workspace 2.0 is available only through its isolated demo route', () => {
  assert.match(main, /patient-workspace-v2-demo/);
  assert.match(main, /<PatientWorkspaceV2Demo\s*\/>/);
  assert.doesNotMatch(app, /PatientWorkspaceV2/);
  assert.doesNotMatch(patientRecord, /PatientWorkspaceV2/);
});

test('preview performs no automatic remote work', () => {
  for (const source of [component, demo, registry, domain]) {
    assert.doesNotMatch(source, /supabase/i);
    assert.doesNotMatch(source, /useEffect/);
    assert.doesNotMatch(source, /fetch\s*\(/);
    assert.doesNotMatch(source, /\.storage\b/);
    assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/);
  }
});

test('Round 4 semantic layer exposes canonical entities and PatientWorkspaceContext without DOM coupling', () => {
  for (const entity of ['PATIENT','CLINICAL_PLAN','CLINICAL_PATHWAY','TREATMENT','ANATOMICAL_SITE','QUOTE','PAYMENT','PAYMENT_PLAN','INSTALLMENT','APPOINTMENT','RECALL','FOLLOWUP','CLINICAL_ALERT','PRESCRIPTION','CONSENT','DOCUMENT','TIMELINE_EVENT','AUTOMATION_RULE']) assert.ok(domain.includes(`'${entity}'`));
  for (const field of ['activeClinicalPlan','clinicalPlans','treatments','anatomicalContext','alerts','quotes','payments','paymentPlans','installments','appointments','recalls','followups','prescriptions','consents','automationRules','timeline']) assert.ok(domain.includes(`${field}:`));
  assert.match(domain, /suggestionsAreFacts: false/);
  assert.doesNotMatch(domain, /document\.|querySelector|innerText/);
});

test('Round 4 registry includes automation and financial actions', () => {
  for (const action of ['CREATE_RECALL','CREATE_FOLLOWUP','SUGGEST_TREATMENT','CREATE_TASK','SUGGEST_APPOINTMENT','CHECK_MISSING_STEP','NOTIFY_CLINICIAN','REGISTER_PAYMENT','CREATE_PAYMENT_PLAN','UPDATE_PAYMENT_PLAN']) assert.match(registry, new RegExp(`${action}:`));
  assert.match(domain, /TRIGGER.*CONDITION.*ACTION/);
});

test('payment plan prototype is fully configurable without persistence', () => {
  for (const token of ['paymentPlanDraft', 'updatePaymentPlan', 'updateInstallment', 'installmentRows', 'paymentPlanReady', 'Conferma configurazione', 'Modifica ancora']) assert.ok(component.includes(token), `missing payment-plan behavior ${token}`);
  assert.match(component, /Scadenza rata/);
  assert.match(component, /Importo rata/);
  assert.match(component, /nessuna persistenza/i);
  assert.match(css, /pw2-installment-editor/);
});

test('Round 4 final UX contains centered modals, operational plan, economy, installments and timeline', () => {
  assert.doesNotMatch(component, /<span>\+<\/span>/);
  for (const text of ['Piano clinico attivo','/5 completate','aggiornamento immediato','Segna eseguita','Piano clinico completato','Nessun piano clinico attivo','Da attenzionare','Automazioni','Situazione economica','Preventivato','Accettato','Registra pagamento','Piano pagamenti','Nuova rateizzazione','INSTALLMENT','Timeline','Piani clinici | Preventivi','Preventivo #2026-014']) assert.ok(component.includes(text), `missing ${text}`);
  assert.match(component, /pw2-plan-columns/);
  assert.match(component, /pw2-plan-table/);
  assert.match(component, /pw2-mini-odontogram/);
  assert.match(component, /Elemento selezionato/);
  assert.match(component, /DiscountEditor/);
  assert.match(css, /align-items:center;justify-content:center/);
  assert.match(css, /box-shadow:0 7px 16px/);
  assert.match(css, /grid-template-columns:1fr/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});

test('Round 3 exposes five compact quick actions and canonical shared action registry', () => {
  for (const label of ['Prestazione', 'Piano clinico', 'Preventivo', 'Ricetta', 'Consenso']) assert.ok(component.includes(label));
  for (const action of ['CREATE_CLINICAL_PLAN', 'ADD_TREATMENT', 'UPDATE_TREATMENT_STATUS', 'CREATE_QUOTE', 'SEND_QUOTE', 'PRINT_QUOTE', 'CREATE_PRESCRIPTION', 'CREATE_CONSENT', 'SEND_CLINICAL_SUMMARY']) {
    assert.match(registry, new RegExp(`${action}: \\{ id: '${action}'`));
  }
  assert.match(component, /PATIENT_WORKSPACE_ACTIONS/);
});

test('Round 3 prototypes the plan to quote workflow, sharing and Polyedron confirmation', () => {
  for (const text of ['Piano clinico pronto', 'Genera preventivo →', 'Preventivo pronto', 'Anteprima messaggio', 'Invia WhatsApp', 'Prova con Polyedron', 'Nessuna azione è stata eseguita.', 'Conferma', 'Modifica', 'Annulla']) assert.ok(component.includes(text), `missing ${text}`);
  assert.match(component, /selectedQuoteItems/);
  assert.match(component, /setQuoteReady\(true\)/);
  assert.match(component, /shareMessage/);
});

test('workspace keeps the required identity, KPI and navigation surfaces', () => {
  for (const label of ['Piani', 'Eseguito', 'Pagato', 'Da pagare', 'Info', 'Timeline', 'Foto', 'Documenti', 'Agenda']) {
    assert.ok(component.includes(label), `missing ${label}`);
  }
  assert.match(component, /filter\(Boolean\)/);
  assert.match(component, /Array\.isArray/);
  assert.doesNotMatch(component, /<img\b/);
});

test('Round 2 keeps creation actions distinct and prototype-only', () => {
  for (const label of ["service: 'Prestazione'", 'Nuovo piano clinico', 'Nuovo preventivo']) {
    assert.ok(component.includes(label), `missing ${label}`);
  }
  for (const kind of ['service', 'plan', 'quote']) assert.match(component, new RegExp(`setQuickCreate\\('${kind}'\\)`));
  for (const site of ['Dente', 'Quadrante', 'Arcata', 'Generale', 'Nessuna']) assert.ok(component.includes(site));
  for (const status of ['Proposta', 'Pianificata', 'In corso', 'Eseguita']) assert.ok(component.includes(status));
  assert.match(component, /Prototype · nessun salvataggio/);
  assert.match(component, /Preventivo dal piano clinico/);
  assert.match(component, /Piano clinico/);
});

test('active clinical plan is treatment-driven and odontogram remains an entry point', () => {
  assert.match(component, /clinicalRows = model\.items\.map/);
  assert.match(component, /Piano clinico attivo/);
  assert.match(component, /Odontogramma/);
  assert.match(component, /Modulo clinico in preparazione/);
  assert.doesNotMatch(component, /tone-indigo|tone-amber|tone-teal|tone-violet|tone-blue/);
  assert.match(demo, /Corona zirconia/);
  assert.match(demo, /stato: 'in_corso'/);
});

test('responsive CSS covers compact mobile, mobile and tablet without horizontal page overflow', () => {
  assert.match(css, /overflow-x:hidden/);
  assert.match(css, /max-width:375px/);
  assert.match(css, /max-width:520px/);
  assert.match(css, /max-width:820px/);
  assert.match(css, /grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
  assert.match(css, /button:nth-last-child\(-n\+2\)\{grid-column:span 3\}/);
  assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(css, /button:before\{[^}]*content:/);
  assert.match(css, /pw2-shell \*\{min-width:0\}/);
});

test('Round 5 keeps anatomical sites readable and treatment actions state-aware', () => {
  for (const site of ['Generale', 'Arcata superiore', 'Quadrante 3', 'Dente 36', "site: '26'"]) assert.ok(component.includes(site), `missing anatomical case ${site}`);
  assert.match(css, /minmax\(112px,142px\)/);
  assert.match(css, /overflow-wrap:anywhere/);
  assert.match(component, /aria-haspopup="menu"/);
  assert.match(component, /role="menu"/);
  for (const action of ['Segna in corso', 'Crea richiamo', 'Crea follow-up', 'Apri dettaglio', 'Modifica nota', 'Annulla']) assert.ok(component.includes(action), `missing contextual action ${action}`);
  for (const tone of ['is-done', 'is-todo', 'is-progress', 'is-recall']) assert.ok(css.includes(tone), `missing status tone ${tone}`);
  assert.match(component, /data-entity=\{isRecall \? 'RECALL' : 'TREATMENT'\}/);
  assert.match(component, /const primaryActions = \(status\)/);
  assert.match(component, /status === 'Eseguita'[\s\S]*?\['Crea follow-up', 'Crea richiamo'\]/);
  assert.match(component, /status === 'In corso'[\s\S]*?\['Segna eseguita', 'Programma'\]/);
  assert.match(component, /status === 'Richiamo da programmare'[\s\S]*?\['Programma', 'Modifica'\]/);
  assert.match(component, /primaryActions\(item\.status\)\.map/);
  assert.match(component, /setLocallyCompleted/);
  assert.match(component, /label === 'Segna eseguita'/);
  assert.match(component, /✓ Segna eseguita/);
  assert.match(component, /pw2-status-action is-\$\{tone\}/);
  assert.match(component, /data-status=\{tone\}/);
  assert.match(css, /Mobile is a dedicated clinical surface/);
  assert.match(css, /grid-template-columns:minmax\(0,1fr\) 46px/);
  assert.match(css, /@media\(max-width:820px\)/);
  assert.match(css, /@media\(max-width:520px\)/);
});

test('domain audit names verified database objects and maps every required frontend flow', () => {
  assert.match(audit, /src\/lib\/canonicalFinancialSelectors\.js/);
  assert.doesNotMatch(audit, /src\/lib\/financialSnapshot\.js/);
  for (const object of ['financial_current_studio_v1', 'validate_financial_allocation_v1', 'get_financial_snapshot_v1', 'patient_care_assignments_guard_v1', 'poliedron_messages_guard_v1']) assert.ok(audit.includes(object), `missing database object ${object}`);
  for (const flow of ['Create clinical plan', 'Add treatment', 'Create\/send quote', 'Register payment', 'Payment plan \/ installment', 'Agenda appointment', 'Recall', 'Follow-up', 'Timeline \/ history', 'Patient record', 'Odontogram', 'Medical\/fiscal documents', 'Prescription', 'Consent', 'Polyedron']) assert.match(audit, new RegExp(flow));
  assert.match(audit, /NOT_VERIFIED_REMOTE/);
});
