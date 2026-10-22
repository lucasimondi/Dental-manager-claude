import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareAppointmentEntry, persistAppointmentEntry } from '../src/lib/appointmentEntry.js';
const patient={id:7},appointment={id:3,pazienteId:7};
const draft={items:[{description:'Igiene',price:'85',tooth:''}],planId:'new',amount:'25',paymentPlanId:'context',quoteItems:[]};
const plan=id=>({id,pazienteId:7,stato:'attivo',voci:[]});
test('rapid entry validates every section before writing and never marks treatment executed/paid',()=>{
 const p=prepareAppointmentEntry({patient,appointment,plans:[],draft});assert.equal(p.treatment.plan.voci[0].eseguita,false);assert.equal(p.treatment.plan.voci[0].incassata,false);assert.equal(p.payment.target,'treatment');
 assert.throws(()=>prepareAppointmentEntry({patient,appointment,plans:[],draft:{...draft,quoteItems:[{description:'Voce incompleta',price:''}]}}),/prezzo/);
 assert.throws(()=>prepareAppointmentEntry({patient,appointment:{...appointment,pazienteId:8},plans:[],draft}),/corrispondono/);
});
test('generic incasso with several plans requires explicit choice; contextual entry follows chosen treatment plan',()=>{
 const plans=[plan(10),plan(11)];
 assert.throws(()=>prepareAppointmentEntry({patient,appointment,plans,draft:{...draft,items:[]}}),/piano per l’incasso/);
 const p=prepareAppointmentEntry({patient,appointment,plans,draft:{...draft,planId:'11'}});assert.equal(p.treatment.plan.id,11);assert.equal(p.payment.target,'treatment');
 assert.throws(()=>prepareAppointmentEntry({patient,appointment,plans,draft:{...draft,planId:'99'}}),/Scegli il piano/);
});
test('server-assigned plan ID is awaited before payment and all writes are confirmed',async()=>{
 const calls=[],applied=[];const db={getById:async k=>k==='dm_p'?patient:appointment,getAll:async()=>[],insert:async(k,row)=>{calls.push([k,row]);return {...row,id:k==='dm_pl'?501:900}}};
 const result=await persistAppointmentEntry({db,patient,appointment,draft,onApplied:(...r)=>applied.push(r)});
 assert.equal(calls[1][0],'dm_py');assert.equal(calls[1][1].pianoId,501);assert.equal(result.treatmentId,501);assert.equal(result.completed,2);assert.equal(applied.length,2);
});
test('bad quote prevents even valid treatment/payment writes',async()=>{
 let writes=0;const db={getById:async k=>k==='dm_p'?patient:appointment,getAll:async()=>[],insert:async()=>{writes++}};
 await assert.rejects(()=>persistAppointmentEntry({db,patient,appointment,draft:{...draft,quoteItems:[{description:'Incomplete',price:'-1'}]}}),e=>!e.writesStarted);assert.equal(writes,0);
});
test('failed payment retains confirmed treatment, reports partial result and never retries',async()=>{
 let writes=0;const applied=[];const db={getById:async k=>k==='dm_p'?patient:appointment,getAll:async()=>[],insert:async(k,row)=>{writes++;if(k==='dm_py')throw Error('network');return {...row,id:501}}};
 await assert.rejects(()=>persistAppointmentEntry({db,patient,appointment,draft,onApplied:(...r)=>applied.push(r)}),e=>e.writesStarted&&e.completed===1);assert.equal(writes,2);assert.equal(applied.length,1);
});
test('fresh identity and plan validation fail closed before writes',async()=>{
 let writes=0;const db={getById:async k=>k==='dm_p'?patient:{...appointment,pazienteId:8},getAll:async()=>[],insert:async()=>writes++};
 await assert.rejects(()=>persistAppointmentEntry({db,patient,appointment,draft}),e=>!e.writesStarted);assert.equal(writes,0);
});
test('fresh existing plan preserves concurrent items; verifies update before payment',async()=>{
 let current={...plan(20),voci:[{prestazione:'Esistente',prezzo:40}]};const calls=[];const db={getById:async k=>k==='dm_p'?patient:k==='dm_a'?appointment:current,getAll:async()=>[current],update:async(k,id,row)=>{current={...row,id};calls.push('update')},insert:async(k,row)=>{calls.push('payment');return {...row,id:900}}};
 await persistAppointmentEntry({db,patient,appointment,draft:{...draft,planId:'20'}});assert.deepEqual(calls,['update','payment']);assert.equal(current.voci.length,2);assert.equal(current.voci[0].prestazione,'Esistente');
});
test('JSONB key order does not turn a confirmed plan update into a false failure',async()=>{
 let current=plan(20);const db={getById:async k=>k==='dm_p'?patient:k==='dm_a'?appointment:current,getAll:async()=>[current],update:async(k,id,row)=>{current={...row,id,voci:row.voci.map(v=>Object.fromEntries(Object.entries(v).reverse()))}},insert:async(k,row)=>({...row,id:900})};
 const r=await persistAppointmentEntry({db,patient,appointment,draft:{...draft,planId:'20',amount:''}});assert.equal(r.completed,1);
});
test('an explicit quote deposit awaits the saved quote ID, without creating a treatment',async()=>{
 const calls=[];const db={getById:async k=>k==='dm_p'?patient:appointment,getAll:async()=>[],insert:async(k,row)=>{calls.push([k,row]);return {...row,id:k==='dm_pl'?600:901}}};
 await persistAppointmentEntry({db,patient,appointment,draft:{...draft,items:[],quoteItems:[{description:'Preventivo',price:'200'}],paymentPlanId:'quote'}});assert.equal(calls.length,2);assert.equal(calls[0][1].voci[0].eseguita,false);assert.equal(calls[1][1].pianoId,600);
});

test('an existing treatment is reused without rewriting price or creating a duplicate; payment keeps its plan',async()=>{
 const current={...plan(20),voci:[{prestazione:'IGIENE',prezzo:110,dente:'',eseguita:true}]};let writes=0;const payments=[];
 const db={getById:async k=>k==='dm_p'?patient:k==='dm_a'?appointment:current,getAll:async()=>[current],update:async()=>{writes++},insert:async(k,row)=>{payments.push(row);return {...row,id:901}}};
 const r=await persistAppointmentEntry({db,patient,appointment,draft:{...draft,planId:'20'}});
 assert.equal(writes,0);assert.equal(r.skipped,1);assert.equal(r.treatmentId,20);assert.equal(r.completed,1);assert.equal(payments[0].pianoId,20);assert.equal(current.voci[0].prezzo,110);
});
test('only absent procedure/tooth pairs are appended, including duplicate rows inside a single draft',()=>{
 const existing={...plan(20),voci:[{prestazione:'Igiene   completa',dente:'16',prezzo:90}]};
 const rows=[{description:'  IGIENE completa ',tooth:'16',price:'120'},{description:'Igiene completa',tooth:'26',price:'120'},{description:'Igiene completa',tooth:'26',price:'130'}];
 const r=prepareAppointmentEntry({patient,appointment,plans:[existing],draft:{...draft,items:rows,planId:'20',amount:''}});
 assert.equal(r.treatment.skipped,2);assert.equal(r.treatment.plan.voci.length,2);assert.equal(r.treatment.plan.voci[0].prezzo,90);assert.equal(r.treatment.plan.voci[1].dente,'26');assert.equal(existing.voci.length,1);
});
