/* Ricetta rapida dalla chat: "amoxicillina e clavulanico per Tizio Caio",
   "ricetta di ibuprofene per Mario Rossi", "prescrivi Augmentin a Rossi".
   Nessuna chiamata al modello e nessuna scrittura: si apre il modulo Ricetta
   del paziente già compilato con i farmaci frequenti dello studio
   (Impostazioni → Documenti); il medico controlla e genera lui il PDF.
   Il paziente deve essere uno solo: con omonimi o nessun risultato si chiede.
   Le frasi con posologia o durata dettate ("ogni 8 ore", "per 5 giorni")
   restano al percorso esistente, che compila tutti i campi. */
import { normalizza, cercaPazienti } from '../ricercaPazienti.js';

const clean = (v = '') => String(v).normalize('NFC').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
const words = (v = '') => normalizza(v).replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
const fullName = (p) => [p?.nome, p?.cognome].filter(Boolean).join(' ').trim();

// Parole che non identificano un farmaco (connettivi, forme, unità).
const NOISE = new Set(['e', 'ed', 'di', 'del', 'con', 'acido', 'sale', 'mg', 'g', 'gr', 'ml', 'compresse', 'compressa', 'cp', 'cpr', 'bustine', 'bustina', 'capsule', 'capsula', 'collutorio']);
// Nomi commerciali → principio attivo, per abbinarli ai farmaci frequenti.
const SYNONYMS = Object.freeze({
  augmentin: ['amoxicillina', 'clavulanico'],
  clavulin: ['amoxicillina', 'clavulanico'],
  brufen: ['ibuprofene'],
  moment: ['ibuprofene'],
  tachipirina: ['paracetamolo'],
  oki: ['ketoprofene'],
  ketorolac: ['toradol'],
  azitromicina: ['zitromax'],
  alprazolam: ['xanax'],
  dalacin: ['clindamicina'],
});
// Radici di farmaci comuni in odontoiatria: servono solo a riconoscere la
// forma breve "<farmaco> per <paziente>" quando il farmaco non è tra i preferiti.
const DRUG_STEMS = ['amoxicill', 'augmentin', 'clavulan', 'ibuprof', 'brufen', 'paracetam', 'tachipirin', 'ketoprof', 'oki', 'toradol', 'ketorolac',
  'clindamic', 'dalacin', 'azitrom', 'zitromax', 'claritrom', 'metronidaz', 'flagyl', 'spiramic', 'rodogyl', 'cefix', 'ciproflox', 'levoflox',
  'pantopraz', 'omepraz', 'lansopraz', 'clorexid', 'enterogerm', 'enterobou', 'xanax', 'alprazol', 'nimesul', 'aulin', 'diclofen', 'voltaren',
  'desametas', 'bentelan', 'betametas', 'deltacorten', 'prednis', 'tramadol', 'codein', 'naprossen', 'momendol'];
const DETAILS_RE = /\b(?:ogni|volt[ae]|al giorno|die|per \d+ (?:giorni|settimane)|per (?:una|due|tre|quattro|cinque|sei|sette) (?:giorni|settimane)|compress[ae] (?:al|ogni)|bustin[ae] (?:al|ogni)|mattina|sera|prima dei pasti|dopo i pasti)\b/i;
const NAME = "([A-Za-zÀ-ÿ'][A-Za-zÀ-ÿ' ]{1,60}?)";
const DRUG = '(.{3,160}?)';
const LEAD = "(?:(?:fai|fammi|crea|creami|prepara|preparami|scrivi|fare|faccio)\\s+(?:una\\s+|la\\s+)?)?";
const PATTERNS = [
  // "ricetta di amoxicillina per Mario Rossi", "fai una ricetta con Augmentin a Rossi"
  { re: new RegExp(`^${LEAD}ricetta\\s+(?:(?:di|con)\\s+)?${DRUG}\\s+(?:per|a|al|alla)\\s+(?:paziente\\s+)?${NAME}$`, 'i'), drug: 1, patient: 2, explicit: true },
  // "ricetta per Mario Rossi di amoxicillina"
  { re: new RegExp(`^${LEAD}ricetta\\s+(?:per|a|al|alla)\\s+(?:paziente\\s+)?${NAME}\\s+(?:di|con)\\s+${DRUG}$`, 'i'), drug: 2, patient: 1, explicit: true },
  // "prescrivi amoxicillina a Mario Rossi"
  { re: new RegExp(`^prescriv\\w*\\s+${DRUG}\\s+(?:a|al|alla|per)\\s+(?:paziente\\s+)?${NAME}$`, 'i'), drug: 1, patient: 2, explicit: true },
  // "amoxicillina e clavulanico per Tizio Caio": only when it really is a drug
  { re: new RegExp(`^${DRUG}\\s+(?:per|a)\\s+(?:paziente\\s+)?${NAME}$`, 'i'), drug: 1, patient: 2, explicit: false },
];

const drugTokens = (text) => words(text).flatMap((w) => SYNONYMS[w] || [w]).filter((w) => !NOISE.has(w) && !/^\d/.test(w));
const looksLikeDrug = (text, favorites) => {
  const tokens = drugTokens(text);
  if (!tokens.length) return false;
  return tokens.some((t) => DRUG_STEMS.some((s) => t.startsWith(s))) || Boolean(matchFavorite(text, favorites));
};

/** The favorite this text names: all its words in the favorite's name, fewest extra words wins. */
export function matchFavorite(text, favorites = []) {
  const tokens = drugTokens(text);
  if (!tokens.length) return null;
  let best = null;
  for (const fav of favorites) {
    const favWords = drugTokens(fav?.farmaco || '');
    if (!favWords.length || !tokens.every((t) => favWords.some((w) => w === t || (t.length >= 5 && w.startsWith(t))))) continue;
    const extra = favWords.length - tokens.length;
    if (!best || extra < best.extra) best = { fav, extra };
  }
  if (!best) return null;
  // A dose said in the sentence that the favorite does not have: keep the
  // name only, never a posology meant for another dose.
  const doses = (normalizza(text).match(/\d+(?:[.,]\d+)?/g) || []);
  const favDose = normalizza(`${best.fav.farmaco} ${best.fav.dosaggio || ''}`);
  if (doses.some((d) => !favDose.includes(d))) return null;
  return best.fav;
}

/** Drug lines for the form: one favorite for the whole phrase, otherwise one per part. */
export function prescriptionLines(drugText, favorites = []) {
  const whole = matchFavorite(drugText, favorites);
  const parts = whole ? [drugText] : drugText.split(/\s*(?:,|;|\+|\bpiù\b|\bpiu\b|\be\b)\s*/i).map((p) => p.trim()).filter(Boolean);
  return parts.map((part) => {
    const fav = whole || matchFavorite(part, favorites);
    return fav
      ? { farmaco: fav.farmaco, dosaggio: fav.dosaggio || '', posologia: fav.posologia || '', durata: fav.durata || '', note: fav.note || '', abituale: true }
      : { farmaco: part.charAt(0).toUpperCase() + part.slice(1), dosaggio: '', posologia: '', durata: '', note: '', abituale: false };
  }).slice(0, 10);
}

/** { drugText, patientText, explicit } or null. Pure. */
export function parseQuickPrescription(text = '', favorites = []) {
  const t = clean(text).replace(/[.!]+$/, '');
  if (!t || /\?$/.test(t) || DETAILS_RE.test(t)) return null;
  for (const p of PATTERNS) {
    const m = t.match(p.re);
    if (!m) continue;
    const drugText = clean(m[p.drug]).replace(/^(?:di|con)\s+/i, '');
    const patientText = clean(m[p.patient]);
    if (!drugText || !patientText) continue;
    if (!p.explicit && !looksLikeDrug(drugText, favorites)) continue;
    return { drugText, patientText, explicit: p.explicit };
  }
  return null;
}

function findPatients(patients, patientText) {
  const target = normalizza(patientText);
  const exact = patients.filter((p) => {
    const a = normalizza(fullName(p));
    const b = normalizza([p?.cognome, p?.nome].filter(Boolean).join(' '));
    return a === target || b === target;
  });
  return exact.length ? exact : cercaPazienti(patients, patientText).slice(0, 5);
}

/**
 * Result for processQuery, or null when the sentence is not a quick prescription.
 * Opens the form only on a submitted message (never on a keystroke preview).
 */
export function resolveQuickPrescription(text, { patients = [], favorites = [], actions = [], submitted = false } = {}) {
  const parsed = parseQuickPrescription(text, favorites);
  if (!parsed) return null;
  const candidates = findPatients(patients, parsed.patientText);
  const base = { intent: 'PRESCRIPTION', entities: {}, confirmationRequired: false, suggestedActions: [], searchResults: [] };
  if (!submitted) return { ...base, answer: null, awaitingSubmit: true };
  if (!actions.some((a) => a.id === 'prescription.create')) {
    return { ...base, answer: 'Non posso aprire il modulo Ricetta con i permessi e la configurazione attuali.' };
  }
  if (!candidates.length) return { ...base, answer: `Non trovo il paziente “${parsed.patientText}”. Controlla il nome o crealo prima.` };
  if (candidates.length > 1) {
    return { ...base, answer: `Ho trovato più pazienti: ${candidates.map(fullName).join(', ')}. Per chi è la ricetta? Scrivimi nome e cognome.` };
  }
  const patient = candidates[0];
  const lines = prescriptionLines(parsed.drugText, favorites);
  const farmaci = lines.map(({ abituale, ...line }) => line);
  const usual = lines.filter((l) => l.abituale).map((l) => l.farmaco);
  const free = lines.filter((l) => !l.abituale).map((l) => l.farmaco);
  const answer = [
    `Ricetta per ${fullName(patient)} pronta da verificare.`,
    usual.length ? `${usual.join(', ')}: ho usato la posologia abituale dello studio.` : '',
    free.length ? `${free.join(', ')}: completa dosaggio e posologia nel modulo.` : '',
    'Controllala qui sotto: la invio al paziente solo quando confermi.',
  ].filter(Boolean).join(' ');
  return {
    ...base,
    answer,
    documentRequest: { type: 'ricetta', patientId: patient.id, patientName: fullName(patient), farmaci },
  };
}
