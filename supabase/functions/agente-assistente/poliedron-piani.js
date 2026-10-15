// Poliedron Core — preventivi e piani di cura senza modello (PO 2026-10-15:
// "Ora voglio che faccia i piani di cura ed i preventivi").
// "Preventivo per Mario Rossi: igiene, otturazione 36 e 37, corona 46 650 euro".
// Pure functions: the sentence becomes items (text, teeth, quantity, price);
// prices come from the studio's listino or from the sentence itself, never
// invented. Patient, permissions and the write stay server-side (piani.js).

const clean = (v = '') => String(v).normalize('NFC').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
const fold = (v = '') => clean(v).toLocaleLowerCase('it-IT').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const NUMBER_WORDS = { un: 1, una: 1, uno: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10 };
const STOP = new Set(['di', 'del', 'della', 'dei', 'delle', 'su', 'sul', 'sui', 'sulla', 'al', 'ai', 'alla', 'con', 'per', 'il', 'lo', 'la', 'le', 'gli', 'i', 'un', 'una', 'uno', 'e', 'a', 'in', 'dente', 'denti', 'elemento', 'elementi']);
// FDI numbering: permanent 11-48, deciduous 51-85.
const TOOTH = '(?:[1-4][1-8]|[5-8][1-5])';
const PRICE_RE = /(?:€\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*(?:euro|eur|€))/i;
const NAME = "[A-Za-zÀ-ÿ'][A-Za-zÀ-ÿ' ]{1,60}?";

const toPrice = (s) => Math.round(Number(String(s).replace(',', '.')) * 100) / 100;

/** One item of the sentence: { testo, denti[], quantita, prezzo|null }, or null when nothing is left to name. */
export function parseVoce(raw = '') {
  let t = ` ${clean(raw)} `;
  let prezzo = null;
  const p = t.match(PRICE_RE);
  if (p) { prezzo = toPrice(p[1] || p[2]); t = t.replace(p[0], ' '); }
  const denti = [];
  t = t.replace(new RegExp(`(?:\\b(?:sul|sui|su|al|ai|del|dei)\\s+)?(?:\\b(?:dente|denti|elemento|elementi)\\s+)?\\b(${TOOTH})\\b`, 'gi'), (_, d) => { denti.push(d); return ' '; });
  let quantita = 1;
  const q = clean(t).match(/^(\d{1,2}|un|una|uno|due|tre|quattro|cinque|sei|sette|otto|nove|dieci)\s+(?=[a-zà-ÿ])/i);
  if (q) { quantita = /^\d+$/.test(q[1]) ? Number(q[1]) : NUMBER_WORDS[q[1].toLowerCase()]; t = clean(t).slice(q[0].length); }
  const testo = clean(t).replace(/^(?:(?:di|del|della|un|una|uno)\s+)+/i, '').replace(/\s+(?:(?:su|sul|sui|al|ai|del|dei|e)\s*)+$/i, '').trim();
  if (!testo || /\d/.test(testo) || quantita < 1 || quantita > 32) return null;
  return { testo, denti: [...new Set(denti)], quantita, prezzo };
}

/**
 * "Preventivo per Mario Rossi: igiene, otturazione 36", "fai un piano di cura a
 * Rossi con 2 impianti 36 e 37". Returns the Core action or null.
 */
export function parsePlanCreate(text = '') {
  const t = clean(text);
  if (/\?\s*$/.test(t)) return null;
  const m = t.match(new RegExp(`^(?:(?:fai|fammi|crea|creami|prepara|preparami|nuovo|nuova|scrivi|inserisci)\\s+)?(?:(?:un|una|il|lo)\\s+)?(?:nuovo\\s+)?(preventivo|piano(?:\\s+di\\s+(?:cura|trattamento))?(?!\\s+di\\s+(?:cura|trattamento)))\\s+(?:per|a|al|alla|di|del|della)\\s+(?:(?:il|la)\\s+)?(?:paziente\\s+)?(${NAME})\\s*(?::|,|–|-|\\bcon\\b|\\bper\\b)\\s*(.+)$`, 'i'));
  if (!m) return null;
  const [, kind, patient, rest] = m;
  // Items: commas, "e", "+", "più". A piece made only of teeth ("36 e 37") belongs to the previous item.
  const pieces = rest.split(/\s*(?:,|;|\+|\bpiù\b|\be\b)\s*/i).map(clean).filter(Boolean);
  const voci = [];
  for (const piece of pieces) {
    if (new RegExp(`^(?:(?:dente|denti|elemento|elementi|sul|sui|su)\\s+)?${TOOTH}$`, 'i').test(piece) && voci.length) {
      voci.at(-1).denti.push(piece.match(new RegExp(TOOTH))[0]);
      continue;
    }
    const v = parseVoce(piece);
    if (!v) return null;
    voci.push(v);
  }
  if (!voci.length || voci.length > 30) return null;
  return { intent: 'PLAN_CREATE', confidence: .94, entities: { patient_query: clean(patient), tipo: /^preventivo$/i.test(kind) ? 'preventivo' : 'piano', voci }, missing: [] };
}

const stems = (s) => fold(s).split(' ').filter((w) => w.length >= 3 && !STOP.has(w)).map((w) => w.slice(0, 5));

/**
 * The listino entry a spoken item refers to: every word of the item must start
 * a word of the entry ("otturazione" → "Otturazione composita"). Several
 * entries → the exact name, else the shortest one if it is the only shortest;
 * otherwise the candidates are returned and the user chooses.
 */
// Everyday words the listino names differently. Tried only when the word itself matches nothing.
const SINONIMI = { igiene: 'ablazione tartaro', pulizia: 'ablazione tartaro', detartrasi: 'ablazione tartaro' };

/** Listino rows by name: duplicates merged; one name with different prices keeps all prices (the user chooses). */
export function unisciListino(listino = []) {
  const byName = new Map();
  for (const row of listino) {
    const key = fold(row.nome);
    if (!key) continue;
    const entry = byName.get(key) || { nome: clean(row.nome), prezzi: new Set() };
    if (Number.isFinite(Number(row.prezzo))) entry.prezzi.add(Number(row.prezzo));
    byName.set(key, entry);
  }
  return [...byName.values()].map((e) => ({ nome: e.nome, prezzi: [...e.prezzi].sort((x, y) => x - y), prezzo: e.prezzi.size === 1 ? [...e.prezzi][0] : null }));
}

export function matchListino(testo, listino = []) {
  const found = matchOne(testo, listino);
  if (found.voce || found.candidati.length) return found;
  const alt = SINONIMI[fold(testo)];
  return alt ? matchOne(alt, listino) : found;
}

function matchOne(testo, listino) {
  const want = stems(testo);
  if (!want.length) return { candidati: [] };
  const hits = listino.filter((row) => {
    const words = fold(row.nome).split(' ');
    return want.every((s) => words.some((w) => w.startsWith(s)));
  });
  if (hits.length <= 1) return hits.length ? { voce: hits[0], candidati: [] } : { candidati: [] };
  const exact = hits.filter((row) => fold(row.nome) === fold(testo));
  if (exact.length === 1) return { voce: exact[0], candidati: [] };
  const size = (row) => fold(row.nome).split(' ').length;
  const min = Math.min(...hits.map(size));
  const shortest = hits.filter((row) => size(row) === min);
  if (shortest.length === 1 && min === want.length) return { voce: shortest[0], candidati: [] };
  return { candidati: hits.slice(0, 6) };
}

const capitalize = (s) => s.charAt(0).toLocaleUpperCase('it-IT') + s.slice(1);

/**
 * The plan's items from the parsed sentence and the listino: { voci } ready for
 * crea_piano_cura, or { problemi } (one line each) when a price is unknown or
 * an item matches several listino entries. Nothing is guessed.
 */
export function vociDaListino(voci = [], righeListino = []) {
  const listino = unisciListino(righeListino);
  const out = [], problemi = [];
  for (const v of voci) {
    const match = matchListino(v.testo, listino);
    let nome, prezzo;
    if (v.prezzo != null) {
      nome = match.voce?.nome || capitalize(v.testo);
      prezzo = v.prezzo;
    } else if (match.voce && match.voce.prezzo != null) {
      nome = match.voce.nome;
      prezzo = Number(match.voce.prezzo);
    } else if (match.voce) {
      problemi.push(`“${match.voce.nome}” ha più prezzi nel listino (${match.voce.prezzi.map((x) => `${x} €`).join(', ')}): dimmi quale (es. “${v.testo} ${match.voce.prezzi.at(-1)} euro”).`);
      continue;
    } else if (match.candidati?.length) {
      problemi.push(`“${v.testo}”: nel listino ci sono ${match.candidati.map((c) => c.nome).join(', ')}. Quale?`);
      continue;
    } else {
      problemi.push(`“${v.testo}” non è nel listino: dimmi il prezzo (es. “${v.testo} 80 euro”).`);
      continue;
    }
    const denti = v.denti.length ? v.denti : Array.from({ length: v.quantita }, () => '');
    for (const dente of denti) out.push({ prestazione: nome, prezzo, ...(dente ? { dente } : {}) });
  }
  return problemi.length ? { problemi } : { voci: out };
}

/** Plan title: the treatments, in order, without repeats. */
export const titoloPiano = (voci = []) => [...new Set(voci.map((v) => v.prestazione))].join(', ').slice(0, 120) || 'Piano di cura';
