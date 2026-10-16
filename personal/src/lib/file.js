// POL-VITA-003 — prepara un file scelto sul telefono per il caricamento.
// Le foto vengono ridotte (lato lungo max 2200 px, JPEG): restano leggibili, pesano poco
// e rientrano nel limite di analisi delle immagini dello script.
const LATO_MAX = 2200;

const comeBase64 = (blob) => new Promise((ok, ko) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(',')[1] || '');
  r.onerror = () => ko(new Error('Lettura del file non riuscita'));
  r.readAsDataURL(blob);
});

async function riduciFoto(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  if (!bitmap) return file;
  const scala = Math.min(1, LATO_MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scala);
  canvas.height = Math.round(bitmap.height * scala);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
  return blob && blob.size < file.size ? blob : file;
}

export async function preparaFile(file) {
  const foto = /^image\/(jpeg|png|heic|heif|webp)$/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
  const pronto = foto ? await riduciFoto(file) : file;
  const ridotto = pronto !== file;
  const nome = ridotto ? file.name.replace(/\.[^.]+$/, '') + '.jpg' : file.name;
  return { nome: nome || 'documento', mime: ridotto ? 'image/jpeg' : (file.type || 'application/octet-stream'), dati: await comeBase64(pronto), byte: pronto.size };
}
