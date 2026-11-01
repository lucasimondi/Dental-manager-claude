import test from 'node:test';
import assert from 'node:assert/strict';
import { patientQuoteProjection } from '../src/lib/patientQuoteProjection.js';
import { persistPatientEntry } from '../src/lib/appointmentEntry.js';
const plan={id:20,pazienteId:7,titolo:'Cure',stato:'attivo',sconto:20,scontoTipo:'eur',voci:[{prestazione:'Controllo',dente:'36',prezzo:60},{prestazione:'Otturazione estetica',dente:'31',prezzo:100},{prestazione:'Otturazione estetica',dente:'41',prezzo:110}]};
const draft={items:[{description:'otturazione   ESTETICA',tooth:'31',price:'150'}],quoteItems:[]};
test('complete quote preserves every saved row, original price and discount without mutating the plan',()=>{
 const before=structuredClone(plan),full=patientQuoteProjection(plan,draft,'all');
 assert.deepEqual(full,plan);assert.notEqual(full.voci,plan.voci);assert.notEqual(full.voci[0],plan.voci[0]);assert.deepEqual(plan,before);
});
test('entered quote selects correct tooth and confirmed price; global plan discount is explicitly excluded',()=>{
 const partial=patientQuoteProjection(plan,draft,'entered');
 assert.deepEqual(partial.voci,[plan.voci[1]]);assert.equal(partial.voci[0].prezzo,100);assert.equal(partial.sconto,0);assert.equal(plan.sconto,20);assert.equal(plan.voci.length,3);
 assert.throws(()=>patientQuoteProjection(plan,{...draft,items:[{description:'Non presente',price:'100'}]},'entered'),/Nessuna/);
 assert.throws(()=>patientQuoteProjection(plan,draft,'unknown'),/Seleziona/);
});
test('implant preset remains a three-line intervention in the partial quote',()=>{
 const implant={...plan,voci:[plan.voci[0],{prestazione:'Impianto osteointegrato',prezzo:500,dente:'16'},{prestazione:'Moncone',prezzo:150,dente:'16'},{prestazione:'Corona composito ceramica',prezzo:1150,dente:'16'}]};
 const partial=patientQuoteProjection(implant,{items:[{description:'impianto',tooth:'16',price:'1800'}],quoteItems:[],implantPreset:true},'entered');
 assert.equal(partial.voci.length,3);assert.equal(partial.voci[0].prestazione,'Impianto osteointegrato');assert.equal(implant.voci.length,4);
});
test('confirmed existing plan is returned even when duplicate input causes no writes',async()=>{
 const actual={...plan,voci:plan.voci.map(v=>({...v}))};let writes=0;
 const db={getById:async()=>({id:7}),getAll:async()=>[actual],insert:async()=>{writes++},update:async()=>{writes++}};
 const result=await persistPatientEntry({db,patient:{id:7},draft:{...draft,planId:'20',amount:''}});
 assert.equal(result.skipped,1);assert.equal(writes,0);assert.equal(result.savedPlans[0],actual);
 assert.equal(patientQuoteProjection(result.savedPlans[0],draft,'entered').voci[0].prezzo,100);
});
