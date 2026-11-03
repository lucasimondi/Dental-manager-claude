import React, { Suspense, lazy, useRef, useState } from 'react';
import QuoteDeliveryActions from './QuoteDeliveryActions.jsx';
import { archivePreventivo, quoteRequestId } from '../lib/preventivi.js';
import { supabase } from '../lib/supabase.js';
import Ic from './ui/Ic.jsx';
import { totaliPreventivo, numeroPreventivo, euroIt } from '../lib/documenti/preventivoPdf.js';

const PdfViewerModal = lazy(() => import('./ui/PdfViewerModal.jsx'));

export default function PdfView({ pl, paz, si, features, onClose, documentClient = supabase, zIndex = 3000 }) {
  const isDentistico = !si?.vertical || si.vertical === 'dentistico';
  const { subtotale: sub, sconto: sc, scontato, totale: tot } = totaliPreventivo(pl);
  const fmtE = euroIt;

  const archiveId = useRef(quoteRequestId());
  const prepare = () => archivePreventivo(documentClient, { id: archiveId.current, piano: pl, paziente: paz, si });

  // Il PDF si apre DENTRO l'app (PdfViewerModal, con Chiudi, Condividi e
  // Scarica): mai più una finestra nuova, da cui sull'app installata
  // dell'iPhone non si torna alla scheda del paziente.
  const [pdf, setPdf] = useState(null);
  const [pdfMsg, setPdfMsg] = useState(null);

  const apriPdf = async () => {
    setPdfMsg(null);
    try {
      setPdf(await prepare());
    } catch (err) {
      console.error('Errore PDF:', err);
      setPdfMsg({ type: 'error', text: 'Errore nella generazione del PDF: ' + (err && err.message ? err.message : String(err)) });
    }
  };

  const nome = [paz?.nome, paz?.cognome].filter(Boolean).join(' ');
  const datiPaziente = [paz?.cf && `C.F. ${String(paz.cf).toUpperCase()}`, paz?.dataNascita && `Nato/a il ${new Date(paz.dataNascita + 'T12:00').toLocaleDateString('it-IT')}`, paz?.indirizzo].filter(Boolean);
  const etichetta = { fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#718096' };
  const riquadro = { flex: '1 1 200px', minWidth: 0, background: '#F6F9FC', borderLeft: '3px solid #4A90C4', padding: '10px 12px' };
  const cella = { padding: '9px 8px', borderBottom: '1px solid #D6DEE8', fontSize: 12, verticalAlign: 'top' };
  const testa = { background: '#1A4E66', color: '#fff', padding: '8px', textAlign: 'left', fontSize: 10, letterSpacing: '.04em', textTransform: 'uppercase' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex, background: '#C8D4E0', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#124E66', padding: '10px 14px', paddingTop: 'max(10px, env(safe-area-inset-top))', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={onClose} aria-label="Torna alla scheda" style={{ minHeight: 44, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: '8px 12px', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}><Ic n="back" s={15} c="#fff" />Indietro</button>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 14, flex: 1, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Preventivo{nome ? ` · ${nome}` : ''}</span>
        <span style={{ width: 44, flexShrink: 0 }} aria-hidden="true" />
      </div>

      <div style={{ background: '#fff', padding: '10px 16px', flexShrink: 0, borderBottom: '1px solid #dce6ee' }}>
        <QuoteDeliveryActions prepare={prepare} onPreview={setPdf} />
        <button type="button" onClick={apriPdf} style={{ border: 0, background: 'none', color: '#245b80', minHeight: 36, cursor: 'pointer' }}>Anteprima senza inviare</button>
      </div>

      {pdfMsg && (
        <div style={{ background: pdfMsg.type === 'error' ? '#FDECEA' : '#E8F7EE', borderBottom: `2px solid ${pdfMsg.type === 'error' ? '#E63946' : '#2D9E61'}`, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 8, flexShrink: 0 }}>
          <Ic n={pdfMsg.type === 'error' ? 'warn' : 'help'} s={15} c={pdfMsg.type === 'error' ? '#C53030' : '#236B45'} />
          <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: pdfMsg.type === 'error' ? '#C53030' : '#236B45', lineHeight: 1.4 }}>{pdfMsg.text}</span>
          <button onClick={() => setPdfMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0, color: pdfMsg.type === 'error' ? '#C53030' : '#236B45', display: 'flex' }}><Ic n="x" s={13} c={pdfMsg.type === 'error' ? '#C53030' : '#236B45'} /></button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 10px 40px', paddingBottom: 'max(40px, env(safe-area-inset-bottom))' }}>
        <div style={{ background: '#fff', maxWidth: 680, margin: '0 auto', boxShadow: '0 4px 24px rgba(0,0,0,0.15)', borderRadius: 4, padding: '28px 22px', fontFamily: 'Helvetica,Arial,sans-serif', color: '#1A202C' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontStyle: 'italic', fontWeight: 'bold', color: '#1A4E66' }}>{si.nome || 'Studio'}</div>
            {si.spec && <div style={{ fontSize: 11, color: '#4A90C4', marginTop: 3 }}>{si.spec}</div>}
            {si.iscr && <div style={{ fontSize: 10, color: '#4A90C4', marginTop: 2 }}>{si.iscr}</div>}
            <div style={{ fontSize: 10, color: '#4A5568', marginTop: 6 }}>{[si.tel && `Tel. ${si.tel}`, si.email, si.piva && `P.IVA ${si.piva}`].filter(Boolean).join('  ·  ')}</div>
          </div>
          <div style={{ borderTop: '2px solid #1A4E66', margin: '12px 0 16px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '.14em' }}>PREVENTIVO</span>
            <span style={{ fontSize: 11, color: '#718096', textAlign: 'right', lineHeight: 1.5 }}>N° {numeroPreventivo(pl)}<br />Data {new Date().toLocaleDateString('it-IT')}</span>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
            <div style={riquadro}>
              <div style={etichetta}>Paziente</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>{nome || '—'}</div>
              {datiPaziente.map((riga) => <div key={riga} style={{ fontSize: 11, color: '#4A5568', marginTop: 3, overflowWrap: 'anywhere' }}>{riga}</div>)}
            </div>
            <div style={riquadro}>
              <div style={etichetta}>Piano di cura</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, overflowWrap: 'anywhere' }}>{pl.titolo || 'Piano di cura'}</div>
              <div style={{ fontSize: 11, color: '#4A5568', marginTop: 3 }}>{pl.voci.length} {pl.voci.length === 1 ? 'prestazione' : 'prestazioni'}</div>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={{ ...testa, width: 22 }}>#</th>
                <th style={testa}>Prestazione</th>
                {isDentistico && <th style={{ ...testa, width: 46 }}>Dente</th>}
                <th style={{ ...testa, width: 74 }}>Stato</th>
                <th style={{ ...testa, width: 80, textAlign: 'right' }}>Importo</th>
              </tr></thead>
              <tbody>
                {pl.voci.map((v, i) => (
                  <tr key={i} style={{ background: i % 2 ? '#F6F9FC' : '#fff' }}>
                    <td style={{ ...cella, color: '#718096' }}>{i + 1}</td>
                    <td style={{ ...cella, overflowWrap: 'anywhere' }}>{v.prestazione}</td>
                    {isDentistico && <td style={cella}>{v.dente || '—'}</td>}
                    <td style={{ ...cella, fontSize: 10, fontWeight: 700, color: v.eseguita ? '#2D9E61' : '#E08040' }}>{v.eseguita ? 'Eseguita' : 'Da eseguire'}</td>
                    <td style={{ ...cella, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtE(v.prezzo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginLeft: 'auto', maxWidth: 300, marginTop: 14 }}>
            {scontato > 0 && <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#4A5568', padding: '3px 10px' }}><span>Subtotale</span><span>{fmtE(sub)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#2D9E61', padding: '3px 10px' }}><span>Sconto{pl.scontoTipo === 'pct' ? ` ${sc}%` : ''}</span><span>- {fmtE(scontato)}</span></div>
            </>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1A4E66', color: '#fff', padding: '10px 12px', marginTop: 4 }}><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em' }}>TOTALE</span><span style={{ fontSize: 17, fontWeight: 800 }}>{fmtE(tot)}</span></div>
          </div>
          <div style={{ marginTop: 28, fontSize: 11, color: '#718096' }}>{si.firma_b64 && <img src={si.firma_b64} alt="Firma del medico" style={{ display:'block', width:150, height:65, objectFit:'contain' }} />}Il medico</div>
          <div style={{ marginTop: 18, paddingTop: 8, borderTop: '1px solid #E2E8F0', textAlign: 'center', fontSize: 10, color: '#4A5568' }}>
            {[si.tel && `Tel. ${si.tel}`, si.addr1, si.addr2, si.email].filter(Boolean).join('  ·  ')}
          </div>
        </div>
      </div>

      {pdf && (
        <Suspense fallback={null}>
          <PdfViewerModal titolo={pdf.titolo} dataUrl={pdf.dataUrl} filename={pdf.filename} zIndex={zIndex + 100} onClose={() => setPdf(null)} />
        </Suspense>
      )}
    </div>
  );
}
