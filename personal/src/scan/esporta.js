// SCAN-ESPORTA (PO 2026-11-12: «fai tutto tu», passo 3 di «Scan professionale») — un documento di
// «I miei documenti» esportato come Word (.docx dal testo), immagini JPG (una per pagina) o testo
// (.txt). Tutto sul telefono: il testo viene dall'OCR (ML Kit nell'app, Tesseract nel browser)
// o direttamente dal PDF se è digitale. Gli originali non cambiano.

export const FORMATI = [
  ['docx', 'Word (.docx)', 'testo modificabile, per Word o Google Documenti'],
  ['jpg', 'Immagini JPG', 'una foto per pagina'],
  ['txt', 'Testo (.txt)', 'solo il testo'],
];
const base = (nome) => nome.replace(/\.[^.]+$/, '');
const ePdf = (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

// Pura: righe di testo → paragrafi (righe vuote separano i paragrafi, le pagine hanno un separatore).
export function paragrafi(testo) {
  return String(testo || '').replace(/\r/g, '').split(/\n{2,}/).map((p) => p.split('\n').map((r) => r.trim()).filter(Boolean)).filter((p) => p.length);
}

async function testoDi(file, onAvanzamento) {
  if (/^text\//.test(file.type)) return [await file.text()];
  const { testoDaPdf, testoDaImmagini } = await import('../pdf/ocr.js');
  if (ePdf(file)) {
    const { parti } = await testoDaPdf(file, { onAvanzamento });
    return parti;
  }
  if ((file.type || '').startsWith('image/')) {
    const url = await new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ko(r.error); r.readAsDataURL(file); });
    return testoDaImmagini([url], { onAvanzamento });
  }
  throw new Error('Questo file non contiene pagine da esportare.');
}

export async function wordDa(file, { onAvanzamento } = {}) {
  const parti = await testoDi(file, onAvanzamento);
  if (!parti.some((p) => p.trim())) throw new Error('Nessun testo riconosciuto da mettere in Word.');
  const { Document, Packer, Paragraph, HeadingLevel, TextRun, PageBreak } = await import('docx');
  const figli = [new Paragraph({ text: base(file.name), heading: HeadingLevel.HEADING_1 })];
  parti.forEach((testo, i) => {
    if (i > 0) figli.push(new Paragraph({ children: [new PageBreak()] }));
    for (const righe of paragrafi(testo)) {
      figli.push(new Paragraph({ children: righe.flatMap((r, k) => (k ? [new TextRun({ text: r, break: 1 })] : [new TextRun(r)])), spacing: { after: 160 } }));
    }
  });
  const doc = new Document({ creator: 'Poliedra Scan', title: base(file.name), sections: [{ children: figli }] });
  const blob = await Packer.toBlob(doc);
  return [new File([blob], `${base(file.name)}.docx`, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })];
}

export async function testoTxtDa(file, { onAvanzamento } = {}) {
  const parti = await testoDi(file, onAvanzamento);
  const testo = parti.map((p) => p.trim()).filter(Boolean).join('\n\n— — —\n\n');
  if (!testo) throw new Error('Nessun testo riconosciuto.');
  return [new File([testo], `${base(file.name)}.txt`, { type: 'text/plain' })];
}

export const MAX_PAGINE_JPG = 30;
export async function jpgDa(file, { onAvanzamento } = {}) {
  if (!ePdf(file)) return [file];
  const { apriDocumento, disegnaPagina, liberaCanvas } = await import('../pdf/raster.js');
  const doc = await apriDocumento(new Uint8Array(await file.arrayBuffer()));
  const out = [];
  try {
    const n = Math.min(doc.numPages, MAX_PAGINE_JPG);
    for (let i = 1; i <= n; i += 1) {
      onAvanzamento?.(`Preparo la pagina ${i} di ${n}…`);
      const { canvas } = await disegnaPagina(doc, i, { latoMax: 2000 });
      const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.88));
      liberaCanvas(canvas);
      out.push(new File([blob], n > 1 ? `${base(file.name)} - pagina ${i}.jpg` : `${base(file.name)}.jpg`, { type: 'image/jpeg' }));
    }
  } finally { await doc.destroy(); }
  return out;
}

export const esporta = { docx: wordDa, jpg: jpgDa, txt: testoTxtDa };
