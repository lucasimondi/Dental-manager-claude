import test from 'node:test';
import assert from 'node:assert/strict';
import { shareQuoteFiles, quotePdfFile } from '../src/lib/quoteFiles.js';
import { preparePatientEntry } from '../src/lib/appointmentEntry.js';
import { archivePreventivo, quoteIdentity } from '../src/lib/preventivi.js';

test('quote share passes only files, keeps cancellation distinct and does not use text fallback', async()=>{
 const files=[new File(['pdf'],'test.pdf',{type:'application/pdf'})];let payload;
 const nav={canShare:p=>p.files===files,share:async p=>{payload=p;}};
 assert.equal(await shareQuoteFiles(files,nav),'shared');assert.deepEqual(Object.keys(payload),['files']);
 nav.share=async()=>{throw Object.assign(Error(),{name:'AbortError'});};assert.equal(await shareQuoteFiles(files,nav),'cancelled');
 assert.equal(await shareQuoteFiles(files,{}),'unsupported');
 nav.share=async()=>{throw Error('permission');};await assert.rejects(()=>shareQuoteFiles(files,nav),/permission/);
});
test('PDF file ignores jsPDF filename parameter in MIME header and keeps real PDF bytes',async()=>{
 const file=quotePdfFile({dataUrl:'data:application/pdf;filename=x.pdf;base64,JVBERi0xLjQ=',filename:'quote.pdf'});
 assert.equal(file.type,'application/pdf');assert.equal(await file.text(),'%PDF-1.4');
});
test('quote discounts validated before persistence; canonical quote remains proposed',()=>{
 const args={patient:{id:7},plans:[],draft:{items:[],quoteItems:[{description:'Corona',price:'500'}],quoteDiscount:'20',quoteDiscountType:'pct'}};
 const quote=preparePatientEntry(args).quote;assert.equal(quote.sconto,20);assert.equal(quote.stato,'attivo');assert.equal(quote.voci[0].eseguita,false);
 for(const discount of [-1,101,'invalid']) assert.throws(()=>preparePatientEntry({...args,draft:{...args.draft,quoteDiscount:discount}}),/sconto/);
});
test('document archive rejects missing tenant and mismatched patient before table access',async()=>{
 const client={auth:{getSession:async()=>({data:{session:{user:{id:'user',app_metadata:{}}}}})},from:()=>{throw Error('must not query');}};
 await assert.rejects(()=>quoteIdentity(client),/Sessione/);
 await assert.rejects(()=>archivePreventivo(client,{id:'x',piano:{id:1,pazienteId:8},paziente:{id:7}}),/corrispondono/);
});
test('archive retry returns first immutable PDF and never creates a second plan or overwrites the snapshot',async()=>{
 let stored, writes=0;
 const client={auth:{getSession:async()=>({data:{session:{user:{id:'u',app_metadata:{studio_id:'s'}}}}})},from:table=>{
   assert.equal(table,'preventivi');
   const chain={upsert:async(row,options)=>{writes++;assert.deepEqual(options,{onConflict:'id',ignoreDuplicates:true});stored||=structuredClone(row);return {error:null};},select:()=>chain,eq:()=>chain,single:async()=>({data:stored,error:null})};return chain;
 }};
 const input={id:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',piano:{id:10,pazienteId:7,titolo:'Test',voci:[{prestazione:'Igiene',prezzo:85}]},paziente:{id:7,nome:'Sintetico'},si:{nome:'Studio Test'}};
 const first=await archivePreventivo(client,input);input.piano.voci[0].prezzo=900;
 const retry=await archivePreventivo(client,input);
 assert.equal(writes,2);assert.equal(retry.dataUrl,first.dataUrl);assert.equal(retry.plan_snapshot.voci[0].prezzo,85);
});
