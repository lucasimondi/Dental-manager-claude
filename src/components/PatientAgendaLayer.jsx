import React from 'react';
import PatientAgendaDock from './PatientAgendaDock.jsx';

export default function PatientAgendaLayer({ patient, minimized, saving, onRestore, children }) {
  return <>
    <div hidden={minimized} style={{ display: minimized ? 'none' : undefined }} data-patient-workspace-preserved>{children}</div>
    {minimized && <PatientAgendaDock patient={patient} saving={saving} onRestore={onRestore} />}
  </>;
}
