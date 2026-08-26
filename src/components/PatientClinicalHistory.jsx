import React from 'react';
import { Crd } from './ui';
import { C } from '../lib/utils';

export default function PatientClinicalHistory({ patient }) {
  return <div>
    <Crd style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: C.pri, marginBottom: 8 }}>Anamnesi / Allergie / Note generali</div>
      <div style={{ fontSize: 13, color: patient?.noteGenerale ? C.txt : C.txm, whiteSpace: 'pre-wrap' }}>{patient?.noteGenerale || 'Nessuna nota generale registrata.'}</div>
    </Crd>
    <Crd style={{ borderColor: C.war }}>
      <div style={{ fontWeight: 800, color: C.war, marginBottom: 6 }}>Storia clinica firmata temporaneamente non disponibile</div>
      <div style={{ fontSize: 12, color: C.txm, lineHeight: 1.5 }}>Le RPC autenticate per lettura, firma in studio e compilazione remota non sono verificabili nel backend versionato. Per sicurezza non vengono effettuate query né abilitate firme finché il contratto non sarà confermato.</div>
      <button type="button" disabled style={{ marginTop: 10, border: 0, borderRadius: 8, padding: '8px 12px' }}>Nuova anamnesi</button>
    </Crd>
  </div>;
}
