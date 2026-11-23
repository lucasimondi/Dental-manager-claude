// POL-VITA-ORDINA fase 2 — «Piano di riordino»: le proposte di Claude Code (tabella piano_riordino) che Luca
// approva, corregge o rifiuta dal telefono. Qui si decide soltanto: nessun file viene spostato o rinominato
// (l'esecuzione su Drive è la fase 3, solo sulle righe approvate, a lotti annullabili).
import { URL_CARICAMENTO } from './archivio.js';

export const SOGLIA_ALTA = 0.85;
export const SOGLIA_DUBBIO = 0.6;
export const CAMPI_PIANO = 'id,documento_id,file_id,percorso_attuale,nome_attuale,percorso_nuovo,nome_nuovo,categoria_id,tipo,soggetto,data_documento,confidenza,motivo,scorciatoie,duplicato_di,stato';
const PAGINA = 1000;

/** Verde ≥ 0,85, giallo fra 0,60 e 0,85, rosso sotto (i rossi sono già in «99 Da verificare»). */
export function livello(confidenza) {
  const c = Number(confidenza) || 0;
  return c >= SOGLIA_ALTA ? 'alta' : c >= SOGLIA_DUBBIO ? 'media' : 'bassa';
}

export const confidenzaTesto = (c) => (Number(c) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Stesse regole del vincolo sul database: 1–90 caratteri, niente / \ : * ? " < > |. */
export function controllaNome(nome) {
  const n = String(nome || '').trim();
  if (!n) return 'Il nome è vuoto.';
  if (n.length > 90) return `Il nome è troppo lungo (${n.length} caratteri, massimo 90).`;
  if (/[/\\:*?"<>|]/.test(n)) return 'Il nome non può contenere / \\ : * ? " < > |';
  return null;
}

/** Il nome segue lo schema AAAA-MM-GG_Tipo_Soggetto_Dettaglio (estensione facoltativa per i file Google). */
export const nomeConforme = (nome) => /^\d{4}(-\d{2}){0,2}_[A-ZÀ-Ý][^_]*_[^_]+(_[^_]+)?(\.[A-Za-z0-9]{1,5})?$/.test(String(nome || ''));

export function riepilogo(righe) {
  const r = { totale: righe.length, proposto: 0, approvato: 0, rifiutato: 0, eseguito: 0, daVerificare: 0, alte: 0, conformi: 0 };
  for (const x of righe) {
    r[x.stato] = (r[x.stato] || 0) + 1;
    if (String(x.percorso_nuovo).startsWith('99 ')) r.daVerificare += 1;
    if (x.stato === 'proposto' && Number(x.confidenza) >= SOGLIA_ALTA) r.alte += 1;
    if (nomeConforme(x.nome_nuovo)) r.conformi += 1;
  }
  r.percDaVerificare = r.totale ? Math.round((1000 * r.daVerificare) / r.totale) / 10 : 0;
  r.percConformi = r.totale ? Math.round((1000 * r.conformi) / r.totale) / 10 : 0;
  return r;
}

export const FILTRI = [
  { id: 'da_decidere', nome: 'Da decidere', vale: (x) => x.stato === 'proposto' },
  { id: 'gialli', nome: 'Da guardare', vale: (x) => x.stato === 'proposto' && livello(x.confidenza) === 'media' },
  { id: 'approvati', nome: 'Approvati', vale: (x) => x.stato === 'approvato' },
  { id: 'rifiutati', nome: 'Rifiutati', vale: (x) => x.stato === 'rifiutato' },
  { id: 'tutti', nome: 'Tutti', vale: () => true },
];

export function filtra(righe, filtro = 'da_decidere', testo = '') {
  const f = FILTRI.find((x) => x.id === filtro) || FILTRI[0];
  const q = String(testo || '').trim().toLowerCase();
  return righe.filter((x) => f.vale(x) && (!q || `${x.nome_attuale} ${x.nome_nuovo} ${x.percorso_nuovo} ${x.motivo}`.toLowerCase().includes(q)));
}

/**
 * Raggruppa per cartella di destinazione, ordinate come su Drive (00…13, poi 99). Dentro, prima le righe
 * meno sicure: sono quelle da guardare. Per ogni gruppo: confidenza media e righe ancora da decidere.
 */
export function raggruppa(righe) {
  const m = new Map();
  for (const x of righe) {
    if (!m.has(x.percorso_nuovo)) m.set(x.percorso_nuovo, []);
    m.get(x.percorso_nuovo).push(x);
  }
  return [...m.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'it'))
    .map(([percorso, voci]) => {
      voci.sort((a, b) => Number(a.confidenza) - Number(b.confidenza) || String(a.nome_nuovo).localeCompare(String(b.nome_nuovo), 'it'));
      const media = voci.reduce((s, x) => s + Number(x.confidenza || 0), 0) / voci.length;
      return { percorso, radice: percorso.split('/')[0], voci, media, daDecidere: voci.filter((x) => x.stato === 'proposto').length };
    });
}

/** Le cartelle radice (00…13, 99) con il numero di righe: l'indice in alto nella schermata. */
export function radici(gruppi) {
  const m = new Map();
  for (const g of gruppi) m.set(g.radice, (m.get(g.radice) || 0) + g.voci.length);
  return [...m.entries()].map(([nome, n]) => ({ nome, n }));
}

// ---------------------------------------------------------------- database
export async function caricaPiano(db) {
  const tutte = [];
  for (let da = 0; ; da += PAGINA) {
    const { data, error } = await db.from('piano_riordino').select(CAMPI_PIANO).order('file_id').range(da, da + PAGINA - 1);
    if (error) throw error;
    tutte.push(...(data || []));
    if (!data || data.length < PAGINA) break;
  }
  return tutte;
}

export async function caricaCategorie(db) {
  const { data, error } = await db.from('categorie').select('id,percorso').order('percorso');
  if (error) throw error;
  return data || [];
}

/** Cambia le righe ancora da decidere (mai quelle già eseguite su Drive). */
export async function decidi(db, ids, campi) {
  const lista = [...new Set(ids)].filter(Boolean);
  for (let i = 0; i < lista.length; i += 200) {
    const { error } = await db.from('piano_riordino').update(campi).in('id', lista.slice(i, i + 200)).neq('stato', 'eseguito');
    if (error) throw error;
  }
  return lista.length;
}

export const approva = (db, ids) => decidi(db, ids, { stato: 'approvato' });
export const rifiuta = (db, ids) => decidi(db, ids, { stato: 'rifiutato' });
export const riproponi = (db, ids) => decidi(db, ids, { stato: 'proposto' });

export async function rinomina(db, id, nome) {
  const errore = controllaNome(nome);
  if (errore) throw new Error(errore);
  return decidi(db, [id], { nome_nuovo: nome.trim(), stato: 'approvato' });
}

/** Cambia cartella: solo verso una cartella della tassonomia (tabella categorie), mai una inventata. */
export async function cambiaCartella(db, id, categoria) {
  if (!categoria?.id || !categoria?.percorso) throw new Error('Scegli una cartella della tassonomia.');
  return decidi(db, [id], { categoria_id: categoria.id, percorso_nuovo: categoria.percorso, stato: 'approvato' });
}

/** Il piano preparato da Claude Code sta su Drive: lo script lo copia in piano_riordino (solo dati). */
export async function importaPiano({ token }, fetchImpl = fetch) {
  if (!token) throw new Error('Sessione scaduta: esci e rientra.');
  const res = await fetchImpl(URL_CARICAMENTO, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ token, azione: 'importa_piano' }) });
  let r;
  try { r = await res.json(); } catch { throw new Error('Lo script non ha risposto.'); }
  if (!r.ok) throw new Error(r.errore === 'File mancante' ? 'Lo script pubblicato non sa ancora caricare il piano: va pubblicata la versione nuova.' : r.errore || 'Caricamento non riuscito.');
  return r;
}

// ---------------------------------------------------------------- fase 3: esecuzione su Drive a lotti
async function chiamaScriptPiano(corpo, fetchImpl) {
  if (!corpo.token) throw new Error('Sessione scaduta: esci e rientra.');
  const res = await fetchImpl(URL_CARICAMENTO, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(corpo) });
  let r;
  try { r = await res.json(); } catch { throw new Error('Lo script non ha risposto.'); }
  if (!r.ok) throw new Error(r.errore === 'File mancante' ? 'Lo script pubblicato non sa ancora spostare i file: va pubblicata la versione nuova.' : r.errore || 'Operazione non riuscita.');
  return r;
}

/** Sposta su Drive il prossimo lotto (al massimo 100 righe approvate). Mai le righe in «99». */
export const eseguiLotto = ({ token }, fetchImpl = fetch) => chiamaScriptPiano({ token, azione: 'esegui_lotto' }, fetchImpl);

/** Rimette i file del lotto dov'erano, con il nome di prima. */
export function annullaLotto({ token, lotto }, fetchImpl = fetch) {
  if (!/^[0-9a-f-]{36}$/i.test(String(lotto || ''))) return Promise.reject(new Error('Lotto non valido.'));
  return chiamaScriptPiano({ token, azione: 'annulla_lotto', lotto }, fetchImpl);
}

export async function caricaLotti(db) {
  const { data, error } = await db.from('v_lotti_riordino').select('*').order('iniziato_il', { ascending: false }).limit(20);
  if (error) throw error;
  return data || [];
}

/** Quante righe approvate restano da spostare (escluse quelle in «99»). */
export const daEseguire = (righe) => righe.filter((x) => x.stato === 'approvato' && !String(x.percorso_nuovo).startsWith('99 ')).length;

// ---------------------------------------------------------------- fase 3b: lo script sposta da solo
/** Stato dello spostamento automatico (scritto dallo script in impostazioni_app 'riordino_stato') e file fermi dopo 3 errori. */
export async function caricaStatoRiordino(db) {
  const [s, f] = await Promise.all([
    db.from('impostazioni_app').select('valore').eq('chiave', 'riordino_stato').maybeSingle(),
    db.from('v_riordino_errori_ripetuti').select('file_id,nome_attuale,nome_nuovo,percorso_nuovo,errori,ultimo_errore,ultimo_il').order('ultimo_il', { ascending: false }).limit(200),
  ]);
  if (s.error) throw s.error;
  return { stato: s.data?.valore || null, fermi: f.error ? [] : f.data || [] };
}

/** Barra in alto: eseguiti sul totale degli approvati (eseguiti + ancora da spostare, mai «99»), errori, ultimo giro. */
export function avanzamento(righe, stato = null, fermi = []) {
  const fuori99 = (x) => !String(x.percorso_nuovo).startsWith('99 ');
  const eseguiti = righe.filter((x) => x.stato === 'eseguito').length;
  const daSpostare = righe.filter((x) => x.stato === 'approvato' && fuori99(x)).length;
  const totale = eseguiti + daSpostare;
  const s = stato || {};
  const riprendiDopo = s.riprendi_dopo && Date.parse(s.riprendi_dopo) > Date.now() ? s.riprendi_dopo : null;
  return {
    eseguiti, daSpostare, totale,
    perc: totale ? Math.floor((1000 * eseguiti) / totale) / 10 : 0,
    errori: Number(s.totale?.errori) || 0,
    fermi: fermi.length,
    ultimoGiro: s.ultimo_giro || null,
    attivo: !!s.attivo, pausa: !!s.pausa, riprendiDopo, finito: s.finito_il || null,
    stato: s.finito_il && !daSpostare ? 'finito' : s.pausa ? 'pausa' : riprendiDopo ? 'quota' : s.attivo ? 'attivo' : 'spento',
  };
}

/** Pausa / Riprendi dello spostamento automatico (proprietà RIORDINO_PAUSA dello script, solo con il token di Luca). */
export const pausaRiordino = ({ token, pausa }, fetchImpl = fetch) => chiamaScriptPiano({ token, azione: 'riordino_pausa', pausa: !!pausa }, fetchImpl);
