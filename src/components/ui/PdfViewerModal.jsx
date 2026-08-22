import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
// Usiamo esplicitamente la build "legacy" di pdf.js: la build standard usa
// feature JS moderne non pienamente compatibili con Safari iOS meno recenti
// (è la stessa raccomandazione ufficiale della libreria per compatibilità
// mobile estesa) — è la causa più probabile per cui l'anteprima falliva
// silenziosamente su iPhone.
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.js?url';
import { C } from '../../lib/utils';
import Ic from './Ic.jsx';
import Btn from './Btn.jsx';
import { condividiPdf, scaricaPdf } from '../../lib/condivisionePdf';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Converte un data URL "data:application/pdf;...;base64,XXXX" in bytes
// grezzi, il formato che pdf.js si aspetta per aprire il documento.
function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

/**
 * Visualizzatore PDF a schermo intero, ottimizzato per mobile (iPhone e
 * Android). Non usa il viewer PDF nativo del browser in un <iframe>: quello
 * approccio, su Safari iOS in particolare, ignora i parametri di zoom/fit
 * nell'URL e mostra il documento alla sua dimensione nativa, costringendo
 * a scrollare sia in verticale che in orizzontale per vederlo tutto.
 *
 * Qui invece ogni pagina viene disegnata su un <canvas> con pdf.js,
 * calcolando noi stessi la scala in base alla larghezza reale dello
 * schermo — così il contenuto è sempre leggibile per intero in larghezza,
 * con solo lo scroll verticale naturale tra una pagina e l'altra (identico
 * comportamento su iOS e Android, perché non dipendiamo dal renderer PDF
 * nativo di nessuno dei due sistemi).
 */
export default function PdfViewerModal({ titolo, dataUrl, filename, onClose }) {
  const [errore, setErrore] = useState(false);
  const [erroreDettaglio, setErroreDettaglio] = useState('');
  const [caricamento, setCaricamento] = useState(true);
  const scrollAreaRef = useRef(null); // contenitore scrollabile, sempre visibile — usato per misurare la larghezza reale
  const containerRef = useRef(null); // dove vengono appesi i canvas delle pagine
  const pdfDocRef = useRef(null);

  useEffect(() => {
    let annullato = false;

    const renderizzaTutto = async () => {
      setCaricamento(true);
      setErrore(false);
      setErroreDettaglio('');
      try {
        const bytes = dataUrlToBytes(dataUrl);
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        if (annullato) return;
        pdfDocRef.current = pdf;

        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = '';

        // Larghezza disponibile reale, misurata dal contenitore scrollabile
        // SEMPRE VISIBILE (non da quello dove appendiamo i canvas, che resta
        // display:none finché il caricamento non finisce — misurarla lì
        // darebbe sempre 0, producendo canvas invisibili senza alcun errore).
        // Un padding orizzontale di 16px totali (8px per lato, vedi stile del
        // contenitore) va sottratto per non far traboccare il canvas.
        const larghezzaDisponibile = Math.max(1, (scrollAreaRef.current?.clientWidth || window.innerWidth) - 16);

        for (let numPagina = 1; numPagina <= pdf.numPages; numPagina++) {
          if (annullato) return;
          const pagina = await pdf.getPage(numPagina);
          const viewportBase = pagina.getViewport({ scale: 1 });
          const scala = larghezzaDisponibile / viewportBase.width;
          const viewport = pagina.getViewport({ scale: scala });

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          canvas.style.display = 'block';
          canvas.style.marginBottom = pdf.numPages > 1 ? '10px' : '0';
          canvas.style.boxShadow = '0 1px 4px rgba(0,0,0,0.25)';
          container.appendChild(canvas);

          const ctx = canvas.getContext('2d');
          await pagina.render({ canvasContext: ctx, viewport }).promise;
        }
      } catch (err) {
        console.error('PdfViewerModal — errore rendering PDF:', err);
        if (!annullato) {
          setErroreDettaglio(`${err?.name || 'Errore'}: ${err?.message || String(err)}`);
          setErrore(true);
        }
      } finally {
        if (!annullato) setCaricamento(false);
      }
    };

    renderizzaTutto();
    return () => { annullato = true; };
  }, [dataUrl]);

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${C.brd}`, background: C.sur, flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 14.5, color: C.txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titolo}</span>
        <button onClick={onClose} aria-label="Chiudi anteprima documento" style={{ width: 44, height: 44, background: 'none', border: 'none', borderRadius: 10, cursor: 'pointer', padding: 0, color: C.txl, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
          <Ic n="x" s={20} />
        </button>
      </div>

      <div ref={scrollAreaRef} style={{ flex: 1, minHeight: 0, background: '#525659', overflowY: 'auto', overflowX: 'hidden', padding: '10px 8px' }}>
        {errore && (
          <div style={{ color: '#fff', fontSize: 13, padding: 20, textAlign: 'center' }}>
            <div>Impossibile visualizzare l'anteprima. Usa Scarica qui sotto.</div>
            {erroreDettaglio && (
              <div style={{ marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.6)', userSelect: 'text', WebkitUserSelect: 'text', wordBreak: 'break-word', background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: 10, textAlign: 'left' }}>
                {erroreDettaglio}
              </div>
            )}
          </div>
        )}
        {caricamento && !errore && <div style={{ color: '#fff', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>Caricamento…</div>}
        <div ref={containerRef} style={{ display: caricamento || errore ? 'none' : 'block' }} />
      </div>

      <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: `1px solid ${C.brd}`, background: C.sur, flexShrink: 0, paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <Btn
          ch="Condividi"
          ic="send"
          onClick={async () => {
            const ok = await condividiPdf(dataUrl, filename);
            if (!ok) scaricaPdf(dataUrl, filename);
          }}
          full
        />
        <Btn ch="Scarica" ic="download" v="sec" onClick={() => scaricaPdf(dataUrl, filename)} full />
      </div>
    </div>,
    document.body
  );
}
