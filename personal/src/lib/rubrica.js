// RUBRICA (PO 2026-11-26): «ho un problema, chi chiamo?». Professionisti e aziende per categoria (idraulico,
// elettricista, stufa e caldaia, cartongessista, gommista…), con note e storico degli interventi, e promemoria
// che si ripetono (cambio gomme, manutenzione stufa, revisione caldaia). Tabelle `rubrica` e
// `rubrica_promemoria`. Qui solo dati e testo, senza React: l'app e i test usano le stesse funzioni.
import { dataBreve, dataIso, giorniTra, numero, quando } from './mieCose.js';

export { dataBreve, dataIso };
const esito = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const pulito = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
export const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/* ---------- categorie ---------- */
// [id, nome, colore, parole del problema]: cercando «perdita lavandino» o «salvavita» esce chi chiamare.
export const CATEGORIE = [
  ['idraulico', 'Idraulico', 'blu', 'perdita perde acqua tubo tubi lavandino lavello scarico intasato otturato wc water bidet doccia rubinetto boiler scaldabagno sifone allagamento'],
  ['elettricista', 'Elettricista', 'ambra', 'luce corrente salvavita presa prese interruttore quadro elettrico blackout lampadina impianto elettrico citofono'],
  ['stufa', 'Stufa e caldaia', 'rosso', 'stufa pellet legna caldaia termosifone termosifoni riscaldamento fumi bollino canna fumaria camino spazzacamino acqua calda'],
  ['clima', 'Condizionatori', 'cielo', 'condizionatore condizionatori clima climatizzatore aria condizionata split pompa di calore filtri'],
  ['cartongesso', 'Cartongessista', 'pietra', 'cartongesso controsoffitto parete pareti divisorio crepa'],
  ['muratore', 'Muratore', 'pietra', 'muro muratura piastrelle intonaco infiltrazione tetto tegole crepa ristrutturazione'],
  ['imbianchino', 'Imbianchino', 'viola', 'pittura pitturare tinteggiare imbiancare muffa parete pareti vernice'],
  ['fabbro', 'Fabbro', 'grigio', 'serratura chiave chiavi porta blindata cancello inferriata bloccato chiuso fuori'],
  ['serramenti', 'Serramenti e tapparelle', 'grigio', 'tapparella tapparelle finestra finestre infissi serramenti zanzariera vetro vetri'],
  ['elettrodomestici', 'Elettrodomestici', 'cielo', 'lavatrice lavastoviglie frigo frigorifero forno asciugatrice piano cottura cappa'],
  ['antennista', 'Antenna e internet', 'viola', 'antenna tv televisione parabola internet wifi router fibra'],
  ['giardiniere', 'Giardiniere', 'verde', 'giardino siepe prato potatura albero alberi erba irrigazione'],
  ['pulizie', 'Pulizie', 'verde', 'pulizie pulizia vetri sgombero'],
  ['spurghi', 'Spurghi e disinfestazioni', 'grigio', 'fogna pozzo nero spurgo topi insetti vespe zanzare scarafaggi disinfestazione'],
  ['gommista', 'Gommista', 'grigio', 'gomme gomma pneumatici foratura bucata cambio gomme invernali estive'],
  ['meccanico', 'Meccanico e officina', 'ambra', 'auto macchina tagliando freni motore batteria spia revisione officina moto'],
  ['carrozziere', 'Carrozziere', 'rosso', 'carrozzeria graffio ammaccatura parabrezza incidente'],
  ['altro', 'Altro', 'grigio', ''],
];
const PER_ID = Object.fromEntries(CATEGORIE.map(([id, nome, colore, parole]) => [id, { id, nome, colore, parole }]));
const PER_NOME = Object.fromEntries(CATEGORIE.map(([id, nome]) => [norm(nome), id]));
// Una categoria scritta (anche nuova, es. «Vetraio») → { id, nome, colore }.
export function categoria(nome) {
  const id = PER_NOME[norm(pulito(nome))];
  return id ? PER_ID[id] : { id: `x-${norm(pulito(nome))}`, nome: pulito(nome), colore: 'grigio', parole: '' };
}
// Le categorie da mostrare: prima quelle usate (con quanti contatti), poi le altre standard.
export function categorieUsate(contatti) {
  const conta = new Map();
  for (const c of contatti) for (const n of c.categorie || []) { const k = categoria(n); conta.set(k.nome, (conta.get(k.nome) || 0) + 1); }
  const ordine = (n) => { const i = CATEGORIE.findIndex(([, x]) => x === n); return i < 0 ? 900 : i; };
  return [...conta.entries()].map(([nome, n]) => ({ ...categoria(nome), n })).sort((a, b) => ordine(a.nome) - ordine(b.nome) || a.nome.localeCompare(b.nome));
}
export const nomeCategoria = (c) => (c.categorie?.length ? categoria(c.categorie[0]).nome : 'Altro');

/* ---------- ricerca: per nome, nota o problema ---------- */
const testoContatto = (c) => norm([c.nome, c.referente, c.note, c.parole, c.indirizzo, c.telefono, c.email,
  ...(c.categorie || []).flatMap((n) => [n, categoria(n).parole]), ...(c.interventi || []).flatMap((r) => [r.voce, r.note])].join(' '));
export function cerca(contatti, q, cat = null) {
  const parole = norm(q).split(/\s+/).filter((p) => p.length > 1);
  return contatti.filter((c) => {
    if (cat && !(c.categorie || []).some((n) => categoria(n).nome === cat) && !(cat === 'Altro' && !c.categorie?.length)) return false;
    if (!parole.length) return true;
    const t = testoContatto(c);
    // basta una parola che corrisponde («perdita lavandino» trova l'idraulico anche se «lavandino» non c'è)
    return parole.some((p) => t.includes(p) || (p.length > 4 && t.includes(p.slice(0, -1))));
  }).map((c) => ({ c, punti: parole.filter((p) => testoContatto(c).includes(p)).length + (c.preferito ? 0.5 : 0) + (c.voto || 0) / 10 }))
    .sort((a, b) => b.punti - a.punti || a.c.nome.localeCompare(b.c.nome)).map((x) => x.c);
}
// I contatti per categoria (un contatto con due categorie compare in tutte e due).
export function perCategoria(contatti) {
  const gruppi = new Map();
  for (const c of contatti) {
    const nomi = c.categorie?.length ? c.categorie.map((n) => categoria(n).nome) : ['Altro'];
    for (const n of new Set(nomi)) { if (!gruppi.has(n)) gruppi.set(n, []); gruppi.get(n).push(c); }
  }
  const ordine = (n) => { const i = CATEGORIE.findIndex(([, x]) => x === n); return i < 0 ? 900 : i; };
  return [...gruppi.entries()].sort(([a], [b]) => ordine(a) - ordine(b) || a.localeCompare(b))
    .map(([nome, lista]) => ({ ...categoria(nome), contatti: [...lista].sort((a, b) => Number(b.preferito) - Number(a.preferito) || a.nome.localeCompare(b.nome)) }));
}
export const iniziali = (nome) => pulito(nome).split(' ').filter((w) => /[\p{L}\d]/u.test(w[0] || '')).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
export const telefonoChiamabile = (t) => String(t || '').replace(/[^\d+]/g, '');
export const whatsapp = (t) => { let n = telefonoChiamabile(t).replace(/^\+/, '').replace(/^00/, ''); if (/^3\d{8,9}$/.test(n)) n = `39${n}`; return n ? `https://wa.me/${n}` : null; };
export const mappa = (indirizzo) => (pulito(indirizzo) ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pulito(indirizzo))}` : null);
export const sitoWeb = (s) => { const t = pulito(s); return !t ? null : /^https?:\/\//i.test(t) ? t : `https://${t}`; };

/* ---------- promemoria ---------- */
export const RIPETI = [['mai', 'Una volta'], ['1m', 'Ogni mese'], ['3m', 'Ogni 3 mesi'], ['6m', 'Ogni 6 mesi'], ['1a', 'Ogni anno'], ['2a', 'Ogni 2 anni']];
const MESI = { '1m': 1, '3m': 3, '6m': 6, '1a': 12, '2a': 24 };
export const testoRipeti = (r) => RIPETI.find(([k]) => k === r)?.[1] || 'Una volta';
export const AVVISI = [[30, '30 giorni prima'], [14, '2 settimane prima'], [7, '7 giorni prima'], [1, 'Il giorno prima'], [0, 'Il giorno stesso']];
const oggiIso = (oggi = new Date()) => new Date(oggi.getTime() - oggi.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export { oggiIso };

// Aggiunge mesi a una data ISO (il 31 gennaio + 1 mese = 28/29 febbraio).
export function piuMesi(iso, mesi) {
  const [a, m, g] = iso.split('-').map(Number);
  const tot = a * 12 + (m - 1) + mesi, na = Math.floor(tot / 12), nm = tot % 12;
  const ultimo = new Date(Date.UTC(na, nm + 1, 0)).getUTCDate();
  return `${na}-${String(nm + 1).padStart(2, '0')}-${String(Math.min(g, ultimo)).padStart(2, '0')}`;
}
// La prossima data dopo «fatto»: si va avanti di un periodo alla volta finché si supera oggi.
export function prossimaData(data, ripeti, oggi = new Date()) {
  const mesi = MESI[ripeti]; if (!mesi) return null;
  const o = oggiIso(oggi);
  let d = piuMesi(data, mesi), giri = 0;
  while (d <= o && giri++ < 600) d = piuMesi(d, mesi);
  return d;
}
// 'scaduta' (passata), 'presto' (dentro i giorni di avviso), 'ok'.
export function statoPromemoria(p, oggi = new Date()) {
  const giorni = giorniTra(oggiIso(oggi), p.data);
  const avviso = Number.isFinite(Number(p.avviso_giorni)) ? Number(p.avviso_giorni) : 30;
  return { giorni, stato: giorni < 0 ? 'scaduta' : giorni <= avviso ? 'presto' : 'ok', quando: quando(giorni) };
}
export const ordinaPromemoria = (lista, oggi = new Date()) => lista.map((p) => ({ ...p, ...statoPromemoria(p, oggi) })).sort((a, b) => a.giorni - b.giorni);

// Promemoria tipici: [cosa, ripeti, mese-giorno suggerito o null, categoria del professionista].
export const SUGGERITI = [
  ['Cambio gomme invernali', '1a', '11-15', 'Gommista'],
  ['Cambio gomme estive', '1a', '04-15', 'Gommista'],
  ['Manutenzione stufa', '1a', '09-15', 'Stufa e caldaia'],
  ['Revisione caldaia', '1a', '09-30', 'Stufa e caldaia'],
  ['Controllo fumi caldaia', '2a', null, 'Stufa e caldaia'],
  ['Pulizia canna fumaria', '1a', '09-01', 'Stufa e caldaia'],
  ['Pulizia filtri condizionatori', '1a', '05-15', 'Condizionatori'],
  ['Tagliando auto', '1a', null, 'Meccanico e officina'],
  ['Decalcificare boiler', '2a', null, 'Idraulico'],
  ['Potatura siepe', '1a', '03-01', 'Giardiniere'],
];
// La prima data utile per un suggerimento con mese-giorno (quest'anno se non è passata, se no l'anno dopo).
export function dataSuggerita(meseGiorno, oggi = new Date()) {
  if (!meseGiorno) return '';
  const o = oggiIso(oggi), anno = Number(o.slice(0, 4));
  const d = `${anno}-${meseGiorno}`;
  return d >= o ? d : `${anno + 1}-${meseGiorno}`;
}

/* ---------- salvataggio ---------- */
const TESTI = ['referente', 'telefono', 'telefono2', 'email', 'indirizzo', 'sito', 'orari', 'parole'];
export function campiContatto(s) {
  const out = {};
  if ('nome' in s) { out.nome = pulito(s.nome); if (!out.nome) throw new Error('Scrivi il nome'); }
  for (const k of TESTI) if (k in s) out[k] = pulito(s[k]) || null;
  if ('note' in s) out.note = String(s.note ?? '').trim() || null;
  if ('categorie' in s) out.categorie = [...new Set((s.categorie || []).map((n) => categoria(n).nome).filter(Boolean))].slice(0, 12);
  if ('voto' in s) { const v = Number(s.voto); out.voto = v >= 1 && v <= 5 ? Math.round(v) : null; }
  if ('preferito' in s) out.preferito = Boolean(s.preferito);
  if ('interventi' in s) {
    out.interventi = (s.interventi || []).map((r) => ({ data: dataIso(r.data) || '', voce: pulito(r.voce), importo: pulito(r.importo), note: pulito(r.note) }))
      .filter((r) => r.data || r.voce || r.note || r.importo)
      .map((r) => Object.fromEntries(Object.entries(r).filter(([, v]) => v)));
  }
  return out;
}
export function campiPromemoria(s) {
  const out = {};
  if ('cosa' in s) { out.cosa = pulito(s.cosa); if (!out.cosa) throw new Error('Scrivi cosa ricordare'); }
  if ('data' in s) { out.data = dataIso(s.data); if (!out.data) throw new Error('Metti la data'); }
  if ('ripeti' in s) out.ripeti = MESI[s.ripeti] || s.ripeti === 'mai' ? s.ripeti : 'mai';
  if ('avviso_giorni' in s) { const n = Number(s.avviso_giorni); out.avviso_giorni = Number.isFinite(n) ? Math.min(365, Math.max(0, Math.round(n))) : 30; }
  if ('contatto_id' in s) out.contatto_id = s.contatto_id || null;
  if ('note' in s) out.note = pulito(s.note) || null;
  return out;
}
export const ordinaInterventi = (r = []) => [...r].sort((a, b) => String(dataIso(b.data) || '').localeCompare(String(dataIso(a.data) || '')));
export const totaleInterventi = (r = []) => r.reduce((t, x) => t + (numero(x.importo) || 0), 0);
export const euro = (n) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
export { numero };

// Il testo da copiare o inoltrare di un contatto.
export function testoDaCopiare(c) {
  return [pulito(c.nome), c.categorie?.length && c.categorie.join(', '), c.referente && `Referente: ${pulito(c.referente)}`,
    c.telefono && `Tel. ${pulito(c.telefono)}`, c.telefono2 && `Tel. ${pulito(c.telefono2)}`, c.email && pulito(c.email), c.indirizzo && pulito(c.indirizzo),
    c.sito && pulito(c.sito), c.orari && `Orari: ${pulito(c.orari)}`].filter(Boolean).join('\n');
}

const COLONNE = 'id, nome, referente, categorie, telefono, telefono2, email, indirizzo, sito, orari, parole, note, voto, preferito, interventi, creato_il, modificato_il';
const COLONNE_P = 'id, contatto_id, cosa, data, ripeti, avviso_giorni, note, ultimo_fatto, creato_il, modificato_il';
export async function caricaRubrica(db) {
  const [contatti, promemoria] = await Promise.all([
    db.from('rubrica').select(COLONNE).is('archiviato_il', null).order('nome').then(esito),
    db.from('rubrica_promemoria').select(COLONNE_P).is('archiviato_il', null).order('data').then(esito),
  ]);
  return { contatti, promemoria };
}
export const creaContatto = async (db, c) => esito(await db.from('rubrica').insert(campiContatto(c)).select(COLONNE).single());
export const salvaContatto = async (db, id, patch) => esito(await db.from('rubrica').update(campiContatto(patch)).eq('id', id).select('id, modificato_il').single());
// Archiviare toglie dall'elenco senza cancellare. Eliminare (PO 2026-11-26: "devono poter essere cancellabili e
// modificabili") cancella davvero, solo dopo la conferma nell'app; con `conPromemoria` anche i promemoria del
// contatto, altrimenti restano senza contatto (on delete set null).
export const archiviaContatto = async (db, id) => esito(await db.from('rubrica').update({ archiviato_il: new Date().toISOString() }).eq('id', id).select('id').single());
export const creaPromemoria = async (db, p) => esito(await db.from('rubrica_promemoria').insert(campiPromemoria(p)).select(COLONNE_P).single());
export const salvaPromemoria = async (db, id, patch) => esito(await db.from('rubrica_promemoria').update(campiPromemoria(patch)).eq('id', id).select(COLONNE_P).single());
export async function eliminaContatto(db, id, conPromemoria = false) {
  if (!id) throw new Error('Contatto mancante');
  if (conPromemoria) esito(await db.from('rubrica_promemoria').delete().eq('contatto_id', id).select('id'));
  return esito(await db.from('rubrica').delete().eq('id', id).select('id').single());
}
export const eliminaPromemoria = async (db, id) => { if (!id) throw new Error('Promemoria mancante'); return esito(await db.from('rubrica_promemoria').delete().eq('id', id).select('id').single()); };
export const archiviaPromemoria = async (db, id) => esito(await db.from('rubrica_promemoria').update({ archiviato_il: new Date().toISOString() }).eq('id', id).select('id').single());

// «Fatto»: se si ripete va alla data seguente, se no si archivia. Cosa scrivere nel database.
export function dopoFatto(p, oggi = new Date()) {
  const o = oggiIso(oggi);
  const prossima = prossimaData(p.data, p.ripeti, oggi);
  return prossima ? { data: prossima, ultimo_fatto: o } : { ultimo_fatto: o, archiviato_il: new Date(oggi).toISOString() };
}
export async function segnaFatto(db, p, oggi = new Date()) {
  return esito(await db.from('rubrica_promemoria').update(dopoFatto(p, oggi)).eq('id', p.id).select(COLONNE_P).single());
}

// Per la Home di Personal: quanti contatti e il prossimo promemoria (lettura leggera).
export async function rubricaHome(db, oggi = new Date()) {
  const [{ count }, promemoria] = await Promise.all([
    db.from('rubrica').select('id', { count: 'exact', head: true }).is('archiviato_il', null).then((r) => { if (r.error) throw new Error(r.error.message); return r; }),
    db.from('rubrica_promemoria').select('id, cosa, data, avviso_giorni').is('archiviato_il', null).order('data').limit(20).then(esito),
  ]);
  const lista = ordinaPromemoria(promemoria, oggi);
  return { n: count || 0, prossimo: lista[0] || null, daGuardare: lista.filter((p) => p.stato !== 'ok').length };
}
export const testoPromemoria = (p) => `${dataBreve(p.data)} · ${p.quando}`;

/* ---------- rubrica del telefono e Google Contatti (PO 2026-11-26: "il tastino che sincronizza su rubrica telefono e Google") ---------- */
// Un file vCard (.vcf): aperto sul telefono aggiunge i contatti alla rubrica (su Android scegli l'account Google e
// finiscono anche in Google Contatti); da computer si importa in contacts.google.com › Importa. Il gruppo
// «Rubrica Poliedron» e l'UID fisso aiutano Google a riconoscere i doppioni a una nuova importazione.
const esc = (t) => String(t ?? '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
const piega = (riga) => { const out = []; let r = riga; while (r.length > 74) { out.push(r.slice(0, 74)); r = ` ${r.slice(74)}`; } out.push(r); return out.join('\r\n'); };
export function vcard(c) {
  const nome = pulito(c.nome);
  const nota = [c.categorie?.length && `Categoria: ${c.categorie.join(', ')}`, c.referente && `Referente: ${pulito(c.referente)}`, c.orari && `Orari: ${pulito(c.orari)}`, String(c.note || '').trim()].filter(Boolean).join('\n');
  const righe = ['BEGIN:VCARD', 'VERSION:3.0', `UID:poliedron-rubrica-${c.id}`, `N:${esc(nome)};;;;`, `FN:${esc(nome)}`, `ORG:${esc(nome)}`,
    c.categorie?.length && `TITLE:${esc(c.categorie.join(', '))}`,
    c.telefono && `TEL;TYPE=CELL:${telefonoChiamabile(c.telefono) || esc(c.telefono)}`,
    c.telefono2 && `TEL;TYPE=WORK:${telefonoChiamabile(c.telefono2) || esc(c.telefono2)}`,
    c.email && `EMAIL;TYPE=INTERNET:${esc(pulito(c.email))}`,
    c.indirizzo && `ADR;TYPE=WORK:;;${esc(pulito(c.indirizzo))};;;;`,
    c.sito && `URL:${esc(sitoWeb(c.sito))}`,
    `CATEGORIES:Rubrica Poliedron${(c.categorie || []).map((n) => `,${esc(n)}`).join('')}`,
    nota && `NOTE:${esc(nota)}`, 'END:VCARD'].filter(Boolean);
  return righe.map(piega).join('\r\n');
}
export const vcardTutti = (contatti) => `${contatti.map(vcard).join('\r\n')}\r\n`;
export const nomeVcf = (contatti, d = new Date()) => (contatti.length === 1
  ? `${norm(contatti[0].nome).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'contatto'}.vcf`
  : `rubrica-poliedron-${d.toISOString().slice(0, 10)}.vcf`);
