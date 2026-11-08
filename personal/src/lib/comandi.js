// Comandi semplici di Poliedron Personal eseguiti dall'app, senza AI esterna (PO 2026-11-08:
// "devi renderlo indipendente da AI esterna… deve essere in grado di eseguire comandi semplici").
// Solo logica pura: legge la frase e restituisce cosa fare; la chat esegue subito (con Annulla)
// quando il comando è completo, altrimenti mostra la scheda già compilata da completare.
import { daIso, isoData, piuGiorni } from './agenda.js';

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const GIORNI = ['domenica', 'luned', 'marted', 'mercoled', 'gioved', 'venerd', 'sabato'];
const GIORNO_RE = 'domenica|luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato';
const due = (n) => String(n).padStart(2, '0');
const pulisci = (s) => String(s || '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();

// Sezioni apribili a voce: parola → vista di Personal (o pagina, per le Impostazioni).
// Le parole marcate «verbo» aprono solo con "apri/vai…": da sole restano una ricerca ("scadenze").
const SEZIONI = [
  [/^(?:home|oggi|inizio|pagina iniziale)$/, { vista: 'oggi', nome: 'Oggi' }],
  [/^(?:agenda|calendario)$/, { vista: 'agenda', nome: 'Agenda' }],
  [/^(?:documenti|archivio)$/, { vista: 'documenti', nome: 'Documenti' }],
  [/^conti$/, { vista: 'conti', nome: 'Conti' }],
  [/^(?:soldi|spese|pagamenti|da pagare|scadenze|incassi)$/, { vista: 'conti', nome: 'Conti', verbo: true }],
  [/^(?:foto|album)$/, { vista: 'foto', nome: 'Foto' }],
  [/^(?:immagini|video)$/, { vista: 'foto', nome: 'Foto', verbo: true }],
  [/^(?:diario|amor fati)$/, { vista: 'diario', nome: 'Diario' }],
  [/^(?:biblioteca|filosofia)$/, { vista: 'didattica', nome: 'Biblioteca' }],
  [/^(?:letture|didattica)$/, { vista: 'didattica', nome: 'Biblioteca', verbo: true }],
  [/^(?:legal|legale)$/, { vista: 'legal', nome: 'Legal' }],
  [/^pratiche$/, { vista: 'legal', nome: 'Legal', verbo: true }],
  [/^(?:personali|documenti personali)$/, { vista: 'personali', nome: 'Personali' }],
  [/^(?:identit[aà]|tessere|portafoglio)$/, { vista: 'personali', nome: 'Personali', verbo: true }],
  [/^(?:impostazioni|preferenze)$/, { pagina: 'impostazioni', nome: 'Impostazioni' }],
  [/^altro$/, { vista: 'altro', nome: 'Altro' }],
];

// Prossimo giorno con quel numero: questo mese se non è passato, altrimenti il mese dopo.
function giornoDelMese(n, mese, anno, oggi) {
  const d0 = daIso(oggi);
  if (mese) {
    let a = anno || d0.getFullYear();
    let d = new Date(a, mese - 1, n, 12);
    if (!anno && isoData(d) < oggi) { a += 1; d = new Date(a, mese - 1, n, 12); }
    return d.getMonth() === mese - 1 ? isoData(d) : null;
  }
  for (let k = 0; k < 2; k += 1) {
    const d = new Date(d0.getFullYear(), d0.getMonth() + k, n, 12);
    if (d.getDate() === n && isoData(d) >= oggi) return isoData(d);
  }
  return null;
}

const DATA_RE = new RegExp([
  '\\b(?:(oggi|stasera|stamattina|dopodomani|domani))(?![a-zà-ÿ])',
  '\\b(?:tra|fra)\\s+(\\d{1,3}|un|una|due|tre)\\s+(giorn[oi]|settiman[ae]|mes[ei])',
  `\\b(?:(?:il|la|di|questo|questa)\\s+)?(${GIORNO_RE})(?![a-zà-ÿ])(?:\\s+(prossim[oa]))?`,
  '\\b(?:il\\s+|entro\\s+il\\s+|per\\s+il\\s+)?(\\d{1,2})\\s*[/.-]\\s*(\\d{1,2})(?:\\s*[/.-]\\s*(\\d{2,4}))?',
  `\\b(?:il\\s+|entro\\s+il\\s+|per\\s+il\\s+)?(\\d{1,2})\\s+(${MESI.join('|')})(?:\\s+(\\d{4}))?`,
  '\\b(?:il|entro il|per il)\\s+(\\d{1,2})(?![\\d:.,/]|\\s*(?:€|euro))',
].join('|'), 'i');

const NUMERI = { un: 1, una: 1, due: 2, tre: 3 };

/** Data citata nella frase → { data: 'aaaa-mm-gg', testo } (il pezzo da togliere dal titolo). */
export function leggiData(frase, oggi) {
  const m = DATA_RE.exec(frase);
  if (!m) return null;
  let data = null;
  if (m[1]) data = piuGiorni(oggi, { oggi: 0, stasera: 0, stamattina: 0, domani: 1, dopodomani: 2 }[m[1].toLowerCase()]);
  else if (m[2]) {
    const n = NUMERI[m[2].toLowerCase()] ?? Number(m[2]);
    const u = m[3].toLowerCase();
    if (u.startsWith('giorn')) data = piuGiorni(oggi, n);
    else if (u.startsWith('settiman')) data = piuGiorni(oggi, 7 * n);
    else { const d = daIso(oggi); d.setMonth(d.getMonth() + n); data = isoData(d); }
  } else if (m[4]) {
    const g = GIORNI.findIndex((s) => m[4].toLowerCase().startsWith(s));
    const diff = (g - daIso(oggi).getDay() + 7) % 7 || 7;
    data = piuGiorni(oggi, diff);
  } else if (m[6]) {
    const anno = m[8] ? (Number(m[8]) < 100 ? 2000 + Number(m[8]) : Number(m[8])) : null;
    data = giornoDelMese(Number(m[6]), Number(m[7]), anno, oggi);
  } else if (m[9]) data = giornoDelMese(Number(m[9]), MESI.indexOf(m[10].toLowerCase()) + 1, m[11] ? Number(m[11]) : null, oggi);
  else if (m[12]) data = giornoDelMese(Number(m[12]), null, null, oggi);
  return data ? { data, testo: m[0] } : null;
}

/** Ora citata ("alle 15", "ore 9:30", "alle 3 del pomeriggio", "alle 18 e mezza") → { ora, testo }. */
export function leggiOra(frase) {
  const m = /\b(?:alle|ore|alle ore|per le|verso le|dalle)\s*(\d{1,2})(?:[:.](\d{2}))?(?:\s+e\s+(mezza|mezzo|un quarto|trenta|quindici|quarantacinque))?(?:\s+(?:del|di)\s+(pomeriggio|sera|mattina))?\b/i.exec(frase);
  if (!m) return null;
  let h = Number(m[1]);
  const extra = { mezza: 30, mezzo: 30, trenta: 30, 'un quarto': 15, quindici: 15, quarantacinque: 45 };
  const min = m[2] != null ? Number(m[2]) : m[3] ? extra[m[3].toLowerCase()] : 0;
  if (m[4] && /pomeriggio|sera/i.test(m[4]) && h >= 1 && h < 12) h += 12;
  if (h > 23 || min > 59) return null;
  return { ora: `${due(h)}:${due(min)}`, testo: m[0] };
}

/** Importo citato ("120 euro", "€ 45,50", "80€") → { importo, testo }. */
export function leggiImporto(frase) {
  const m = /(?:€\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*(?:€|euro\b))/i.exec(frase);
  if (!m) return null;
  return { importo: Number((m[1] || m[2]).replace(',', '.')), testo: m[0] };
}

const maiuscola = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// Toglie dal titolo i pezzi già letti (data, ora, importo) e le parole di raccordo rimaste.
function titoloDa(resto, pezzi) {
  let t = ` ${resto} `;
  for (const p of pezzi) if (p) t = t.replace(p, ' ');
  t = pulisci(t)
    .replace(/\b(?:di|da|per|il|la|lo|entro|alle|ore)\s*$/i, '')
    .replace(/^(?:di|che|a|da)\s+/i, '')
    .replace(/^(?:(?:il|la|lo|i|le|gli)\s+|l')/i, '')
    .replace(/\s+(?:di|da|per|entro|il|la|e)$/i, '')
    .replace(/[.,;:!?]+$/, '');
  return maiuscola(pulisci(t));
}

const PAGAMENTO_RE = /\b(?:pagar[ei]|pagamento|versare|bollett\w*|rata|bollo|f24|tass[ae]|canone|affitto|multa|scadenza)\b/i;

/**
 * Promemoria o pagamento: "ricordami di chiamare Marco domani alle 10", "segna dentista venerdì
 * alle 15", "devo pagare il bollo auto 120 euro il 30", "aggiungi pagamento luce 80€ entro il 5".
 */
function leggiPromemoria(frase, oggi) {
  const comando = /^(?:poliedron[, ]+)?(?:per favore\s+)?(ricordami|ricorda(?:mi)?|promemoria|segna(?:mi)?|annota(?:mi)?|metti(?:mi)? in agenda|aggiungi (?:in agenda|un impegno|impegno|un evento|evento|un promemoria|promemoria)|nuovo (?:impegno|evento|promemoria)|crea (?:un )?(?:impegno|evento|promemoria)|devo pagare|da pagare|aggiungi (?:un )?pagamento|nuovo pagamento|crea (?:un )?pagamento|pagamento)\b[:,]?\s*/i.exec(frase);
  if (!comando) return null;
  const verbo = comando[1].toLowerCase();
  const resto = frase.slice(comando[0].length);
  if (!resto.trim()) return { tipo: 'chiarisci', testo: 'Cosa devo ricordarti, e per quando? Ad esempio: "ricordami di chiamare Marco domani alle 10".' };
  const data = leggiData(resto, oggi);
  const ora = leggiOra(resto);
  const importo = leggiImporto(resto);
  const pagamento = /pagar|pagamento/.test(verbo) || PAGAMENTO_RE.test(resto) || Boolean(importo);
  let titolo = titoloDa(resto, [data?.testo, ora?.testo, importo?.testo]);
  if (pagamento) titolo = maiuscola(titolo.replace(/^(?:pagare|versare)\s+(?:il|la|lo|l'|i|le|gli)?\s*/i, ''));
  const m = {
    cosa: pagamento ? 'pagamento' : 'evento',
    titolo,
    data: data?.data || '',
    ora: pagamento ? '' : ora?.ora || '',
    importo: importo ? importo.importo : '',
  };
  const manca = [!m.titolo && 'titolo', !m.data && 'data'].filter(Boolean);
  return { tipo: 'promemoria', m, completo: manca.length === 0, manca };
}

/** "apri agenda", "vai ai documenti", "mostrami le foto", o solo "agenda" → sezione da aprire. */
function leggiApri(frase) {
  const m = /^(?:apri(?:mi)?|vai|torna|portami|mostra(?:mi)?|fammi vedere)\s+(?:(?:a|al|alla|ai|alle|agli|in|su|nel|nella|nei|nelle)\s+|all'\s*)?(.+)$/i.exec(frase);
  const nome = pulisci(m ? m[1] : frase).toLowerCase().replace(/[.!?]+$/, '').replace(/^(?:(?:la|il|lo|le|i|gli)\s+|l'\s*)/, '').replace(/^(?:sezione|pagina)\s+/, '');
  for (const [re, { verbo, ...dest }] of SEZIONI) if (re.test(nome) && (m || !verbo)) return { tipo: 'apri', ...dest };
  return null;
}

export const AIUTO_COMANDI = [
  'Ricordami di chiamare Marco domani alle 10',
  'Devo pagare il bollo auto 120 euro il 30',
  'Cosa ho domani?',
  'Apri i documenti',
];

/**
 * Frase → comando che l'app sa eseguire da sola, oppure null (allora risponde la ricerca o l'AI).
 * Le domande ("…?") non sono mai comandi di scrittura.
 */
export function interpretaComando(testo, oggi) {
  const frase = pulisci(testo);
  if (!frase) return null;
  if (/^(?:aiuto|help|comandi|cosa sai fare\??|cosa puoi fare\??)$/i.test(frase)) return { tipo: 'aiuto' };
  const apri = leggiApri(frase);
  if (apri) return apri;
  if (/\?\s*$/.test(frase)) return null;
  return leggiPromemoria(frase, oggi);
}
