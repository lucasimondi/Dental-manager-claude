import React, { useState } from 'react';
import { Btn, Crd, Fld, Ic, Inp, Modal, Sel, Txt } from './ui';
import { C, today } from '../lib/utils';
import { patientWithNote, patientWithRecall } from '../lib/patientQuickActions.js';
import { planAssignmentForPatient } from '../lib/domain/incassiActions.js';
import { useCategorieSpesa } from '../lib/useCategorieSpesa';
import SpesaModal from './SpesaModal.jsx';

// POL-UI-020: Product Owner — "I tasti azioni veloci in pazienti devono
// essere 6 e messi bene impaginati, metti magari spesa". Da 4 pillole in
// fila (flex-wrap) a una griglia di 6 tile icona+etichetta — stesso
// linguaggio visivo della sidebar sezioni appena introdotta in
// SchedaPaz.jsx, non un pattern a sé stante. "Spesa" apre lo STESSO
// SpesaModal già usato in Spese.jsx (associazione al paziente
// precompilata ma rimovibile, mai un secondo form). "Nuovo piano" riusa
// l'handler che SchedaPaz già riceve da App.jsx per lo stesso scopo
// (chiude la scheda e apre la creazione piano, come "Nuovo appuntamento"
// già fa con l'Agenda) — nessuna nuova rotta inventata.
export default function PatientQuickActions({ patient, plans = [], setPatients, setPayments, richiami = [], setRichiami, onNewAppointment, onNewPlan, onPatientChange, studioId }) {
  const [modal, setModal] = useState(null);
  const [note, setNote] = useState(patient.noteGenerale || '');
  const [annotation, setAnnotation] = useState('');
  const [recallDate, setRecallDate] = useState(today());
  const [payment, setPayment] = useState({ importo: '', metodo: 'Contanti', nota: '', data: today(), pianoId: '' });
  const [status, setStatus] = useState('');
  const { categorie } = useCategorieSpesa(studioId);
  // POL-FIN-003 §5 — this is a generic payment with no prestazione context:
  // auto-assign when there's exactly one active plan, otherwise require an
  // explicit choice (no silent inference across plans).
  const assignment = planAssignmentForPatient(plans, patient.id);
  const planOptions = assignment.mode === 'choose' ? assignment.options : [];
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
    if (assignment.mode === 'choose' && !payment.pianoId) return;
    const pianoId = assignment.mode === 'auto' ? assignment.pianoId : (assignment.mode === 'choose' ? Number(payment.pianoId) : undefined);
    const { pianoId: _draftPianoId, ...rest } = payment;
    setPayments?.((rows) => [...rows, { ...rest, importo: Number(payment.importo), id: Date.now() + Math.floor(Math.random() * 9999), pazienteId: patient.id, stato: 'pagato', ...(pianoId !== undefined ? { pianoId } : {}) }]);
    setModal(null);
  };

  const ACTIONS = [
    { id: 'note', icon: 'edit', label: 'Note', onClick: () => { setStatus(''); setModal('note'); } },
    { id: 'recall', icon: 'bell', label: 'Richiamo', onClick: () => { setStatus(''); setModal('recall'); } },
    { id: 'appointment', icon: 'cal', label: 'Appuntamento', onClick: () => onNewAppointment?.(patient.id) },
    { id: 'payment', icon: 'eur', label: 'Pagamento', onClick: () => { setPayment({ importo: '', metodo: 'Contanti', nota: '', data: today(), pianoId: '' }); setModal('payment'); } },
    { id: 'spesa', icon: 'receipt', label: 'Spesa', onClick: () => setModal('spesa') },
    { id: 'piano', icon: 'tooth', label: 'Nuovo piano', onClick: () => onNewPlan?.(patient.id) },
  ];

  return <Crd style={{ marginTop: 10 }}>
    <div style={{ fontSize: 11, fontWeight: 800, color: C.pri, marginBottom: 8 }}>Azioni paziente</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {ACTIONS.map((a) => (
        <button key={a.id} type="button" onClick={a.onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '11px 4px', borderRadius: 12, border: `1px solid ${C.brd}`, background: C.bg, cursor: 'pointer' }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: C.priL, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Ic n={a.icon} s={16} c={C.pri} />
          </div>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: C.txt, textAlign: 'center' }}>{a.label}</span>
        </button>
      ))}
    </div>
    {status && <div role="status" style={{ marginTop: 8, fontSize: 11.5, color: C.suc }}>{status}</div>}
    {modal === 'note' && <Modal title="Note paziente" onClose={() => setModal(null)}><Txt aria-label="Note paziente" value={note} onChange={(event) => setNote(event.target.value)} /><div style={{ marginTop: 10 }}><Btn ch="Salva note" onClick={() => { commitPatient(patientWithNote(patient, note)); setModal(null); setStatus('Note salvate e aggiornate nella scheda.'); }} full /></div></Modal>}
    {modal === 'recall' && <Modal title="Nuovo richiamo" onClose={() => setModal(null)}><Fld label="Motivo"><Txt value={annotation} onChange={(event) => setAnnotation(event.target.value)} /></Fld><Fld label="Data richiamo"><Inp type="date" value={recallDate} onChange={(event) => setRecallDate(event.target.value)} /></Fld><Btn ch="Crea richiamo" dis={!annotation.trim() || !recallDate} onClick={saveRecall} full /></Modal>}
    {modal === 'payment' && <Modal title="Registra pagamento" onClose={() => setModal(null)}>
      <Fld label="Importo"><Inp type="number" value={payment.importo} onChange={(event) => setPayment((value) => ({ ...value, importo: event.target.value }))} /></Fld>
      {assignment.mode === 'choose' && (
        <Fld label="Piano">
          <Sel value={payment.pianoId} onChange={(event) => setPayment((value) => ({ ...value, pianoId: event.target.value }))}>
            <option value="">Seleziona piano…</option>
            {planOptions.map((plan) => <option key={plan.id} value={plan.id}>{plan.titolo}</option>)}
          </Sel>
        </Fld>
      )}
      <Fld label="Metodo"><Inp value={payment.metodo} onChange={(event) => setPayment((value) => ({ ...value, metodo: event.target.value }))} /></Fld>
      <Fld label="Nota"><Inp value={payment.nota} onChange={(event) => setPayment((value) => ({ ...value, nota: event.target.value }))} /></Fld>
      <Btn ch="Registra" dis={!(Number(payment.importo) > 0) || (assignment.mode === 'choose' && !payment.pianoId)} onClick={savePayment} full />
    </Modal>}
    {modal === 'spesa' && (
      <SpesaModal
        initialPazienteId={patient.id}
        patients={[patient]}
        categorie={categorie}
        onClose={() => setModal(null)}
        onSalvato={() => { setModal(null); setStatus('Spesa registrata in Spese.'); }}
      />
    )}
  </Crd>;
}
