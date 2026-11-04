import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { preparePatientEntry, completeTreatmentVoce } from '../src/lib/appointmentEntry.js';
import { markRowsDone, applyVoceChanges, undoVoceChanges } from '../src/lib/patientToothEntry.js';
import { today } from '../src/lib/utils.js';
const patient={id:7,nome:'Test'};
const base={items:[],quoteItems:[],planId:'20',planTitle:'P',amount:''};
const plan=voci=>({id:20,pazienteId:7,stato:'attivo',titolo:'Piano',voci});

test('eseguite oggi: new items are saved executed today; quotes are never executed',()=>{
 const r=preparePatientEntry({patient,plans:[plan([])],draft:{...base,markDone:true,items:[{description:'Otturazione',price:'80',tooth:'16'}],quoteItems:[{description:'Corona',price:'500',tooth:'26'}]}});
 assert.deepEqual(r.treatment.plan.voci.map(v=>[v.prestazione,v.eseguita,v.dataEsec]),[['Otturazione',true,today()]]);
 assert.equal(r.quote.voci[0].eseguita,false);
});
test('eseguite oggi completes an identical pending item in place instead of duplicating it',()=>{
 const existing=plan([{prestazione:'Otturazione',dente:'16',prezzo:90,eseguita:false,incassata:true}]);
 const r=preparePatientEntry({patient,plans:[existing],draft:{...base,markDone:true,items:[{description:'otturazione',price:'80',tooth:'16'}]}});
 assert.equal(r.treatment.plan.voci.length,1);assert.equal(r.treatment.completedExisting,1);assert.equal(r.treatment.skipped,0);
 assert.deepEqual([r.treatment.plan.voci[0].eseguita,r.treatment.plan.voci[0].prezzo,r.treatment.plan.voci[0].incassata],[true,90,true]);
 assert.equal(existing.voci[0].eseguita,false);
 const off=preparePatientEntry({patient,plans:[existing],draft:{...base,items:[{description:'Otturazione',price:'80',tooth:'16'}]}});
 assert.equal(off.treatment.kind,'existing');assert.equal(off.treatment.skipped,1);
});
test('re-treatment: same procedure on a tooth executed on an earlier date is recorded again; today or undated stays a duplicate',()=>{
 const items=[{description:'Otturazione',price:'80',tooth:'16'}];
 const past=preparePatientEntry({patient,plans:[plan([{prestazione:'Otturazione',dente:'16',prezzo:90,eseguita:true,dataEsec:'2020-01-10'}])],draft:{...base,items}});
 assert.equal(past.treatment.plan.voci.length,2);assert.equal(past.treatment.skipped,0);
 for(const dataEsec of [today(),undefined,'']){const r=preparePatientEntry({patient,plans:[plan([{prestazione:'Otturazione',dente:'16',prezzo:90,eseguita:true,dataEsec}])],draft:{...base,items}});assert.equal(r.treatment.skipped,1);assert.equal(r.treatment.plan.voci.length,1);}
});
test('completing suggests the usual recall only when missing and is idempotent',()=>{
 const done=completeTreatmentVoce({prestazione:'Igiene professionale',eseguita:false},'2026-11-04');
 assert.equal(done.eseguita,true);assert.equal(done.dataEsec,'2026-11-04');assert.ok(done.richiamoData > '2026-11-04');
 const kept=completeTreatmentVoce({prestazione:'Igiene professionale',richiamoData:'2027-01-01'},'2026-11-04');assert.equal(kept.richiamoData,'2027-01-01');
 const already={prestazione:'X',eseguita:true,dataEsec:'2026-01-01'};assert.equal(completeTreatmentVoce(already),already);
});
test('chart one-tap done changes only the matching current item and undo restores it exactly',()=>{
 const plans=[plan([{prestazione:'Corona',dente:'36',prezzo:500,eseguita:false},{prestazione:'Otturazione',dente:'46',prezzo:100,eseguita:false}])];
 const changes=markRowsDone(plans,[{planId:20,itemIndex:1,prestazione:'Otturazione',dente:'46'},{planId:20,itemIndex:0,prestazione:'Altro',dente:'36'}],'2026-11-04');
 assert.equal(changes.length,1);
 const after=applyVoceChanges(plans,changes);
 assert.deepEqual(after[0].voci.map(v=>v.eseguita),[false,true]);assert.equal(plans[0].voci[1].eseguita,false);
 assert.deepEqual(undoVoceChanges(after,changes),plans);
 const edited=[{...after[0],voci:[after[0].voci[0],{...after[0].voci[1],prezzo:120}]}];
 assert.deepEqual(undoVoceChanges(edited,changes),edited);
});
test('chart and both entry forms expose the done controls through the shared component',()=>{
 const read=f=>readFileSync(new URL(`../src/components/${f}`,import.meta.url),'utf8');
 assert.match(read('PatientDentalOverview.jsx'),/✓ Eseguita/);
 assert.match(read('PatientPlanEntry.jsx'),/markDone: !quote && markDone/);
 assert.match(read('AppointmentWorkspace.jsx'),/<ToothEntryOptions rows=\{draft\.items\}/);
 assert.match(read('AppointmentWorkspace.jsx'),/items:savedEntryRows\(draft\.items,draft\.perTooth\)/);
 assert.match(read('SchedaPaz.jsx'),/onMarkDone=/);
});
