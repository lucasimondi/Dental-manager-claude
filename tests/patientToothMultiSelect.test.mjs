import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dentalEntryTeeth, toggleDentalGroup, DENTAL_SELECTION_GROUPS } from '../src/lib/patientDentalOverview.js';
import { toothList, expandRowsPerTooth, isMultiToothRow, rowsByTooth } from '../src/lib/patientToothEntry.js';
import { preparePatientEntry } from '../src/lib/appointmentEntry.js';

test('chart multi-selection seed keeps only permanent FDI teeth, sorted and unique',()=>{
 assert.equal(dentalEntryTeeth([26,16,16,36]),'16, 26, 36');
 assert.equal(dentalEntryTeeth('31, 41'),'31, 41');
 assert.equal(dentalEntryTeeth(36),'36');
 for(const v of ['',null,undefined,{},[19,49,99],'abc'])assert.equal(dentalEntryTeeth(v),'');
 assert.equal(dentalEntryTeeth({tooth:'11'}),'');
});
test('quick groups add a whole quadrant/arch and remove it when already complete',()=>{
 const q1=DENTAL_SELECTION_GROUPS.find(g=>g.label==='Q1').teeth;
 const added=toggleDentalGroup([36],q1);
 assert.equal(added.length,9);assert.ok(added.includes(36));
 assert.deepEqual(toggleDentalGroup(added,q1),[36]);
 assert.equal(toggleDentalGroup([],DENTAL_SELECTION_GROUPS.find(g=>g.label==='Tutti').teeth).length,32);
});
test('only explicit FDI lists are expanded per tooth; ranges and free text stay intact',()=>{
 assert.deepEqual(toothList('16, 26 · 36'),[16,26,36]);
 for(const v of ['33-43','33–43','arcata sup','55, 65','','16, x'])assert.equal(toothList(v),null);
 const rows=[{description:'Otturazione',price:'80',tooth:'16, 26'},{description:'Ponte',price:'900',tooth:'33-43'},{description:'Igiene',price:'85',tooth:''}];
 const before=structuredClone(rows),out=expandRowsPerTooth(rows);
 assert.deepEqual(out.map(r=>[r.description,r.tooth,r.price]),[['Otturazione','16','80'],['Otturazione','26','80'],['Ponte','33-43','900'],['Igiene','','85']]);
 assert.deepEqual(rows,before);
 assert.equal(isMultiToothRow(rows[0]),true);assert.equal(isMultiToothRow(rows[1]),false);
});
test('several procedures on several teeth produce one canonical item per tooth and procedure',()=>{
 const rows=expandRowsPerTooth([{description:'Otturazione',price:'80',tooth:'16, 26'},{description:'Devitalizzazione',price:'250',tooth:'16, 26'}]);
 const prepared=preparePatientEntry({patient:{id:7,nome:'Test'},plans:[],draft:{items:rows,quoteItems:[],planId:'new',planTitle:'Piano',amount:''}});
 const voci=prepared.treatment.plan.voci.map(v=>[v.prestazione,v.dente,v.prezzo]);
 assert.deepEqual(voci,[['Otturazione','16',80],['Otturazione','26',80],['Devitalizzazione','16',250],['Devitalizzazione','26',250]]);
 assert.equal(prepared.treatment.skipped,0);
 assert.deepEqual(rowsByTooth(rows).map(g=>[g.site,g.items.map(i=>i.description)]),[['16',['Otturazione','Devitalizzazione']],['26',['Otturazione','Devitalizzazione']]]);
});
test('patient chart selects teeth instead of opening the editor and passes the selection explicitly',()=>{
 const src=readFileSync(new URL('../src/components/PatientDentalOverview.jsx',import.meta.url),'utf8');
 assert.match(src,/onClick=\{\(\)=>toggle\(d\)\}/);
 assert.match(src,/tooth:dentalEntryTeeth\(selected\)/);
 assert.match(src,/aria-pressed=\{on\}/);
 const boundary=readFileSync(new URL('../src/components/PatientWorkspaceBoundary.jsx',import.meta.url),'utf8');
 assert.match(boundary,/dentalEntryTeeth\(options\?\.tooth\)/);
 const entry=readFileSync(new URL('../src/components/PatientPlanEntry.jsx',import.meta.url),'utf8');
 assert.match(entry,/items: quote \? \[\] : savedRows, quoteItems: quote \? savedRows : \[\]/);
});
test('upper arch glyphs are mirrored so roots point up, lower arch unchanged',()=>{
 const src=readFileSync(new URL('../src/components/PatientDentalOverview.jsx',import.meta.url),'utf8');
 assert.match(src,/upper = Math\.floor\(tooth \/ 10\) <= 2/);
 assert.match(src,/transform=\{upper \? 'matrix\(1 0 0 -1 0 28\)' : undefined\}/);
});
