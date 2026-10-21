import React from 'react';
import { C } from '../lib/utils';
import { MOBILE_DOCK_BOTTOM, MOBILE_DOCK_HEIGHT } from '../lib/poliedron/poliedronMobileDock.js';

// The patient subtree is hidden by App, never unmounted while choosing a slot.
export default function PatientAgendaDock({ patient, onRestore, saving = false }) {
  return <div className="patient-agenda-dock" style={{ position: 'fixed', zIndex: 450, bottom: `calc(${MOBILE_DOCK_BOTTOM + MOBILE_DOCK_HEIGHT + 12}px + env(safe-area-inset-bottom, 0px))`, left: 12, right: 12, margin: '0 auto', maxWidth: 520, border: `1px solid ${C.brd}`, borderRadius: 14, background: C.sur, color: C.txt, boxShadow: '0 5px 20px rgba(0,0,0,0.15)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
    <div style={{ flex: 1, minWidth: 0 }}><strong style={{ display: 'block', overflowWrap: 'anywhere' }}>{patient.nome} {patient.cognome}</strong><span style={{ fontSize: 12, color: C.txm }}>{saving ? 'Salvataggio appuntamento…' : 'Scheda compressa · compilazione conservata'}</span></div>
    <button type="button" disabled={saving} onClick={onRestore} style={{ minHeight: 44, padding: '8px 12px', borderRadius: 9, border: `1px solid ${C.brd}`, background: C.priL, color: C.pri, fontWeight: 700, flexShrink: 0 }}>Riapri scheda</button>
  </div>;
}
