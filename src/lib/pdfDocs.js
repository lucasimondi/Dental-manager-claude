import { jsPDF } from 'jspdf';

const fmtD = (d) => (d ? new Date(d + 'T12:00').toLocaleDateString('it-IT') : '-');

/**
 * Genera e scarica il PDF di una ricetta medica, con la stessa identica resa
 * grafica del modulo Documenti Medici (DocMedico.jsx) — stessa intestazione,
 * stesso box paziente, stesso timbro/firma in calce.
 *
 * @param {object} params
 * @param {object} params.paziente - { nome, cognome, data_nascita }
 * @param {object} params.studio - { nome, spec, iscr, addr1, tel, email, piva, firma_b64 }
 * @param {Array<{nome:string, dosaggio?:string, posologia:string, durata?:string}>} params.farmaci
 * @param {string} params.data - YYYY-MM-DD, data del documento (default: oggi)
 * @returns {string} nome del file scaricato
 */
export function generaRicettaPdf({ paziente, studio, farmaci, data }) {
  const oggi = data || new Date().toISOString().slice(0, 10);
  const si = studio || {};
  const paz = paziente || {};
  const hasFirma = !!si.firma_b64;

  const STUDIO = {
    nome: si.nome || 'Studio',
    spec: si.spec || '',
    iscr: si.iscr || '',
    addr: si.addr1 || '',
    tel: si.tel || '',
    email: si.email || '',
    piva: si.piva || '',
  };

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 18;
  let y = 18;

  // ── Intestazione ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(26, 78, 102);
  doc.text(STUDIO.nome, W / 2, y, { align: 'center' }); y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(74, 144, 196);
  doc.text(STUDIO.spec, W / 2, y, { align: 'center' }); y += 5;
  doc.text(STUDIO.iscr, W / 2, y, { align: 'center' }); y += 5;
  doc.setTextColor(100, 100, 100);
  doc.text(`${STUDIO.addr}   |   Tel: ${STUDIO.tel}`, W / 2, y, { align: 'center' }); y += 7;
  doc.setDrawColor(26, 107, 138);
  doc.setLineWidth(0.5);
  doc.line(M, y, W - M, y); y += 8;

  // ── Titolo ──
  doc.setFillColor(26, 107, 138);
  doc.rect(M, y, W - M * 2, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('RICETTA MEDICA', W / 2, y + 6, { align: 'center' });
  y += 13;

  // ── Box paziente ──
  doc.setFillColor(245, 247, 250);
  doc.rect(M, y, W - M * 2, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(113, 128, 150);
  doc.text('PAZIENTE', M + 3, y + 4);
  doc.text('DATA', W / 2, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(26, 32, 44);
  doc.text(`${paz.nome || ''} ${paz.cognome || ''}`.trim(), M + 3, y + 11);
  if (paz.data_nascita) {
    doc.setFontSize(8);
    doc.setTextColor(113, 128, 150);
    doc.text(`Nato/a il ${fmtD(paz.data_nascita)}`, M + 3, y + 16);
  }
  doc.setFontSize(11);
  doc.setTextColor(26, 32, 44);
  doc.text(new Date(oggi + 'T12:00').toLocaleDateString('it-IT'), W / 2, y + 11);
  y += (paz.data_nascita ? 22 : 18) + 4;

  // ── Prescrizione ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(26, 107, 138);
  doc.text('PRESCRIZIONE:', M, y); y += 6;

  (farmaci || []).forEach((f, i) => {
    if (y > 240) { doc.addPage(); y = 20; }
    const nomeFarmaco = [f.nome, f.dosaggio].filter(Boolean).join(' ');
    doc.setFillColor(i % 2 === 0 ? 247 : 255, i % 2 === 0 ? 250 : 255, i % 2 === 0 ? 252 : 255);
    const rh = f.durata ? 18 : 13;
    doc.rect(M, y, W - M * 2, rh, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(26, 32, 44);
    doc.text(`${i + 1}. ${nomeFarmaco}`, M + 3, y + 7);
    if (f.posologia) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(74, 85, 104);
      doc.text(`Posologia: ${f.posologia}`, M + 5, y + 13);
    }
    if (f.durata) {
      doc.text(`Durata: ${f.durata}`, M + 5 + (f.posologia ? 80 : 0), y + 13);
    }
    y += rh + 2;
  });

  y += 12;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(130, 130, 130);
  doc.text('Ricetta valida 30 giorni dalla data di emissione. · Medico prescrittore: ' + STUDIO.nome, M, y);

  // ── Footer / timbro ──
  const fY = 228;
  if (hasFirma) {
    const tW = 60, tH = 21;
    const tX = (W - tW) / 2;
    const tY = fY + 5;
    const pad = 3;

    doc.setDrawColor(26, 78, 102);
    doc.setLineWidth(0.8);
    doc.roundedRect(tX, tY, tW, tH, 2.5, 2.5, 'S');
    doc.setLineWidth(0.3);
    doc.roundedRect(tX + 1, tY + 1, tW - 2, tH - 2, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(4.5);
    doc.setTextColor(26, 78, 102);
    doc.text(STUDIO.nome, tX + tW / 2, tY + 4.5, { align: 'center', maxWidth: tW - pad * 2 });

    doc.setDrawColor(26, 78, 102);
    doc.setLineWidth(0.2);
    doc.line(tX + 4, tY + 5.8, tX + tW - 4, tY + 5.8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(3);
    doc.setTextColor(26, 78, 102);
    doc.text(STUDIO.spec, tX + tW / 2, tY + 8, { align: 'center', maxWidth: tW - pad * 2 });
    doc.text(STUDIO.iscr, tX + tW / 2, tY + 10.5, { align: 'center', maxWidth: tW - pad * 2 });

    doc.setLineWidth(0.2);
    doc.line(tX + 5, tY + 12, tX + tW - 5, tY + 12);

    doc.setFontSize(2.8);
    doc.text(STUDIO.addr, tX + tW / 2, tY + 14, { align: 'center', maxWidth: tW - pad * 2 });
    doc.text(`Tel. ${STUDIO.tel} · ${STUDIO.email}`, tX + tW / 2, tY + 16.5, { align: 'center', maxWidth: tW - pad * 2 });

    doc.setFontSize(2.5);
    doc.setTextColor(80, 110, 130);
    doc.text(`P.IVA ${STUDIO.piva}`, tX + tW / 2, tY + 19, { align: 'center', maxWidth: tW - pad * 2 });

    try {
      doc.addImage(si.firma_b64, 'PNG', tX + tW / 2 - 14, tY - 4, 60, 36, undefined, 'FAST');
    } catch (e) { /* firma non valida, il timbro resta senza immagine */ }
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const righe = [STUDIO.nome, STUDIO.addr, [STUDIO.tel, STUDIO.email].filter(Boolean).join(' · ')].filter(Boolean);
    let yy = fY + 8;
    righe.forEach((r) => { doc.text(r, W / 2, yy, { align: 'center' }); yy += 4; });
  }

  doc.setDrawColor(200, 210, 220);
  doc.setLineWidth(0.3);
  doc.line(M, 283, W - M, 283);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(150, 160, 170);
  doc.text(`${STUDIO.nome} · ${STUDIO.addr} · P.IVA ${STUDIO.piva}`, W / 2, 287, { align: 'center' });

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const filename = `ricetta_${(paz.cognome || 'paziente').replace(/\s+/g, '_')}_${oggi}.pdf`;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return filename;
}
