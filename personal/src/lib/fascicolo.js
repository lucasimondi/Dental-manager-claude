// Complete folder operations. Never treat a search page as the complete folder.
import { CAMPI_DOC, URL_CARICAMENTO } from './archivio.js';

export async function tuttiDocumentiCartella(db, ente) {
  const tutti = [];
  for (let da = 0; ; ) {
    let q = db.from('documenti').select(CAMPI_DOC).neq('fascicolo', 'clinico_pazienti').order('id');
    q = ente == null ? q.is('ente', null) : q.eq('ente', ente);
    const { data, error } = await q.range(da, da + 199);
    if (error) throw new Error(error.message || 'Cartella non caricata');
    tutti.push(...data);
    if (!data.length) return tutti.sort((a, b) => String(b.email_data || b.data_documento || '').localeCompare(String(a.email_data || a.data_documento || '')));
    da += data.length;
  }
}

export async function azioneFascicolo(token, azione, campi, fetchImpl = fetch) {
  if (!token) throw new Error('Sessione scaduta: esci e rientra.');
  const res = await fetchImpl(URL_CARICAMENTO, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...campi, azione, token }) });
  let r;
  try { r = await res.json(); } catch { throw new Error('Aggiornamento archivio necessario o servizio non raggiungibile.'); }
  if (!r.ok) throw new Error(r.errore === 'File mancante' ? 'Aggiorna lo script Archivio personale per attivare questa funzione.' : r.errore || 'Operazione non disponibile');
  return r;
}

// Read every original, one request per file so Apps Script execution limits do not truncate
// a large folder. The answer and every excluded/failed source stay visible together.
export async function interrogaFascicolo(documenti, domanda, chiama, progresso = () => {}, annullato = () => false) {
  const letti = [], esclusi = [];
  for (const d of documenti) {
    if (annullato()) throw new Error('Analisi interrotta');
    progresso(`Leggo ${letti.length + esclusi.length + 1}/${documenti.length}`);
    if (d.fascicolo === 'clinico_pazienti' || !d.drive_file_id) {
      esclusi.push({ id: d.id, titolo: d.titolo, motivo: d.fascicolo === 'clinico_pazienti' ? 'Documento clinico paziente escluso' : 'Originale non disponibile' });
      continue;
    }
    try {
      const r = await chiama('fascicolo_leggi', { id: d.id, domanda });
      if (!r.testo) throw new Error('Nessun contenuto leggibile');
      letti.push({ id: d.id, titolo: d.titolo, testo: r.testo, parziale: !!r.parziale });
    } catch (e) {
      if (/Sessione|Aggiorna lo script|limite di spesa|Poliedron AI è ferma|limite gratuito/.test(e.message)) throw e;
      esclusi.push({ id: d.id, titolo: d.titolo, motivo: e.message });
    }
  }
  if (!letti.length) return { risposta: 'Nessun originale analizzato. Consulta il resoconto dei documenti.', letti, esclusi };
  // Recursive reduction includes ALL sources; no slice(0, N) or unreported context truncation.
  let gruppi = letti.map((d) => ({ testo: `[[doc:${d.id}|${d.titolo}]]\n${d.testo}` }));
  while (gruppi.length > 1) {
    const prossimi = [];
    for (let i = 0; i < gruppi.length; i += 8) {
      if (annullato()) throw new Error('Analisi interrotta');
      progresso('Confronto i documenti…');
      const r = await chiama('fascicolo_rispondi', { domanda, evidenze: gruppi.slice(i, i + 8).map((g) => g.testo) });
      if (!r.testo) throw new Error('Sintesi non disponibile');
      prossimi.push({ testo: r.testo });
    }
    gruppi = prossimi;
  }
  return { risposta: gruppi[0].testo, letti, esclusi };
}

export const annoDocumento = (d) => {
  const data = d.data_documento || d.email_data || '';
  return /^\d{4}/.test(String(data)) ? String(data).slice(0, 4) : 'Senza data';
};

export const nomeSicuro = (s) => String(s || 'documento').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/^\.+$/, '_').slice(0, 140);

// ZIP STORE (UTF-8, no compression). Native Blob parts avoid another dependency and preserve
// original bytes. The manifest makes missing files explicit, including same-name originals.
export function zipFile(voci) {
  if (voci.length > 65535) throw new Error('Troppi file per un archivio: scegli una cartella più piccola');
  const parti = [], centrali = [];
  let posizione = 0;
  const header = (n) => { const a = new Uint8Array(n); return [a, new DataView(a.buffer)]; };
  for (const { nome, byte } of voci) {
    const nomeByte = new TextEncoder().encode(nome);
    if (nomeByte.length > 65535 || byte.length > 0xffffffff || posizione + byte.length > 0xffffffff) throw new Error('Archivio troppo grande');
    let crc = 0xffffffff;
    for (const b of byte) { crc ^= b; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
    crc = (crc ^ 0xffffffff) >>> 0;
    const [h, v] = header(30);
    v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x800, true);
    v.setUint16(12, 33, true); v.setUint32(14, crc, true); v.setUint32(18, byte.length, true); v.setUint32(22, byte.length, true); v.setUint16(26, nomeByte.length, true);
    const [c, cv] = header(46);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x800, true); cv.setUint16(14, 33, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, byte.length, true); cv.setUint32(24, byte.length, true); cv.setUint16(28, nomeByte.length, true); cv.setUint32(42, posizione, true);
    parti.push(h, nomeByte, byte); centrali.push(c, nomeByte);
    posizione += h.length + nomeByte.length + byte.length;
  }
  const [fine, fv] = header(22);
  const dimensione = centrali.reduce((n, c) => n + c.length, 0);
  fv.setUint32(0, 0x06054b50, true); fv.setUint16(8, voci.length, true); fv.setUint16(10, voci.length, true); fv.setUint32(12, dimensione, true); fv.setUint32(16, posizione, true);
  return new Blob([...parti, ...centrali, fine], { type: 'application/zip' });
}

export async function esportaFascicolo(documenti, scarica, progresso = () => {}, annullato = () => false) {
  const voci = [], manifest = [], nomi = new Set();
  let dimensione = 0;
  for (const d of documenti) {
    if (annullato()) throw new Error('Preparazione interrotta');
    progresso(`Preparo ${manifest.length + 1}/${documenti.length}`);
    try {
      if (d.fascicolo === 'clinico_pazienti') throw new Error('Documento clinico paziente escluso dalla condivisione');
      if (!d.drive_file_id) throw new Error('Originale non disponibile');
      const r = await scarica(d.drive_file_id, d);
      const byte = Uint8Array.from(atob(r.dati), (c) => c.charCodeAt(0));
      dimensione += byte.length;
      if (dimensione > 120 * 1024 * 1024) throw Object.assign(new Error('Cartella oltre 120 MB: esporta gruppi più piccoli dalla selezione'), { limite: true });
      const base = nomeSicuro(r.nome || d.nome_file_originale || d.titolo);
      let nome = `${nomeSicuro(d.ente || 'Senza cartella')}/${annoDocumento(d)}/${base}`, n = 1;
      while (nomi.has(nome)) nome = `${nomeSicuro(d.ente || 'Senza cartella')}/${annoDocumento(d)}/${n++}_${base}`;
      nomi.add(nome); voci.push({ nome, byte });
      manifest.push({ id: d.id, titolo: d.titolo, file: nome, stato: 'incluso' });
    } catch (e) {
      if (e.limite) throw e;
      manifest.push({ id: d.id, titolo: d.titolo, stato: 'non incluso', motivo: e.message });
    }
  }
  const inclusi = voci.length;
  voci.push({ nome: 'CONTENUTO.json', byte: new TextEncoder().encode(JSON.stringify({ totale: documenti.length, inclusi, documenti: manifest }, null, 2)) });
  return { blob: zipFile(voci), inclusi, mancanti: manifest.filter((d) => d.stato !== 'incluso') };
}
