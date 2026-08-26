import React, { useEffect, useState } from 'react';
import PatientWorkspaceBoundary from './PatientWorkspaceBoundary.jsx';
import { supabase } from '../lib/supabase.js';
import { loadRealPatientWorkspace } from '../lib/patientWorkspaceClinicalFinancial.js';

export default function PatientWorkspaceRealPreview() {
  const patientId = new URLSearchParams(window.location.search).get('patientId');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!patientId) return;
    let active = true;
    loadRealPatientWorkspace(supabase, patientId).then((result) => active && setData(result)).catch((reason) => active && setError(reason.message));
    return () => { active = false; };
  }, [patientId]);
  if (!patientId) return <main style={{ padding: 32 }}><h1>Preview reale controllata</h1><p>Specificare un patientId e autenticarsi nello studio.</p></main>;
  if (error) return <main style={{ padding: 32 }}><h1>Workspace non disponibile</h1><p>{error}</p></main>;
  if (!data) return <main role="status" style={{ padding: 32 }}>Caricamento dati reali…</main>;
  return <PatientWorkspaceBoundary key={data.patient.id} paz={data.patient} plans={data.plans} payments={data.payments} appointments={data.appointments} pricelist={[]} richiami={[]} features={{ patientWorkspaceV2: true }} si={{}} documentClient={supabase} canonicalFinancial={data.canonicalFinancial} financialScope={data.financialScope} />;
}
