import React, { Suspense, lazy, useState } from 'react';
import { waAbilitato } from './ui/WaAction.jsx';
import Ic from './ui/Ic.jsx';
import { buildPreventivoPdf, totaliPreventivo, numeroPreventivo, euroIt } from '../lib/documenti/preventivoPdf.js';

const PdfViewerModal = lazy(() => import('./ui/PdfViewerModal.jsx'));

export default function PdfView({ pl, paz, si, features, onClose }) {
  const isDentistico = !si?.vertical || si.vertical === 'dentistico';
  const { subtotale: sub, sconto: sc, scontato, totale: tot } = totaliPreventivo(pl);
  const fmtE = euroIt;

  const buildTesto = () => {
    const righe = pl.voci.map((v, i) => `${i + 1}. ${v.prestazione}${(isDentistico && v.dente) ? ' (d.' + v.dente + ')' : ''} — ${fmtE(v.prezzo)}${v.eseguita ? ' ✓' : ''}`).join('\n');
    const scontoR = scontato > 0 ? `\n🏷️ Sconto: −${fmtE(scontato)}` : '';
    return `📋 *${si.nome || 'Studio'}*\n${si.spec || ''}\n${'─'.repeat(32)}\n\n📋 *PREVENTIVO*\nPaziente: ${paz?.nome || ''} ${paz?.cognome || ''}\nData: ${new Date().toLocaleDateString('it-IT')}\nN°: ${numeroPreventivo(pl)}\n\nPiano: *${pl.titolo}*\n\n${righe}${scontoR}\n${'─'.repeat(32)}\n💰 *TOTALE: ${fmtE(tot)}*\n${'─'.repeat(32)}\n📞 ${si.tel || ''}  ✉️ ${si.email || ''}\n${si.addr1 || ''}`;
  };

  const sendWA = () => {
    const tel = (paz?.telefono || '').replace(/\D/g, '');
    const msg = encodeURIComponent(buildTesto());
    const url = tel ? `https://wa.me/39${tel}?text=${msg}` : `https://wa.me/?text=${msg}`;
    window.open(url, '_blank');
  };

  const sendEmail = () => {
    const sogg = encodeURIComponent(`Preventivo – ${paz?.nome || ''} ${paz?.cognome || ''}`);
    const corpo = encodeURIComponent(buildTesto().replace(/\*/g, ''));
    const dest = paz?.email || '';
    window.open(`mailto:${dest}?subject=${sogg}&body=${corpo}`);
  };

  const shareNativo = async () => {
    if (!navigator.share) { sendWA(); return; }
    try {
      await navigator.share({ title: `Preventivo ${paz?.nome || ''} ${paz?.cognome || ''}`, text: buildTesto() });
    } catch (e) {
      if (e.name !== 'AbortError') sendWA();
    }
  };

  // Il PDF si apre DENTRO l'app (PdfViewerModal, con Chiudi, Condividi e
  // Scarica): mai più una finestra nuova, da cui sull'app installata
  // dell'iPhone non si torna alla scheda del paziente.
  const [pdf, setPdf] = useState(null);
  const [pdfMsg, setPdfMsg] = useState(null);

  const apriPdf = () => {
    setPdfMsg(null);
    try {
      setPdf(buildPreventivoPdf({ si, paziente: paz, piano: pl }));
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: '#C8D4E0', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#124E66', padding: '10px 14px', paddingTop: 'max(10px, env(safe-area-inset-top))', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={onClose} aria-label="Torna alla scheda" style={{ minHeight: 44, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: '8px 12px', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}><Ic n="back" s={15} c="#fff" />Indietro</button>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 14, flex: 1, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Preventivo{nome ? ` · ${nome}` : ''}</span>
        <span style={{ width: 44, flexShrink: 0 }} aria-hidden="true" />
      </div>

      <div style={{ background: '#0F3D52', padding: '10px 14px', display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
        <button onClick={apriPdf} style={{ flex: '1 1 0', minWidth: 90, background: '#F4A261', border: 'none', borderRadius: 9, padding: '10px 0', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Ic n="file" s={13} c="#fff" />Apri PDF
        </button>
        {waAbilitato(features) && (
        <button onClick={sendWA} style={{ flex: '1 1 0', minWidth: 90, background: '#25D366', border: 'none', borderRadius: 9, padding: '10px 0', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
          WhatsApp
        </button>
        )}
        <button onClick={sendEmail} style={{ flex: '1 1 0', minWidth: 90, background: '#4A5568', border: 'none', borderRadius: 9, padding: '10px 0', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Ic n="mail" s={13} c="#fff" />Email
        </button>
        {navigator.share && (
          <button onClick={shareNativo} style={{ flex: '1 1 0', minWidth: 90, background: '#2EC4B6', border: 'none', borderRadius: 9, padding: '10px 0', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Ic n="send" s={13} c="#fff" />Condividi
          </button>
        )}
        {navigator.share && (
          <button onClick={shareNativo} style={{ flex: '1 1 0', minWidth: 90, background: '#2EC4B6', border: 'none', borderRadius: 9, padding: '10px 0', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Ic n="send" s={13} c="#fff" />Testo
          </button>
        )}
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
          {paz?.note && <div style={{ marginTop: 14, background: '#FFFBEB', padding: 10, fontSize: 11, color: '#78350F', display: 'flex', alignItems: 'flex-start', gap: 5 }}><Ic n="warn" s={11} c="#78350F" /><span><b>Note:</b> {paz.note}</span></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginTop: 40, fontSize: 10, color: '#718096' }}>
            <div style={{ flex: 1, borderTop: '1px solid #A0AEC0', paddingTop: 4 }}>Il medico</div>
            <div style={{ flex: 1, borderTop: '1px solid #A0AEC0', paddingTop: 4 }}>Il paziente, per accettazione</div>
          </div>
          <div style={{ marginTop: 18, paddingTop: 8, borderTop: '1px solid #E2E8F0', textAlign: 'center', fontSize: 10, color: '#4A5568' }}>
            {[si.tel && `Tel. ${si.tel}`, si.addr1, si.addr2, si.email].filter(Boolean).join('  ·  ')}
          </div>
        </div>
      </div>

      {pdf && (
        <Suspense fallback={null}>
          <PdfViewerModal titolo={pdf.titolo} dataUrl={pdf.dataUrl} filename={pdf.filename} zIndex={3100} onClose={() => setPdf(null)} />
        </Suspense>
      )}
    </div>
  );
}
