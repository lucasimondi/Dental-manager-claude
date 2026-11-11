// Pure PDF geometry and byte transformations. No network, storage or original writes.
import { PDFDocument, degrees } from 'pdf-lib';

export { MAX_PDF_BYTES, validaFile } from './filePdf.js';
export function schermoPdf({ x, y }, [a, b, c, d, e, f]) {
  const det = a * d - b * c;
  if (!Number.isFinite(det) || det === 0) throw new Error('Coordinate della pagina non valide.');
  return { x: (d * (x - e) - c * (y - f)) / det, y: (-b * (x - e) + a * (y - f)) / det };
}
export function pdfSchermo({ x, y }, [a, b, c, d, e, f]) {
  return { x: a * x + c * y + e, y: b * x + d * y + f };
}
export function limitaFirma(r) {
  const width = Math.max(.08, Math.min(.9, r.width));
  const height = Math.max(.025, Math.min(.5, r.height));
  return { ...r, width, height, x: Math.max(0, Math.min(1 - width, r.x)), y: Math.max(0, Math.min(1 - height, r.y)) };
}
export function posizioneFirma(r, viewport) {
  const origin = schermoPdf({ x: r.x * viewport.width, y: (r.y + r.height) * viewport.height }, viewport.transform);
  const right = schermoPdf({ x: (r.x + r.width) * viewport.width, y: (r.y + r.height) * viewport.height }, viewport.transform);
  const top = schermoPdf({ x: r.x * viewport.width, y: r.y * viewport.height }, viewport.transform);
  return { ...origin, width: Math.hypot(right.x - origin.x, right.y - origin.y), height: Math.hypot(top.x - origin.x, top.y - origin.y), rotation: Math.atan2(right.y - origin.y, right.x - origin.x) * 180 / Math.PI };
}
export function riordina(indici, da, a) {
  if (![da, a].every(i => Number.isInteger(i) && i >= 0 && i < indici.length)) throw new Error('Pagina non valida.');
  const result = [...indici]; result.splice(a, 0, result.splice(da, 1)[0]); return result;
}
async function apri(bytes) {
  try { return await PDFDocument.load(bytes); }
  catch { throw new Error('Questo PDF è protetto o non modificabile con gli strumenti pagine. L’originale resta intatto.'); }
}
// Page copying cannot retain the document-level AcroForm tree. Explicitly flatten first;
// the UI explains this before page operations. Never silently lose filled values.
function fissaModuli(pdf) { const form = pdf.getForm(); if (form.getFields().length) form.flatten(); }
export async function unisciPdf(files) {
  if (!files.length) throw new Error('Scegli almeno un PDF.');
  const out = await PDFDocument.create();
  for (const bytes of files) {
    const source = await apri(bytes); fissaModuli(source);
    for (const page of await out.copyPages(source, source.getPageIndices())) out.addPage(page);
  }
  return out.save();
}
export async function organizzaPdf(bytes, pages) {
  const source = await apri(bytes);
  if (!pages.length || pages.some(p => !Number.isInteger(p.index) || p.index < 0 || p.index >= source.getPageCount() || !Number.isInteger(p.rotation) || p.rotation % 90)) throw new Error('Mantieni almeno una pagina e usa rotazioni di 90°.');
  if (new Set(pages.map(p => p.index)).size !== pages.length) throw new Error('Pagina duplicata.');
  fissaModuli(source);
  const out = await PDFDocument.create();
  const copies = await out.copyPages(source, pages.map(p => p.index));
  copies.forEach((page, i) => { page.setRotation(degrees((page.getRotation().angle + pages[i].rotation) % 360)); out.addPage(page); });
  return out.save();
}
export async function incorporaFirme(bytes, signatures) {
  if (!signatures.length) return bytes;
  const pdf = await apri(bytes);
  for (const signature of signatures) {
    const image = await pdf.embedPng(signature.png);
    const { rotation, ...rect } = signature.position;
    pdf.getPage(signature.page - 1).drawImage(image, { ...rect, rotate: degrees(rotation) });
  }
  return pdf.save();
}
export function nomeCopia(name = 'Documento.pdf') {
  return `${name.replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|]/g, '-')} - modificato.pdf`;
}
// Invoke from a fresh click after preparing the file (transient user activation).
export async function condividiCopia(file, nav = globalThis.navigator) {
  if (!nav?.share || !nav?.canShare?.({ files: [file] })) return 'non_disponibile';
  try { await nav.share({ files: [file] }); return 'condiviso'; }
  catch (e) { if (e.name === 'AbortError') return 'annullato'; throw e; }
}
// Crop rectangle around the drawn ink (CSS px), padded and clamped to the pad.
export function ritaglioFirma(b, pad, margin = 8) {
  if (!b) return { x: 0, y: 0, width: pad.width, height: pad.height };
  const x = Math.max(0, Math.floor(b.x0 - margin)), y = Math.max(0, Math.floor(b.y0 - margin));
  const x1 = Math.min(pad.width, Math.ceil(b.x1 + margin)), y1 = Math.min(pad.height, Math.ceil(b.y1 + margin));
  return { x, y, width: Math.max(1, x1 - x), height: Math.max(1, y1 - y) };
}

// Explicit page-range parser: reject typos instead of exporting the wrong pages.
export function pagineDaIntervallo(value, count) {
  const pages = [], seen = new Set();
  for (const part of String(value).split(',')) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error('Indica le pagine, ad esempio 1-3, 5.');
    const first = Number(match[1]), last = Number(match[2] || match[1]);
    if (first < 1 || last > count || last < first) throw new Error(`Scegli pagine da 1 a ${count}, in ordine crescente negli intervalli.`);
    for (let n = first; n <= last; n++) if (!seen.has(n)) { seen.add(n); pages.push({ index: n - 1, rotation: 0 }); }
  }
  return pages;
}
export function nomeDocumento(value) {
  const base = String(value || '').trim().replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|\x00-\x1f]/g, '-').trim().slice(0, 120);
  if (!base || /^\.+$/.test(base)) throw new Error('Scrivi un nome per il documento.');
  return `${base}.pdf`;
}
