import React from 'react';
import Ic from './Ic.jsx';

/* ── VARIANTI STILE DOCK ──
   Ogni voce NAV supportata offre lo stesso simbolo in tre trattamenti visivi,
   così il dock può essere personalizzato senza dover ridisegnare le icone:
   - outline: identico allo stile Ic esistente, lineare e neutro
   - filled:  forma piena monocolore, più "app icon" classica
   - vivid:   duotone con blob sfumato + glifo bianco — lo stile "pro/disruptive" */

const DOCK_GLYPHS = {
  home: {
    outline: (s, c) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>),
    filled: (s, c) => (<svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M12 2.1 1.5 10.6a1 1 0 0 0 .63 1.78H4v9.12A1.5 1.5 0 0 0 5.5 23H9.4a1.5 1.5 0 0 0 1.5-1.5V16a1.1 1.1 0 0 1 1.1-1.1h0a1.1 1.1 0 0 1 1.1 1.1v5.5a1.5 1.5 0 0 0 1.5 1.5h3.9A1.5 1.5 0 0 0 20 21.5v-9.12h1.87a1 1 0 0 0 .63-1.78z" /></svg>),
  },
  pz: {
    outline: (s, c) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>),
    filled: (s, c) => (<svg width={s} height={s} viewBox="0 0 24 24" fill={c}><circle cx="9" cy="7" r="4.3" /><path d="M9 13c-4.4 0-8 2.6-8 6.3V21a1.2 1.2 0 0 0 1.2 1.2h13.6A1.2 1.2 0 0 0 17 21v-1.7c0-3.7-3.6-6.3-8-6.3z" /></svg>),
  },
  plan: {
    outline: (s, c) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>),
    filled: (s, c) => (<svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.83a2 2 0 0 0-.59-1.41l-4.83-4.83A2 2 0 0 0 13.17 2z" /></svg>),
  },
  pay: {
    outline: (s, c) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>),
    filled: (s, c) => (<svg width={s} height={s} viewBox="0 0 24 24" fill={c}><rect x="1" y="4" width="22" height="16" rx="2.5" /></svg>),
  },
  list: {
    outline: (s, c) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>),
    filled: (s, c) => (<svg width={s} height={s} viewBox="0 0 24 24" fill={c}><circle cx="3.5" cy="6" r="1.8" /><circle cx="3.5" cy="12" r="1.8" /><circle cx="3.5" cy="18" r="1.8" /><rect x="8" y="4.8" width="14" height="2.4" rx="1.2" /><rect x="8" y="10.8" width="14" height="2.4" rx="1.2" /><rect x="8" y="16.8" width="14" height="2.4" rx="1.2" /></svg>),
  },
  cal: {
    outline: (s, c) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>),
    filled: (s, c) => (<svg width={s} height={s} viewBox="0 0 24 24" fill={c}><rect x="3" y="4" width="18" height="18" rx="2.5" /><rect x="3" y="4" width="18" height="6" rx="2.5" fill="white" opacity="0.28" /></svg>),
  },
  spe: {
    outline: (s, c) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>),
    filled: (s, c) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.6" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>),
  },
  wa: {
    outline: (s, c) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>),
    filled: (s, c) => (<svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>),
  },
  set: {
    outline: (s, c) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>),
    filled: (s, c) => (<svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /><circle cx="12" cy="12" r="3.4" fill="white" /></svg>),
  },
};

// Sfondo "goccia" sfumato usato dallo stile vivid: ogni icona vivid condivide
// la stessa forma di blob (firma visiva comune), cambia solo il gradiente + il glifo interno.
function VividBlob({ s, gradId, cA, cB, children }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={cA} />
          <stop offset="100%" stopColor={cB} />
        </linearGradient>
      </defs>
      <path d="M12 1.5c4.5 0 8.5 2.6 10 6.8 1.1 3-.1 5.7-2.3 8-2.4 2.5-4.8 5.2-8.2 5.2-3.6 0-6.7-2.5-8.9-5.4C.5 13.6-.6 10.6.9 7.7 2.6 4.4 7 1.5 12 1.5z" fill={`url(#${gradId})`} />
      <g transform="translate(4.4 4.4) scale(0.633)">{children}</g>
    </svg>
  );
}

const DOCK_VIVID = {
  home: (s) => (<VividBlob s={s} gradId="dmgh" cA="#3E9AF0" cB="#185FA5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22v-10h6v10" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" /></VividBlob>),
  pz: (s) => (<VividBlob s={s} gradId="dmpz" cA="#7C6CF0" cB="#3C3489"><circle cx="12" cy="8" r="4" fill="none" stroke="#fff" strokeWidth="2.1" /><path d="M4 21v-1a8 8 0 0 1 16 0v1" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" /></VividBlob>),
  plan: (s) => (<VividBlob s={s} gradId="dmpl" cA="#4FCB93" cB="#0F6E56"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" /><line x1="8" y1="13" x2="16" y2="13" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /><line x1="8" y1="17" x2="16" y2="17" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /></VividBlob>),
  pay: (s) => (<VividBlob s={s} gradId="dmpy" cA="#4BC98A" cB="#0F6E56"><rect x="1" y="4" width="22" height="16" rx="3" fill="none" stroke="#fff" strokeWidth="2.1" /><line x1="1" y1="10" x2="23" y2="10" stroke="#fff" strokeWidth="2.1" /></VividBlob>),
  list: (s) => (<VividBlob s={s} gradId="dmls" cA="#F0A15C" cB="#854F0B"><line x1="8" y1="6" x2="21" y2="6" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" /><line x1="8" y1="12" x2="21" y2="12" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" /><line x1="8" y1="18" x2="21" y2="18" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" /><circle cx="3.3" cy="6" r="1.4" fill="#fff" /><circle cx="3.3" cy="12" r="1.4" fill="#fff" /><circle cx="3.3" cy="18" r="1.4" fill="#fff" /></VividBlob>),
  cal: (s) => (<VividBlob s={s} gradId="dmca" cA="#3E9AF0" cB="#0C447C"><rect x="3" y="4" width="18" height="18" rx="3" fill="none" stroke="#fff" strokeWidth="2.1" /><line x1="16" y1="2" x2="16" y2="6" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" /><line x1="8" y1="2" x2="8" y2="6" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" /><line x1="3" y1="10" x2="21" y2="10" stroke="#fff" strokeWidth="2.1" /></VividBlob>),
  spe: (s) => (<VividBlob s={s} gradId="dmsp" cA="#F0A15C" cB="#854F0B"><line x1="12" y1="1" x2="12" y2="23" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" /></VividBlob>),
  wa: (s) => (<VividBlob s={s} gradId="dmwa" cA="#3DDC84" cB="#0F6E56"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" fill="#fff" /></VividBlob>),
  set: (s) => (<VividBlob s={s} gradId="dmse" cA="#9A93EE" cB="#3C3489"><circle cx="12" cy="12" r="3.3" fill="none" stroke="#fff" strokeWidth="2.1" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" /></VividBlob>),
};

/**
 * Icona del dock personalizzabile in tre stili:
 * - 'outline' (lineare, colore singolo — stile Ic classico)
 * - 'filled'  (forma piena monocolore)
 * - 'vivid'   (duotone: blob sfumato + glifo bianco — lo stile "pro/disruptive")
 * Per 'vivid' il colore passato viene ignorato: il gradiente è predefinito per icona.
 */
export default function DockIc(props) {
  const n = props.n;
  const st = props.style || 'outline';
  const size = props.s || 22;
  const color = props.c || 'currentColor';
  if (st === 'vivid') {
    const render = DOCK_VIVID[n];
    return render ? render(size) : <Ic n={n} s={size} c={color} />;
  }
  const set = DOCK_GLYPHS[n];
  const render = (set && set[st]) || (set && set.outline);
  if (render) return render(size, color);
  return <Ic n={n} s={size} c={color} />;
}

export const DOCK_ICON_STYLES = [
  { id: 'outline', label: 'Outline' },
  { id: 'filled', label: 'Pieno' },
  { id: 'vivid', label: 'Vivid' },
];
