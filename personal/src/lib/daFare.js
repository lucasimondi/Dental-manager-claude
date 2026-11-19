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
const CAMPI = 'id, documento_id, ente, titolo, spiegazione, cosa_fare, bozza_risposta, scadenza, importo, priorita, stato, stato_il, creato_il, categoria, rimanda_al, note, pratica_id';
const CAMPI_ANTEPRIMA = 'id, gmail_message_id, titolo, drive_url, drive_file_id, mime_type, nome_file_originale, fascicolo, riassunto, pratica_id, data_documento, email_data';

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
  const docs = ids.length ? esito(await db.from('documenti').select(CAMPI_ANTEPRIMA).in('id', ids)) : [];
  const perId = new Map(docs.map((d) => [d.id, d]));
  // DA-FARE-PER-PRATICA: la pratica del promemoria, o quella del suo documento.
  const conPratica = righe.map((r) => ({ ...r, pratica_id: r.pratica_id || perId.get(r.documento_id)?.pratica_id || null }));
  const pids = [...new Set(conPratica.map((r) => r.pratica_id).filter(Boolean))];
  const [pratiche, ultimi] = pids.length ? await Promise.all([
    db.from('v_pratiche').select('id, titolo, fascicolo, stato, urgenza, n_documenti, prossima_scadenza').in('id', pids).then(esito),
    db.from('documenti').select(CAMPI_ANTEPRIMA).in('pratica_id', pids).neq('fascicolo', 'clinico_pazienti').not('drive_file_id', 'is', null).order('email_data', { ascending: false, nullsFirst: false }).limit(400).then(esito),
  ]) : [[], []];
  const anteprima = new Map();
  for (const d of ultimi || []) if (!anteprima.has(d.pratica_id)) anteprima.set(d.pratica_id, d);
  const praticaDi = new Map((pratiche || []).map((p) => [p.id, { ...p, anteprima: anteprima.get(p.id) || null }]));
  return ordina(conPratica.map((r) => {
    const d = perId.get(r.documento_id);
    const msg = String(d?.gmail_message_id || '');
    return { ...r, documento: d || null, pratica: praticaDi.get(r.pratica_id) || null, email: Boolean(msg) && !/^(caricato|drivefile|drivefoto):/.test(msg) };
  }));
}

// DA-FARE-PER-PRATICA (PO 2026-11-19: "io devo vedere l'elenco delle pratiche poi apro e lì ho tutti i documenti"):
// i promemoria della stessa pratica diventano una sola voce (la pratica, con i suoi passi); gli altri restano singoli.
// Ordine: urgenza, poi la scadenza più vicina.
export function perPratica(voci) {
  const gruppi = new Map();
  const fuori = [];
  for (const p of voci) {
    if (!p.pratica) { fuori.push({ tipo: 'promemoria', id: p.id, p, priorita: p.priorita, scadenza: p.scadenza || null }); continue; }
    const g = gruppi.get(p.pratica.id) || { tipo: 'pratica', id: p.pratica.id, pratica: p.pratica, voci: [] };
    g.voci.push(p);
    gruppi.set(p.pratica.id, g);
  }
  const PESO_P = { alta: 0, media: 1, bassa: 2 };
  const elenco = [...[...gruppi.values()].map((g) => {
    const voci = ordina(g.voci);
    return { ...g, voci, priorita: voci[0].priorita, scadenza: voci.map((x) => x.scadenza).filter(Boolean).sort()[0] || null,
      importo: voci.reduce((t, x) => t + (Number(x.importo) || 0), 0) || null };
  }), ...fuori];
  return elenco.sort((a, b) => (PESO_P[a.priorita] ?? 1) - (PESO_P[b.priorita] ?? 1) || String(a.scadenza || '9999').localeCompare(String(b.scadenza || '9999')));
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

// DA-FARE v3 (2026-11-16, Luca: "metti anche altre azioni tipo chiama condividi ... condividerlo con ia
// piuttosto che con qualcuno"). Tutto parte da un tocco di Luca: nessun invio automatico.
const euroTesto = (n) => (n == null ? '' : Number(n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }));

// Testo completo e leggibile del promemoria, per condividerlo con una persona o con un'IA.
export function testoCondivisione(p) {
  const righe = [p.titolo];
  const meta = [p.ente, p.importo != null ? euroTesto(p.importo) : null, p.scadenza ? `scadenza ${p.scadenza}` : null].filter(Boolean).join(' · ');
  if (meta) righe.push(meta);
  if (p.spiegazione) righe.push('', p.spiegazione);
  const ps = passi(p.cosa_fare);
  if (ps.length) righe.push('', 'Cosa fare:', ...ps.map((x, i) => `${i + 1}. ${x}`));
  return righe.join('\n');
}

// Numeri di telefono citati nel promemoria (fissi e cellulari italiani), normalizzati per tel:/WhatsApp.
export function telefoni(p) {
  const testo = [p.spiegazione, p.cosa_fare, p.bozza_risposta].filter(Boolean).join(' ');
  const visti = new Set();
  const out = [];
  for (const m of testo.matchAll(/(?<!\d)(?:\+39[ .]?)?(?:3\d{2}|0\d{1,3})(?:[ .]?\d){5,8}(?![\d])/g)) {
    const cifre = m[0].replace(/\D/g, '').replace(/^39(?=[03]\d{6,})/, '');
    if (cifre.length < 8 || cifre.length > 11 || visti.has(cifre)) continue;
    visti.add(cifre);
    out.push({ mostra: m[0].trim(), tel: `+39${cifre}`, cellulare: cifre.startsWith('3') });
  }
  return out;
}

const PROMPT_IA = 'Sono Luca. Aiutami a gestire questa pratica: spiegami in parole semplici cosa rischio, quali opzioni ho e cosa conviene fare per primo. Se serve, proponimi il testo di una risposta.\n\n';
export function linkIA(p, servizio = 'claude') {
  const q = encodeURIComponent(PROMPT_IA + testoCondivisione(p));
  return servizio === 'chatgpt' ? `https://chatgpt.com/?q=${q}` : `https://claude.ai/new?q=${q}`;
}
export const linkWhatsApp = (p, numero) => `https://wa.me/${numero ? numero.replace(/\D/g, '') : ''}?text=${encodeURIComponent(testoCondivisione(p))}`;
export const linkEmail = (p) => `mailto:?subject=${encodeURIComponent(p.titolo)}&body=${encodeURIComponent(testoCondivisione(p))}`;


// Evento nell'agenda di Poliedron (impegni_personali dello studio, solo agenda personale: non lo vede lo studio).
export function eventoDaPromemoria(p, { data, ora } = {}) {
  const giorno = data || p.scadenza || dataTra(1);
  const conOra = /^\d{2}:\d{2}$/.test(ora || '');
  const [h, m] = conOra ? ora.split(':').map(Number) : [0, 0];
  const fine = conOra ? `${String(Math.min(h + 1, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}` : null;
  return {
    titolo: `Da fare: ${p.titolo}`.slice(0, 200), tipo: 'personale', data_inizio: giorno, data_fine: giorno,
    tutto_il_giorno: !conOra, ora_inizio: conOra ? ora : null, ora_fine: fine,
    note: testoCondivisione(p), visibile_personal: true, visibile_studio: false,
  };
}

// Paga: IBAN citati nel promemoria o nel riassunto del documento collegato, con la causale se scritta.
export function datiPagamento(p) {
  const testo = [p.spiegazione, p.cosa_fare, p.bozza_risposta, p.documento?.riassunto].filter(Boolean).join('\n');
  const iban = [...new Set([...testo.matchAll(/\bIT\s?\d{2}\s?[A-Z]\s?(?:[0-9A-Z]\s?){22}/g)].map((m) => m[0].replace(/\s/g, '')))]
    .filter((x) => x.length === 27);
  const causale = testo.match(/causale[^:"“]*[:"“]\s*["“]?([^"”\n.;)]{4,90})/i)?.[1]?.trim() || '';
  return { iban, causale, importo: p.importo ?? null };
}

// Note di avanzamento: una riga datata in cima.
export function conNota(note, testo, quando = new Date()) {
  const riga = `${quando.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })} – ${String(testo).trim()}`;
  return [riga, note].filter(Boolean).join('\n');
}
export async function salvaNota(db, id, note) {
  return esito(await db.from('promemoria_azioni').update({ note }).eq('id', id).select('id, note').single());
}

// Inoltra: contatti salvati una volta (avvocato, commercialista, Anna…) in impostazioni_app.
const CHIAVE_CONTATTI = 'contatti_dafare';
export function normalizzaContatti(xs) {
  return (Array.isArray(xs) ? xs : []).map((c) => ({ nome: String(c?.nome || '').trim(), email: String(c?.email || '').trim(), telefono: String(c?.telefono || '').trim() }))
    .filter((c) => c.nome && (c.email || c.telefono)).slice(0, 30);
}
export async function leggiContatti(db) {
  const r = esito(await db.from('impostazioni_app').select('valore').eq('chiave', CHIAVE_CONTATTI).maybeSingle());
  return normalizzaContatti(r?.valore);
}
export async function salvaContatti(db, contatti) {
  const valore = normalizzaContatti(contatti);
  esito(await db.from('impostazioni_app').upsert({ chiave: CHIAVE_CONTATTI, valore, aggiornato_il: new Date().toISOString() }, { onConflict: 'chiave' }).select('chiave'));
  return valore;
}
export const linkEmailA = (p, email) => `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(p.titolo)}&body=${encodeURIComponent(testoCondivisione(p))}`;
