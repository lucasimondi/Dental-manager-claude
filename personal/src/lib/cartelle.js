// POL-VITA-014 — Cartelle in Documenti: una cartella per ente (es. "Kerdos") con i suoi documenti,
// il periodo, i contatti da cui arrivano, etichette, note, promemoria, sintesi dell'AI e bozza di
// risposta. La cartella è l'ente dei documenti: rinominarla cambia l'ente di tutti (o li unisce a
// un'altra cartella con quel nome). Mai i documenti clinici dei pazienti.
import { URL_CARICAMENTO } from './archivio.js';

const esito = ({ data, error }) => {
  if (error) throw new Error(error.message || 'Errore archivio');
  return data;
};

export const ETICHETTE_SUGGERITE = ['Da pagare', 'In attesa di risposta', 'Importante', 'Chiusa', 'Da archiviare'];
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

// "mar 2023 – ott 2026"; un mese solo → "ott 2026".
export function periodoCartella(dal, al) {
  const m = (d) => (d ? `${MESI[Number(String(d).slice(5, 7)) - 1]} ${String(d).slice(0, 4)}` : '');
  const a = m(dal), b = m(al);
  if (!a && !b) return '';
  return a && b && a !== b ? `${a} – ${b}` : a || b;
}

// Cartelle da mostrare: quelle con almeno un documento utile (o tutte su richiesta), le più recenti prima.
export function cartelleVisibili(cartelle, { testo = '', anchePocoUtili = false, etichetta = null } = {}) {
  const w = String(testo).trim().toLowerCase();
  return (cartelle || [])
    .filter((c) => anchePocoUtili || c.n_utili > 0)
    .filter((c) => !etichetta || (c.etichette || []).includes(etichetta))
    .filter((c) => !w || c.ente.toLowerCase().includes(w) || (c.etichette || []).some((e) => e.toLowerCase().includes(w)))
    .sort((x, y) => String(y.al || '').localeCompare(String(x.al || '')) || y.n - x.n);
}

// Contatti da cui arrivano i documenti: "Nome <email>" → { nome, email, n }, i più frequenti prima.
export function contattiCartella(documenti) {
  const perChiave = new Map();
  for (const d of documenti || []) {
    const grezzo = String(d.email_mittente || '').trim();
    if (!grezzo || /^caricato dall/i.test(grezzo)) continue;
    const email = (grezzo.match(/<([^>]+)>/) || grezzo.match(/([\w.+-]+@[\w.-]+\.\w+)/) || [])[1]?.toLowerCase() || null;
    const nome = grezzo.replace(/<[^>]*>/, '').replace(/["']/g, '').trim() || email;
    const chiave = email || nome.toLowerCase();
    const c = perChiave.get(chiave) || { nome, email, n: 0, ultimo: null };
    c.n += 1;
    const data = d.data_documento || String(d.email_data || '').slice(0, 10) || null;
    if (data && (!c.ultimo || data > c.ultimo)) c.ultimo = data;
    perChiave.set(chiave, c);
  }
  return [...perChiave.values()].sort((a, b) => b.n - a.n || String(b.ultimo).localeCompare(String(a.ultimo)));
}

const pulisciEtichetta = (e) => String(e || '').trim().replace(/\s+/g, ' ').slice(0, 40);
export const etichettePulite = (xs) => [...new Set((xs || []).map(pulisciEtichetta).filter(Boolean))].slice(0, 12);

/* ---------- dati ---------- */
export async function caricaCartelle(db) {
  return esito(await db.from('v_cartelle').select('*').order('al', { ascending: false, nullsFirst: false }).limit(2000));
}

export async function cartella(db, ente) {
  const r = esito(await db.from('v_cartelle').select('*').eq('ente', ente).limit(1));
  return r[0] || null;
}

export async function promemoriaCartella(db, ente, idDocumenti = []) {
  const campi = 'id, data, descrizione, importo, completata, documento_id, cartella';
  const [propri, deiDocumenti] = await Promise.all([
    db.from('scadenze').select(campi).eq('cartella', ente).order('data', { ascending: true }).then(esito),
    idDocumenti.length ? db.from('scadenze').select(campi).in('documento_id', idDocumenti).order('data', { ascending: true }).then(esito) : [],
  ]);
  const visti = new Set();
  return [...propri, ...deiDocumenti].filter((s) => (visti.has(s.id) ? false : visti.add(s.id))).sort((a, b) => a.data.localeCompare(b.data));
}

export async function nuovoPromemoria(db, ente, { data, descrizione, importo }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data || ''))) throw new Error('Data non valida');
  const n = importo === '' || importo == null ? null : Number(String(importo).replace(/\./g, '').replace(',', '.'));
  return esito(await db.from('scadenze').insert({
    data, descrizione: String(descrizione || '').trim().slice(0, 200) || `Promemoria – ${ente}`,
    importo: Number.isFinite(n) ? n : null, completata: false, cartella: ente,
  }).select('id, data, descrizione, importo, completata, cartella').single());
}

export async function salvaCartella(db, ente, campi) {
  const riga = { ente, aggiornata_il: new Date().toISOString() };
  if ('etichette' in campi) riga.etichette = etichettePulite(campi.etichette);
  if ('note' in campi) riga.note = String(campi.note || '').trim().slice(0, 2000) || null;
  return esito(await db.from('cartelle_ente').upsert(riga, { onConflict: 'ente' }).select('ente, etichette, note').single());
}

export async function rinominaCartella(db, da, a) {
  const nuovo = String(a || '').trim().slice(0, 120);
  if (!nuovo) throw new Error('Scrivi un nome per la cartella');
  if (nuovo === da) return 0;
  return esito(await db.rpc('rinomina_cartella', { da, a: nuovo }));
}

// "Togli la cartella": i documenti restano in archivio, senza ente (finiscono in "Senza cartella").
export async function sciogliCartella(db, ente) {
  return esito(await db.from('documenti').update({ ente: null }).eq('ente', ente).neq('fascicolo', 'clinico_pazienti').select('id'));
}

export async function documentiSenzaCartella(db, campi) {
  return esito(await db.from('documenti').select(campi).is('ente', null).neq('fascicolo', 'clinico_pazienti')
    .order('email_data', { ascending: false }).limit(400));
}

/* ---------- AI (nello script: Claude, mai i documenti clinici) ---------- */
async function chiamaScript(corpo, fetchImpl) {
  if (!corpo.token) throw new Error('Sessione scaduta: esci e rientra.');
  const res = await fetchImpl(URL_CARICAMENTO, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(corpo) });
  let r;
  try { r = await res.json(); } catch { throw new Error('Poliedron non raggiungibile.'); }
  if (!r.ok) throw new Error(r.errore || 'Poliedron non disponibile.');
  return r;
}

// Sintesi della cartella (salvata dallo script in cartelle_ente.sintesi).
export async function analizzaCartella({ token, ente }, fetchImpl = fetch) {
  return chiamaScript({ token, azione: 'cartella', ente }, fetchImpl);
}

// Bozza di risposta all'ultima email della cartella: resta tra le bozze di Gmail, non parte nulla.
export async function bozzaRisposta({ token, ente, istruzioni }, fetchImpl = fetch) {
  return chiamaScript({ token, azione: 'bozza', ente, istruzioni: String(istruzioni || '').slice(0, 500) }, fetchImpl);
}

/* ---------- calendario del telefono ---------- */
// File .ics di un promemoria (evento di tutto il giorno, avviso alle 9 del giorno stesso).
export function icsPromemoria({ data, descrizione, cartella: nome }, ora = new Date()) {
  const giorno = String(data).replace(/-/g, '');
  const dopo = new Date(`${data}T12:00:00Z`);
  dopo.setUTCDate(dopo.getUTCDate() + 1);
  const fine = dopo.toISOString().slice(0, 10).replace(/-/g, '');
  const testo = (s) => String(s || '').replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n');
  const stamp = ora.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Poliedron Personal//IT', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:${giorno}-${Math.abs(hash(descrizione + nome))}@poliedron`, `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${giorno}`, `DTEND;VALUE=DATE:${fine}`,
    `SUMMARY:${testo(descrizione)}`, nome ? `DESCRIPTION:${testo(`Cartella: ${nome}`)}` : null,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${testo(descrizione)}`, 'TRIGGER:PT9H', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}
function hash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }
