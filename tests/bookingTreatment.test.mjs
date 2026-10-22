import test from 'node:test';
import assert from 'node:assert/strict';
import {persistBookingTreatment} from '../src/lib/appointmentEntry.js';
import {uniqueAppointmentTypes} from '../src/lib/appointmentTypes.js';
const row={description:'Igiene',price:'85',tooth:''},patient={id:7};
function fixture(plans=[]){const calls=[];const db={getById:async(k,id)=>k==='dm_p'?patient:plans.find(p=>String(p.id)===String(id)),getAll:async()=>plans,insert:async(k,p)=>{const saved={...p,id:30};plans.push(saved);calls.push('insert');return saved;},update:async(k,id,p)=>{Object.assign(plans.find(p=>p.id===id),p);calls.push('update');}};return {db,calls,plans};}
test('booking creates one canonical plan when none exists and repeated saves reuse its item',async()=>{
 const f=fixture();await persistBookingTreatment({...f,patientId:7,row});const r=await persistBookingTreatment({...f,patientId:7,row:{...row,price:'99'}});
 assert.deepEqual(f.calls,['insert']);assert.equal(f.plans.length,1);assert.equal(f.plans[0].voci[0].prezzo,85);assert.equal(f.plans[0].voci[0].eseguita,false);assert.equal(r.skipped,1);
});
test('booking appends to the only active patient plan and does not use another patient plan',async()=>{
 const f=fixture([{id:11,pazienteId:8,stato:'attivo',voci:[]},{id:12,pazienteId:7,stato:'attivo',voci:[]}]);await persistBookingTreatment({...f,patientId:7,row});assert.deepEqual(f.calls,['update']);assert.equal(f.plans[0].voci.length,0);assert.equal(f.plans[1].voci.length,1);
});
test('several plans require an explicit choice before any write',async()=>{
 const f=fixture([{id:11,pazienteId:7,stato:'attivo',voci:[]},{id:12,pazienteId:7,stato:'accettato',voci:[]}]);await assert.rejects(()=>persistBookingTreatment({...f,patientId:7,row}),/Scegli il piano/);assert.equal(f.calls.length,0);await persistBookingTreatment({...f,patientId:7,row,planId:'12'});assert.equal(f.plans[1].voci.length,1);
});
test('invalid price and unverified patient fail before writes',async()=>{
 const f=fixture();await assert.rejects(()=>persistBookingTreatment({...f,patientId:7,row:{...row,price:'-1'}}),e=>!e.writesStarted);await assert.rejects(()=>persistBookingTreatment({...f,patientId:8,row}),e=>!e.writesStarted);assert.equal(f.calls.length,0);
});
test('uncertain plan writes are surfaced without retry',async()=>{
 const f=fixture();f.db.insert=async()=>{f.calls.push('insert');throw Error('network')};await assert.rejects(()=>persistBookingTreatment({...f,patientId:7,row}),e=>e.writesStarted);assert.deepEqual(f.calls,['insert']);
});
test('repeated visit tag series collapse to one while retaining distinct types and configured colors',()=>{
 const types=[{id:1,nome:'Visita',colore:'#123'},{id:2,nome:'Igiene',colore:'#456'},{id:3,nome:' VISITA ',colore:'#999'},{id:4,nome:'Igiene',colore:'#456'},{id:5,nome:'Controllo',colore:'#123'}];assert.deepEqual(uniqueAppointmentTypes(types),[types[0],types[1],types[4]]);
});
