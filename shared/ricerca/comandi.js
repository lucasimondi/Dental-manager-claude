// RICERCA-AGENDA (PO 2026-11-08): "La barra di ricerca deve cercare direttamente, inoltre deve poter
// anche agire: inserire appuntamenti, spostarli, cancellarli, trovare documenti, note, password,
// acquisire documenti, azioni veloci". Motore deterministico, uguale in Studio e in Personal:
// nessun modello, nessun dato inviato fuori. Capisce frasi brevi in italiano; ogni azione che
// cambia l'agenda passa sempre da una conferma nella barra.
export const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daIso = (s) => { const [y, m, g] = s.split('-').map(Number); return new Date(y, m - 1, g, 12); };
const piuGiorni = (s, n) => { const d = daIso(s); d.setDate(d.getDate() + n); return iso(d); };

const GIORNI = ['domenica', 'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato'];
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const GIORNO_RE = '(?:lun|mar|mer|gio|ven|sab|dom)[a-z]*';

// Senza anno: l'occorrenza più vicina a oggi (1/11 visto l'8/11 è quest'anno, 3 marzo è il prossimo).
function vicina(oggi, mese, giorno) {
  const y = daIso(oggi).getFullYear();
  return [y - 1, y, y + 1].map((a) => iso(new Date(a, mese, giorno, 12))).sort((a, b) => Math.abs(daIso(a) - daIso(oggi)) - Math.abs(daIso(b) - daIso(oggi)))[0];
}

// Ogni espressione di data riconosciuta, nell'ordine in cui compare nel testo.
export function trovaDate(testo, oggi) {
  const t = norm(testo), out = [];
  const add = (index, length, data) => { if (data) out.push({ index, length, data }); };
  for (const m of t.matchAll(/\b(dopodomani|domani|oggi)\b/g)) add(m.index, m[0].length, piuGiorni(oggi, { oggi: 0, domani: 1, dopodomani: 2 }[m[1]]));
  const NUM_GIORNO = { dom: 0, lun: 1, mar: 2, mer: 3, gio: 4, ven: 5, sab: 6 };
  for (const m of t.matchAll(new RegExp(`\\b(${GIORNO_RE})(?:\\s+prossim[oa])?\\b`, 'g'))) {
    const g = NUM_GIORNO[m[1].slice(0, 3)];
    // Solo il nome intero o l'abbreviazione di tre lettere; "mar" dopo un numero è marzo.
    if (!(m[1].length === 3 || GIORNI[g].startsWith(m[1]))) continue;
    if (/\d\s*$/.test(t.slice(0, m.index))) continue;
    // "domenica 1/11", "giovedì 12 novembre": conta la data scritta, non il giorno della settimana.
    if (/^\s+\d/.test(t.slice(m.index + m[0].length))) continue;
    const diff = ((g - daIso(oggi).getDay() + 7) % 7) || 7;
    add(m.index, m[0].length, piuGiorni(oggi, diff));
  }
  for (const m of t.matchAll(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/g)) {
    if (/^\d{1,2}[.]\d{2}$/.test(m[0]) && !m[3] && Number(m[2]) > 12) continue; // 15.30 è un orario
    const [g, me] = [Number(m[1]), Number(m[2])];
    if (!(g >= 1 && g <= 31 && me >= 1 && me <= 12)) continue;
    const d = m[3] ? iso(new Date(Number(m[3].length === 2 ? `20${m[3]}` : m[3]), me - 1, g, 12)) : vicina(oggi, me - 1, g);
    add(m.index, m[0].length, d);
  }
  for (const m of t.matchAll(new RegExp(`\\b(\\d{1,2})\\s+(${MESI.map((x) => x.slice(0, 3)).join('|')})[a-z]*(?:\\s+(\\d{4}))?\\b`, 'g'))) {
    const me = MESI.findIndex((x) => x.startsWith(m[2]));
    const d = m[3] ? iso(new Date(Number(m[3]), me, Number(m[1]), 12)) : vicina(oggi, me, Number(m[1]));
    add(m.index, m[0].length, d);
  }
  return out.sort((a, b) => a.index - b.index).filter((x, i, xs) => !xs.slice(0, i).some((y) => x.index < y.index + y.length));
}

// Orari: "alle 15", "ore 9:30", "15.30", "alle 9 e mezza", "alle 11 e un quarto".
export function trovaOre(testo) {
  const t = norm(testo), out = [];
  const re = /\b(?:(alle|all'|ore|dalle|per le|verso le|h)\s*)?(\d{1,2})(?:[:.](\d{2})|\s+e\s+(mezza|mezzo|un quarto|quarto|tre quarti))?\b/g;
  for (const m of t.matchAll(re)) {
    const h = Number(m[2]);
    const min = m[3] ? Number(m[3]) : m[4] ? ({ mezza: 30, mezzo: 30, 'un quarto': 15, quarto: 15, 'tre quarti': 45 })[m[4]] : 0;
    if (h > 23 || min > 59) continue;
    if (!m[1] && !m[3] && !m[4]) continue; // un numero da solo non è un orario
    // "12/11" e "12 novembre" sono date, non orari.
    const dopo = t.slice(m.index + m[0].length);
    if (!m[3] && /^\s*[/-]\d|^\s*(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)/.test(dopo)) continue;
    if (m[3] && /^[/.-]\d/.test(dopo)) continue;
    out.push({ index: m.index, length: m[0].length, ora: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}` });
  }
  return out;
}

const VERBI = [
  ['cancella', /^(cancella|elimina|annulla|togli|rimuovi)\b/],
  ['sposta', /^(sposta|rimanda|anticipa|posticipa|cambia orario( di| a)?)\b/],
  ['nuovaNota', /^(nuova nota|nota|annota|appunta|scrivi (una )?nota)\b:?/],
  ['password', /^(password|pass|pw|credenziali)\b/],
  ['acquisisci', /^(acquisisci|scansiona|fotografa|carica|archivia)( (un |il |la )?(documento|foto|scontrino|fattura|ricetta))?\b/],
  ['nuovoAppuntamento', /^(nuovo appuntamento|appuntamento|prenota|fissa( (un )?appuntamento)?)\b/],
  ['nuovoImpegno', /^(nuovo impegno|impegno|ricordami( di)?|promemoria|evento|aggiungi( (un )?impegno)?)\b/],
];
const PAROLE_VUOTE = /\b(a|al|alla|allo|ad|da|dal|dalla|di|del|della|per|con|il|lo|la|le|i|gli|un|una|uno|e|in|su|ore|alle|dalle|prossim[oa]|appuntamento|impegno|paziente|dott|dottoressa|dottore|sig|signora|signor)\b/g;

/** Interpreta una frase: { tipo, soggetto, testo, date: [...], ore: [...] }. tipo 'cerca' se non è un comando. */
export function interpreta(testo, oggi) {
  const originale = String(testo || '').trim();
  const t = norm(originale);
  if (!t) return { tipo: 'vuoto', soggetto: '', testo: '', date: [], ore: [] };
  const verbo = VERBI.find(([, re]) => re.test(t));
  const tipo = verbo ? verbo[0] : 'cerca';
  const resto = verbo ? t.replace(verbo[1], '').trim() : t;
  const date = trovaDate(resto, oggi), ore = trovaOre(resto);
  let soggetto = resto;
  for (const x of [...date, ...ore].sort((a, b) => b.index - a.index)) soggetto = soggetto.slice(0, x.index) + ' ' + soggetto.slice(x.index + x.length);
  soggetto = soggetto.replace(/\b(lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica|lun|mar|mer|gio|ven|sab|dom|oggi|domani|dopodomani)\b/g, ' ');
  const soggettoPulito = soggetto.replace(PAROLE_VUOTE, ' ').replace(/[^\p{L}\p{N}@.' -]/gu, ' ').replace(/\s+/g, ' ').trim();
  // Testo libero di note e impegni: dalla frase originale, senza il verbo iniziale.
  const quante = verbo ? t.match(verbo[1])[0].split(' ').filter(Boolean).length : 0;
  const libero = originale.split(/\s+/).slice(quante).join(' ').replace(/^:\s*/, '');
  // Titolo di un impegno o di una nota: le parole dell'utente, senza data e ora.
  const liberoN = libero.replace(/\s+/g, ' ');
  let titolo = liberoN;
  const spazi = [...trovaDate(liberoN, oggi), ...trovaOre(liberoN)].sort((a, b) => b.index - a.index);
  for (const x of spazi) titolo = titolo.slice(0, x.index) + ' ' + titolo.slice(x.index + x.length);
  titolo = titolo.replace(/\s+/g, ' ').trim().replace(/(\s+\b(a|al|alle|il|la|per|di|del|e|ore|da|dalle|prossim[oa])\b)+$/i, '').replace(/^(di|che)\s+/i, '').trim();
  return { tipo, soggetto: soggettoPulito, testo: libero, titolo, date: date.map((d) => d.data), ore: ore.map((o) => o.ora) };
}

const parole = (s) => norm(s).split(' ').filter((p) => p.length > 1);
/** Elementi dell'agenda che corrispondono al soggetto (tutte le parole), i prossimi per primi. */
export function trovaElementi(elementi, soggetto, { oggi, data = null, ora = null, limite = 8 } = {}) {
  const ps = parole(soggetto);
  return elementi
    .filter((e) => (!data || e.data === data) && (!ora || e.ora === ora))
    .filter((e) => { const dove = norm(`${e.titolo} ${e.sottotitolo || ''}`); return ps.length ? ps.every((p) => dove.includes(p)) : Boolean(data); })
    .map((e) => ({ e, futuro: e.data >= oggi ? 0 : 1, distanza: Math.abs(daIso(e.data) - daIso(oggi)) }))
    .sort((a, b) => a.futuro - b.futuro || a.distanza - b.distanza || String(a.e.ora || '').localeCompare(String(b.e.ora || '')))
    .slice(0, limite).map((x) => x.e);
}

/** Proposta concreta da confermare, con i dati già risolti. */
export function proposta(cmd, elementi, oggi) {
  if (cmd.tipo === 'sposta' || cmd.tipo === 'cancella') {
    // "sposta Rossi da giovedì a venerdì alle 15": la prima data/ora (se due) indica quale.
    const due = cmd.tipo === 'sposta' && cmd.date.length > 1, dueOre = cmd.tipo === 'sposta' && cmd.ore.length > 1;
    const filtroData = cmd.tipo === 'cancella' ? cmd.date[0] : due ? cmd.date[0] : null;
    const filtroOra = cmd.tipo === 'cancella' ? cmd.ore[0] : dueOre ? cmd.ore[0] : null;
    const candidati = trovaElementi(elementi, cmd.soggetto, { oggi, data: filtroData || null, ora: filtroOra || null });
    if (cmd.tipo === 'cancella') return { tipo: 'cancella', candidati };
    const data = cmd.date[cmd.date.length - 1] || null, ora = cmd.ore[cmd.ore.length - 1] || null;
    return { tipo: 'sposta', candidati, verso: { data, ora } };
  }
  if (cmd.tipo === 'nuovoAppuntamento' || cmd.tipo === 'nuovoImpegno') {
    const titolo = cmd.tipo === 'nuovoImpegno' ? (cmd.titolo || '') : cmd.soggetto;
    return { tipo: cmd.tipo, data: cmd.date[0] || null, ora: cmd.ore[0] || null, soggetto: cmd.soggetto, titolo: titolo.replace(/^./, (c) => c.toUpperCase()) };
  }
  return { tipo: cmd.tipo };
}

/** Nuova data e ora di uno spostamento: quello che manca resta com'era. */
export function destinazione(elemento, verso) {
  return { data: verso?.data || elemento.data, ora: verso?.ora || elemento.ora || null };
}

export const etichettaData = (s, oggi) => {
  if (!s) return '';
  if (s === oggi) return 'oggi';
  if (s === piuGiorni(oggi, 1)) return 'domani';
  return daIso(s).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
};
