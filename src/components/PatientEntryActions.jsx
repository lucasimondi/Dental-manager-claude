import React from 'react';
import './PatientPlanEntry.css';

export default function PatientEntryActions({ onTreatment, onQuote }) {
  if (!onTreatment || !onQuote) return null;
  return <div className="patient-entry-actions" aria-label="Prestazioni e preventivi">
    <button type="button" onClick={onTreatment}>+ Aggiungi prestazione</button>
    <button type="button" onClick={onQuote}>+ Nuovo preventivo</button>
  </div>;
}
