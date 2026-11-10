import React from 'react';
import './acquisisci.css';

// ACQUISISCI-UNICO (PO 2026-11-10): "Il tasto acquisizione deve essere unico e flottante, in basso a
// destra come il più; poi da lì decido dove archiviare, se in personale o studio (paziente)".
// Uguale in Studio e in Personal: tondo, fotocamera, sopra il «+». Un tocco apre subito l'acquisizione.
export default function TastoAcquisisci({ onClick, className = '' }) {
  return <button type="button" className={`tasto-acquisisci ${className}`} aria-label="Acquisisci documento" title="Acquisisci: scatta, foto o file" onClick={onClick}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13.5" r="3.5" /></svg>
  </button>;
}
