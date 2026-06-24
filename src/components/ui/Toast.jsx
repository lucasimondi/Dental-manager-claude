import React, { useEffect } from 'react';
import { C } from '../../lib/utils';

export default function Toast({ msg, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, []);
  return (
    <div style={{
      position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)', background: C.priD,
      color: '#fff', padding: '9px 20px', borderRadius: 28, fontSize: 13, fontWeight: 700,
      zIndex: 3000, whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
    }}>
      {msg}
    </div>
  );
}
