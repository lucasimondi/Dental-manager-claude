import React from 'react';
import ReactDOM from 'react-dom';
import { C } from '../../lib/utils';
import Ic from './Ic.jsx';
import Btn from './Btn.jsx';
import { condividiPdf, scaricaPdf } from '../../lib/condivisionePdf';

/**
 * Visualizzatore PDF a schermo intero per un documento già generato/
 * archiviato: mostra il contenuto vero (non solo il nome) tramite iframe
 * — i browser mobile moderni (Safari iOS, Chrome Android) renderizzano
 * nativamente i PDF passati come data URL in un iframe — con Condividi e
 * Scarica sotto per chi, dopo averlo guardato, vuole inviarlo.
 */
export default function PdfViewerModal({ titolo, dataUrl, filename, onClose }) {
  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${C.brd}`, background: C.sur, flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 14.5, color: C.txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titolo}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: C.txl, flexShrink: 0 }}>
          <Ic n="x" s={20} />
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, background: '#525659' }}>
        <iframe
          src={dataUrl}
          title={titolo}
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: `1px solid ${C.brd}`, background: C.sur, flexShrink: 0, paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <Btn
          ch="📤 Condividi"
          onClick={async () => {
            const ok = await condividiPdf(dataUrl, filename);
            if (!ok) scaricaPdf(dataUrl, filename);
          }}
          full
        />
        <Btn ch="💾 Scarica" v="sec" onClick={() => scaricaPdf(dataUrl, filename)} full />
      </div>
    </div>,
    document.body
  );
}
