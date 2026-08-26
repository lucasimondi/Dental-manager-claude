import React, { useState } from 'react';
import { Btn, Crd, Fld, Inp, Modal, Txt } from './ui';
import { C, today } from '../lib/utils';
import { patientWithNote, patientWithRecall } from '../lib/patientQuickActions.js';

export default function PatientQuickActions({ patient, setPatients, setPayments, richiami = [], setRichiami, onNewAppointment, onPatientChange }) {
  const [modal, setModal] = useState(null);
  const [note, setNote] = useState(patient.noteGenerale || '');
  const [annotation, setAnnotation] = useState('');
  const [recallDate, setRecallDate] = useState(today());
  const [payment, setPayment] = useState({ importo: '', metodo: 'Contanti', nota: '', data: today() });
  const [status, setStatus] = useState('');
  const commitPatient = (updated) => {
    setPatients?.((rows) => rows.map((row) => row.id === patient.id ? updated : row));
    onPatientChange?.(updated);
  };
  const saveRecall = () => {
    if (!annotation.trim()) return;
    commitPatient(patientWithRecall(patient, annotation, recallDate, Date.now(), today()));
    setRichiami?.((rows) => [...rows, {
      id: Date.now() + Math.floor(Math.random() * 9999), pazienteId: patient.id,
      categoria: 'generico', motivo: annotation.trim(), dataScadenza: recallDate,
      origine: 'manuale', stato: 'da_fare', chiaveBot: null,
    }]);
    setAnnotation(''); setModal(null); setStatus(`Richiamo creato per il ${recallDate}.`);
  };
  const savePayment = () => {
    if (!(Number(payment.importo) > 0)) return;
    setPayments?.((rows) => [...rows, { ...payment, importo: Number(payment.importo), id: Date.now() + Math.floor(Math.random() * 9999), pazienteId: patient.id, stato: 'pagato' }]);
    setModal(null);
  };
  return <Crd style={{ marginTop: 10 }}>
    <div style={{ fontSize: 11, fontWeight: 800, color: C.pri, marginBottom: 8 }}>Azioni paziente</div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}><Btn ch="Note" v="sec" sz="sm" onClick={() => { setStatus(''); setModal('note'); }} /><Btn ch="Nuovo richiamo" v="sec" sz="sm" onClick={() => { setStatus(''); setModal('recall'); }} /><Btn ch="Nuovo appuntamento" v="sec" sz="sm" onClick={() => onNewAppointment?.(patient.id)} /><Btn ch="Registra pagamento" v="sec" sz="sm" onClick={() => setModal('payment')} /></div>
    {status && <div role="status" style={{ marginTop: 8, fontSize: 11.5, color: C.suc }}>{status}</div>}
    {modal === 'note' && <Modal title="Note paziente" onClose={() => setModal(null)}><Txt aria-label="Note paziente" value={note} onChange={(event) => setNote(event.target.value)} /><div style={{ marginTop: 10 }}><Btn ch="Salva note" onClick={() => { commitPatient(patientWithNote(patient, note)); setModal(null); setStatus('Note salvate e aggiornate nella scheda.'); }} full /></div></Modal>}
    {modal === 'recall' && <Modal title="Nuovo richiamo" onClose={() => setModal(null)}><Fld label="Motivo"><Txt value={annotation} onChange={(event) => setAnnotation(event.target.value)} /></Fld><Fld label="Data richiamo"><Inp type="date" value={recallDate} onChange={(event) => setRecallDate(event.target.value)} /></Fld><Btn ch="Crea richiamo" dis={!annotation.trim() || !recallDate} onClick={saveRecall} full /></Modal>}
    {modal === 'payment' && <Modal title="Registra pagamento" onClose={() => setModal(null)}><Fld label="Importo"><Inp type="number" value={payment.importo} onChange={(event) => setPayment((value) => ({ ...value, importo: event.target.value }))} /></Fld><Fld label="Metodo"><Inp value={payment.metodo} onChange={(event) => setPayment((value) => ({ ...value, metodo: event.target.value }))} /></Fld><Fld label="Nota"><Inp value={payment.nota} onChange={(event) => setPayment((value) => ({ ...value, nota: event.target.value }))} /></Fld><Btn ch="Registra" dis={!(Number(payment.importo) > 0)} onClick={savePayment} full /></Modal>}
  </Crd>;
}
