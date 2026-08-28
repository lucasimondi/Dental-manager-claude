import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import Ic from './Ic.jsx';
import { C } from '../../lib/utils';

export default function Modal({ title, icon, iconColor, onClose, children, wide, mobileVariant = 'standard', footer }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  return ReactDOM.createPortal(
    <div
      className="pol-modal-backdrop"
      role="presentation"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(10,20,40,0.55)', zIndex: 9999,
        display: 'flex', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="pol-modal-sheet" data-mobile-variant={mobileVariant} role="dialog" aria-modal="true" aria-label={title} style={{
        background: C.sur, width: '100%',
        maxWidth: wide ? 700 : 480, maxHeight: 'min(92vh, 92dvh)',
      }}>
        <div className="pol-modal-header" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px',
          borderBottom: `1px solid ${C.brd}`, position: 'sticky', top: 0, background: C.sur, zIndex: 1,
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15, color: C.txt, minWidth: 0 }}>
            {icon && <Ic n={icon} s={16} c={iconColor || C.pri} />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
          </span>
          <button onClick={onClose} className="pol-icon-btn" aria-label="Chiudi" style={{ width: 44, height: 44, background: 'none', border: 'none', cursor: 'pointer', padding: 0, borderRadius: 10, color: C.txl, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
            <Ic n="x" s={20} />
          </button>
        </div>
        <div className="pol-modal-content" style={{ padding: 18 }}>{children}</div>
        {footer ? <div className="pol-modal-footer">{footer}</div> : <div style={{ height: 'env(safe-area-inset-bottom,12px)', flexShrink: 0 }} />}
      </div>
    </div>,
    document.body
  );
}
