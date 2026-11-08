// Synthetic-only fixture: no real authentication, archive, document or model calls.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { GestorePdf } from '../../personal/src/pdf/GestorePdf.jsx';
window.pdfTest = { shares: [], archived: null, closed: false };
Object.defineProperty(navigator, 'canShare', { configurable: true, value: ({ files }) => files?.[0]?.type === 'application/pdf' });
Object.defineProperty(navigator, 'share', { configurable: true, value: async ({ files }) => { window.pdfTest.shares.push({ name: files[0].name, bytes: Array.from(new Uint8Array(await files[0].arrayBuffer())) }); } });
createRoot(document.getElementById('root')).render(<React.StrictMode><GestorePdf onClose={() => { window.pdfTest.closed = true; }} onArchive={async file => { window.pdfTest.archived = Array.from(new Uint8Array(await file.arrayBuffer())); }} /></React.StrictMode>);
