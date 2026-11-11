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
  // A single PDF must retain its forms, annotations and original byte structure.
  const bytes = pezzi.length === 1 ? pezzi[0] : await unisciPdf(pezzi);
  return new File([bytes], nomePdf(titolo), { type: 'application/pdf' });
}

// Prepare actual attachments before the share gesture. No network or storage writes.
// SCAN-PDF-MANAGER: con `ocr` ogni PDF pronto riceve il testo ricercabile (sul dispositivo).
export async function preparaAllegatiScan(elementi, titolo, separati, strumenti = {}) {
  const prepara = strumenti.pdfDaElementi || pdfDaElementi;
  if (!elementi.length) throw new Error('Seleziona almeno un documento.');
  if (elementi.length > 20) throw new Error('Seleziona al massimo 20 documenti.');
  const files = await preparaSenzaOcr(elementi, titolo, separati, prepara);
  if (!strumenti.ocr) return files;
  const leggi = strumenti.fileRicercabile || (await import('../pdf/ocr.js')).fileRicercabile;
  const out = [];
  for (const [i, f] of files.entries()) out.push(await leggi(f, { onAvanzamento: (m) => strumenti.onAvanzamento?.(files.length > 1 ? `${f.name} (${i + 1}/${files.length}) · ${m}` : m) }));
  return out;
}
async function preparaSenzaOcr(elementi, titolo, separati, prepara) {
  if (!separati) return [await prepara(elementi, titolo)];
  const files = [], nomi = new Set();
  for (const [i, elemento] of elementi.entries()) {
    const base = (elemento.nome || elemento.file?.name || `${titolo} ${i + 1}`).replace(/\.[^.]+$/, '').slice(0, 64);
    let nome = nomePdf(base), n = 2;
    while (nomi.has(nome.toLocaleLowerCase())) nome = nomePdf(`${base} - ${n++}`);
    nomi.add(nome.toLocaleLowerCase());
    const file = await prepara([elemento], nome.replace(/\.pdf$/i, ''));
    files.push(new File([file], nome, { type: 'application/pdf' }));
  }
  return files;
}
