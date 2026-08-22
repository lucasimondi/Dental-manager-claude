import React from 'react';
import { C } from '../../lib/utils';
import { Btn, Ic } from '../ui';

/* POL-AI-001 §11, §19 — confirmation preview for CREATE/UPDATE intents.
   Phase 1 scope (see actionRegistry.js header comment): "Conferma" opens
   the existing, unchanged form via the reused workflow — it does not
   write data itself, so this stays a Level 1 flow even though the UI
   pattern already matches the Level 2 "preview + confirm" shape the task
   describes for when a direct-write path exists in a future phase. */
export default function PoliedronActionPreview({ entities, suggestedActions, onConfirm, onModify }) {
  const primary = suggestedActions?.[0];
  if (!primary) return null;
  const patient = entities?.patientCandidates?.[0];

  return (
    <div style={{ background: C.priL, border: `1px solid ${C.pri}35`, borderRadius: 14, padding: 14, marginTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Ic n="zap" s={14} c={C.pri} />
        <span style={{ fontSize: 12.5, fontWeight: 800, color: C.txt, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{primary.label}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12, fontSize: 12.5 }}>
        {patient && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: C.txm }}>Paziente</span>
            <span style={{ fontWeight: 700, color: C.txt }}>{patient.nome} {patient.cognome}</span>
          </div>
        )}
        {entities?.amount != null && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: C.txm }}>Importo</span>
            <span style={{ fontWeight: 700, color: C.txt }}>{entities.amount.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: C.txm }}>Data</span>
          <span style={{ fontWeight: 700, color: C.txt }}>Oggi</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn ch="Modifica" v="sec" onClick={onModify} />
        <Btn ch="Conferma" onClick={() => onConfirm(primary)} full />
      </div>
    </div>
  );
}
