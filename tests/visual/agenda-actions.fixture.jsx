import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import Agenda from '../../src/components/Agenda.jsx';
import PatientWorkspaceBoundary from '../../src/components/PatientWorkspaceBoundary.jsx';
import { appointmentPatientAction } from '../../src/lib/appointmentQuickHub.js';
import '../../src/styles.css';
import '../../src/styles/designTokens.css';
import '../../src/components/PremiumVisualSystem.css';
const patient={id:7,nome:'Paziente',cognome:'Test',telefono:'3330000000'};
const settings={oraInizio:8,oraFine:20,slotMin:30,durataDefault:30,hiddenWeekdays:[]};
function Fixture(){
 const [appointments,setAppointments]=useState([{id:3,pazienteId:7,data:'2026-10-23',ora:'10:00',durata:60,tipo:'Visita',stato:'confermato'}]);
 const [plans,setPlans]=useState([{id:20,pazienteId:7,titolo:'Piano test',data:'2026-10-21',stato:'attivo',voci:[],sconto:0,scontoTipo:'pct'}]);
 const [payments,setPayments]=useState([]),[record,setRecord]=useState(null);
 window.__plans=plans;window.__payments=payments;
 const open=(p,a,action)=>{const target=appointmentPatientAction(p,a,action);if(target)setRecord({...target,patient:p,documentRequest:target.documentType?{type:target.documentType,requestId:'fixture-'+action}:null})};
 return <div className="app-shell--mobile" style={{display:'flex',height:'100dvh',flexDirection:'column'}}><main style={{display:'flex',flex:1,minHeight:0,padding:6}}><Agenda patients={[patient]} setPatients={()=>{}} appointments={appointments} setAppointments={setAppointments} impegni={[]} appTypes={[{id:1,nome:'Visita',colore:'#2563eb'}]} si={{vertical:'dentistico',agenda_settings:settings}} features={{}} onPatientAction={open} onOpenPatient={p=>setRecord({patient:p,tab:'info'})} /></main>{record&&createPortal(<PatientWorkspaceBoundary key={patient.id} paz={record.patient} initTab={record.tab} initialAction={record.initialAction} initialDocumentRequest={record.documentRequest} onDocumentRequestHandled={()=>setRecord(current=>({...current,documentRequest:null}))} plans={plans} setPlans={setPlans} payments={payments} setPayments={setPayments} appointments={appointments} si={{vertical:'dentistico'}} features={{}} setPatients={()=>{}} onNuovoPiano={()=>{window.__newPlan=true}} onClose={()=>setRecord(null)} />,document.body)}</div>
}
createRoot(document.getElementById('root')).render(<Fixture/>);
