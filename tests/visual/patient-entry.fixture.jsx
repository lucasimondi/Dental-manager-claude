// Synthetic integration fixture; no account, real patient, network writes or production data.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import PatientWorkspaceBoundary from '../../src/components/PatientWorkspaceBoundary.jsx';
import { persistPatientEntry } from '../../src/lib/appointmentEntry.js';
import '../../src/styles.css';
import '../../src/styles/designTokens.css';
import '../../src/components/PremiumVisualSystem.css';
const patient = {id:7,nome:'Paziente',cognome:'Sintetico'};
const params = new URLSearchParams(location.search);
const count = Number(params.get('plans') || 0);
let stored = Array.from({length:count},(_,i)=>({id:20+i,pazienteId:7,titolo:`Piano ${i+1}`,stato:'attivo',data:'2026-11-01',voci:[]}));
window.__writes = [];
const db = {getById:async(table,id)=>table==='dm_p'?patient:stored.find(p=>p.id===id),getAll:async()=>stored,
 insert:async(table,payload)=>{await new Promise(r=>setTimeout(r,250));if(window.__failSave)throw Error('Errore sintetico');const saved={...payload,id:100+window.__writes.length};stored.push(saved);window.__writes.push({table,...saved});return saved;},
 update:async(table,id,payload)=>{const saved={...payload,id};stored=stored.map(p=>p.id===id?saved:p);window.__writes.push({table,...saved});}};
if (params.get('keyboard') === 'test') {
 const viewport = new EventTarget(); Object.assign(viewport,{height:740,offsetTop:0});
 Object.defineProperty(window,'visualViewport',{value:viewport,configurable:true});
 window.addEventListener('message',event=>{if(event.source !== window.parent || event.data?.type !== 'test-keyboard')return;viewport.height=event.data.open?340:740;viewport.offsetTop=event.data.open?35:0;viewport.dispatchEvent(new Event('resize'));});
}
function Fixture() {
 const [plans,setPlans] = useState(stored);
 const save = async(patient,draft)=>{let savedPlan;const result=await persistPatientEntry({db,patient,draft,onApplied:(kind,row)=>{savedPlan=row;setPlans([...stored]);}});return {...result,savedPlan};};
 return <PatientWorkspaceBoundary paz={patient} plans={plans} setPlans={setPlans} payments={[]} appointments={[]} si={{nome:'Studio Test',vertical:'dentistico'}} saldiPiani={{}} pricelist={[{id:1,nome:'Igiene professionale',cat:'Prevenzione',cod:'IG1',prezzo:85},{id:2,nome:'Otturazione estetica',cat:'Conservativa',prezzo:100},{id:3,nome:'Visita di controllo',cat:'Visite',prezzo:0}]} features={{patientWorkspaceV2:params.get('v2')==='1'}} onClose={()=>{}} onNuovoPiano={()=>{}} onSavePatientEntry={save} />;
}
createRoot(document.getElementById('root')).render(<Fixture />);
