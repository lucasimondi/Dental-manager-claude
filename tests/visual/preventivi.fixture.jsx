// Reproducible synthetic QA: no real account, records, messaging or API calls.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import PatientPlanEntry from '../../src/components/PatientPlanEntry.jsx';
import Preventivi from '../../src/components/Preventivi.jsx';
import {persistPatientEntry} from '../../src/lib/appointmentEntry.js';
import '../../src/styles.css';
const patient={id:7,nome:'Paziente',cognome:'Sintetico'};
let plans=[],documents=[],planWrites=0,archiveWrites=0;
let report=()=>{};
const client={auth:{getSession:async()=>({data:{session:{user:{id:'user',app_metadata:{studio_id:'studio'}}}}})},from:()=>{
 let filters=[],single=false,payload,offset=0,end=49;
 const q={select:()=>q,eq:(k,v)=>{filters.push([k,v]);return q;},or:()=>q,order:()=>q,range:(a,b)=>{offset=a;end=b;return q;},single:()=>{single=true;return q;},upsert:(row)=>{payload=row;return q;},update:(row)=>{payload=row;return q;},then:(resolve,reject)=>Promise.resolve().then(()=>{
 if(payload?.pdf_base64){archiveWrites++;if(!documents.some(d=>d.id===payload.id))documents.unshift({...payload,archiviato:false,created_at:new Date().toISOString()});}
 let selected=documents.filter(d=>filters.every(([k,v])=>d[k]===v));
 if(payload&&!payload.pdf_base64)selected.forEach(d=>Object.assign(d,payload));
 report();return {data:single?selected[0]:selected.slice(offset,end+1),error:null};
 }).then(resolve,reject)};return q;
}};
const db={getById:async(table,id)=>table==='dm_p'?patient:plans.find(p=>p.id===id),getAll:async()=>plans,insert:async(table,payload)=>{planWrites++;const plan={...payload,id:100+plans.length};plans.push(plan);report();return plan;}};
Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
Object.defineProperty(navigator,'share',{configurable:true,value:async({files,...rest})=>{if(Object.keys(rest).length)throw Error('Text fallback not allowed');document.getElementById('shared').textContent=`Allegati: ${files.map(f=>`${f.name} · ${f.type} · ${f.size} bytes`).join(' / ')}`;}});
function Fixture(){
 const[open,setOpen]=useState(true),[version,setVersion]=useState(0);report=()=>setVersion(v=>v+1);
 const save=draft=>persistPatientEntry({db,patient,draft});
 return <><div style={{padding:12}}><button onClick={()=>setOpen(true)}>Nuovo preventivo sintetico</button><p>Piani scritti: {planWrites} · Documenti: {documents.length} · Tentativi archivio: {archiveWrites}</p><p id="shared" role="status" /></div><Preventivi patient={patient} plans={plans} si={{nome:'Studio Test'}} client={client} onSave={(_,draft)=>save(draft)} key={open?'open':'archive'} />{open&&<PatientPlanEntry patient={patient} mode="quote" plans={plans} pricelist={[{id:1,nome:'Igiene professionale',prezzo:85},{id:2,nome:'Otturazione estetica',prezzo:100}]} si={{nome:'Studio Test',vertical:'dentistico'}} documentClient={client} onSave={save} onClose={()=>setOpen(false)} />}</>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
