import test from 'node:test';
import assert from 'node:assert/strict';
import { dentalSites, expandDentalRows } from '../src/lib/domain/dentalSites.js';
import { prepareAppointmentEntry, persistAppointmentEntry } from '../src/lib/appointmentEntry.js';
const patient={id:7},appointment={id:3,pazienteId:7};
const draft={perTooth:true,implantPreset:true,items:[{description:'Otturazione',price:'85',tooth:'16, 26'}],quoteItems:[],planId:'new',planTitle:'Visita',amount:'',paymentPlanId:'context'};

test('multiple selected teeth create unique independent rows; empty and free-text sites retain existing meaning',()=>{
 assert.deepEqual(dentalSites('16, 26,16'),['16','26']);assert.deepEqual(dentalSites(''),['']);assert.deepEqual(dentalSites(', ;'),[', ;']);assert.deepEqual(dentalSites('arcata superiore'),['arcata superiore']);assert.deepEqual(dentalSites('51; 65'),['51','65']);
 const source=draft.items[0],rows=expandDentalRows([source]);assert.deepEqual(rows.map(r=>r.tooth),['16','26']);rows[0].price=90;assert.equal(rows[1].price,'85');assert.equal(source.tooth,'16, 26');
});

test('two teeth save two unit-price procedures; unchecking a tooth removes the extra derived line',()=>{
 const result=prepareAppointmentEntry({patient,appointment,plans:[],draft});assert.deepEqual(result.treatment.plan.voci.map(v=>[v.dente,v.prezzo,v.eseguita,v.incassata]),[['16',85,false,false],['26',85,false,false]]);
 const single=prepareAppointmentEntry({patient,appointment,plans:[],draft:{...draft,items:[{...draft.items[0],tooth:'16'}]}});assert.equal(single.treatment.plan.voci.length,1);
 const old=prepareAppointmentEntry({patient,appointment,plans:[],draft:{...draft,perTooth:false}});assert.equal(old.treatment.plan.voci[0].dente,'16, 26');
});

test('two implant teeth create six quote lines, no generic treatment and one deposit target',()=>{
 const result=prepareAppointmentEntry({patient,appointment,plans:[],draft:{...draft,items:[{description:'impianto',price:'1800',tooth:'16, 26'}],amount:'100'}});
 assert.equal(result.treatment,null);assert.equal(result.quote.voci.length,6);assert.deepEqual(result.quote.voci.map(v=>[v.dente,v.prezzo]),[['16',500],['16',150],['16',1150],['26',500],['26',150],['26',1150]]);assert.equal(result.payment.target,'quote');
});

test('confirmed procedures survive a fresh read and are reported with saved plan IDs',async()=>{
 const stored=new Map(),db={getById:async key=>key==='dm_p'?patient:appointment,getAll:async()=>structuredClone([...stored.values()]),insert:async(key,row)=>{const saved={...structuredClone(row),id:501};stored.set(saved.id,saved);return structuredClone(saved)}};
 const applied=[];const saved=await persistAppointmentEntry({db,patient,appointment,draft,onApplied:(kind,row)=>applied.push([kind,row])});assert.deepEqual(saved.savedPlanIds,[501]);assert.equal(applied[0][1].voci.length,2);
 const fresh=await db.getAll('dm_pl');assert.equal(fresh[0].pazienteId,7);assert.deepEqual(fresh[0].voci.map(v=>v.dente),['16','26']);assert.deepEqual(fresh[0].voci.map(v=>v.prezzo),[85,85]);
});
