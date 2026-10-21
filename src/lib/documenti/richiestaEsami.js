import { jsPDF } from 'jspdf';
import { createPdfLayout, nomeFilePaziente } from './pdfLayout.js';

// No clinical defaults: the clinician specifies examination, site and indication.
export function buildRichiestaEsamiPdf({ si, paziente, data, esami, distretto = '', quesito = '', note = '' }) {
  if (!paziente) throw new Error('Seleziona il paziente.');
  if (!String(esami || '').trim()) throw new Error('Indica almeno un esame da richiedere.');
  const { intestazione, pazienteBox, finalizzaMultipagina } = createPdfLayout({ si, data });
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 18;
  let y = intestazione(doc, W, M);
  doc.setFillColor(26, 107, 138);
  doc.rect(M, y, W - M * 2, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('RICHIESTA ESAMI DIAGNOSTICI', W / 2, y + 6, { align: 'center' });
  y = pazienteBox(doc, paziente, y + 13, W, M) + 6;
  const space = () => { if (y > 217) { doc.addPage(); y = 52; } };
  for (const [label, value] of [['ESAMI RICHIESTI', esami], ['DISTRETTO ANATOMICO / LATO', distretto], ['QUESITO CLINICO / MOTIVAZIONE', quesito], ['NOTE', note]]) {
    if (!String(value || '').trim()) continue;
    if (y > 207) { doc.addPage(); y = 52; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(26, 107, 138);
    doc.text(label + ':', M, y); y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(26, 32, 44);
    for (const line of doc.splitTextToSize(String(value).trim(), W - M * 2)) {
      space(); doc.text(line, M, y); y += 5.5;
    }
    y += 5;
  }
  finalizzaMultipagina(doc, W, M);
  return { dataUrl: doc.output('datauristring'), filename: nomeFilePaziente(paziente), titolo: 'Richiesta esami diagnostici', tipoDoc: 'esami' };
}
