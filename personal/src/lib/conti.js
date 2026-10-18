// POL-VITA-006 — Conti di Personal: incassi e spese registrati da Luca (tabella movimenti,
// solo il proprietario) e bilancino. I calcoli sono puri e testabili.
const CAMPI = 'id, data, tipo, importo, descrizione, categoria, documento_id, scadenza_id, note, documento:documenti(id, titolo, fascicolo)';

const esito = ({ data, error }) => {
  if (error) throw new Error(error.message || 'Errore conti');
  return data;
};

export const CATEGORIE_SPESA = ['Casa', 'Bollette', 'Riscaldamento', 'Spesa', 'Auto', 'Salute', 'Scuola', 'Tasse', 'Assicurazioni', 'Svago', 'Altro'];
export const CATEGORIE_INCASSO = ['Studio', 'Collaborazione', 'Lavoro', 'Rimborsi', 'Affitti', 'Altro'];

// POL-VITA-021 — incassi di studio o di collaborazione: si registrano SOLO nel gestionale dello
// studio (una sola fonte, come l'agenda: PO 2026-10-18) e Personal li rilegge da lì per il reddito
// di lavoro netto. Studio → payments (pagamento di un paziente), Collaborazione → pagamenti_esterni.
export const CATEGORIE_STUDIO = { Studio: 'payments', Collaborazione: 'pagamenti_esterni' };
export const tabellaStudio = (categoria) => CATEGORIE_STUDIO[categoria] || null;
export const METODI_STUDIO = ['Contanti', 'Carta', 'Bonifico', 'POS', 'Assegno'];

// Riga per lo studio, con le stesse colonne che usa il gestionale. Senza paziente o collaborazione
// non si registra nulla.
export function rigaIncassoStudio(m) {
  const tabella = tabellaStudio(m.categoria);
  if (m.tipo !== 'entrata' || !tabella) return null;
  const importo = importoNumero(m.importo);
  if (!(importo > 0)) throw new Error('Importo non valido');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(m.data || ''))) throw new Error('Data non valida');
  const metodo = METODI_STUDIO.includes(m.metodo) ? m.metodo : (tabella === 'payments' ? 'Contanti' : 'Bonifico');
  const nota = String(m.note || '').trim() || null;
  if (tabella === 'payments') {
    if (!m.paziente_id) throw new Error('Scegli il paziente dello studio');
    return { tabella, riga: { paziente_id: Number(m.paziente_id), data: m.data, importo, metodo, nota, stato: 'pagato' } };
  }
  if (!m.collaborazione_id) throw new Error('Scegli la collaborazione');
  return { tabella, riga: { collaborazione_id: Number(m.collaborazione_id), collaborazione_nome: String(m.collaborazione_nome || '').trim() || null, data: m.data, importo, metodo, note: nota } };
}


// Categoria di spesa suggerita dal fascicolo del documento da cui viene il pagamento.
const PER_FASCICOLO = {
  utenze: 'Bollette', riscaldamento: 'Riscaldamento', fiscale: 'Tasse', veicoli: 'Auto', sanitario_famiglia: 'Salute',
  famiglia_scuola: 'Scuola', immobili: 'Casa', assicurazioni: 'Assicurazioni', acquisti: 'Spesa',
};
export const categoriaDaFascicolo = (f) => PER_FASCICOLO[f] || 'Altro';

export const importoNumero = (v) => {
  if (v === '' || v == null) return NaN;
  const n = Number(String(v).trim().replace(/\s|€/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};

export function rigaMovimento(m) {
  const importo = importoNumero(m.importo);
  if (!(importo >= 0)) throw new Error('Importo non valido');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(m.data || ''))) throw new Error('Data non valida');
  return {
    data: m.data,
    tipo: m.tipo === 'entrata' ? 'entrata' : 'uscita',
    importo,
    descrizione: String(m.descrizione || '').trim() || (m.tipo === 'entrata' ? 'Incasso' : 'Spesa'),
    categoria: String(m.categoria || '').trim() || null,
    documento_id: m.documento_id || null,
    note: String(m.note || '').trim() || null,
  };
}

export async function movimentiTra(db, da, a) {
  return esito(await db.from('movimenti').select(CAMPI).gte('data', da).lte('data', a)
    .order('data', { ascending: false }).order('creato_il', { ascending: false }).limit(2000));
}

export async function salvaMovimento(db, m) {
  const riga = { ...rigaMovimento(m), aggiornato_il: new Date().toISOString() };
  if (m.id) return esito(await db.from('movimenti').update(riga).eq('id', m.id).select(CAMPI).single());
  return esito(await db.from('movimenti').insert(riga).select(CAMPI).single());
}

export async function eliminaMovimento(db, id) {
  return esito(await db.from('movimenti').delete().eq('id', id).select('id'));
}

// Pagamento dell'archivio segnato pagato → spesa collegata (una sola per scadenza).
export async function spesaDaScadenza(db, s, data = new Date().toISOString().slice(0, 10)) {
  if (s.importo == null || !(Number(s.importo) > 0)) return null;
  const gia = esito(await db.from('movimenti').select('id').eq('scadenza_id', s.id).limit(1));
  if (gia.length) return gia[0];
  return esito(await db.from('movimenti').insert({
    data, tipo: 'uscita', importo: Number(s.importo), descrizione: s.descrizione || 'Pagamento',
    categoria: s.categoria || categoriaDaFascicolo(s.documento?.fascicolo), documento_id: s.documento_id || s.documento?.id || null, scadenza_id: s.id,
  }).select('id').single());
}

// Pagamento rimesso "da pagare": la spesa registrata in automatico si toglie.
export async function annullaSpesaDaScadenza(db, scadenzaId) {
  return esito(await db.from('movimenti').delete().eq('scadenza_id', scadenzaId).select('id'));
}

// Pagamento da fare inserito a mano: categoria (bollette, pulizia, …), ricorrenza per i pagamenti
// fissi e, se c'è, il documento (foto o PDF) a cui si riferisce.
export const CATEGORIE_PAGAMENTO = ['Bollette', 'Pulizia', 'Assicurazioni', 'Bollo auto', 'Affitto o mutuo', 'Tasse', 'Scuola', 'Abbonamenti', 'Altro'];
export async function nuovaScadenza(db, { data, descrizione, importo, categoria, ricorrenza, documento_id: documentoId }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data || ''))) throw new Error('Data non valida');
  const n = importoNumero(importo);
  return esito(await db.from('scadenze').insert({
    data, descrizione: String(descrizione || '').trim() || 'Pagamento', importo: Number.isFinite(n) ? n : null, completata: false,
    categoria: String(categoria || '').trim() || null, ricorrenza: ricorrenza || null, documento_id: documentoId || null,
  }).select('id').single());
}

// Totali di Da pagare per categoria (per vedere quanto va in bollette, pulizia, assicurazioni…).
export function totaliPerCategoria(scadenze) {
  const per = {};
  for (const s of scadenze) {
    const c = s.categoria || categoriaDaFascicolo(s.documento?.fascicolo);
    per[c] = Math.round(((per[c] || 0) + Number(s.importo || 0)) * 100) / 100;
  }
  return Object.entries(per).map(([categoria, totale]) => ({ categoria, totale })).sort((x, y) => y.totale - x.totale);
}

/* ---------- bilancino ---------- */
const due = (n) => String(n).padStart(2, '0');
export const periodo = (tipo, rif) => {
  const [a, m] = rif.split('-').map(Number);
  if (tipo === 'anno') return { da: `${a}-01-01`, a: `${a}-12-31` };
  const fine = new Date(a, m, 0).getDate();
  return { da: `${a}-${due(m)}-01`, a: `${a}-${due(m)}-${due(fine)}` };
};
export const spostaPeriodo = (tipo, rif, n) => {
  const [a, m] = rif.split('-').map(Number);
  if (tipo === 'anno') return `${a + n}-${due(m)}`;
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${due(d.getMonth() + 1)}`;
};

const somma = (xs) => Math.round(xs.reduce((t, x) => t + Number(x.importo || 0), 0) * 100) / 100;

export function bilancio(movimenti) {
  const entrate = movimenti.filter((m) => m.tipo === 'entrata');
  const uscite = movimenti.filter((m) => m.tipo === 'uscita');
  const perCategoria = (xs) => Object.entries(xs.reduce((acc, m) => {
    const c = m.categoria || 'Altro';
    acc[c] = (acc[c] || 0) + Number(m.importo || 0);
    return acc;
  }, {})).map(([categoria, totale]) => ({ categoria, totale: Math.round(totale * 100) / 100 })).sort((x, y) => y.totale - x.totale);
  const e = somma(entrate);
  const u = somma(uscite);
  return { entrate: e, uscite: u, saldo: Math.round((e - u) * 100) / 100, n: movimenti.length, speseCategoria: perCategoria(uscite), incassiCategoria: perCategoria(entrate) };
}

// Mesi dell'anno (o gli ultimi n mesi) con entrate e uscite, per le barre.
export function perMese(movimenti, anno) {
  return Array.from({ length: 12 }, (_, i) => {
    const chiave = `${anno}-${due(i + 1)}`;
    const delMese = movimenti.filter((m) => String(m.data).startsWith(chiave));
    return { mese: chiave, entrate: somma(delMese.filter((m) => m.tipo === 'entrata')), uscite: somma(delMese.filter((m) => m.tipo === 'uscita')) };
  });
}

/* ---------- POL-VITA-021: lavoro dallo studio (netto) ---------- */
// PO 2026-10-18: "in studio ci sono solo io", il reddito vero è l'utile dello studio: incassi dei
// pazienti + collaborazioni − spese dello studio. Spese ricorrenti come le proietta il gestionale
// (importo × volte l'anno), divise per mese dall'inizio a data_fine.
const VOLTE_ANNO = { Mensile: 12, Bimestrale: 6, Trimestrale: 4, Semestrale: 2, Annuale: 1 };
const tondo = (n) => Math.round(n * 100) / 100;
export function mesiTra(da, a) {
  const out = [];
  let [y, m] = da.slice(0, 7).split('-').map(Number);
  const fine = a.slice(0, 7);
  for (let k = 0; k < 600; k++) {
    const chiave = `${y}-${String(m).padStart(2, '0')}`;
    if (chiave > fine) break;
    out.push(chiave);
    m += 1; if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

export function lavoroDelPeriodo({ pagamenti = [], esterni = [], spese = [] } = {}, da, a) {
  const dentro = (d) => Boolean(d) && d >= da && d <= a;
  const pazienti = tondo(pagamenti.filter((p) => p.stato !== 'sospeso' && dentro(p.data)).reduce((t, p) => t + Number(p.importo || 0), 0));
  const per = {};
  for (const e of esterni.filter((x) => dentro(x.data))) {
    const nome = e.collaborazione_nome || 'Collaborazione';
    per[nome] = (per[nome] || 0) + Number(e.importo || 0);
  }
  const perCollaborazione = Object.entries(per).map(([nome, totale]) => ({ nome, totale: tondo(totale) })).sort((x, y) => y.totale - x.totale);
  const collaborazioni = tondo(perCollaborazione.reduce((t, c) => t + c.totale, 0));
  const mesi = mesiTra(da, a);
  let speseStudio = spese.filter((s) => !s.ricorrente && dentro(s.data)).reduce((t, s) => t + Number(s.importo || 0), 0);
  for (const s of spese.filter((x) => x.ricorrente)) {
    const quota = Number(s.importo || 0) * (VOLTE_ANNO[s.frequenza] || 12) / 12;
    const inizio = String(s.data || '').slice(0, 7);
    const fine = String(s.data_fine || '').slice(0, 7);
    speseStudio += quota * mesi.filter((m) => (!inizio || m >= inizio) && (!fine || m <= fine)).length;
  }
  speseStudio = tondo(speseStudio);
  return { pazienti, collaborazioni, perCollaborazione, spese: speseStudio, netto: tondo(pazienti + collaborazioni - speseStudio) };
}

// Il netto di ogni mese come movimento (solo per bilancio e grafico, non si salva da nessuna parte).
export function movimentiLavoro(dati, da, a) {
  if (!dati) return [];
  return mesiTra(da, a).map((mese) => {
    const fine = periodo('mese', mese).a;
    const l = lavoroDelPeriodo(dati, `${mese}-01` < da ? da : `${mese}-01`, fine > a ? a : fine);
    if (!l.netto) return null;
    return { id: `lavoro-${mese}`, data: `${mese}-01`, tipo: l.netto >= 0 ? 'entrata' : 'uscita', importo: Math.abs(l.netto),
      categoria: 'Lavoro (studio, netto)', descrizione: 'Lavoro dallo studio (netto)', daStudio: true };
  }).filter(Boolean);
}
