export const pdfImageFormat = (dataUrl = '') => /^data:image\/jpe?g/i.test(dataUrl) ? 'JPEG' : 'PNG';

export function applyConfiguredSignature(doc, dataUrl, x, y, width = 60, height = 36) {
  if (!dataUrl) return false;
  try {
    doc.addImage(dataUrl, pdfImageFormat(dataUrl), x, y, width, height, undefined, 'FAST');
    return true;
  } catch {
    return false;
  }
}

export function drawFiscalStamp(doc, studio, { x = 75, y = 246, width = 60, height = 21 } = {}) {
  if (!studio?.firma_b64) return false;
  doc.setDrawColor(26, 78, 102);
  doc.setLineWidth(0.6);
  doc.roundedRect(x, y, width, height, 2.5, 2.5, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5);
  doc.setTextColor(26, 78, 102);
  doc.text(studio.nome || '', x + width / 2, y + 5, { align: 'center', maxWidth: width - 6 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(3.5);
  doc.text([studio.spec, studio.iscr, studio.addr].filter(Boolean), x + width / 2, y + 9, { align: 'center', maxWidth: width - 6 });
  return applyConfiguredSignature(doc, studio.firma_b64, x + width / 2 - 14, y - 4);
}
