/* POL-AI-008 — un documento (PDF) o una foto allegati a un messaggio della
   Chat Poliedron.

   Il file viene letto dal modello solo nel messaggio in cui è allegato e non
   viene salvato: nel database resta il testo del messaggio e, nei metadata,
   nome/tipo/dimensione (vedi `attachmentMetadata`). I limiti coincidono con
   quelli della funzione `agente-assistente` (supabase/functions/
   agente-assistente/allegato.js), che li ricontrolla. */

export const ATTACHMENT_ACCEPT = 'application/pdf,image/*';
export const MAX_PDF_BYTES = 6 * 1024 * 1024;
export const MAX_IMAGE_SOURCE_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGE_SIDE = 2048;
export const IMAGE_QUALITY = 0.85;
export const ATTACHMENT_ONLY_TEXT = 'Leggi il file allegato e dimmi cosa contiene.';

const MB = 1024 * 1024;

/** 'pdf' | 'image' | null, dal tipo dichiarato o dall'estensione. */
export function attachmentKind(file) {
  const type = String(file?.type || '').toLowerCase();
  const name = String(file?.name || '').toLowerCase();
  if (type === 'application/pdf' || (!type && name.endsWith('.pdf'))) return 'pdf';
  if (type.startsWith('image/') || (!type && /\.(jpe?g|png|webp|gif|heic|heif)$/.test(name))) return 'image';
  return null;
}

/** Messaggio per l'utente se il file non è allegabile, altrimenti null. */
export function attachmentProblem(file) {
  if (!file) return 'Nessun file selezionato.';
  const kind = attachmentKind(file);
  if (!kind) return 'Formato non supportato: allega un PDF o una foto.';
  if (kind === 'pdf' && file.size > MAX_PDF_BYTES) return `Il PDF è troppo grande (massimo ${MAX_PDF_BYTES / MB} MB).`;
  if (kind === 'image' && file.size > MAX_IMAGE_SOURCE_BYTES) return `La foto è troppo grande (massimo ${MAX_IMAGE_SOURCE_BYTES / MB} MB).`;
  if (!file.size) return 'Il file è vuoto.';
  return null;
}

/** Dimensioni dopo la riduzione: il lato lungo non supera MAX_IMAGE_SIDE. */
export function scaledSize(width, height, maxSide = MAX_IMAGE_SIDE) {
  const longest = Math.max(width, height);
  if (!longest || longest <= maxSide) return { width, height };
  const ratio = maxSide / longest;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

/** Cosa resta nel database: mai il contenuto del file. */
export function attachmentMetadata(attachment) {
  if (!attachment) return null;
  return { nome: attachment.name, tipo: attachment.mediaType, dimensione: attachment.size };
}

/** Corpo per la funzione `agente-assistente`. */
export function attachmentPayload(attachment) {
  if (!attachment?.data || !attachment?.mediaType) return null;
  return { nome: attachment.name, media_type: attachment.mediaType, data: attachment.data };
}

export function formatAttachmentSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} kB`;
  return `${(bytes / MB).toFixed(1).replace('.', ',')} MB`;
}

const base64FromDataUrl = (dataUrl) => String(dataUrl).split(',')[1] || '';

const readAsDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error || new Error('READ_FAILED'));
  reader.readAsDataURL(blob);
});

async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* fallback sotto */ }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('DECODE_FAILED'));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/**
 * File del browser → { name, mediaType, size, data (base64) }.
 * Le foto sono sempre ricodificate in JPEG con il lato lungo ≤ 2048 px:
 * una foto del telefono passa da diversi MB a qualche centinaio di kB e
 * formati come HEIC diventano leggibili dal modello.
 */
export async function prepareAttachment(file) {
  const problem = attachmentProblem(file);
  if (problem) throw new Error(problem);
  const name = String(file.name || '').slice(0, 200) || (attachmentKind(file) === 'pdf' ? 'documento.pdf' : 'foto.jpg');
  if (attachmentKind(file) === 'pdf') {
    const data = base64FromDataUrl(await readAsDataUrl(file));
    return { name, mediaType: 'application/pdf', size: file.size, data };
  }
  let image;
  try {
    image = await decodeImage(file);
  } catch {
    throw new Error('Non riesco ad aprire questa foto: prova con un JPEG o PNG.');
  }
  const { width, height } = scaledSize(image.width, image.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  image.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', IMAGE_QUALITY));
  if (!blob) throw new Error('Non riesco a preparare questa foto.');
  const data = base64FromDataUrl(await readAsDataUrl(blob));
  return { name: name.replace(/\.(heic|heif|png|webp|gif)$/i, '.jpg'), mediaType: 'image/jpeg', size: blob.size, data };
}
