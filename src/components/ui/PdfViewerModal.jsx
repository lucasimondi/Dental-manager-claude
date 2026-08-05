import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { C } from '../../lib/utils';
import Ic from './Ic.jsx';
import Btn from './Btn.jsx';
import { condividiPdf, scaricaPdf } from '../../lib/condivisionePdf';

// Converte un data URL "data:application/pdf;...;base64,XXXX" in un Blob
// vero. Safari iOS (e alcuni Android) non renderizzano in modo affidabile
// un PDF passato come data: URI diretto dentro un <iframe> — restano vuoti
// o mostrano errore silenzioso. Un Blob URL (object URL) invece funziona
// sempre, su tutte le piattaforme.
function dataUrlToBlobUrl(dataUrl) {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/^data:([^;]+)/);
  const mime = mimeMatch?.[1] || 'application/pdf';
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  return URL.createObjectURL(blob);
}

/**
 * Visualizzatore PDF a schermo intero per un documento già generato/
 * archiviato: mostra il contenuto vero (non solo il nome) tramite iframe
 * con un Blob URL — l'unico formato che Safari iOS renderizza in modo
 * affidabile per PDF in iframe — con Condividi e Scarica sotto per chi,
 * dopo averlo guardato, vuole inviarlo.
 */
export default function PdfViewerModal({ titolo, dataUrl, filename, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [errore, setErrore] = useState(false);

  useEffect(() => {
    try {
      const url = dataUrlToBlobUrl(dataUrl);
      setBlobUrl(url);
      return () => URL.revokeObjectURL(url);
    } catch {
      setErrore(true);
    }
  }, [dataUrl]);

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${C.brd}`, background: C.sur, flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 14.5, color: C.txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titolo}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: C.txl, flexShrink: 0 }}>
          <Ic n="x" s={20} />
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, background: '#525659', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {errore && <div style={{ color: '#fff', fontSize: 13, padding: 20, textAlign: 'center' }}>Impossibile visualizzare l'anteprima. Usa Scarica qui sotto.</div>}
        {!errore && !blobUrl && <div style={{ color: '#fff', fontSize: 13 }}>Caricamento…</div>}
        {!errore && blobUrl && (
          <iframe
            src={blobUrl}
            title={titolo}
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        )}
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
