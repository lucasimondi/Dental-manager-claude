// Lightweight validation shared by Scan without loading the PDF editor.
export const MAX_PDF_BYTES = 40 * 1024 * 1024;
export function validaFile(file) {
  if (!file?.size || file.size > MAX_PDF_BYTES) throw new Error('Scegli un file non vuoto, fino a 40 MB.');
  if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name) && !(file.type || '').startsWith('image/') && !/\.(jpe?g|png|heic|heif|webp)$/i.test(file.name)) throw new Error('Scegli un PDF o una foto.');
}
