import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import Ic from './Ic.jsx';
import { C } from '../../lib/utils';

// POL-UI-030: `backdropClassName`/`sheetClassName`/`backdropStyle` are
// opt-in escape hatches (default to nothing, zero effect on every existing
// caller) for the rare case where ONE specific modal instance needs real,
// measured clearance from something that floats independently over the
// page behind it — e.g. Agenda's own floating month/week-strip controls,
// which the generic "sheet"/"standard" mobile variants know nothing about.
// Mirrors the same technique already used for Agenda's own appointment
// context menu (agenda-appointment-menu-backdrop/-sheet in
// PremiumVisualSystem.css), just made reusable instead of that menu
// building its own one-off backdrop/sheet markup.
// Page scroll lock shared by every open Modal. Each Modal used to save and
// restore `body.style.overflow` on its own: with two modals open (e.g. the PDF
// over a form) closed in the other order, the last one put back "hidden" and
// the page stayed frozen until the app was restarted (PO 2026-10-17). Now the
// page is locked while at least one Modal is open and always released after
// the last one closes.
let openModals = 0;
let overflowBeforeLock = '';
export function lockPageScroll() {
  if (openModals === 0) overflowBeforeLock = document.body.style.overflow === 'hidden' ? '' : document.body.style.overflow;
  openModals += 1;
  document.body.style.overflow = 'hidden';
  let released = false;
  return () => {
    if (released) return;
    released = true;
    openModals = Math.max(0, openModals - 1);
    if (openModals === 0) document.body.style.overflow = overflowBeforeLock;
  };
}

export default function Modal({ title, icon, iconColor, onClose, children, wide, mobileVariant = 'standard', footer, backdropClassName = '', sheetClassName = '', backdropStyle }) {
  useEffect(() => lockPageScroll(), []);

  return ReactDOM.createPortal(
    <div
      className={`pol-modal-backdrop${backdropClassName ? ` ${backdropClassName}` : ''}`}
      role="presentation"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(10,20,40,0.55)', zIndex: 9999,
        display: 'flex', justifyContent: 'center', ...backdropStyle,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`pol-modal-sheet${sheetClassName ? ` ${sheetClassName}` : ''}`} data-mobile-variant={mobileVariant} role="dialog" aria-modal="true" aria-label={title} style={{
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
