// POL-VITA-008 — Condividi un documento con il foglio di condivisione del sistema (iPhone e
// Android: Mail, WhatsApp, Messaggi, AirDrop…). Si condivide il file vero; se il telefono non
// accetta file, il link all'originale su Drive; senza foglio di condivisione, il link copiato.
// Il file viene preparato prima del tocco: iOS apre il foglio solo se la chiamata parte subito
// dal tocco, non dopo un download.
import { anteprimaFile } from './archivio.js';

const MAX_IN_MEMORIA = 24; // anche più documenti scelti insieme (POL-VITA-016; fino a 20 da La mia salute)
const memoria = new Map(); // drive_file_id → Promise<{ nome, mime, dati }>

export function preparaFile(driveFileId, token) {
  if (!driveFileId) return Promise.reject(new Error('Nessun file'));
  if (!memoria.has(driveFileId)) {
    const p = anteprimaFile({ token, driveFileId }).catch((e) => { memoria.delete(driveFileId); throw e; });
    memoria.set(driveFileId, p);
    while (memoria.size > MAX_IN_MEMORIA) memoria.delete(memoria.keys().next().value);
  }
  return memoria.get(driveFileId);
}

import { ponte, salvaNativo } from './nativo.js';

export function comeFile({ nome, mime, dati }) {
  const byte = Uint8Array.from(atob(dati), (c) => c.charCodeAt(0));
  return new File([byte], nome || 'documento', { type: mime || 'application/octet-stream' });
}

// Va chiamata direttamente nel gestore del tocco. `file` (o `files`, più file insieme) può mancare:
// allora si condivide il link.
export async function condividi({ titolo, link, file, files }, nav = globalThis.navigator) {
  try {
    const tutti = files?.length ? files : file ? [file] : [];
    if (tutti.length && nav?.canShare?.({ files: tutti })) {
      await nav.share({ files: tutti, title: titolo });
      return tutti.length > 1 ? 'files' : 'file';
    }
    // Never silently replace multiple attachments with a title-only message.
    if (tutti.length > 1) return 'non_disponibile';
    if (nav?.share) {
      await nav.share({ title: titolo, text: titolo, ...(link ? { url: link } : {}) });
      return 'link';
    }
    if (link && nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(link);
      return 'copiato';
    }
    return 'non_disponibile';
  } catch (e) {
    if (e?.name === 'AbortError') return 'annullato';
    throw e;
  }
}

export function scaricaDocumento(file) {
  // SCAN-MLKIT: nell'app Android la WebView non scarica: «Salva in…» di Android.
  if (ponte()) { salvaNativo(file).catch(() => {}); return; }
  const url=URL.createObjectURL(file);
  const a=document.createElement('a');a.href=url;a.download=file.name;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}

// MIA-SALUTE (PO 2026-11-10): tasti «Mail» e «WhatsApp». Con i file si apre il foglio di
// condivisione del telefono (l'unico modo web per allegare file: lì si tocca Mail o WhatsApp);
// senza, si apre la mail nuova o WhatsApp con i link agli originali su Drive. Mai invii automatici.
export function urlInvio(canale, { titolo = 'Documenti', links = [] }) {
  const testo = [titolo, ...links].filter(Boolean).join('\n');
  return canale === 'whatsapp'
    ? `https://wa.me/?text=${encodeURIComponent(testo)}`
    : `mailto:?subject=${encodeURIComponent(titolo)}&body=${encodeURIComponent(testo)}`;
}

export async function inviaCon(canale, { titolo, files = [], links = [] }, nav = globalThis.navigator, apriUrl = (u) => globalThis.open?.(u, '_blank')) {
  try {
    if (files.length && nav?.canShare?.({ files })) {
      await nav.share({ files, title: titolo });
      return 'files';
    }
  } catch (e) {
    if (e?.name === 'AbortError') return 'annullato';
    throw e;
  }
  if (!links.length) return 'non_disponibile';
  apriUrl(urlInvio(canale, { titolo, links }));
  return 'link';
}
