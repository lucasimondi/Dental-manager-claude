import React from 'react';
import Ic from './Ic.jsx';
import { C } from '../../lib/utils';
import WaAction from './WaAction.jsx';

export default function PhStr({ tel, whatsapp = true, features }) {
  if (!tel) return null;
  const d = tel.replace(/\D/g, '');
  // Compatibilità: se arriva ancora il vecchio prop `whatsapp`, lo trattiamo
  // come features.whatsapp; il prop `features` (nuovo) ha comunque la priorità.
  const feat = features || { whatsapp };
  return (
    <div style={{ display: 'flex', gap: 7, marginTop: 7 }}>
      <a
        href={`tel:+39${d}`}
        style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          background: C.priL, borderRadius: 9, padding: '9px', textDecoration: 'none',
          color: C.pri, fontWeight: 700, fontSize: 12,
        }}
      >
        <Ic n="ph" s={13} c={C.pri} />Chiama
      </a>
      <WaAction tel={tel} features={feat} variant="full" />
    </div>
  );
}
