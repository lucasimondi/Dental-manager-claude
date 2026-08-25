import React, { useEffect, useState } from 'react';
import PatientWorkspaceV2 from './PatientWorkspaceV2.jsx';
import { DB, supabase } from '../lib/supabase.js';
import { completePatientTreatment, replacePersistedPlan } from '../lib/patientWorkspaceIntegration.js';

export default function PatientWorkspaceV2Connected() {
  const [state, setState] = useState({ loading: true, error: '', patients: [], patient: null, plans: [], payments: [], appointments: [] });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session) throw new Error('Accedi prima all’applicazione per usare la preview con dati reali.');
        const [patients, plans, payments, appointments] = await Promise.all([DB.getAll('dm_p'), DB.getAll('dm_pl'), DB.getAll('dm_py'), DB.getAll('dm_a')]);
        if (cancelled) return;
        const requestedId = new URLSearchParams(window.location.search).get('patientId');
        const patient = patients.find((row) => String(row.id) === String(requestedId)) || patients[0] || null;
        setState({ loading: false, error: '', patients, patient, plans, payments, appointments });
      } catch (error) {
        if (!cancelled) setState((current) => ({ ...current, loading: false, error: error?.message || 'Caricamento non riuscito.' }));
      }
    })();
    return () => { cancelled = true; };
  }, []);
  if (state.loading) return <div className="pw2-connected-state">Caricamento dati paziente…</div>;
  if (state.error) return <div className="pw2-connected-state is-error" role="alert">{state.error}</div>;
  if (!state.patient) return <div className="pw2-connected-state">Nessun paziente disponibile.</div>;
  const selectPatient = (id) => setState((current) => ({ ...current, patient: current.patients.find((row) => String(row.id) === String(id)) || current.patient }));
  const completeTreatment = async (item) => {
    const persisted = await completePatientTreatment(DB, { patientId: state.patient.id, planId: item.planId, treatmentIndex: item.treatmentIndex });
    setState((current) => ({ ...current, plans: replacePersistedPlan(current.plans, persisted) }));
  };
  return <><label className="pw2-connected-patient"><span>Paziente reale</span><select value={state.patient.id} onChange={(event) => selectPatient(event.target.value)}>{state.patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.nome} {patient.cognome}</option>)}</select></label><PatientWorkspaceV2 patient={state.patient} plans={state.plans} payments={state.payments} appointments={state.appointments} integrationMode onCompleteTreatment={completeTreatment} onClose={() => { window.location.href = '/'; }} /></>;
}
