// SCAN-HUB (PO 2026-11-12: Scan come lo scanner di riferimento mostrato) — «Carta d'identità»:
// fronte e retro di una tessera su un solo foglio A4, uno sopra l'altro, come una fotocopia.
// Le misure sono in millimetri; il calcolo è puro (testabile), il PDF si crea sul dispositivo.

export const A4 = { w: 210, h: 297 };
// ISO/IEC 7810 ID-1: carta d'identità elettronica, patente, tessera sanitaria, carte bancarie.
export const TESSERA = { w: 85.6, h: 54 };
export const DIMENSIONI = { reale: TESSERA.w, grande: 150 };

// Rettangolo (mm) dove stare un'immagine larghezza×altezza dentro il riquadro, senza deformarla.
export function adatta(larghezza, altezza, riquadro) {
  if (!(larghezza > 0 && altezza > 0)) throw new Error('Immagine vuota.');
  const k = Math.min(riquadro.w / larghezza, riquadro.h / altezza);
  const w = larghezza * k, h = altezza * k;
  return { x: riquadro.x + (riquadro.w - w) / 2, y: riquadro.y + (riquadro.h - h) / 2, w, h };
}

// Riquadri delle facce sul foglio: centrati in orizzontale, nella metà alta e in quella bassa.
// `larghezza` in mm: 85.6 = dimensione reale, fino a 180 per una copia più leggibile.
export function riquadriFacce(n, { larghezza = DIMENSIONI.reale, foglio = A4 } = {}) {
  if (n < 1 || n > 2) throw new Error('Servono il fronte e, se vuoi, il retro.');
  const w = Math.max(40, Math.min(foglio.w - 30, larghezza));
  const h = w * (TESSERA.h / TESSERA.w);
  const x = (foglio.w - w) / 2;
  const centri = n === 1 ? [foglio.h * 0.3] : [foglio.h * 0.3, foglio.h * 0.68];
  return centri.map((c) => ({ x, y: c - h / 2, w, h }));
}

// Una tessera si fotografa di solito in orizzontale: se la foto è verticale va girata di 90°.
export const daGirare = (larghezza, altezza) => altezza > larghezza * 1.05;

// facce: [{ url (JPEG data URL), larghezza, altezza }] → File PDF A4 con una sola pagina.
export async function pdfFronteRetro(facce, { nome = "Carta d'identità", larghezza = DIMENSIONI.reale } = {}) {
  const valide = facce.filter(Boolean);
  const riquadri = riquadriFacce(valide.length, { larghezza });
  const { jsPDF: JsPdf } = await import('jspdf');
  const pdf = new JsPdf({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  valide.forEach((f, i) => {
    const r = adatta(f.larghezza, f.altezza, riquadri[i]);
    pdf.addImage(f.url, 'JPEG', r.x, r.y, r.w, r.h, undefined, 'FAST');
  });
  pdf.setProperties({ title: nome });
  const pulito = nome.replace(/[^\w\- ']+/g, '').replace(/'/g, ' ').replace(/\s+/g, ' ').trim() || 'Documento';
  return new File([pdf.output('blob')], `${pulito}.pdf`, { type: 'application/pdf' });
}
