// SCAN-LIBRERIA — miniatura di un file per «I miei documenti»: prima pagina del PDF o foto ridotta,
// disegnata sul dispositivo (JPEG piccolo). null se il file non si può disegnare.
const LATO = 220;
export async function creaMiniatura(file) {
  try {
    let tela;
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      const { apriDocumento, disegnaPagina } = await import('../pdf/raster.js');
      const doc = await apriDocumento(new Uint8Array(await file.arrayBuffer()));
      try { tela = (await disegnaPagina(doc, 1, { latoMax: LATO })).canvas; } finally { await doc.destroy(); }
    } else if ((file.type || '').startsWith('image/')) {
      const b = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const k = Math.min(1, LATO / Math.max(b.width, b.height));
      tela = document.createElement('canvas');
      tela.width = Math.max(1, Math.round(b.width * k)); tela.height = Math.max(1, Math.round(b.height * k));
      tela.getContext('2d').drawImage(b, 0, 0, tela.width, tela.height); b.close();
    } else return null;
    const url = tela.toDataURL('image/jpeg', 0.7);
    tela.width = 0; tela.height = 0;
    return url;
  } catch { return null; }
}
