import React, { useRef, useState } from 'react';
import { quotePdfFile, quoteJpgFiles, shareQuoteFiles, downloadQuoteFiles } from '../lib/quoteFiles.js';
import './Preventivi.css';

// First tap persists/prepares. Second tap opens the native file share sheet
// synchronously, never after a network request or a JPG rendering await.
export default function QuoteDeliveryActions({ prepare, disabled = false, onPreview, onBusyChange }) {
  const [ready, setReady] = useState(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const locked = useRef(false), documentRef = useRef(null);
  const action = async format => {
    if (locked.current || disabled) return;
    locked.current = true; setBusy(true); onBusyChange?.(true); setMessage('');
    try {
      if (ready?.format === format) {
        const outcome = await shareQuoteFiles(ready.files);
        if (outcome === 'unsupported') { downloadQuoteFiles(ready.files); setMessage('File scaricato. Allegalo nella chat del paziente.'); }
        else setMessage(outcome === 'cancelled' ? 'Condivisione annullata. Il preventivo resta salvato.' : 'File condiviso. L’invio al destinatario si completa nell’app scelta.');
      } else {
        const pdf = documentRef.current || await prepare();
        if (!pdf) return;
        documentRef.current = pdf;
        const files = format === 'pdf' ? [quotePdfFile(pdf)] : await quoteJpgFiles(pdf);
        setReady({ format, files });
        setMessage(`Salvato nei Preventivi. ${files.length > 1 ? `${files.length} pagine JPG pronte` : `${format.toUpperCase()} pronto`}: tocca Condividi e scegli WhatsApp o un’altra app.`);
      }
    } catch (error) { setMessage(error.message || 'Operazione non riuscita. Riprova.'); }
    finally { locked.current = false; setBusy(false); onBusyChange?.(false); }
  };
  return <div className="quote-delivery">
    <div className="quote-delivery-buttons">
      <button type="button" disabled={disabled || busy} onClick={() => action('pdf')}>{busy ? 'Preparazione…' : ready?.format === 'pdf' ? 'Condividi PDF' : 'Invia PDF'}</button>
      <button type="button" disabled={disabled || busy} onClick={() => action('jpg')}>{ready?.format === 'jpg' ? 'Condividi JPG' : 'Invia JPG'}</button>
    </div>
    {ready && <div className="quote-delivery-secondary"><button type="button" disabled={busy} onClick={() => downloadQuoteFiles(ready.files)}>Scarica {ready.format.toUpperCase()}</button>{onPreview && <button type="button" disabled={busy} onClick={() => onPreview(documentRef.current)}>Anteprima</button>}</div>}
    <p className="quote-delivery-status" role="status" aria-live="polite">{message || 'Salva e prepara il file · poi condividi al paziente'}</p>
  </div>;
}
