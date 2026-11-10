// ACQUISISCI-UNICO (PO 2026-11-10): dal tasto unico di Studio si può archiviare nel personale.
// Stesso percorso di Personal (caricaDocumento → Drive «Archivio personale/Caricati» e indice), con la
// sessione dell'archivio già salvata da Personal in questo indirizzo: nessun nuovo accesso. Senza
// sessione non scrive nulla e lo dice. I documenti dei pazienti vanno archiviati in Studio.
import { archivio } from './scadenzePersonali.js';

export async function sessioneArchivioPersonale() {
  try { const db = await archivio(); return (await db.auth.getSession()).data?.session || null; } catch { return null; }
}

export async function archiviaInPersonale(file, descrizione = '', tag = []) {
  const s = await sessioneArchivioPersonale();
  if (!s?.access_token) throw new Error('Archivio personale non collegato: apri Personal una volta su questo telefono, poi riprova.');
  const [{ preparaFile }, { caricaDocumento }] = await Promise.all([import('../../personal/src/lib/file.js'), import('../../personal/src/lib/archivio.js')]);
  const pronto = await preparaFile(file);
  const r = await caricaDocumento({ token: s.access_token, ...pronto, descrizione });
  // DOCUMENTI-TAG: i tag scelti si aggiungono a quelli dell'archivio (stessa colonna `tag` usata da Personal).
  if (r?.id && tag?.length) {
    const db = await archivio();
    const { data } = await db.from('documenti').select('tag').eq('id', r.id).maybeSingle();
    await db.from('documenti').update({ tag: [...new Set([...(data?.tag || []), ...tag])] }).eq('id', r.id);
  }
  return r;
}
