// CONCORDATO (PO 2026-11-20): i beni immobili di Luca (dalla visura) e le proposte di divisione con Anna.
// Qui solo dati e calcoli, senza React: l'app, il PDF e i test usano le stesse funzioni.
const esito = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

/* ---------- Quote, nomi, valori ---------- */
export function quota(q) {
  const m = String(q ?? '').match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
  return m && Number(m[2]) > 0 ? Number(m[1]) / Number(m[2]) : null;
}
const cent = (n) => Math.round(n * 100) / 100;
export const TIPI = {
  'A/2': 'Abitazione civile', 'A/3': 'Abitazione', 'A/4': 'Abitazione popolare', 'A/7': 'Villino',
  'C/1': 'Negozio', 'C/2': 'Magazzino', 'C/3': 'Laboratorio', 'C/6': 'Garage / box', 'C/7': 'Tettoia', 'F/1': 'Area urbana',
};
export const tipoBene = (b) => (b.catasto === 'T' ? `Terreno – ${String(b.categoria || '').toLowerCase()}` : TIPI[b.categoria] || b.categoria || 'Immobile');
export const eAbitazione = (b) => b.catasto === 'F' && /^A\//.test(b.categoria || '') && b.categoria !== 'A/10';
export function datiCatastali(b, aCapo = false) {
  const base = `fg ${b.foglio} · part. ${b.particella}`;
  return b.subalterno ? `${base}${aCapo ? '\n' : ' · '}sub ${b.subalterno}` : base;
}
// Valore catastale ai fini fiscali (rendita rivalutata × moltiplicatore): solo un riferimento per confrontare i
// beni tra loro, non è un valore di mercato.
export function valoreCatastale(b) {
  if (b.catasto === 'T') return b.reddito_dominicale ? Math.round(Number(b.reddito_dominicale) * 1.25 * 135) : null;
  const r = Number(b.rendita); const c = String(b.categoria || '').toUpperCase();
  if (!r) return null;
  const k = c === 'A/10' ? 80 : c.startsWith('A/') ? 160 : c.startsWith('B/') ? 140 : c === 'C/1' ? 55
    : ['C/2', 'C/6', 'C/7'].includes(c) ? 160 : ['C/3', 'C/4', 'C/5'].includes(c) ? 140 : c.startsWith('D/') ? 65 : null;
  return k ? Math.round(r * 1.05 * k) : null;
}
// Importi scritti all'italiana: «250.000», «250.000,50», «250000», «250 mila», «250k», «1,2 mln».
export function leggiEuro(testo) {
  let s = String(testo ?? '').trim().toLowerCase().replace(/€|euro/g, '').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  let molt = 1;
  if (/(k|mila)$/.test(s)) { molt = 1000; s = s.replace(/\s*(k|mila)$/, ''); } else if (/(mln|milioni|milione)$/.test(s)) { molt = 1e6; s = s.replace(/\s*(mln|milioni|milione)$/, ''); }
  s = s.replace(/\s/g, '');
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d+(,\d+)?$/.test(s)) s = s.replace(',', '.');
  else if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
  const n = Number(s) * molt;
  return Number.isFinite(n) && n >= 0 ? cent(n) : NaN;
}
export const euroIntero = (n) => (n == null || Number.isNaN(Number(n)) ? '—' : `${Math.round(Number(n)).toLocaleString('it-IT')} €`);

/* ---------- Divisione ---------- */
// A chi va un bene nella proposta. «comune» = resta in comproprietà, fuori dalla divisione.
export const DESTINI = [['luca', 'A te'], ['anna', 'Ad Anna'], ['vendita', 'Si vende'], ['comune', 'Resta in comune']];
export const beniDivisibili = (beni) => beni.filter((b) => b.in_divisione && quota(b.quota_luca) != null && quota(b.quota_anna) != null);

// Regola della divisione: ognuno deve ricevere il valore della sua quota. Il conguaglio è quanto Anna deve a
// Luca (negativo: quanto Luca deve ad Anna) = la parte di Luca dei beni che vanno ad Anna − la parte di Anna dei
// beni che vanno a Luca, più le voci aggiunte a mano (accolli di mutuo, spese, acconti).
export function calcolaDivisione(beni, scenario = {}) {
  const ass = scenario.assegnazioni || {};
  const r = { lottoLuca: 0, lottoAnna: 0, vendita: 0, venditaLuca: 0, venditaAnna: 0, dirittoLuca: 0, dirittoAnna: 0, conguaglioBeni: 0, voci: 0,
    mancanti: [], daDecidere: [], righe: [] };
  for (const b of beniDivisibili(beni)) {
    const dove = ass[b.id];
    const qL = quota(b.quota_luca), qA = quota(b.quota_anna), V = b.valore == null ? null : Number(b.valore);
    r.righe.push({ bene: b, dove: dove || null, valore: V, parteLuca: V == null ? null : cent(V * qL), parteAnna: V == null ? null : cent(V * qA) });
    if (!dove) { r.daDecidere.push(b); continue; }
    if (dove === 'comune') continue;
    if (V == null) { r.mancanti.push(b); continue; }
    r.dirittoLuca += V * qL; r.dirittoAnna += V * qA;
    if (dove === 'luca') { r.lottoLuca += V; r.conguaglioBeni -= V * qA; }
    if (dove === 'anna') { r.lottoAnna += V; r.conguaglioBeni += V * qL; }
    if (dove === 'vendita') { r.vendita += V; r.venditaLuca += V * qL; r.venditaAnna += V * qA; }
  }
  for (const v of scenario.voci || []) {
    const n = Number(v.importo);
    if (!Number.isFinite(n) || n <= 0) continue;
    r.voci += v.a_favore === 'anna' ? -n : n;
  }
  for (const k of ['lottoLuca', 'lottoAnna', 'vendita', 'venditaLuca', 'venditaAnna', 'dirittoLuca', 'dirittoAnna', 'conguaglioBeni', 'voci']) r[k] = cent(r[k]);
  r.conguaglio = cent(r.conguaglioBeni + r.voci);
  // Per il concordato: soldi che arrivano a Luca (conguaglio + metà delle vendite) e valore dei beni che tiene.
  r.entrateLuca = cent(Math.max(r.conguaglio, 0) + r.venditaLuca);
  r.pagaLuca = r.conguaglio < 0 ? -r.conguaglio : 0;
  r.completo = !r.mancanti.length && !r.daDecidere.length;
  return r;
}
export function fraseConguaglio(c) {
  if (Math.abs(c) < 1) return 'Nessun conguaglio: le due parti si equivalgono';
  return c > 0 ? `Anna ti paga ${euroIntero(c)}` : `Paghi tu ad Anna ${euroIntero(-c)}`;
}

/* ---------- Proposte pronte ---------- */
// Servono la casa di Luca e quella di Anna (scelte da Luca): le altre unità seguono la proposta. In una divisione
// equa il valore della metà di Luca non cambia: le proposte cambiano quanto arriva in denaro (subito) e quanto in
// beni da vendere.
export const PROPOSTE = [
  { id: 'equa', nome: 'Proposta A – Equa', descrizione: 'Anna prende il negozio, Beinette e la sua casa; tu la tua casa. Il resto (garage, terreni, altre unità) si vende e il ricavato si divide a metà. Anna ti paga il conguaglio.' },
  { id: 'massimo', nome: 'Proposta B – Tutto in denaro, subito', descrizione: 'Tu tieni solo la tua casa; ad Anna va tutto il resto e ti paga la tua metà in denaro (il conguaglio più alto). Niente da vendere: soldi certi e subito per i creditori. Anna deve avere la liquidità o un mutuo.' },
  { id: 'leggero', nome: 'Proposta C – Conguaglio leggero', descrizione: 'Anna prende il negozio, Beinette e la sua casa; tu tieni la tua casa più garage, terreni e altre unità, da vendere nel piano. Anna paga meno conguaglio.' },
  { id: 'vuota', nome: 'Proposta libera', descrizione: 'Tutto da decidere: assegni tu bene per bene.' },
];
export function assegnazioniProposta(tipo, beni, { casaLuca, casaAnna } = {}) {
  const div = beniDivisibili(beni); const ass = {};
  if (tipo === 'vuota') return ass;
  if (!casaLuca || !casaAnna || casaLuca === casaAnna) throw new Error('Scegli la tua casa e quella di Anna');
  const perAnna = (b) => b.id === casaAnna || b.categoria === 'C/1' || /^beinette$/i.test(b.comune || '');
  for (const b of div) {
    if (b.id === casaLuca) ass[b.id] = 'luca';
    else if (tipo === 'massimo') ass[b.id] = 'anna';
    else if (perAnna(b)) ass[b.id] = 'anna';
    else ass[b.id] = tipo === 'leggero' ? 'luca' : 'vendita';
  }
  return ass;
}

/* ---------- Database ---------- */
export async function caricaBeni(db) {
  return esito(await db.from('concordato_beni').select('*').order('ordine').order('creato_il'));
}
const CAMPI_BENE = ['nome', 'valore', 'valore_fonte', 'quota_luca', 'quota_anna', 'altri_comproprietari', 'in_divisione', 'vincoli', 'note'];
export function campiBene(campi) {
  const riga = {};
  for (const k of CAMPI_BENE) if (k in campi) riga[k] = typeof campi[k] === 'string' ? campi[k].trim() || null : campi[k];
  if ('valore' in riga && riga.valore != null && !(Number(riga.valore) >= 0)) throw new Error('Valore non valido');
  for (const k of ['quota_luca', 'quota_anna']) if (riga[k] != null && quota(riga[k]) == null) throw new Error('Scrivi la quota come 1/2, 1/4…');
  if ('quota_luca' in riga && !riga.quota_luca) throw new Error('Manca la tua quota');
  if (riga.in_divisione && 'quota_anna' in riga && !riga.quota_anna) throw new Error("Per metterlo nella divisione serve la quota di Anna");
  return { ...riga, aggiornato_il: new Date().toISOString() };
}
export async function salvaBene(db, id, campi) {
  return esito(await db.from('concordato_beni').update(campiBene(campi)).eq('id', id).select('*').single());
}
export async function caricaScenari(db) {
  return esito(await db.from('divisione_scenari').select('*').order('creato_il'));
}
export function campiScenario(s) {
  const nome = String(s.nome || '').trim().slice(0, 120);
  if (!nome) throw new Error('Dai un nome alla proposta');
  const assegnazioni = Object.fromEntries(Object.entries(s.assegnazioni || {}).filter(([, v]) => DESTINI.some(([k]) => k === v)));
  const voci = (s.voci || []).map((v, i) => ({ id: String(v.id || `v${Date.now().toString(36)}${i}`).slice(0, 40), descrizione: String(v.descrizione || '').trim().slice(0, 200), importo: Number(v.importo) || 0, a_favore: v.a_favore === 'anna' ? 'anna' : 'luca' }));
  return { nome, descrizione: s.descrizione || null, assegnazioni, voci, note: s.note || null };
}
export async function salvaScenario(db, s) {
  const riga = { ...campiScenario(s), aggiornato_il: new Date().toISOString() };
  const q = s.id ? db.from('divisione_scenari').update(riga).eq('id', s.id) : db.from('divisione_scenari').insert(riga);
  return esito(await q.select('*').single());
}
export async function eliminaScenario(db, id) {
  return esito(await db.from('divisione_scenari').delete().eq('id', id).select('id'));
}
