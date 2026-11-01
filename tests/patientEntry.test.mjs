import test from 'node:test';
import assert from 'node:assert/strict';
import { persistPatientEntry, persistAppointmentEntry } from '../src/lib/appointmentEntry.js';
const patient = { id: 7 };
const row = { description: 'Otturazione', price: '100', tooth: '31' };
const draft = { items: [row], quoteItems: [], planId: 'new', amount: '' };
function adapter(plans = [], actualPatient = patient) {
  const calls = [];
  return { calls, getById: async (table, id) => { calls.push(['read',table,id]); return table === 'dm_p' ? actualPatient : plans.find(p => p.id === id); }, getAll: async () => plans,
    insert: async (table,payload) => { calls.push(['insert',table,payload]); return { ...payload,id:501 }; },
    update: async (table,id,payload) => { calls.push(['update',table,id,payload]); plans.splice(plans.findIndex(p => p.id === id),1,{...payload,id}); } };
}
test('patient entry creates a plan without an appointment and returns only confirmed rows', async () => {
  const db = adapter(), applied = [];
  const result = await persistPatientEntry({ db,patient,draft,onApplied:(kind,row)=>applied.push([kind,row]) });
  assert.equal(result.treatmentId,501); assert.equal(applied.length,1);
  assert.equal(db.calls.some(c => c[1] === 'dm_a'),false);
  assert.equal(applied[0][1].pazienteId,7);assert.equal(applied[0][1].voci[0].eseguita,false);assert.equal(applied[0][1].voci[0].incassata,false);
});
test('patient quote creates only a quote; every submitted row is validated before writes', async () => {
  const db = adapter();
  const result = await persistPatientEntry({ db,patient,draft:{...draft,items:[],quoteItems:[row],quoteTitle:'Cure proposte'} });
  assert.equal(result.quoteId,501);assert.equal(result.treatmentId,undefined);
  assert.equal(db.calls.filter(c=>c[0]==='insert').length,1);
  assert.equal(db.calls.find(c=>c[0]==='insert')[2].titolo,'Cure proposte');
  const invalid = adapter();
  await assert.rejects(()=>persistPatientEntry({db:invalid,patient,draft:{...draft,quoteItems:[{description:'Incompleta',price:''}]}}),e=>!e.writesStarted);
  assert.equal(invalid.calls.some(c=>c[0]==='insert'),false);
});
test('several eligible plans require a choice and foreign patient plans cannot be selected', async () => {
  const plans = [1,2].map(id=>({id,pazienteId:7,stato:'attivo',voci:[]}));
  plans.push({id:3,pazienteId:8,stato:'attivo',voci:[]});
  for (const planId of ['', '3']) {
    const db = adapter(plans);
    await assert.rejects(()=>persistPatientEntry({db,patient,draft:{...draft,planId}}),e=>!e.writesStarted);
    assert.equal(db.calls.some(c=>['insert','update'].includes(c[0])),false);
  }
  const db = adapter(plans);
  const result = await persistPatientEntry({db,patient,draft:{...draft,planId:'2'}});
  assert.equal(result.treatmentId,2);assert.equal(plans.find(p=>p.id===1).voci.length,0);assert.equal(plans.find(p=>p.id===2).voci.length,1);
});
test('patient identity must be reverified and the appointment path never accepts missing identity', async () => {
  const db = adapter([], {id:8});
  await assert.rejects(()=>persistPatientEntry({db,patient,draft}),e=>!e.writesStarted);
  assert.equal(db.calls.some(c=>c[0]==='insert'),false);
  await assert.rejects(()=>persistAppointmentEntry({db:adapter(),patient,draft}),/Appuntamento non valido/);
});
test('unconfirmed writes stop and are marked uncertain, without automatic replay', async () => {
  const db = adapter();let writes = 0;
  db.insert = async ()=>{writes++;throw Error('Network');};
  await assert.rejects(()=>persistPatientEntry({db,patient,draft}),e=>e.writesStarted&&e.completed===0);
  assert.equal(writes,1);
});
