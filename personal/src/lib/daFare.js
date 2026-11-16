// DA-FARE (2026-11-16, Luca: "remind sintetici ed esplicativi con i tastini per cliccare gestita rimuovi
// dimmi cosa fare rispondi ad email"). Promemoria d'azione scritti leggendo email e documenti.
// «Rimuovi» non cancella nulla: lo stato diventa 'rimosso'. «Rispondi» crea solo una bozza in Gmail.
import { URL_CARICAMENTO } from './archivio.js';

const esito = ({ data, error }) => {
  if (error) throw new Error(error.message || 'Errore archivio');
  return data;
};

export const PRIORITA = { alta: 'Urgente', media: 'Da fare', bassa: 'Quando puoi' };
const PESO = { alta: 0, media: 1, bassa: 2 };
const CAMPI = 'id, documento_id, ente, titolo, spiegazione, cosa_fare, bozza_risposta, scadenza, importo, priorita, stato, stato_il, creato_il, categoria, rimanda_al';

// DA-FARE v2: categorie per i filtri. Se la riga non ha categoria la deduce dal titolo.
export const CATEGORIE = [
  { id: 'soldi', nome: 'Pagamenti e debiti' },
  { id: 'legale', nome: 'Avvocati e tribunali' },
  { id: 'fisco', nome: 'Fisco e uffici' },
  { id: 'lavoro', nome: 'Studio e lavoro' },
  { id: 'famiglia', nome: 'Famiglia, casa, auto' },
];
export function categoria(p) {
  if (CATEGORIE.some((c) => c.id === p?.categoria)) return p.categoria;
  const t = `${p?.titolo || ''} ${p?.ente || ''}`;
  if (/(avvocat|esecuzion|causa|pignoramento|tribunal|alpi marittime)/i.test(t)) return 'legale';
  if (/(agenzia|certificat|rottamazione|ordine dei medici|anagrafe|inps|aruba)/i.test(t)) return 'fisco';
  if (/(ortopantomografo|clinn|straumann|biologitech|yndetech|you medical|san raffaele)/i.test(t)) return 'lavoro';
  if (/(mensa|scuola|telepass|assicurazione auto)/i.test(t)) return 'famiglia';
  return 'soldi';
}

const oggi = () => new Date().toISOString().slice(0, 10);
export const rimandato = (p, giorno = oggi()) => Boolean(p?.rimanda_al && p.rimanda_al > giorno);

// I filtri in cima: Urgenti, una per categoria (solo se ha voci), Rimandate.
export function filtri(voci, giorno = oggi()) {
  const attive = voci.filter((p) => !rimandato(p, giorno));
  const out = [{ id: 'tutte', nome: 'Tutte', n: attive.length }, { id: 'urgenti', nome: 'Urgenti', n: attive.filter((p) => p.priorita === 'alta').length }];
  for (const c of CATEGORIE) { const n = attive.filter((p) => categoria(p) === c.id).length; if (n) out.push({ id: c.id, nome: c.nome, n }); }
  const r = voci.length - attive.length;
  if (r) out.push({ id: 'rimandate', nome: 'Rimandate', n: r });
  return out;
}
export function filtra(voci, filtro, giorno = oggi()) {
  if (filtro === 'rimandate') return ordina(voci.filter((p) => rimandato(p, giorno)));
  const attive = voci.filter((p) => !rimandato(p, giorno));
  if (filtro === 'urgenti') return ordina(attive.filter((p) => p.priorita === 'alta'));
  if (CATEGORIE.some((c) => c.id === filtro)) return ordina(attive.filter((p) => categoria(p) === filtro));
  return ordina(attive);
}
export function riepilogo(voci, giorno = oggi()) {
  const attive = voci.filter((p) => !rimandato(p, giorno));
  return { aperte: attive.length, urgenti: attive.filter((p) => p.priorita === 'alta').length,
    importo: attive.filter((p) => categoria(p) === 'soldi' || p.importo).reduce((s, p) => s + (Number(p.importo) || 0), 0) };
}

// Ordine: priorità, poi scadenza più vicina (senza scadenza in fondo), poi i più recenti.
export function ordina(promemoria) {
  return [...promemoria].sort((a, b) => (PESO[a.priorita] ?? 1) - (PESO[b.priorita] ?? 1)
    || String(a.scadenza || '9999').localeCompare(String(b.scadenza || '9999'))
    || String(b.creato_il || '').localeCompare(String(a.creato_il || '')));
}

export function raggruppa(promemoria) {
  const gruppi = { alta: [], media: [], bassa: [] };
  for (const p of ordina(promemoria)) (gruppi[p.priorita] || gruppi.media).push(p);
  return Object.entries(gruppi).filter(([, v]) => v.length).map(([id, voci]) => ({ id, nome: PRIORITA[id], voci }));
}

// I passi di «Dimmi cosa fare»: una riga per passo (accetta «1.», «-», «•» davanti).
export function passi(testo) {
  return String(testo || '').split(/\n+/).map((r) => r.replace(/^\s*(\d+[.)]|[-•])\s*/, '').trim()).filter(Boolean);
}

export const puoRispondere = (p) => Boolean(p?.documento_id && p?.email);

export async function caricaDaFare(db) {
  const righe = esito(await db.from('promemoria_azioni').select(CAMPI).eq('stato', 'aperto').limit(500));
  const ids = [...new Set(righe.map((r) => r.documento_id).filter(Boolean))];
  const docs = ids.length ? esito(await db.from('documenti').select('id, gmail_message_id, titolo, drive_url, fascicolo').in('id', ids)) : [];
  const perId = new Map(docs.map((d) => [d.id, d]));
  return ordina(righe.map((r) => {
    const d = perId.get(r.documento_id);
    const msg = String(d?.gmail_message_id || '');
    return { ...r, documento: d || null, email: Boolean(msg) && !/^(caricato|drivefile|drivefoto):/.test(msg) };
  }));
}

// Rimanda: il promemoria resta aperto ma esce dalla lista fino alla data scelta.
export function dataTra(giorni, da = new Date()) {
  const d = new Date(da); d.setDate(d.getDate() + giorni); return d.toISOString().slice(0, 10);
}
export async function rimanda(db, id, giorno) {
  return esito(await db.from('promemoria_azioni').update({ rimanda_al: giorno }).eq('id', id).select('id, rimanda_al').single());
}

export async function cambiaStato(db, id, stato) {
  if (!['aperto', 'gestito', 'rimosso'].includes(stato)) throw new Error('Stato non valido');
  return esito(await db.from('promemoria_azioni').update({ stato, stato_il: new Date().toISOString() }).eq('id', id).select('id, stato').single());
}

// Bozza in Gmail per l'email del documento: con il testo scritto da Luca, o dall'AI con le sue indicazioni.
export async function bozzaPerPromemoria({ token, documento, ente, testo, istruzioni }, fetchImpl = fetch) {
  if (!token) throw new Error('Sessione scaduta: esci e rientra.');
  const res = await fetchImpl(URL_CARICAMENTO, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token, azione: 'bozza', documento, ente: ente || '', testo: String(testo || '').slice(0, 8000), istruzioni: String(istruzioni || '').slice(0, 500) }) });
  let r;
  try { r = await res.json(); } catch { throw new Error('Poliedron non raggiungibile.'); }
  if (!r.ok) throw new Error(r.errore || 'Poliedron non disponibile.');
  return r;
}
