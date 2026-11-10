// Synthetic-only fixture (MIA-SALUTE): scan with crop → PDF, and photos + PDF merged into one PDF.
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../personal/src/personal.css';
import '../../personal/src/pro.css';
import { PaginaScansione } from '../../personal/src/Aggiungi.jsx';
import { unisciInPdf } from '../../personal/src/lib/pdfUnico.js';
window.saluteTest = { pagina: null, messaggi: [], unisciInPdf, condivisi: [] };
Object.defineProperty(navigator, 'canShare', { configurable: true, value: ({ files }) => !!files?.length });
Object.defineProperty(navigator, 'share', { configurable: true, value: async ({ files }) => { window.saluteTest.condivisi.push(files.map((f) => f.name)); } });
const ctx = { mostra: (m) => window.saluteTest.messaggi.push(m) };
createRoot(document.getElementById('root')).render(<div className="pp-app" style={{ padding: 16 }}><PaginaScansione ctx={ctx} opzioni={{ salute: true, persona: 'Persona Test' }} sostituisci={async (p) => { window.saluteTest.pagina = { tipo: p.tipo, opzioni: p.opzioni, nome: p.file.name, bytes: Array.from(new Uint8Array(await p.file.arrayBuffer())) }; }} /></div>);
