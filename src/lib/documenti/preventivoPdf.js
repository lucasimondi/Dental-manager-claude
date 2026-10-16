/* Il preventivo in PDF: stesso disegno per il modulo Piani (PdfView) e per
   Poliedron, che lo prepara in chat dopo aver creato il piano (PO 2026-10-15:
   "lui mi dà il pdf da mandare"). */
import { jsPDF } from 'jspdf';
import { nomeFilePaziente } from './pdfLayout.js';

/** Importi del piano: subtotale, sconto applicato e totale. Accetta sia scontoTipo (app) sia sconto_tipo (database). */
export function totaliPreventivo(pl) {
  const sub = (pl.voci || []).reduce((s, v) => s + Number(v.prezzo), 0);
  const sc = Number(pl.sconto) || 0;
  const tipo = pl.scontoTipo ?? pl.sconto_tipo ?? 'pct';
  const scontato = tipo === 'pct' ? sub * (sc / 100) : Math.min(sc, sub);
  return { sub, sc, tipo, scontato, tot: Math.max(0, sub - scontato) };
}

/** Il documento jsPDF del preventivo (il chiamante sceglie come salvarlo o condividerlo). */
export function disegnaPreventivo({ pl, paz, si = {} }) {
  const isDentistico = !si?.vertical || si.vertical === 'dentistico';
  const { sc, tipo, scontato, tot } = totaliPreventivo(pl);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, margin = 14;
  const contentW = W - margin * 2;
  let y = 18;

  const txt = (t, x, yy, opts = {}) => doc.text(String(t ?? ''), x, yy, opts);
  const hLine = (yy) => { doc.setDrawColor(203, 213, 224); doc.setLineWidth(0.3); doc.line(margin, yy, W - margin, yy); };
  const box = (x, yy, w, h, r, g, b) => { doc.setFillColor(r, g, b); doc.rect(x, yy, w, h, 'F'); };

  doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(22); doc.setTextColor(26, 78, 102);
  txt(si.nome || 'Studio', W / 2, y, { align: 'center' }); y += 7;
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

  const cols = isDentistico ? [8, 82, 18, 28, 24] : [8, 100, 28, 24];
  const heads = isDentistico ? ['#', 'Prestazione', 'Dente', 'Importo', 'Stato'] : ['#', 'Prestazione', 'Importo', 'Stato'];
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
    if (isDentistico) { txt(v.dente || '—', cx, y + 5); cx += cols[2]; }
    const importoColIdx = isDentistico ? 3 : 2;
    const statoColIdx = isDentistico ? 4 : 3;
    txt(`€ ${Number(v.prezzo).toFixed(2)}`, cx, y + 5); cx += cols[importoColIdx];
    if (v.eseguita) { box(cx - 1, y + 1, cols[statoColIdx] - 2, 5, 232, 247, 238); doc.setTextColor(45, 158, 97); txt('Eseguita', cx + 1, y + 5); }
    else { box(cx - 1, y + 1, cols[statoColIdx] - 2, 5, 254, 243, 226); doc.setTextColor(224, 128, 64); txt('Da fare', cx + 1, y + 5); }
    y += rowH;
  });

  if (scontato > 0) {
    box(margin, y, contentW, 7, 240, 255, 244);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(45, 158, 97);
    txt(`Sconto ${tipo === 'pct' ? sc + '%' : '€ ' + Number(sc).toFixed(2)}`, margin + 2, y + 5);
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

  // Footer fisso a fondo pagina (y=285 su A4 210x297mm)
  const footerY = 287;
  doc.setDrawColor(203, 213, 224); doc.setLineWidth(0.3);
  doc.line(margin, footerY - 4, W - margin, footerY - 4);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(74, 85, 104);
  const foot = [si.tel && `Tel: ${si.tel}`, si.addr1, si.addr2, si.email].filter(Boolean);
  txt(foot.join('   |   '), W / 2, footerY, { align: 'center' });
  return doc;
}

/** Il preventivo pronto per la chat: { dataUrl, filename, titolo, tipoDoc }. */
export function buildPreventivoPdf({ pl, paz, si }) {
  const doc = disegnaPreventivo({ pl, paz, si });
  return { dataUrl: doc.output('datauristring'), filename: nomeFilePaziente(paz), titolo: 'Preventivo', tipoDoc: 'preventivo' };
}
