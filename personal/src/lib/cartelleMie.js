// POL-VITA-031 CARTELLE-MIE — cartelle e sottocartelle create da Luca.
// Un documento può stare in più cartelle; i file su Drive non si spostano.
// Le cartelle non si cancellano: si archiviano e si possono ripristinare.
import { CAMPI_DOC } from './archivio.js';

const esito = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const CAMPI_CARTELLA = 'id, nome, padre_id, colore, posizione, creato_il, modificato_il, archiviata_il, n_documenti, n_sottocartelle';

/* ---------- albero (puro) ---------- */

// Mappa id → cartella con `figli` ordinati per posizione e nome.
export function costruisciAlbero(cartelle, { ancheArchiviate = false } = {}) {
  const vive = cartelle.filter((c) => ancheArchiviate || !c.archiviata_il);
  const perId = new Map(vive.map((c) => [c.id, { ...c, figli: [] }]));
  const radici = [];
  for (const c of perId.values()) {
    const padre = c.padre_id && perId.get(c.padre_id);
    (padre ? padre.figli : radici).push(c);
  }
  const ordina = (a, b) => (a.posizione - b.posizione) || a.nome.localeCompare(b.nome, 'it');
  const ordinaTutti = (l) => { l.sort(ordina); l.forEach((c) => ordinaTutti(c.figli)); };
  ordinaTutti(radici);
  return { radici, perId };
}

// La cartella e tutte le sue sottocartelle (id), a qualsiasi profondità.
export function discendenti(cartelle, id) {
  const fuori = new Set([id]);
  let aggiunte = true;
  while (aggiunte) {
    aggiunte = false;
    for (const c of cartelle) if (c.padre_id && fuori.has(c.padre_id) && !fuori.has(c.id)) { fuori.add(c.id); aggiunte = true; }
  }
  return fuori;
}

// Dalla radice alla cartella: [{id, nome}, …].
export function percorso(cartelle, id) {
  const perId = new Map(cartelle.map((c) => [c.id, c]));
  const fuori = [];
  const visti = new Set();
  let c = perId.get(id);
  while (c && !visti.has(c.id)) { visti.add(c.id); fuori.unshift({ id: c.id, nome: c.nome }); c = c.padre_id ? perId.get(c.padre_id) : null; }
  return fuori;
}

// Dove si possono spostare le cartelle `ids`: mai dentro sé stesse o le proprie sottocartelle.
export function destinazioniPossibili(cartelle, ids) {
  const vietate = new Set();
  for (const id of ids) for (const d of discendenti(cartelle, id)) vietate.add(d);
  return cartelle.filter((c) => !c.archiviata_il && !vietate.has(c.id));
}

// Elenco piatto per i fogli di scelta: "Casa › Utenze".
export function elencoConPercorso(cartelle) {
  const vive = cartelle.filter((c) => !c.archiviata_il);
  return vive.map((c) => ({ id: c.id, nome: percorso(vive, c.id).map((p) => p.nome).join(' › ') }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
}

// Nome di file sicuro dentro uno ZIP (niente barre, niente caratteri riservati).
export function nomeSicuro(s, ripiego = 'documento') {
  const n = String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  return n || ripiego;
}

// Estensione dal nome originale o dal tipo.
export function nomeFileDoc(d) {
  const orig = d.nome_file_originale || '';
  const ext = (orig.match(/\.([a-z0-9]{2,5})$/i) || [])[1]
    || ({ 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic' })[d.mime_type] || '';
  const base = nomeSicuro(d.titolo || orig.replace(/\.[^.]+$/, '') || 'documento');
  return ext && !base.toLowerCase().endsWith(`.${ext.toLowerCase()}`) ? `${base}.${ext.toLowerCase()}` : base;
}

// Nomi unici nella stessa cartella dello ZIP: "Bolletta.pdf", "Bolletta (2).pdf".
export function rendiUnici(percorsi) {
  const usati = new Map();
  return percorsi.map((p) => {
    const k = p.toLowerCase();
    const n = (usati.get(k) || 0) + 1;
    usati.set(k, n);
    if (n === 1) return p;
    const m = p.match(/^(.*?)(\.[^./]+)?$/);
    return `${m[1]} (${n})${m[2] || ''}`;
  });
}

/* ---------- database ---------- */

export async function caricaCartelleMie(db, { ancheArchiviate = true } = {}) {
  let q = db.from('v_cartelle_mie').select(CAMPI_CARTELLA);
  if (!ancheArchiviate) q = q.is('archiviata_il', null);
  return esito(await q.order('posizione', { ascending: true }).order('nome', { ascending: true }));
}

export async function creaCartella(db, { nome, padre_id = null }) {
  const n = String(nome || '').trim();
  if (!n) throw new Error('Scrivi un nome per la cartella');
  return esito(await db.from('cartelle_mie').insert({ nome: n, padre_id }).select('id, nome, padre_id').single());
}

export async function rinominaCartella(db, id, nome) {
  const n = String(nome || '').trim();
  if (!n) throw new Error('Scrivi un nome per la cartella');
  return esito(await db.from('cartelle_mie').update({ nome: n }).eq('id', id).select('id, nome').single());
}

export async function spostaCartelle(db, ids, padre_id) {
  if (!ids.length) return [];
  return esito(await db.from('cartelle_mie').update({ padre_id }).in('id', ids).select('id, padre_id'));
}

export async function archiviaCartelle(db, ids, archivia = true) {
  if (!ids.length) return [];
  return esito(await db.from('cartelle_mie').update({ archiviata_il: archivia ? new Date().toISOString() : null }).in('id', ids).select('id, archiviata_il'));
}

export async function documentiDellaCartella(db, cartellaId) {
  const righe = esito(await db.from('cartelle_mie_documenti').select(`aggiunto_il, documenti(${CAMPI_DOC})`).eq('cartella_id', cartellaId).order('aggiunto_il', { ascending: false }).limit(1000));
  return righe.map((r) => r.documenti).filter(Boolean);
}

// Per lo ZIP: i documenti di più cartelle con la cartella di provenienza.
export async function collegamenti(db, cartellaIds) {
  if (!cartellaIds.length) return [];
  return esito(await db.from('cartelle_mie_documenti').select(`cartella_id, documenti(${CAMPI_DOC})`).in('cartella_id', cartellaIds).limit(5000));
}

export async function aggiungiDocumenti(db, cartellaId, documentoIds) {
  if (!documentoIds.length) return [];
  const righe = documentoIds.map((documento_id) => ({ cartella_id: cartellaId, documento_id }));
  return esito(await db.from('cartelle_mie_documenti').upsert(righe, { onConflict: 'cartella_id,documento_id', ignoreDuplicates: true }).select('documento_id'));
}

// Toglie i documenti da UNA cartella: i documenti restano in archivio e nelle altre cartelle.
export async function togliDocumenti(db, cartellaId, documentoIds) {
  if (!documentoIds.length) return [];
  return esito(await db.from('cartelle_mie_documenti').delete().eq('cartella_id', cartellaId).in('documento_id', documentoIds).select('documento_id'));
}

export async function cartelleDelDocumento(db, documentoId) {
  return esito(await db.from('cartelle_mie_documenti').select('cartella_id').eq('documento_id', documentoId)).map((r) => r.cartella_id);
}
