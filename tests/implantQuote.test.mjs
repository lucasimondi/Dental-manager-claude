import test from 'node:test';
import assert from 'node:assert/strict';
import { implantQuoteRows, expandImplantQuotes, isImplantQuoteRequest } from '../src/lib/domain/implantQuote.js';
import { prepareAppointmentEntry, persistAppointmentEntry } from '../src/lib/appointmentEntry.js';
const patient={id:7},appointment={id:3,pazienteId:7};
const draft={implantPreset:true,items:[{description:'impianto',price:'1800.99',tooth:'16'}],quoteItems:[],quoteTitle:'Preventivo implantare',planId:'new',amount:'',paymentPlanId:'context'};

test('implant quote uses exact cents and prescribed names without mutating source',()=>{
 const row={description:' IMPIANTO ',price:'1800,99',tooth:'16'};
 assert.equal(isImplantQuoteRequest(row.description),true);
 assert.equal(isImplantQuoteRequest('impianto osteointegrato'),false);
 const result=implantQuoteRows(row);
 assert.deepEqual(result.map(x=>[x.description,x.price,x.tooth]),[['Impianto osteointegrato',500,'16'],['Moncone',150,'16'],['Corona composito ceramica',1150.99,'16']]);
 assert.equal(row.price,'1800,99');assert.equal(implantQuoteRows({...row,price:'650'})[2].price,0);
 for(const price of ['', '-1','649.99','1e3','NaN','Infinity','1000.001','999999999999999999999'])assert.throws(()=>implantQuoteRows({...row,price}));
});

test('implant request creates only one canonical quote; payment context follows quote and prices do not become executed/paid',()=>{
 const result=prepareAppointmentEntry({patient,appointment,plans:[],draft:{...draft,amount:'100'}});
 assert.equal(result.treatment,null);assert.equal(result.quote.titolo,'Preventivo implantare');assert.equal(result.quote.voci.length,3);assert.equal(result.payment.target,'quote');
 for(const row of result.quote.voci){assert.equal(row.eseguita,false);assert.equal(row.incassata,false);assert.equal(row.dente,'16');}
 assert.equal(result.quote.voci[2].prezzo,1150.99);
});

test('duplicate implant rows remain independent; quote composer appends manual rows and matches only the full keyword',()=>{
 const source=draft.items[0],copy={...source,tooth:'26',price:'1500'};
 const result=expandImplantQuotes([source,copy,{description:'Visita',price:'80'}],[{description:'impianto',price:'1000',tooth:'36'},{description:'Extra',price:'30'}]);
 assert.equal(result.items.length,1);assert.equal(result.quoteItems.length,10);assert.equal(result.quoteItems[5].price,850);assert.equal(result.quoteItems[5].tooth,'26');assert.equal(result.quoteItems[8].price,350);assert.equal(source.tooth,'16');
 const plain=prepareAppointmentEntry({patient,appointment,plans:[],draft:{...draft,implantPreset:false}});
 assert.equal(plain.quote,null);assert.equal(plain.treatment.plan.voci[0].prestazione,'impianto');
});

test('invalid implant total blocks every write; valid deposit awaits actual quote ID',async()=>{
 const writes=[];
 const db={getById:async key=>key==='dm_p'?patient:appointment,getAll:async()=>[],insert:async(key,row)=>{writes.push([key,row]);return {...row,id:key==='dm_pl'?501:902}}};
 await assert.rejects(persistAppointmentEntry({db,patient,appointment,draft:{...draft,items:[{...draft.items[0],price:'640'}],amount:'50'}}),error=>error.writesStarted===false);
 assert.equal(writes.length,0);
 await persistAppointmentEntry({db,patient,appointment,draft:{...draft,amount:'50'}});
 assert.deepEqual(writes.map(x=>x[0]),['dm_pl','dm_py']);assert.equal(writes[1][1].pianoId,501);assert.equal(writes[0][1].voci.length,3);
});
