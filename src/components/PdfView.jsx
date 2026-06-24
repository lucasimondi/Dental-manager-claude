import React, { useState } from 'react';

export default function PdfView({ pl, paz, si, onClose }) {
  const sub = pl.voci.reduce((s, v) => s + Number(v.prezzo), 0);
  const sc = Number(pl.sconto) || 0;
  const scontato = pl.scontoTipo === 'pct' ? sub * (sc / 100) : Math.min(sc, sub);
  const tot = Math.max(0, sub - scontato);
  const fmtE = (n) => `€ ${Number(n).toFixed(2)}`;

  const buildTesto = () => {
    const righe = pl.voci.map((v, i) => `${i + 1}. ${v.prestazione}${v.dente ? ' (d.' + v.dente + ')' : ''} — ${fmtE(v.prezzo)}${v.eseguita ? ' ✓' : ''}`).join('\n');
    const scontoR = scontato > 0 ? `\n🏷️ Sconto: −${fmtE(scontato)}` : '';
    return `🦷 *${si.nome || 'Studio Dentistico'}*\n${si.spec || ''}\n${'─'.repeat(32)}\n\n📋 *PREVENTIVO*\nPaziente: ${paz?.nome || ''} ${paz?.cognome || ''}\nData: ${new Date().toLocaleDateString('it-IT')}\nN°: ${String(pl.id || '').slice(-6).padStart(6, '0')}\n\nPiano: *${pl.titolo}*\n\n${righe}${scontoR}\n${'─'.repeat(32)}\n💰 *TOTALE: ${fmtE(tot)}*\n${'─'.repeat(32)}\n📞 ${si.tel || ''}  ✉️ ${si.email || ''}\n${si.addr1 || ''}`;
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

  const [generating, setGenerating] = useState(false);
  const [pdfMsg, setPdfMsg] = useState(null);

  const generaPdf = () => {
    if (generating) return;
    setPdfMsg(null);
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
      setPdfMsg({ type: 'error', text: 'Libreria PDF non ancora caricata. Attendi qualche secondo e riprova, oppure verifica la connessione internet.' });
      return;
    }
    setGenerating(true);
    buildAndSave();
  };

  const buildAndSave = () => {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const W = 210, margin = 14;
      const contentW = W - margin * 2;
      let y = 18;

      const txt = (t, x, yy, opts = {}) => doc.text(String(t ?? ''), x, yy, opts);
      const hLine = (yy) => { doc.setDrawColor(203, 213, 224); doc.setLineWidth(0.3); doc.line(margin, yy, W - margin, yy); };
      const box = (x, yy, w, h, r, g, b) => { doc.setFillColor(r, g, b); doc.rect(x, yy, w, h, 'F'); };

      doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(22); doc.setTextColor(26, 78, 102);
      txt(si.nome || 'Studio Dentistico', W / 2, y, { align: 'center' }); y += 7;
      if (si.spec) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(74, 144, 196); txt(si.spec, W / 2, y, { align: 'center' }); y += 5; }
      if (si.iscr) { doc.setFontSize(8); txt(si.iscr, W / 2, y, { align: 'center' }); y += 5; }
      y += 2;
      doc.setFontSize(8); doc.setTextColor(74, 85, 104);
      const contatti = [si.tel && `Tel: ${si.tel}`, si.email, si.piva && `P.IVA ${si.piva}`].filter(Boolean);
      txt(contatti.join('   |   '), W / 2, y, { align: 'center' }); y += 3;
      hLine(y); y += 5;

      box(margin, y, contentW, 16, 247, 250, 252);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(113, 128, 150);
      txt('DATA', margin + 3, y + 4); txt('PAZIENTE', W / 2, y + 4, { align: 'center' }); txt('N° PREVENTIVO', W - margin - 3, y + 4, { align: 'right' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(26, 32, 44);
      txt(new Date().toLocaleDateString('it-IT'), margin + 3, y + 10);
      txt(`${paz?.nome || ''} ${paz?.cognome || ''}`, W / 2, y + 10, { align: 'center' });
      txt(String(pl.id || '').slice(-6).padStart(6, '0'), W - margin - 3, y + 10, { align: 'right' });
      y += 20;

      if (paz?.cf || paz?.dataNascita) {
        doc.setFontSize(8); doc.setTextColor(113, 128, 150);
        const cf = [paz.cf && `C.F.: ${paz.cf}`, paz.dataNascita && `Nato il: ${new Date(paz.dataNascita + 'T12:00').toLocaleDateString('it-IT')}`].filter(Boolean);
        txt(cf.join('   '), W / 2, y, { align: 'center' }); y += 6;
      }

      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(26, 32, 44);
      const tw = doc.getTextWidth('PREVENTIVO') + 10;
      doc.setDrawColor(26, 32, 44); doc.setLineWidth(0.5);
      doc.rect(W / 2 - tw / 2, y - 5, tw, 8);
      txt('PREVENTIVO', W / 2, y, { align: 'center' }); y += 10;

      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(74, 144, 196);
      txt(`PIANO DI CURA: ${(pl.titolo || '').toUpperCase()}`, margin, y);
      doc.setDrawColor(74, 144, 196); doc.setLineWidth(0.4); doc.line(margin, y + 2, W - margin, y + 2);
      y += 7;

      const cols = [8, 82, 18, 28, 24];
      const heads = ['#', 'Prestazione', 'Dente', 'Importo', 'Stato'];
      box(margin, y, contentW, 7, 26, 107, 138);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(255, 255, 255);
      let cx = margin + 2;
      heads.forEach((h, i) => { txt(h, cx, y + 5); cx += cols[i]; });
      y += 7;

      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      pl.voci.forEach((v, i) => {
        if (y > 270) { doc.addPage(); y = 18; }
        const rowH = 7;
        if (i % 2 === 0) box(margin, y, contentW, rowH, 247, 250, 252); else box(margin, y, contentW, rowH, 255, 255, 255);
        doc.setTextColor(26, 32, 44);
        cx = margin + 2;
        txt(String(i + 1), cx, y + 5); cx += cols[0];
        const prest = doc.splitTextToSize(v.prestazione, cols[1] - 3)[0] || '';
        txt(prest, cx, y + 5); cx += cols[1];
        txt(v.dente || '—', cx, y + 5); cx += cols[2];
        txt(`€ ${Number(v.prezzo).toFixed(2)}`, cx, y + 5); cx += cols[3];
        if (v.eseguita) { box(cx - 1, y + 1, cols[4] - 2, 5, 232, 247, 238); doc.setTextColor(45, 158, 97); txt('Eseguita', cx + 1, y + 5); }
        else { box(cx - 1, y + 1, cols[4] - 2, 5, 254, 243, 226); doc.setTextColor(224, 128, 64); txt('Da fare', cx + 1, y + 5); }
        y += rowH;
      });

      if (scontato > 0) {
        box(margin, y, contentW, 7, 240, 255, 244);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(45, 158, 97);
        txt(`Sconto ${pl.scontoTipo === 'pct' ? sc + '%' : '€ ' + Number(sc).toFixed(2)}`, margin + 2, y + 5);
        txt(`−€ ${scontato.toFixed(2)}`, W - margin - 3, y + 5, { align: 'right' });
        y += 7;
      }

      box(margin, y, contentW, 9, 235, 248, 255);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(26, 107, 138);
      txt('TOTALE', margin + 3, y + 6);
      txt(`€ ${tot.toFixed(2)}`, W - margin - 3, y + 6, { align: 'right' });
      y += 13;

      if (paz?.note) {
        if (y > 265) { doc.addPage(); y = 18; }
        y += 2;
        const noteLines = doc.splitTextToSize(paz.note, contentW - 30);
        const boxH = Math.max(10, 6 + noteLines.length * 4);
        box(margin, y, contentW, boxH, 255, 251, 235);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(120, 53, 15);
        txt('Note cliniche:', margin + 2, y + 4);
        doc.setFont('helvetica', 'normal');
        noteLines.forEach((ln, li) => txt(ln, margin + 2, y + 4 + (li + 1) * 4));
        y += boxH + 4;
      }

      if (y > 275) { doc.addPage(); y = 18; }
      y += 4; hLine(y); y += 4;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(74, 85, 104);
      const foot = [si.tel && `Tel: ${si.tel}`, si.addr1, si.addr2, si.email].filter(Boolean);
      txt(foot.join('   |   '), W / 2, y, { align: 'center' });

      const nomeFile = `preventivo_${(paz?.cognome || 'paziente').replace(/\s+/g, '_')}_${String(pl.id || Date.now()).slice(-6)}.pdf`.toLowerCase();

      const ua = navigator.userAgent || '';
      const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
      const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);

      let ok = false;

      if (isIOS || isSafari) {
        try {
          const dataUri = doc.output('datauristring', { filename: nomeFile });
          const w = window.open();
          if (w) {
            w.document.write(`<!DOCTYPE html><html><head><title>${nomeFile}</title><style>body{margin:0}embed{width:100%;height:100vh}</style></head><body><embed src="${dataUri}" type="application/pdf"/></body></html>`);
            w.document.close();
            ok = true;
            setPdfMsg({ type: 'info', text: '✓ PDF aperto in una nuova scheda. Usa il pulsante di condivisione/salvataggio del browser per scaricarlo.' });
          }
        } catch (e1) { console.error('Metodo dataURI fallito:', e1); }
      }

      if (!ok) {
        try {
          const blob = doc.output('blob');
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl; a.download = nomeFile; a.style.display = 'none';
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
          ok = true;
          setPdfMsg({ type: 'info', text: '✓ PDF scaricato. Controlla la cartella Download del dispositivo.' });
        } catch (e2) { console.error('Metodo blob fallito:', e2); }
      }

      if (!ok) {
        try {
          doc.save(nomeFile);
          ok = true;
          setPdfMsg({ type: 'info', text: '✓ PDF generato.' });
        } catch (e3) {
          console.error('Tutti i metodi falliti:', e3);
          setPdfMsg({ type: 'error', text: 'Impossibile generare il PDF su questo dispositivo. Usa WhatsApp o Email per condividere il preventivo come testo.' });
        }
      }
    } catch (err) {
      console.error('Errore PDF:', err);
      setPdfMsg({ type: 'error', text: 'Errore nella generazione del PDF: ' + (err && err.message ? err.message : String(err)) });
    } finally {
      setGenerating(false);
    }
  };

  const S = {
    tbl: { width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'Arial,sans-serif' },
    th: { background: '#1A6B8A', color: '#fff', padding: '8px 10px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase' },
    tdE: { background: '#F7FAFC', padding: '8px 10px', borderBottom: '1px solid #E2E8F0', fontFamily: 'Arial,sans-serif', fontSize: 12 },
    tdO: { background: '#fff', padding: '8px 10px', borderBottom: '1px solid #E2E8F0', fontFamily: 'Arial,sans-serif', fontSize: 12 },
    tdT: { background: '#EBF8FF', padding: '10px', fontWeight: 'bold', fontSize: 14, color: '#1A6B8A', fontFamily: 'Arial,sans-serif' },
    tdS: { background: '#F0FFF4', padding: '10px', fontWeight: 'bold', fontSize: 12, color: '#2D9E61', fontFamily: 'Arial,sans-serif' },
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: '#C8D4E0', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#124E66', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '8px 12px', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>← Chiudi</button>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 14, flex: 1, textAlign: 'center' }}>Anteprima preventivo</span>
      </div>

      <div style={{ background: '#0F3D52', padding: '10px 14px', display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
        <button onClick={sendWA} style={{ flex: '1 1 0', minWidth: 90, background: '#25D366', border: 'none', borderRadius: 9, padding: '10px 0', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
          WhatsApp
        </button>
        <button onClick={sendEmail} style={{ flex: '1 1 0', minWidth: 90, background: '#4A5568', border: 'none', borderRadius: 9, padding: '10px 0', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          ✉️ Email
        </button>
        {navigator.share && (
          <button onClick={shareNativo} style={{ flex: '1 1 0', minWidth: 90, background: '#2EC4B6', border: 'none', borderRadius: 9, padding: '10px 0', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            📤 Condividi
          </button>
        )}
        <button onClick={generaPdf} disabled={generating} style={{ flex: '1 1 0', minWidth: 90, background: generating ? '#555' : '#F4A261', border: 'none', borderRadius: 9, padding: '10px 0', color: '#fff', fontWeight: 800, fontSize: 13, cursor: generating ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {generating ? '⏳ Attendi…' : '⬇️ Scarica PDF'}
        </button>
      </div>

      {pdfMsg && (
        <div style={{ background: pdfMsg.type === 'error' ? '#FDECEA' : '#E8F7EE', borderBottom: `2px solid ${pdfMsg.type === 'error' ? '#E63946' : '#2D9E61'}`, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>{pdfMsg.type === 'error' ? '⚠️' : 'ℹ️'}</span>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: pdfMsg.type === 'error' ? '#C53030' : '#236B45', lineHeight: 1.4 }}>{pdfMsg.text}</span>
          <button onClick={() => setPdfMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0, color: pdfMsg.type === 'error' ? '#C53030' : '#236B45', fontWeight: 800, fontSize: 14 }}>✕</button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 10px 40px' }}>
        <div style={{ background: '#fff', maxWidth: 680, margin: '0 auto', boxShadow: '0 4px 24px rgba(0,0,0,0.15)', borderRadius: 4, padding: '28px 24px', fontFamily: 'Georgia,serif', color: '#1A202C' }}>
          <div style={{ textAlign: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 24, fontStyle: 'italic', fontWeight: 'bold', color: '#1A4E66' }}>{si.nome || 'Studio Dentistico'}</div>
            {si.spec && <div style={{ fontSize: 11, color: '#4A90C4', fontFamily: 'Arial,sans-serif', marginTop: 2 }}>{si.spec}</div>}
            {si.iscr && <div style={{ fontSize: 10, color: '#4A90C4', fontFamily: 'Arial,sans-serif', marginTop: 1 }}>{si.iscr}</div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, fontFamily: 'Arial,sans-serif', fontSize: 10, color: '#4A5568', margin: '8px 0', flexWrap: 'wrap' }}>
            {si.tel && <span>📞 {si.tel}</span>}{si.email && <span>✉️ {si.email}</span>}{si.piva && <span>P.IVA {si.piva}</span>}
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid #CBD5E0', margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', background: '#F7FAFC', borderRadius: 6, padding: '9px 12px', marginBottom: 12, fontFamily: 'Arial,sans-serif' }}>
            <div><div style={{ fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', color: '#718096' }}>Data</div><div style={{ fontSize: 12, fontWeight: 700 }}>{new Date().toLocaleDateString('it-IT')}</div></div>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', color: '#718096' }}>Paziente</div><div style={{ fontSize: 12, fontWeight: 700 }}>{paz?.nome} {paz?.cognome}</div>{paz?.cf && <div style={{ fontSize: 10, color: '#718096', fontFamily: 'monospace' }}>CF: {paz.cf}</div>}</div>
            <div style={{ textAlign: 'right' }}><div style={{ fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', color: '#718096' }}>N° Prev.</div><div style={{ fontSize: 12, fontWeight: 700 }}>{String(pl.id || '').slice(-6).padStart(6, '0')}</div></div>
          </div>
          <div style={{ textAlign: 'center', margin: '8px 0 12px' }}><span style={{ fontSize: 14, fontWeight: 'bold', letterSpacing: '.16em', textTransform: 'uppercase', border: '2px solid #1A202C', display: 'inline-block', padding: '4px 20px' }}>PREVENTIVO</span></div>
          <div style={{ fontSize: 10, fontWeight: 'bold', color: '#4A90C4', textTransform: 'uppercase', letterSpacing: '.08em', borderBottom: '1.5px solid #4A90C4', paddingBottom: 3, marginBottom: 10, fontFamily: 'Arial,sans-serif' }}>Piano di cura: {pl.titolo}</div>
          <table style={S.tbl}>
            <thead><tr>{['#', 'Prestazione', 'Dente', 'Importo', 'Stato'].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {pl.voci.map((v, i) => {
                const td = i % 2 === 0 ? S.tdE : S.tdO;
                return (
                  <tr key={i}>
                    <td style={{ ...td, width: 24 }}>{i + 1}</td>
                    <td style={td}>{v.prestazione}</td>
                    <td style={{ ...td, width: 55, textAlign: 'center' }}>{v.dente || '—'}</td>
                    <td style={{ ...td, width: 80, textAlign: 'right' }}>€ {Number(v.prezzo).toFixed(2)}</td>
                    <td style={{ ...td, width: 90 }}><span style={{ background: v.eseguita ? '#E8F7EE' : '#FEF3E2', color: v.eseguita ? '#2D9E61' : '#E08040', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 'bold' }}>{v.eseguita ? '✓ Eseguita' : 'Da eseguire'}</span></td>
                  </tr>
                );
              })}
              {scontato > 0 && <tr><td colSpan={3} style={S.tdS}>Sconto {pl.scontoTipo === 'pct' ? `${sc}%` : `€ ${Number(sc).toFixed(2)}`}</td><td colSpan={2} style={{ ...S.tdS, textAlign: 'right' }}>−{fmtE(scontato)}</td></tr>}
              <tr><td colSpan={3} style={S.tdT}><b>TOTALE</b></td><td colSpan={2} style={{ ...S.tdT, textAlign: 'right' }}><b>{fmtE(tot)}</b></td></tr>
            </tbody>
          </table>
          {paz?.note && <div style={{ marginTop: 10, background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 4, padding: 9, fontSize: 11, color: '#78350F', fontFamily: 'Arial,sans-serif' }}><b>⚠️ Note:</b> {paz.note}</div>}
          <div style={{ marginTop: 16, paddingTop: 8, borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 4, fontFamily: 'Arial,sans-serif', fontSize: 10, color: '#4A5568' }}>
            {si.addr1 && <span>📍 {si.addr1}</span>}{si.addr2 && <span>📍 {si.addr2}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
