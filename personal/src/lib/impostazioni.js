// POL-VITA-003 — impostazioni di Poliedron Personal (persone, documenti personali, sezioni).
// Salvate nel database dell'archivio (tabella impostazioni_app, solo il proprietario): uguali su
// telefono e computer e non perse reinstallando l'app.
import { ETICHETTE_PREDEFINITE } from './agenda.js';
import { CATEGORIE_SPESA, CATEGORIE_INCASSO } from './conti.js';

const CHIAVE = 'personal';

export const IMPOSTAZIONI_PREDEFINITE = Object.freeze({
  persone: ['Luca Simondi', 'Martina Simondi', 'Giulia Simondi'],
  categorie: [
    { id: 'carta_identita', nome: "Carta d'identità", parole: ["carta d'identità", 'carta di identità', "carta d'identita", 'documento di identità', 'cie'] },
    { id: 'codice_fiscale', nome: 'Codice fiscale', parole: ['codice fiscale', 'tessera sanitaria', 'tesserino fiscale'] },
    { id: 'patente', nome: 'Patente', parole: ['patente'] },
    { id: 'passaporto', nome: 'Passaporto', parole: ['passaporto'] },
  ],
  sezioni: [
    { id: 'bollette', nome: 'Bollette', fascicoli: ['utenze'], parole: ['bolletta'] },
    { id: 'riscaldamento', nome: 'Riscaldamento', fascicoli: ['riscaldamento'], parole: ['pellet', 'legna', 'gasolio', 'gpl', 'caldaia', 'stufa'] },
  ],
  etichette: ETICHETTE_PREDEFINITE,
  categorieSpesa: CATEGORIE_SPESA,
  categorieIncasso: CATEGORIE_INCASSO,
});

const copia = (o) => JSON.parse(JSON.stringify(o));
const testo = (s) => String(s ?? '').trim();
export const slug = (s) => testo(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'sezione';

// Ripulisce ciò che arriva dal database: valori mancanti → predefiniti, niente doppioni.
export function normalizza(valore) {
  const v = valore && typeof valore === 'object' ? valore : {};
  const base = copia(IMPOSTAZIONI_PREDEFINITE);
  const unici = (xs) => [...new Map(xs.map((x) => [x.id ?? x, x])).values()];
  const persone = Array.isArray(v.persone) ? unici(v.persone.map(testo).filter(Boolean)) : base.persone;
  const categorie = Array.isArray(v.categorie)
    ? unici(v.categorie.filter((c) => c && testo(c.nome)).map((c) => ({ id: c.id || slug(c.nome), nome: testo(c.nome), parole: (c.parole || []).map(testo).filter(Boolean) })))
    : base.categorie;
  const sezioni = Array.isArray(v.sezioni)
    ? unici(v.sezioni.filter((s) => s && testo(s.nome)).map((s) => ({
      id: s.id || slug(s.nome), nome: testo(s.nome),
      fascicoli: (s.fascicoli || []).map(testo).filter(Boolean), parole: (s.parole || []).map(testo).filter(Boolean),
    })))
    : base.sezioni;
  const colore = (c) => (/^#[0-9a-f]{6}$/i.test(testo(c)) ? testo(c) : '#64748b');
  const etichette = Array.isArray(v.etichette) && v.etichette.length
    ? unici(v.etichette.filter((e) => e && testo(e.nome)).map((e) => ({ id: e.id || slug(e.nome), nome: testo(e.nome), colore: colore(e.colore) })))
    : base.etichette;
  const elenco = (xs, predefiniti) => (Array.isArray(xs) && xs.length ? [...new Set(xs.map(testo).filter(Boolean))] : [...predefiniti]);
  return { persone, categorie, sezioni, etichette, categorieSpesa: elenco(v.categorieSpesa, base.categorieSpesa), categorieIncasso: elenco(v.categorieIncasso, base.categorieIncasso) };
}

export async function leggiImpostazioni(db) {
  const { data, error } = await db.from('impostazioni_app').select('valore').eq('chiave', CHIAVE).maybeSingle();
  if (error) throw new Error(error.message);
  return normalizza(data?.valore);
}

export async function salvaImpostazioni(db, impostazioni) {
  const valore = normalizza(impostazioni);
  const { error } = await db.from('impostazioni_app')
    .upsert({ chiave: CHIAVE, valore, aggiornato_il: new Date().toISOString() }, { onConflict: 'chiave' });
  if (error) throw new Error(error.message);
  return valore;
}

// Documenti personali: categoria e persona scelte da Luca; se mancano, dedotte dal testo.
const minuscolo = (s) => testo(s).toLowerCase();
export function categoriaDi(doc, categorie) {
  if (doc?.categoria) return doc.categoria;
  const t = minuscolo(`${doc?.tipo_documento || ''} ${doc?.titolo || ''}`);
  return categorie.find((c) => c.parole.some((p) => p && t.includes(p.toLowerCase())))?.id || null;
}

export function personaDi(doc, persone) {
  if (doc?.persona) return doc.persona;
  const t = minuscolo(`${doc?.titolo || ''} ${doc?.riassunto || ''}`);
  // Nome completo, poi il solo nome se è unico tra le persone (es. "Martina").
  const piena = persone.find((p) => t.includes(minuscolo(p)));
  if (piena) return piena;
  const perNome = persone.filter((p) => t.includes(minuscolo(p).split(/\s+/)[0]));
  return perNome.length === 1 ? perNome[0] : null;
}

// Filtro PostgREST di una sezione: fascicoli scelti oppure parole nel titolo o nel riassunto.
export function filtroSezione(sezione) {
  const condizioni = [];
  if (sezione?.fascicoli?.length) condizioni.push(`fascicolo.in.(${sezione.fascicoli.map((f) => slug(f)).join(',')})`);
  for (const parola of sezione?.parole || []) {
    const p = testo(parola).replace(/[",()*\\]/g, ' ').trim();
    if (p) condizioni.push(`titolo.ilike."*${p}*"`, `riassunto.ilike."*${p}*"`);
  }
  return condizioni.join(',');
}
