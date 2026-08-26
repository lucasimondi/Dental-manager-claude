import React, { useEffect, useRef, useState } from 'react';
import { Btn, Crd, Modal, FormStoriaClinica } from './ui';
import { C, ANAMNESI_MEDICA_STANDARD, STORIA_CLINICA_MODELLO_BASE, today } from '../lib/utils';
import { supabase } from '../lib/supabase.js';
import { formatClinicalHistoryNote } from '../lib/patientQuickActions.js';

export default function PatientClinicalHistory({ patient, setPatients, onPatientChange, studio }) {
  const medical = !studio?.vertical || studio.vertical === 'dentistico' || studio.vertical === 'medico_chirurgo';
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState(medical ? ANAMNESI_MEDICA_STANDARD : STORIA_CLINICA_MODELLO_BASE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const abortRef = useRef(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const openHistory = async () => {
    setError(''); setSaved('');
    if (medical) { setQuestions(ANAMNESI_MEDICA_STANDARD); setOpen(true); return; }
    setLoading(true);
    const controller = new AbortController();
    abortRef.current?.abort(); abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const studioId = session?.user?.app_metadata?.studio_id;
      if (!studioId) throw new Error('Sessione studio non disponibile.');
      const { data, error: queryError } = await supabase.from('storia_clinica_voci')
        .select('chiave, titolo, ordine').eq('studio_id', studioId).eq('attiva', true).order('ordine')
        .abortSignal(controller.signal);
      if (queryError) throw queryError;
      setQuestions(data?.length ? data : STORIA_CLINICA_MODELLO_BASE);
      setOpen(true);
    } catch (cause) {
      setError(controller.signal.aborted ? 'Caricamento anamnesi scaduto. Riprova.' : (cause?.message || 'Impossibile caricare il modello anamnesi.'));
    } finally {
      clearTimeout(timeout); setLoading(false);
    }
  };

  const saveHistory = (data) => {
    const section = formatClinicalHistoryNote(data, today());
    const updated = { ...patient, noteGenerale: [patient.noteGenerale?.trim(), section].filter(Boolean).join('\n\n') };
    setPatients?.((rows) => rows.map((row) => row.id === patient.id ? updated : row));
    onPatientChange?.(updated);
    setOpen(false); setSaved('Anamnesi salvata nella Scheda Paziente.');
  };

  return <div>
    <Crd style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: C.pri, marginBottom: 8 }}>Anamnesi / Allergie / Note generali</div>
      <div style={{ fontSize: 13, color: patient?.noteGenerale ? C.txt : C.txm, whiteSpace: 'pre-wrap' }}>{patient?.noteGenerale || 'Nessuna anamnesi registrata.'}</div>
      <div style={{ marginTop: 12 }}><Btn ch={loading ? 'Caricamento…' : 'Nuova anamnesi'} onClick={openHistory} dis={loading} full /></div>
      {error && <div role="alert" style={{ marginTop: 10, color: C.dan, fontSize: 12 }}>{error}</div>}
      {saved && <div role="status" style={{ marginTop: 10, color: C.suc, fontSize: 12 }}>{saved}</div>}
    </Crd>
    <Crd style={{ borderColor: C.war }}>
      <div style={{ fontWeight: 800, color: C.war, marginBottom: 6 }}>Firma anamnesi non disponibile</div>
      <div style={{ fontSize: 12, color: C.txm, lineHeight: 1.5 }}>Compilazione e salvataggio sono attivi. Firma in studio e link remoto restano disabilitati perché le RPC autenticate non sono presenti nel backend versionato.</div>
    </Crd>
    {open && <Modal title="Nuova anamnesi" onClose={() => { abortRef.current?.abort(); setOpen(false); }}>
      <FormStoriaClinica voci={questions} onCompilato={saveHistory} C={C} testoBottone="Salva anamnesi" />
    </Modal>}
  </div>;
}
