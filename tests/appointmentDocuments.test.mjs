import test from 'node:test';
import assert from 'node:assert/strict';
import { appointmentDocumentItems, loadAppointmentDocuments } from '../src/lib/appointmentDocuments.js';

test('appointment documents query only metadata for selected patient and propagate archive failures',async()=>{
 const calls=[];
 const client={from(table){calls.push(table);return {select(fields){assert.ok(!fields.includes('pdf_base64'));return this},eq(key,value){calls.push([key,value]);return this},order(){return Promise.resolve({data:[{id:8,paziente_id:7,tipo:'ricetta',titolo:'Ricetta',data:'2026-10-21'},{id:9,paziente_id:99}],error:null})}}}};
 const rows=await loadAppointmentDocuments(client,7);
 assert.equal(rows.length,1);assert.equal(rows[0].category,'prescriptions');
 assert.deepEqual(calls,['documenti_medici',['paziente_id',7]]);
 assert.deepEqual(await loadAppointmentDocuments(null,null),[]);
 const failing={from:()=>({select(){return this},eq(){return this},order:async()=>({error:new Error('denied')})})};
 await assert.rejects(loadAppointmentDocuments(failing,7),/denied/);
});

test('retrieval includes saved plans and prescriptions after reopening without appointment linkage or other patients',()=>{
 const plans=[{id:1,pazienteId:7,titolo:'Preventivo nuovo',data:'2026-10-21'},{id:2,pazienteId:99,titolo:'Privato',data:'2026-10-22'}];
 const docs=[{source:'documenti_medici',sourceId:3,patientId:7,title:'Ricetta precedente',date:'2026-10-20',category:'prescriptions'}, {sourceId:4,patientId:99,title:'Altro'}];
 const result=appointmentDocumentItems(plans,docs,7);
 assert.deepEqual(result.map(x=>x.title),['Preventivo nuovo','Ricetta precedente']);
 assert.equal(result[0].plan,plans[0]);assert.equal(result[1].document,docs[0]);
 assert.deepEqual(appointmentDocumentItems(plans,docs,null),[]);
});
