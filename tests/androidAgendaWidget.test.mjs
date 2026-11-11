import { test } from 'node:test';
import assert from 'node:assert/strict';
import { widgetSnapshot, startAndroidAgendaWidget } from '../personal/src/lib/androidAgendaWidget.js';
import { oggi, piuGiorni } from '../personal/src/lib/agenda.js';
const window = { from:'2026-11-01', to:'2026-11-30', now:1000 };
test('native snapshot combines both sources and multi-day events, no patient identifiers or notes', () => {
  const s=widgetSnapshot({...window,appuntamenti:[{id:1,paziente_id:123,paziente:'SYNTHETIC',note:'PRIVATE',data:'2026-11-03',ora:'15:00:00',tipo:'Visita'}],impegni:[{id:2,titolo:'Impegno prova',data_inizio:'2026-11-02',data_fine:'2026-11-04',tutto_il_giorno:true}]});
  assert.equal(s.entries.length,2); assert.equal(s.entries[0].source,'personal'); assert.equal(s.entries[0].end,'2026-11-04'); assert.equal(s.entries[0].time,''); assert.equal(s.entries[1].time,'15:00');
  assert.doesNotMatch(JSON.stringify(s),/PRIVATE|SYNTHETIC|paziente|note/);
});
test('snapshot respects Personal visibility, cancellation and coverage, including both weekend days',()=>{
 const s=widgetSnapshot({...window,appuntamenti:[{data:'2026-11-03',stato:'annullato'},{data:'2026-11-03',visibile_personal:false},{data:'2026-12-01'},{data:'2026-11-07'},{data:'2026-11-08'}],impegni:[{data_inizio:'2026-11-02',data_fine:'2026-11-03',visibile_personal:false}]});
 assert.deepEqual(s.entries.map(e=>e.start),['2026-11-07','2026-11-08']);
});
test('ordinary browser and untrusted origins do not start additional data reads',()=>{
 let calls=0; const deps={db:null,session:()=>{calls++;},studioId:()=>{}};
 startAndroidAgendaWidget({...deps,host:{location:{origin:'https://other.example'},PoliedraWidget:{postMessage(){throw Error('untrusted');}}}})();
 startAndroidAgendaWidget({...deps,host:{location:{origin:'https://personal.poliedrasoft.it'}}})(); assert.equal(calls,0);
});
test('no studio session fails closed and clears native cache',async()=>{
 const messages=[]; let timer;
 const host={location:{origin:'https://personal.poliedrasoft.it'},PoliedraWidget:{postMessage:s=>messages.push(JSON.parse(s))},document:{addEventListener(){},removeEventListener(){}},addEventListener(){},removeEventListener(){},setTimeout, setInterval:f=>{timer=f;return 1;},clearInterval(){}};
 const stop=startAndroidAgendaWidget({db:{auth:{onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}},session:async()=>null,studioId:()=>{throw Error('must not read');},host});
 await new Promise(r=>setImmediate(r)); assert(messages.length>=2); assert(messages.every(m=>m.clear===true)); stop();
});
function fakeHost() {
 const messages=[]; const listeners=new Map();
 const host={location:{origin:'https://personal.poliedrasoft.it'},PoliedraWidget:{postMessage:s=>messages.push(JSON.parse(s))},document:{visibilityState:'visible',addEventListener(){},removeEventListener(){}},addEventListener:(k,f)=>listeners.set(k,f),removeEventListener(){},setTimeout,setInterval:()=>1,clearInterval(){}};
 return {host,messages,listeners};
}
test('native sync pages both tables, strips identifiers, and clears on a failed refresh',async()=>{
 const {host,messages,listeners}=fakeHost(); let failed=false; const pages=[];
 // Date relative a oggi: la sincronizzazione legge oggi −7 … +28 giorni (date fisse uscivano dalla finestra).
 const giorno1=piuGiorni(oggi(),1), giorno2=piuGiorni(oggi(),2);
 const db={auth:{onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from(table){
  const query={select(){return this;},gte(){return this;},lte(){return this;},order(){return this;},async range(start,end){pages.push([table,start,end]);if(failed)return {error:{message:'unavailable'}};return {data:table==='appointments' && start===0 ? Array.from({length:500},(_,id)=>({id,data:giorno1,ora:'09:00',tipo:'Prova'})) : table==='appointments' ? [{id:501,data:giorno2,ora:'10:00'}] : []};}};return query;
 }};
 const stop=startAndroidAgendaWidget({db,session:async()=>({user:{id:'synthetic'}}),studioId:()=> 'synthetic-studio',host});
 await new Promise(r=>setImmediate(r)); const snapshot=messages.find(m=>m.entries);assert.equal(snapshot.entries.length,501);assert.equal(pages.length,3);assert.equal(snapshot.entries[0].id,undefined);
 failed=true;await listeners.get('focus')();assert.deepEqual(messages.at(-1),{clear:true});stop();
});
test('cleanup prevents late network results from repopulating signed-out widget data',async()=>{
 const {host,messages}=fakeHost(); let release;
 const session=new Promise(resolve=>{release=resolve;});
 const stop=startAndroidAgendaWidget({db:{auth:{onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}},session:()=>session,studioId:()=>{throw Error('must not execute after cleanup');},host});
 stop();release({user:{id:'synthetic'}});await new Promise(r=>setImmediate(r));assert(messages.every(m=>m.clear===true));
});
test('snapshot carries the agenda label color (validated #rrggbb) for both sources',()=>{
 const s=widgetSnapshot({...window,coloriTipi:{Visita:'#185FA5'},etichette:[{id:'sport',nome:'Sport',colore:'#059669'}],appuntamenti:[{id:1,data:'2026-11-03',ora:'09:00',tipo:'Visita'},{id:2,data:'2026-11-03',ora:'10:00',tipo:'Altro',colore:'#DB2777'},{id:3,data:'2026-11-03',ora:'11:00',tipo:'X',colore:'red;x'}],impegni:[{id:4,titolo:'Corsa',tipo:'sport',data_inizio:'2026-11-03',data_fine:'2026-11-03',ora_inizio:'07:00'}]});
 // PO 2026-11-04: il widget mostra il colore palette più vicino, come l'agenda.
 assert.deepEqual(s.entries.map(e=>e.color),['#22714a','#2d6bc4','#c23d78','']);
});
