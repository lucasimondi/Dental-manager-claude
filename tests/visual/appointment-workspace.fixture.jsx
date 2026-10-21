import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Agenda from '../../src/components/Agenda.jsx';
import AppointmentWorkspace from '../../src/components/AppointmentWorkspace.jsx';
import { persistAppointmentEntry } from '../../src/lib/appointmentEntry.js';
import { appointmentPatientAction } from '../../src/lib/appointmentQuickHub.js';
import '../../src/styles.css';
import '../../src/styles/designTokens.css';
import '../../src/components/PremiumVisualSystem.css';
const patient={id:7,nome:'Paziente',cognome:'Test',telefono:'3330000000',email:'test@example.invalid'};
const documentClient={from(){return {select(){return this},eq(){return this},order:async()=>({data:[{id:55,paziente_id:7,paziente_nome:'Paziente Test',tipo:'ricetta',titolo:'Ricetta archiviata',data:'2026-10-20'}],error:null}),single:async()=>{window.__pdfReads=(window.__pdfReads||0)+1;const {buildRicettaPdf}=await import('../../src/lib/documenti/pdfLayout.js');return {data:{pdf_base64:buildRicettaPdf({si:{nome:'Studio test'},paziente:patient,data:'2026-10-20',farmaci:[{farmaco:'Farmaco sintetico',posologia:'Di prova'}]}).dataUrl},error:null}}}}};
const settings={oraInizio:8,oraFine:20,slotMin:30,durataDefault:30,hiddenWeekdays:[]};
function Fixture(){
 const [appointments,setAppointments]=useState([{id:3,pazienteId:7,data:'2026-10-23',ora:'10:00',durata:60,tipo:'Visita',stato:'confermato'}]);
 const [plans,setPlans]=useState(new URLSearchParams(location.search).has('empty') ? [] : [{id:20,pazienteId:7,titolo:'Piano test',data:'2026-10-21',stato:'attivo',voci:[],sconto:0,scontoTipo:'pct'}]);
 const [payments,setPayments]=useState([]),[record,setRecord]=useState(null);
 window.__plans=plans;window.__payments=payments;
 const open=(p,a,action)=>{const target=appointmentPatientAction(p,a,action);if(target)setRecord({...target,patient:p,documentRequest:target.documentType?{type:target.documentType,requestId:'fixture-'+action}:null})};
 return <div className="app-shell--mobile" style={{display:'flex',height:'100dvh',flexDirection:'column'}}><main style={{display:'flex',flex:1,minHeight:0,padding:6}}><Agenda patients={[patient]} setPatients={()=>{}} appointments={appointments} setAppointments={setAppointments} impegni={[]} appTypes={[{id:1,nome:'Visita',colore:'#2563eb'}]} si={{vertical:'dentistico',agenda_settings:settings}} features={{}} renderAppointmentWorkspace={(p,a,onClose,onBusyChange)=><AppointmentWorkspace documentClient={documentClient} patient={p} appointment={a} plans={plans} onBusyChange={onBusyChange} onSave={async draft=>{
    window.__saveCalls=(window.__saveCalls||0)+1;
    if(new URLSearchParams(location.search).has('fail'))throw new Error('Errore di prova');
    let nextId=100+plans.length;
    await new Promise(r=>setTimeout(r,150));
    const db={getById:async(key,id)=>key==='dm_p'?p:key==='dm_a'?a:plans.find(x=>x.id===id),getAll:async()=>plans,insert:async(key,row)=>({...row,id:key==='dm_py'?900:nextId++}),update:async(key,id,row)=>{Object.assign(plans.find(x=>x.id===id),row)}};
    const result=await persistAppointmentEntry({db,patient:p,appointment:a,draft,onApplied:(kind,row)=>{const setter=kind==='plan'?setPlans:setPayments;setter(current=>current.some(x=>x.id===row.id)?current.map(x=>x.id===row.id?row:x):[...current,row])}});return result;
  }} pricelist={[{id:1,nome:'Prestazione listino',prezzo:120}]} si={{vertical:new URLSearchParams(location.search).get('vertical')||'dentistico'}} onClose={onClose}/>} onPatientAction={open} onOpenPatient={p=>setRecord({patient:p,tab:'info'})} /></main>{record&&<div>Scheda paziente richiesta</div>}</div>
}
createRoot(document.getElementById('root')).render(<Fixture/>);
