// POL-VITA-032 ARCHIVIO-TEMPO e ARCHIVIO-COSE — le «cose» della vita (Casa, Auto, Famiglia,
// Studio, Soldi, più le persone delle Impostazioni) e la linea del tempo.
// Le cose raggruppano categorie già esistenti: nessuna nuova classificazione, nessun modello.
// I documenti dei pazienti e quelli poco utili restano fuori.
import { cercaChiedi, scadenzeAperte } from './archivio.js';

export const COSE = [
  { id: 'casa', nome: 'Casa', sotto: 'Immobili, utenze, riscaldamento', fascicoli: ['immobili', 'utenze', 'riscaldamento'], colore: '#2B6FD6',
    chiavi: [/^pod$/i, /^pdr$/i, /^codice (cliente|utenza)$/i, /^indirizzo (fornitura|immobile)$/i, /^(foglio|particella|subalterno)$/i] },
  { id: 'auto', nome: 'Auto', sotto: 'Veicoli, bollo, revisioni, multe', fascicoli: ['veicoli'], colore: '#C46A1B',
    chiavi: [/^targa( veicolo)?$/i, /^numero polizza$/i, /^veicolo$/i] },
  { id: 'famiglia', nome: 'Famiglia', sotto: 'Documenti, scuola, salute', fascicoli: ['identita', 'famiglia_scuola', 'sanitario_famiglia'], colore: '#7A4FD0', chiavi: [] },
  { id: 'studio', nome: 'Studio', sotto: 'Fornitori, fatture, personale, corsi', fascicoli: ['studio_fornitori', 'studio_fatture_emesse', 'personale_studio', 'formazione'], colore: '#2E8B57', chiavi: [] },
  { id: 'soldi', nome: 'Soldi', sotto: 'Conti, tasse, previdenza, polizze', fascicoli: ['conti', 'fiscale', 'previdenza', 'assicurazioni', 'legale', 'successione'], colore: '#1F2937',
    chiavi: [/^numero polizza$/i] },
];

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const RISERVATI = /iban|codice fiscale|password|pin|puk|token|c\.f\./i;

export const cosaDi = (fascicolo) => COSE.find((c) => c.fascicoli.includes(fascicolo)) || null;
export const coloreDi = (fascicolo) => cosaDi(fascicolo)?.colore || '#8A877F';
export const etichettaMese = (iso) => { const [a, m] = String(iso).split('-'); return `${MESI[Number(m) - 1][0].toUpperCase()}${MESI[Number(m) - 1].slice(1)} ${a}`; };
const fineMese = (iso) => { const [a, m] = String(iso).split('-').map(Number); return `${a}-${String(m).padStart(2, '0')}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, '0')}`; };

// Le persone delle Impostazioni diventano «cose» anche loro (documenti cercati per nome).
export function coseConPersone(persone = []) {
  const colori = ['#B4235A', '#0E7490', '#7C5E10', '#4D5BCE'];
  return [...COSE, ...persone.filter(Boolean).map((p, i) => ({ id: `persona:${p}`, nome: p.split(' ')[0], sotto: p, persona: p, fascicoli: null, colore: colori[i % colori.length], chiavi: [] }))];
}

/* ---------- tempo (puro) ---------- */

// Anni dal più recente, con le quote per cosa (barra colorata) e il totale.
export function anniDaMesi(righe, filo = 'tutto') {
  const perAnno = new Map();
  for (const r of righe) {
    const cosa = cosaDi(r.fascicolo);
    if (filo !== 'tutto' && cosa?.id !== filo) continue;
    const anno = String(r.mese).slice(0, 4);
    const a = perAnno.get(anno) || { anno, n: 0, perCosa: {} };
    a.n += r.n;
    const k = cosa?.id || 'altro';
    a.perCosa[k] = (a.perCosa[k] || 0) + r.n;
    perAnno.set(anno, a);
  }
  return [...perAnno.values()].sort((a, b) => b.anno.localeCompare(a.anno)).map((a) => ({
    anno: a.anno, n: a.n,
    seg: [...COSE.map((c) => ({ id: c.id, colore: c.colore, n: a.perCosa[c.id] || 0 })), { id: 'altro', colore: '#B8B4AA', n: a.perCosa.altro || 0 }]
      .filter((s) => s.n > 0).map((s) => ({ ...s, quota: Math.max(1, Math.round((s.n / a.n) * 100)) })),
  }));
}

// Mesi dal più recente (solo quelli con documenti), eventualmente di un anno.
export function mesiDaRighe(righe, filo = 'tutto', anno = null) {
  const perMese = new Map();
  for (const r of righe) {
    if (filo !== 'tutto' && cosaDi(r.fascicolo)?.id !== filo) continue;
    if (anno && !String(r.mese).startsWith(anno)) continue;
    const k = String(r.mese).slice(0, 7);
    perMese.set(k, (perMese.get(k) || 0) + r.n);
  }
  return [...perMese.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([k, n]) => ({ mese: `${k}-01`, n, etichetta: etichettaMese(k) }));
}

/* ---------- cose (puro) ---------- */

// I dati che contano dai documenti più recenti (targa, POD, polizza…): un valore per chiave, il più recente.
export function fattiDaDocumenti(documenti, chiavi = [], massimo = 6) {
  if (!chiavi.length) return [];
  const visti = new Map();
  const ordinati = [...documenti].sort((a, b) => String(b.data_documento || b.email_data || '').localeCompare(String(a.data_documento || a.email_data || '')));
  for (const d of ordinati) {
    const dati = d.dati_estratti && typeof d.dati_estratti === 'object' ? d.dati_estratti : {};
    for (const [k, v] of Object.entries(dati)) {
      if (v == null || typeof v === 'object' || RISERVATI.test(k)) continue;
      const testo = String(v).trim();
      if (!testo || testo.length > 80 || !chiavi.some((re) => re.test(k.trim()))) continue;
      const chiave = k.trim().toLowerCase();
      if (!visti.has(chiave)) visti.set(chiave, { k: k.trim()[0].toUpperCase() + k.trim().slice(1), v: testo, doc: d.id });
    }
    if (visti.size >= massimo) break;
  }
  return [...visti.values()].slice(0, massimo);
}

// A quale cosa appartiene una scadenza (dal documento o dal nome della persona).
export function scadenzePerCosa(scadenze, documenti, cose) {
  const fascicoloDi = new Map(documenti.map((d) => [d.id, d.fascicolo]));
  const fuori = Object.fromEntries(cose.map((c) => [c.id, []]));
  for (const s of scadenze) {
    const f = s.documento_id ? fascicoloDi.get(s.documento_id) : null;
    if (f === 'clinico_pazienti') continue;
    for (const c of cose) {
      const sua = c.persona
        ? new RegExp(`\\b${c.persona.split(' ')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(`${s.descrizione || ''}`)
        : f && c.fascicoli.includes(f);
      if (sua) fuori[c.id].push(s);
    }
  }
  return fuori;
}

const visibile = (d) => d.fascicolo !== 'clinico_pazienti' && d.rilevanza !== 'bassa';

/* ---------- database ---------- */

export async function righeTempo(db) {
  const { data, error } = await db.from('v_tempo_mesi').select('mese, fascicolo, n').limit(10000);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function documentiDelMese(db, mese, filo = 'tutto', limite = 80) {
  const cosa = COSE.find((c) => c.id === filo);
  const filtri = { da: mese, a: fineMese(mese), ...(cosa ? { fascicoli: cosa.fascicoli } : {}) };
  return (await cercaChiedi(db, { testo: '', filtri, limite })).filter(visibile);
}

export async function documentiDellaCosa(db, cosa, limite = 120) {
  const r = cosa.persona
    ? await cercaChiedi(db, { testo: cosa.persona, limite })
    : await cercaChiedi(db, { testo: '', filtri: { fascicoli: cosa.fascicoli }, limite });
  return r.filter(visibile);
}

// Per le schede: quanti documenti ha ogni cosa e le prossime scadenze.
export async function riepilogoCose(db, cose) {
  const [righe, scadenze] = await Promise.all([righeTempo(db), scadenzeAperte(db, 120).catch(() => [])]);
  const ids = [...new Set((scadenze || []).map((s) => s.documento_id).filter(Boolean))];
  let documenti = [];
  if (ids.length) {
    const { data } = await db.from('documenti').select('id, fascicolo').in('id', ids.slice(0, 300));
    documenti = data || [];
  }
  const perCosa = scadenzePerCosa(scadenze || [], documenti, cose);
  return Object.fromEntries(cose.map((c) => [c.id, {
    n: c.fascicoli ? righe.filter((r) => c.fascicoli.includes(r.fascicolo)).reduce((s, r) => s + r.n, 0) : null,
    scadenze: (perCosa[c.id] || []).sort((a, b) => String(a.data).localeCompare(String(b.data))),
  }]));
}
