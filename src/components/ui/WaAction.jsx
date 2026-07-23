import React from 'react';
import Ic from './Ic.jsx';
import { C } from '../../lib/utils';

/* ── MODULO WHATSAPP CENTRALIZZATO ──
   Unico punto della app che decide "posso mostrare/inviare WhatsApp?" e
   costruisce il link wa.me. Tutti gli altri componenti (PhStr, Agenda, Piani,
   SchedaPaz, PdfView, Dashboard) devono passare da qui invece di reimplementare
   la logica — così un domani, se cambia la regola di attivazione, si cambia
   in un solo posto e non si rischia di dimenticarne uno.
*/

// Vera fonte di verità: la funzione è disponibile?
export const waAbilitato = (features) => features?.whatsapp !== false;

// Costruisce l'URL wa.me pulito (numero + testo opzionale)
export const waUrl = (tel, testo) => {
  if (!tel) return null;
  const d = String(tel).replace(/\D/g, '');
  if (!d) return null;
  return `https://wa.me/39${d}${testo ? '?text=' + encodeURIComponent(testo) : ''}`;
};

// Apre WhatsApp direttamente (per i casi "invia subito", es. reminder rapido)
export const apriWaDiretto = (tel, testo) => {
  const url = waUrl(tel, testo);
  if (url) window.open(url, '_blank');
};

/* ── BOTTONE PRONTO ──
   variant: 'full' (bottone con label, es. "Apri WhatsApp"), 'icon' (solo icona
   tonda, per liste/celle strette), 'chip' (piccola pillola, es. "WA" in agenda)
   Se features.whatsapp === false, o manca il telefono, non renderizza nulla. */
export default function WaAction({ tel, testo, features, variant = 'full', label = 'WhatsApp', onClick, style }) {
  if (!waAbilitato(features)) return null;
  if (!tel && !onClick) return null;

  const handleClick = (e) => {
    e?.stopPropagation?.();
    if (onClick) { onClick(e); return; } // il chiamante gestisce l'apertura (es. apre un modale per modificare il testo prima)
    apriWaDiretto(tel, testo);
  };

  if (variant === 'chip') {
    return (
      <button onClick={handleClick} style={{ background: '#25D366', border: 'none', borderRadius: 4, padding: '1px 4px', cursor: 'pointer', fontSize: 9, color: '#fff', fontWeight: 700, ...style }}>
        WA
      </button>
    );
  }

  if (variant === 'icon') {
    return (
      <button onClick={handleClick} style={{ background: '#25D366', border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', display: 'flex', ...style }}>
        <Ic n="wa" s={13} c="#fff" />
      </button>
    );
  }

  // variant 'full'
  return (
    <button onClick={handleClick} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, background: '#E6F9EE', borderRadius: 9, padding: '9px', border: 'none', color: '#128C7E', fontWeight: 700, fontSize: 12, cursor: 'pointer', ...style }}>
      <Ic n="wa" s={13} c="#128C7E" />{label}
    </button>
  );
}
