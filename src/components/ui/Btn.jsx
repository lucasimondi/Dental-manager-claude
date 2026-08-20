import React from 'react';
import Ic from './Ic.jsx';
import { C } from '../../lib/utils';

export default function Btn({ ch, onClick, v = 'pri', sz = 'md', ic, dis, full }) {
  const VS = {
    pri: { bg: C.pri, co: '#fff' },
    sec: { bg: C.sur, co: C.pri, bo: `1.5px solid ${C.brd}` },
    dan: { bg: C.dan, co: '#fff' },
    gho: { bg: 'transparent', co: C.txm },
    wa: { bg: '#25D366', co: '#fff' },
    acc: { bg: C.acc, co: '#fff' },
    pur: { bg: C.pur, co: '#fff' },
    war: { bg: C.war, co: '#fff' },
  };
  const SZ = { sm: { p: '6px 11px', fs: 12 }, md: { p: '10px 17px', fs: 14 }, lg: { p: '13px 22px', fs: 15 } };
  const vs = VS[v] || VS.pri;
  const ss = SZ[sz] || SZ.md;
  return (
    <button
      onClick={onClick}
      disabled={dis}
      style={{
        background: vs.bg, color: vs.co, border: vs.bo || 'none', padding: ss.p, fontSize: ss.fs,
        borderRadius: 11, cursor: dis ? 'not-allowed' : 'pointer', fontWeight: 700,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        opacity: dis ? 0.5 : 1, width: full ? '100%' : 'auto', minHeight: sz === 'sm' ? 32 : 44,
        boxShadow: v === 'sec' || v === 'gho' ? 'none' : '0 8px 18px -6px rgba(24,95,165,.35)',
        transition: 'transform .16s ease, box-shadow .16s ease',
      }}
    >
      {ic && <Ic n={ic} s={sz === 'sm' ? 12 : 14} c="currentColor" />}
      {ch}
    </button>
  );
}
