// POL-VITA-030 ARCHIVIO-CHIEDI — interprete della domanda, tutto sul telefono.
// Riconosce anni, mesi, importi, persone e le domande "quanto ho speso"; le parole che
// restano vanno alla ricerca (sinonimi, accenti, errori di battitura lato database).
// Nessun modello, nessun dato inviato altrove: solo regole.

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

// Parole che non servono alla ricerca.
const VUOTE = new Set(['il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'di', 'del', 'della', 'dello', 'dei', 'degli', 'delle',
  'da', 'dal', 'dalla', 'in', 'nel', 'nella', 'nei', 'nelle', 'a', 'al', 'alla', 'ai', 'agli', 'alle', 'su', 'per', 'con', 'e', 'o',
  'ho', 'hai', 'ha', 'mio', 'mia', 'miei', 'mie', 'tutti', 'tutte', 'tutto', 'cerca', 'trova', 'mostrami', 'fammi', 'vedere', 'dove',
  'che', 'cosa', 'quale', 'quali', 'quanto', 'quanti', 'quante', 'quanta', 'speso', 'spesi', 'pagato', 'pagati', 'costato', 'costati',
  'totale', 'euro', 'eur', 'documento', 'documenti', 'anno', 'mese', 'questo', 'questa', 'scorso', 'scorsa', 'quest']);

const normalizza = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();

const numero = (s) => Number(String(s).replace(/\./g, '').replace(',', '.'));
const pad = (n) => String(n).padStart(2, '0');
const fineMese = (a, m) => new Date(Date.UTC(a, m + 1, 0)).getUTCDate();
const euro = (n) => `${n.toLocaleString('it-IT', { maximumFractionDigits: 2 })} €`;

/**
 * @param {string} domanda
 * @param {{ oggi?: Date, persone?: string[] }} [opzioni]
 * @returns {{ testo: string, filtri: object, etichette: string[], somma: boolean, persona: string|null, vuota: boolean }}
 */
export function interpretaDomanda(domanda, { oggi = new Date(), persone = [] } = {}) {
  let t = ` ${normalizza(domanda)} `;
  const filtri = {};
  const etichette = [];
  const annoCorrente = oggi.getFullYear();

  // "quanto ho speso / pagato", "totale": l'utente vuole una cifra.
  const somma = /\b(quanto|quanti|totale|in tutto|speso|spesi|costato|costati)\b/.test(t);

  // Importi: "tra 50 e 100", "sopra/oltre/più di 100", "sotto/meno di 50".
  const num = '(\\d{1,3}(?:\\.\\d{3})*(?:,\\d+)?|\\d+(?:,\\d+)?)';
  let m = t.match(new RegExp(`\\btra ${num} e ${num}\\s*(?:€|euro|eur)?`));
  if (m) {
    filtri.importo_min = numero(m[1]); filtri.importo_max = numero(m[2]);
    etichette.push(`Importo tra ${euro(filtri.importo_min)} e ${euro(filtri.importo_max)}`);
    t = t.replace(m[0], ' ');
  }
  m = t.match(new RegExp(`\\b(?:sopra|oltre|piu di|più di|maggiore di|superiore a|almeno)\\s*(?:i |gli )?${num}\\s*(?:€|euro|eur)?`));
  if (m) { filtri.importo_min = numero(m[1]); etichette.push(`Importo oltre ${euro(filtri.importo_min)}`); t = t.replace(m[0], ' '); }
  m = t.match(new RegExp(`\\b(?:sotto|meno di|inferiore a|fino a)\\s*(?:i |gli )?${num}\\s*(?:€|euro|eur)?`));
  if (m) { filtri.importo_max = numero(m[1]); etichette.push(`Importo fino a ${euro(filtri.importo_max)}`); t = t.replace(m[0], ' '); }

  // Anno: "quest'anno", "anno scorso", "2024".
  let anno = null;
  if (/\bquest'?\s?anno\b/.test(t)) { anno = annoCorrente; t = t.replace(/\bquest'?\s?anno\b/, ' '); }
  else if (/\b(?:l'|lo )?anno scorso\b/.test(t)) { anno = annoCorrente - 1; t = t.replace(/\b(?:l'|lo )?anno scorso\b/, ' '); }
  else {
    const a = t.match(/\b(19[89]\d|20[0-4]\d)\b/);
    if (a) { anno = Number(a[1]); t = t.replace(a[0], ' '); }
  }

  // Mese: "marzo", "a marzo 2024", "mese scorso".
  let mese = null;
  if (/\bmese scorso\b/.test(t)) {
    const d = new Date(oggi.getFullYear(), oggi.getMonth() - 1, 1);
    mese = d.getMonth(); if (anno == null) anno = d.getFullYear();
    t = t.replace(/\bmese scorso\b/, ' ');
  } else {
    for (let i = 0; i < 12; i += 1) {
      const re = new RegExp(`\\b(?:${MESI[i]}|${MESI_BREVI[i]})\\b`);
      if (re.test(t)) { mese = i; t = t.replace(re, ' '); break; }
    }
  }

  if (mese != null) {
    const a = anno ?? (mese > oggi.getMonth() ? annoCorrente - 1 : annoCorrente);
    filtri.da = `${a}-${pad(mese + 1)}-01`;
    filtri.a = `${a}-${pad(mese + 1)}-${pad(fineMese(a, mese))}`;
    etichette.push(`${MESI[mese][0].toUpperCase()}${MESI[mese].slice(1)} ${a}`);
  } else if (anno != null) {
    filtri.da = `${anno}-01-01`; filtri.a = `${anno}-12-31`;
    etichette.push(`Anno ${anno}`);
  }

  // Persone (dalle Impostazioni dell'app): "di Giulia", "Martina Simondi". Il campo persona è
  // compilato su pochi documenti, quindi il nome resta una parola di ricerca (compare nei titoli):
  // qui lo si riconosce solo per mostrarlo tra le etichette.
  let persona = null;
  for (const p of persone) {
    const intero = normalizza(p);
    const nome = intero.split(' ')[0];
    if (!nome || nome.length < 3) continue;
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b(?:${esc(intero)}|${esc(nome)})\\b`).test(t)) { persona = p; etichette.push(`Persona: ${p}`); break; }
  }

  if (somma) etichette.push('Totale degli importi');

  const parole = t.replace(/[^a-z0-9' ]/g, ' ').replace(/'/g, ' ').split(' ')
    .filter((w) => w.length > 1 && !VUOTE.has(w));
  const testo = parole.join(' ');
  if (testo) etichette.unshift(`«${testo}»`);
  return { testo, filtri, etichette, somma, persona, vuota: !testo && !Object.keys(filtri).length };
}

// Totale e andamento per mese dei documenti trovati (solo quelli con importo).
export function riepilogoImporti(documenti) {
  const conImporto = (documenti || []).filter((d) => d.importo != null && Number.isFinite(Number(d.importo)));
  const totale = conImporto.reduce((s, d) => s + Number(d.importo), 0);
  const perMese = new Map();
  for (const d of conImporto) {
    const data = String(d.data_documento || d.email_data || '').slice(0, 7);
    if (!data) continue;
    perMese.set(data, (perMese.get(data) || 0) + Number(d.importo));
  }
  const mesi = [...perMese.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12);
  const massimo = Math.max(1, ...mesi.map(([, v]) => v));
  return {
    totale: Math.round(totale * 100) / 100,
    n: conImporto.length,
    barre: mesi.map(([k, v]) => ({ chiave: k, etichetta: MESI_BREVI[Number(k.slice(5, 7)) - 1] || k, valore: v, altezza: Math.max(4, Math.round((v / massimo) * 100)) })),
  };
}
