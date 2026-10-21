import test from 'node:test';
import assert from 'node:assert/strict';
import { APPOINTMENT_PATIENT_ACTIONS, appointmentPatientAction } from '../src/lib/appointmentQuickHub.js';
const patient={id:7,nome:'Test'}, appointment={id:22,pazienteId:7,data:'2026-10-23',ora:'09:00'};
test('appointment actions target the existing patient forms',()=>{
  assert.deepEqual(APPOINTMENT_PATIENT_ACTIONS.map(a=>a.id),['treatment','prescription','documents','payment']);
  assert.deepEqual(appointmentPatientAction(patient,appointment,'treatment'),{tab:'piani',initialAction:'treatment',documentType:null});
  assert.deepEqual(appointmentPatientAction(patient,appointment,'prescription'),{tab:'doc',initialAction:'prescription',documentType:'ricetta'});
  assert.deepEqual(appointmentPatientAction(patient,appointment,'documents'),{tab:'doc',initialAction:'documents',documentType:'medico'});
  assert.deepEqual(appointmentPatientAction(patient,appointment,'payment'),{tab:'paga',initialAction:'payment',documentType:null});
});
test('mismatched patient, missing records and unknown actions fail closed',()=>{
  for(const [p,a,k] of [[null,appointment,'payment'],[patient,null,'prescription'],[patient,{...appointment,pazienteId:8},'treatment'],[patient,appointment,'unknown']]) assert.equal(appointmentPatientAction(p,a,k),null);
  assert.ok(appointmentPatientAction(patient,{...appointment,pazienteId:'7'},'documents'));
});
