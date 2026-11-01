import test from 'node:test';
import assert from 'node:assert/strict';
import { patientDentalOverview, dentalTeeth, dentalEntryTooth } from '../src/lib/patientDentalOverview.js';
const plans = [
 {id:1,pazienteId:7,stato:'concluso',titolo:'Storico',voci:[{prestazione:'Otturazione',dente:'36',eseguita:true,dataEsec:'2026-10-01'}]},
 {id:2,pazienteId:'7',stato:'attivo',voci:[{prestazione:'Corona',dente:'36',eseguita:false},{prestazione:'Splint',dente:'31, 41',eseguita:true,dataEsec:'2026-10-20'},{prestazione:'Igiene',eseguita:true},{prestazione:'Annullata',dente:'16',stato:'annullata'}]},
 {id:3,pazienteId:8,voci:[{prestazione:'Altro paziente',dente:'11',eseguita:true}]},
 {id:4,pazienteId:7,stato:'rifiutato',voci:[{prestazione:'Proposta rifiutata',dente:'26'},{prestazione:'Cura storica',dente:'26',eseguita:true}]},
];
test('dental home shows authoritative executed cures including closed plans, with patient isolation and mixed tooth state',()=>{
 const before=structuredClone(plans),model=patientDentalOverview(plans,7);
 assert.equal(model.done.length,4); assert.equal(model.pending.length,1);
 assert.deepEqual(model.teeth[36],{done:1,pending:1});
 assert.deepEqual(model.teeth[31],{done:1,pending:0});assert.deepEqual(model.teeth[41],{done:1,pending:0});
 assert.deepEqual(model.teeth[11],{done:0,pending:0});assert.deepEqual(model.teeth[16],{done:0,pending:0});
 assert.deepEqual(model.teeth[26],{done:1,pending:0});
 assert.equal(model.done[0].name,'Splint');assert.ok(model.done.some(r=>r.site==='Generale'));
 assert.deepEqual(plans,before);
});
test('dental home tolerates malformed history and does not infer executions from plan lifecycle',()=>{
 const model=patientDentalOverview([{id:5,pazienteId:7,stato:'concluso',voci:[null,{prestazione:'Non marcata',dente:'16'}]},null,{id:6,pazienteId:7,voci:null}],7);
 assert.equal(model.done.length,0);assert.equal(model.pending.length,1);
 assert.equal(patientDentalOverview(plans,null).done.length,0);
 assert.equal(patientDentalOverview(undefined,7).pending.length,0);
});
test('tooth context accepts only permanent FDI seeds and keeps explicit multi-tooth history without inferred ranges',()=>{
 assert.deepEqual(dentalTeeth('31, 41 / 31'),[31,41]);assert.deepEqual(dentalTeeth('33–43'),[33,43]);
 assert.deepEqual(dentalTeeth('Generale 99 116'),[]);
 assert.equal(dentalEntryTooth(36),'36');assert.equal(dentalEntryTooth('41'),'41');
 for(const value of ['',null,19,49,51,99,{},'31, 41'])assert.equal(dentalEntryTooth(value),'');
});
