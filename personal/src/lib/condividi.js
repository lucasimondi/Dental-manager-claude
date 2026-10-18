// POL-VITA-008 — Condividi un documento con il foglio di condivisione del sistema (iPhone e
// Android: Mail, WhatsApp, Messaggi, AirDrop…). Si condivide il file vero; se il telefono non
// accetta file, il link all'originale su Drive; senza foglio di condivisione, il link copiato.
// Il file viene preparato prima del tocco: iOS apre il foglio solo se la chiamata parte subito
// dal tocco, non dopo un download.
import { anteprimaFile } from './archivio.js';

const MAX_IN_MEMORIA = 12; // anche più documenti scelti insieme (POL-VITA-014)
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
