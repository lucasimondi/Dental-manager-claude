import React from 'react';
import Ic from './Ic.jsx';
import { C } from '../../lib/utils';

export default function PhStr({ tel, whatsapp = true }) {
  if (!tel) return null;
  const d = tel.replace(/\D/g, '');
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
      {whatsapp && (
      <a
        href={`https://wa.me/39${d}`}
        target="_blank"
        rel="noopener"
        style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          background: '#E6F9EE', borderRadius: 9, padding: '9px', textDecoration: 'none',
          color: '#128C7E', fontWeight: 700, fontSize: 12,
        }}
      >
        <Ic n="wa" s={13} c="#128C7E" />WhatsApp
      </a>
      )}
    </div>
  );
}
