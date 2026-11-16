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
const CAMPI = 'id, documento_id, ente, titolo, spiegazione, cosa_fare, bozza_risposta, scadenza, importo, priorita, stato, stato_il, creato_il';

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
