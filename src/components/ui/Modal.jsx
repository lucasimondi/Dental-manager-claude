import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import Ic from './Ic.jsx';
import { C } from '../../lib/utils';

export default function Modal({ title, icon, iconColor, onClose, children, wide }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  return ReactDOM.createPortal(
    <div
      className="pol-modal-backdrop"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(10,20,40,0.55)', zIndex: 9999,
        display: 'flex', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="pol-modal-sheet" style={{
        background: C.sur, width: '100%',
        maxWidth: wide ? 700 : 480, maxHeight: '92vh', overflowY: 'auto',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px',
          borderBottom: `1px solid ${C.brd}`, position: 'sticky', top: 0, background: C.sur, zIndex: 1,
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15, color: C.txt, minWidth: 0 }}>
            {icon && <Ic n={icon} s={16} c={iconColor || C.pri} />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
          </span>
          <button onClick={onClose} className="pol-icon-btn" aria-label="Chiudi" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 8, color: C.txl, flexShrink: 0 }}>
            <Ic n="x" s={20} />
          </button>
        </div>
        <div style={{ padding: 18 }}>{children}</div>
        <div style={{ height: 'env(safe-area-inset-bottom,12px)' }} />
      </div>
    </div>,
    document.body
  );
}
