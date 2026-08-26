import React, { useState } from 'react';
import { Btn, Crd, Fld, Inp, Modal, Txt } from './ui';
import { C, today } from '../lib/utils';
import { patientWithNote, patientWithRecall } from '../lib/patientQuickActions.js';

export default function PatientQuickActions({ patient, setPatients, setPayments, onNewAppointment, onPatientChange }) {
  const [modal, setModal] = useState(null);
  const [note, setNote] = useState(patient.noteGenerale || '');
  const [annotation, setAnnotation] = useState('');
  const [recallDate, setRecallDate] = useState(today());
  const [payment, setPayment] = useState({ importo: '', metodo: 'Contanti', nota: '', data: today() });
  const commitPatient = (updated) => {
    setPatients?.((rows) => rows.map((row) => row.id === patient.id ? updated : row));
    onPatientChange?.(updated);
  };
  const saveAnnotation = () => {
    if (!annotation.trim()) return;
    commitPatient(patientWithRecall(patient, annotation, recallDate, Date.now(), today()));
    setAnnotation(''); setModal(null);
  };
  const savePayment = () => {
    if (!(Number(payment.importo) > 0)) return;
    setPayments?.((rows) => [...rows, { ...payment, importo: Number(payment.importo), id: Date.now() + Math.floor(Math.random() * 9999), pazienteId: patient.id, stato: 'pagato' }]);
    setModal(null);
  };
  return <Crd style={{ marginTop: 10 }}>
    <div style={{ fontSize: 11, fontWeight: 800, color: C.pri, marginBottom: 8 }}>Azioni paziente</div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}><Btn ch="Note / anamnesi" v="sec" sz="sm" onClick={() => setModal('note')} /><Btn ch="Annotazione / richiamo" v="sec" sz="sm" onClick={() => setModal('annotation')} /><Btn ch="Nuovo appuntamento" v="sec" sz="sm" onClick={() => onNewAppointment?.(patient.id)} /><Btn ch="Registra pagamento" v="sec" sz="sm" onClick={() => setModal('payment')} /></div>
    {modal === 'note' && <Modal title="Note / anamnesi" onClose={() => setModal(null)}><Txt value={note} onChange={(event) => setNote(event.target.value)} /><div style={{ marginTop: 10 }}><Btn ch="Salva" onClick={() => { commitPatient(patientWithNote(patient, note)); setModal(null); }} full /></div></Modal>}
    {modal === 'annotation' && <Modal title="Annotazione e richiamo" onClose={() => setModal(null)}><Fld label="Annotazione"><Txt value={annotation} onChange={(event) => setAnnotation(event.target.value)} /></Fld><Fld label="Data richiamo (opzionale)"><Inp type="date" value={recallDate} onChange={(event) => setRecallDate(event.target.value)} /></Fld><Btn ch="Salva" dis={!annotation.trim()} onClick={saveAnnotation} full /></Modal>}
    {modal === 'payment' && <Modal title="Registra pagamento" onClose={() => setModal(null)}><Fld label="Importo"><Inp type="number" value={payment.importo} onChange={(event) => setPayment((value) => ({ ...value, importo: event.target.value }))} /></Fld><Fld label="Metodo"><Inp value={payment.metodo} onChange={(event) => setPayment((value) => ({ ...value, metodo: event.target.value }))} /></Fld><Fld label="Nota"><Inp value={payment.nota} onChange={(event) => setPayment((value) => ({ ...value, nota: event.target.value }))} /></Fld><Btn ch="Registra" dis={!(Number(payment.importo) > 0)} onClick={savePayment} full /></Modal>}
  </Crd>;
}
