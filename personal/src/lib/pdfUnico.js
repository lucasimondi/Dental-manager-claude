// MIA-SALUTE (PO 2026-11-10) — più documenti (foto e PDF) in un solo PDF, nell'ordine scelto,
// per mandarli come un unico allegato. Le foto diventano pagine A4; i PDF si accodano interi.
// Altri formati (es. fattura elettronica XML) restano fuori e vengono segnalati.
export const tipoFile = (f) => (f?.type === 'application/pdf' || /\.pdf$/i.test(f?.name || '') ? 'pdf'
  : (f?.type || '').startsWith('image/') || /\.(jpe?g|png|heic|heif|webp)$/i.test(f?.name || '') ? 'immagine' : 'altro');

export function nomePdf(titolo = 'Documenti') {
  return `${String(titolo).replace(/[^\w\- àèéìòù]+/gi, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Documenti'}.pdf`;
}

export async function unisciInPdf(files, titolo = 'Documenti', strumenti = {}) {
  const { elaboraPagina = (await import('./scansione.js')).elaboraPagina,
    creaPdf = (await import('./scansione.js')).creaPdf,
    unisciPdf = (await import('../pdf/operazioni.js')).unisciPdf } = strumenti;
  const pezzi = []; const esclusi = [];
  for (const f of files) {
    const t = tipoFile(f);
    if (t === 'pdf') pezzi.push(new Uint8Array(await f.arrayBuffer()));
    else if (t === 'immagine') {
      const pagina = await elaboraPagina(f, { modo: 'originale' });
      const pdf = await creaPdf([pagina], f.name || titolo);
      pezzi.push(new Uint8Array(await pdf.arrayBuffer()));
    } else esclusi.push(f.name || 'file');
  }
  if (!pezzi.length) throw new Error('Nessuna foto o PDF da unire.');
  const bytes = await unisciPdf(pezzi);
  return { file: new File([bytes], nomePdf(titolo), { type: 'application/pdf' }), esclusi };
}

// «Scansiona o allega»: pagine già elaborate (foto: url JPEG + misure) e PDF interi, nell'ordine
// della lista, diventano un solo PDF. Le foto vicine finiscono in un'unica passata di jsPDF.
export async function pdfDaElementi(elementi, titolo = 'Documento', strumenti = {}) {
  const { creaPdf = (await import('./scansione.js')).creaPdf,
    unisciPdf = (await import('../pdf/operazioni.js')).unisciPdf } = strumenti;
  if (!elementi.length) throw new Error('Aggiungi almeno una pagina o un file.');
  const pezzi = []; let foto = [];
  const chiudiFoto = async () => { if (!foto.length) return; const f = await creaPdf(foto, titolo); pezzi.push(new Uint8Array(await f.arrayBuffer())); foto = []; };
  for (const e of elementi) {
    if (e.tipo === 'pdf') { await chiudiFoto(); pezzi.push(new Uint8Array(await e.file.arrayBuffer())); } else foto.push(e);
  }
  await chiudiFoto();
  const bytes = pezzi.length === 1 && elementi.every((e) => e.tipo !== 'pdf') ? pezzi[0] : await unisciPdf(pezzi);
  return new File([bytes], nomePdf(titolo), { type: 'application/pdf' });
}
