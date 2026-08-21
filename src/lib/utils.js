/* ── STORAGE locale (fallback) ── */
export const LS = {
  get: (k, d) => {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : d;
    } catch {
      return d;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  },
};

/* ── COLORI ── */
/* ── TEMA: due palette (chiaro "Poliedra Light Premium" / scuro "Poliedra
   Dark Premium" — POL-UX-002, navy/blue/indigo su entrambi, non due
   identità di brand diverse). C resta lo stesso oggetto mutabile importato
   ovunque nell'app: applyTheme() ne aggiorna le proprietà in place, così
   ogni componente che legge C.xxx a render-time vede i nuovi colori senza
   bisogno di essere riscritto.
   Tutti i valori restano esadecimali a 6 cifre (mai rgba) perché in alcuni
   punti del codice vengono concatenati con un suffisso alpha, es. C.pri + '30'. ── */
export const C_LIGHT = {
  bg: '#F7F8FA', sur: '#FFFFFF',
  pri: '#185FA5', priL: '#E6F1FB', priD: '#0C447C',
  acc: '#0F6E56',
  suc: '#27500A', sucL: '#EAF3DE',
  war: '#854F0B',
  dan: '#791F1F', danL: '#FCEBEB',
  pur: '#3C3489', purL: '#EEEDFE',
  txt: '#1A2433', txm: '#5F6B7A', txl: '#8A93A0', brd: '#DCE1E6',
};

// Stessa direzione navy/blue/indigo dell'header/sidebar premium (le tinte
// bg/priD riusano esattamente gli stop del gradiente già spedito in
// .app-mobile-header/.premium-sidebar) — non un secondo accento a parte.
export const C_DARK = {
  bg: '#0F172A', sur: '#1B2333',
  pri: '#3B82F6', priL: '#1E2A44', priD: '#0B1220',
  acc: '#38BDF8',
  suc: '#5AB478', sucL: '#16261C',
  war: '#E0B75B',
  dan: '#F09595', danL: '#2A1616',
  pur: '#A79AE0', purL: '#211E33',
  txt: '#E7ECF3', txm: '#93A0B4', txl: '#66738C', brd: '#26314A',
};

export const THEME_KEY = 'dm_color_mode';

export const C = { ...C_LIGHT };
C.header = C.priD;

export const applyTheme = (mode) => {
  Object.assign(C, mode === 'dark' ? C_DARK : C_LIGHT);
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = mode === 'dark' ? 'dark' : 'light';
  }
};

/* ── BRAND COLORS (piano Premium): sovrascrivono pri/priL/priD/acc dello
   studio sopra la palette di tema, riusando lo stesso meccanismo di mutazione
   in place di C — vedi commento sopra. Le tinte priL/priD si derivano dal
   colore primario scelto forzando la luminosità (HSL) in un range leggibile
   (testo bianco su priD, sfondo tenue su priL), qualunque sia la luminosità
   del colore di partenza — così anche un logo molto chiaro o molto scuro
   produce comunque un header/bottoni con contrasto sufficiente. */
const hexToRgb = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
};
const rgbToHsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s; const l = (max + min) / 2;
  if (max === min) { h = s = 0; } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h, s, l };
};
const hslToHex = (h, s, l) => {
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (s === 0) { r = g = b = l; } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};
const deriveBrandShades = (hex) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const { h, s } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  if (s === 0) {
    // Colore acromatico (nero/bianco/grigio): la tonalità è matematicamente
    // indefinita quando la saturazione è 0 — forzare comunque una saturazione
    // minima trasformerebbe un nero in un rosso scuro arbitrario (h finisce a
    // 0 per una scelta implementativa di rgbToHsl). Niente tonalità da
    // preservare qui: solo scale di grigio.
    return { pri: hex, priL: hslToHex(0, 0, 0.93), priD: hslToHex(0, 0, 0.22) };
  }
  const satClamped = Math.max(s, 0.35);
  return {
    pri: hex,
    priL: hslToHex(h, Math.min(satClamped, 0.9), 0.93),
    priD: hslToHex(h, satClamped, 0.22),
  };
};

export const applyBrandColors = (mode, custom) => {
  const base = mode === 'dark' ? C_DARK : C_LIGHT;
  C.pri = base.pri; C.priL = base.priL; C.priD = base.priD; C.acc = base.acc;
  if (custom?.pri) {
    const shades = deriveBrandShades(custom.pri);
    if (shades) { C.pri = shades.pri; C.priL = shades.priL; C.priD = shades.priD; }
  }
  if (custom?.acc && hexToRgb(custom.acc)) C.acc = custom.acc;
  C.header = C.priD; // default: l'header segue il colore del brand/tema, sovrascrivibile da applyHeaderColor
};

const hexToRgba = (hex, alpha) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const a = alpha == null ? 1 : Math.min(1, Math.max(0, alpha));
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
};

// Colore header impostabile a piacere dallo studio (Premium), indipendente dal
// colore primario del brand — con opacità. Va chiamata DOPO applyBrandColors
// nello stesso effetto, così "nessun colore personalizzato" ricade sempre sul
// C.priD già risolto (tema o brand), non su un default fisso.
export const applyHeaderColor = (custom) => {
  if (custom?.colore && hexToRgb(custom.colore)) {
    C.header = hexToRgba(custom.colore, custom.opacita);
  }
};

export const getInitialTheme = () => {
  if (typeof window === 'undefined') return 'light';
  return window.localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
};

/* ── UTILS ── */
export const uid = () => Date.now() + Math.floor(Math.random() * 99999);
export const fmt = (n) => `€ ${Number(n).toFixed(2)}`;
export const fmtD = (d) => (d ? new Date(d + 'T12:00').toLocaleDateString('it-IT') : '-');
export const today = () => new Date().toISOString().slice(0, 10);
export const addDays = (d, n) => {
  const dt = new Date(d + 'T12:00');
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0, 10);
};
export const addMesi = (dataStr, mesi) => {
  const d = new Date(dataStr + 'T12:00');
  d.setMonth(d.getMonth() + mesi);
  return d.toISOString().slice(0, 10);
};

/* ── RICHIAMI CLINICI: rilevamento automatico da nome prestazione ──
   Parole chiave per riconoscere in automatico che tipo di richiamo proporre
   quando una prestazione viene segnata come eseguita. Specifiche per
   vertical: quelle odontoiatriche (igiene/impianto) hanno senso solo per lo
   studio dentistico, non vanno applicate a un fisioterapista o altro
   professionista solo perché una sua prestazione contiene per caso una
   parola simile (es. "impianto" in ortopedia). Ogni nuovo vertical può
   aggiungere qui il proprio elenco; di default nessuna rilevazione. ── */
const RICHIAMO_KEYWORDS_PER_VERTICAL = {
  dentistico: [
    { match: /igien/i, tipo: 'Igiene orale', mesi: 6 },
    { match: /implant|impiant/i, tipo: 'Controllo impianto', mesi: 3 },
  ],
};
export const rilevaRichiamo = (nomePrestazione, vertical) => {
  if (!nomePrestazione) return null;
  const isDentistico = !vertical || vertical === 'dentistico';
  const keywords = RICHIAMO_KEYWORDS_PER_VERTICAL[isDentistico ? 'dentistico' : vertical] || [];
  const found = keywords.find((k) => k.match.test(nomePrestazione));
  return found ? { tipo: found.tipo, mesi: found.mesi } : null;
};

export const SCADENZA_PRESET = [
  { label: '3 mesi', mesi: 3 },
  { label: '6 mesi', mesi: 6 },
  { label: '1 anno', mesi: 12 },
];

/* ── AGENTE AI: azioni personalizzate ──
   Ogni azione sceglie un "effetto" da questo elenco fisso e sicuro — nessuna
   esecuzione di codice arbitrario. Solo 'webhook' ha parametri liberi
   (definiti dallo studio); gli altri riusano scritture già presenti nel
   gestionale con uno schema fisso, mostrato qui solo a scopo informativo. */
// POL-UI-005: icona è una chiave di Ic.jsx (non più un carattere emoji) —
// i consumer la passano a <Ic n={...}/>; il <select> nativo in AgenteAISetup
// non può renderla e mostra solo il testo.
export const TIPI_EFFETTO_AZIONE = [
  { id: 'crea_richiamo', label: 'Crea un richiamo', icona: 'bell', descr: 'Aggiunge una voce nella sezione Richiami per il paziente indicato.', parametriFissi: 'paziente_id, categoria, motivo, data_scadenza' },
  { id: 'crea_promemoria', label: 'Crea un promemoria', icona: 'okc', descr: 'Aggiunge un promemoria/todo visibile in Dashboard.', parametriFissi: 'testo, data' },
  { id: 'nota_paziente', label: 'Aggiungi nota al paziente', icona: 'edit', descr: 'Aggiunge un’annotazione con data alla scheda del paziente.', parametriFissi: 'paziente_id, testo' },
  { id: 'webhook', label: 'Chiama un webhook esterno', icona: 'link', descr: 'Invia i parametri che definisci a un URL esterno (es. n8n, Zapier, Make) — utile per collegare automazioni esterne, come un futuro invio WhatsApp.', parametriFissi: null },
];
export const TIPI_PARAMETRO_AZIONE = [
  { id: 'string', label: 'Testo' },
  { id: 'number', label: 'Numero' },
  { id: 'boolean', label: 'Sì/No' },
];

/* ── SEZIONE RICHIAMI: categorie e stati ──
   POL-UI-005: `icona` is an Ic.jsx key (was an emoji character) — every
   consumer renders it via <Ic n={cat.icona}/>, never interpolates it as
   text. Only presentation metadata; the `categoria` values stored on
   richiami rows are the object keys (clinico/preventivo/...), untouched. */
export const RICHIAMO_CATEGORIE = {
  clinico: { label: 'Clinico', icona: 'pulse', colore: '#1A6B8A' },
  preventivo: { label: 'Preventivo in standby', icona: 'plan', colore: '#7C3AED' },
  incasso: { label: 'Incasso in standby', icona: 'eur', colore: '#E63946' },
  generico: { label: 'Generico', icona: 'pin', colore: '#5F6B7A' },
};

/* ── DEFAULT DATA ── */
export const DEF_PRICE = [
  // ── CHIRURGIA ORALE ──
  { id: 1, cat: 'Chirurgia', cod: '', nome: 'Estrazione semplice', prezzo: 80 },
  { id: 2, cat: 'Chirurgia', cod: '', nome: 'Estrazione complessa', prezzo: 150 },
  { id: 3, cat: 'Chirurgia', cod: '', nome: 'Estrazione 8vo incluso', prezzo: 280 },
  // ── IMPLANTOLOGIA ──
  { id: 4, cat: 'Implantologia', cod: '', nome: 'Impianto osteointegrato', prezzo: 800 },
  { id: 5, cat: 'Implantologia', cod: '', nome: '4 impianti per carico immediato', prezzo: 3200 },
  { id: 6, cat: 'Implantologia', cod: '', nome: '6 impianti per carico immediato', prezzo: 4800 },
  // ── PARODONTOLOGIA ──
  { id: 7, cat: 'Parodontologia', cod: '', nome: 'Curettage a quadrante', prezzo: 100 },
  // ── CONSERVATIVA ──
  { id: 8, cat: 'Conservativa', cod: '', nome: 'Splintaggio', prezzo: 170 },
  { id: 9, cat: 'Conservativa', cod: '', nome: 'Perno in fibra', prezzo: 130 },
  { id: 10, cat: 'Conservativa', cod: '', nome: 'Intarsio in composito', prezzo: 190 },
  // ── OTTURAZIONI ──
  { id: 11, cat: 'Otturazioni', cod: '', nome: 'Otturazione semplice', prezzo: 90 },
  { id: 12, cat: 'Otturazioni', cod: '', nome: 'Otturazione estetica', prezzo: 150 },
  { id: 13, cat: 'Otturazioni', cod: '', nome: 'Otturazione complessa', prezzo: 110 },
  { id: 14, cat: 'Otturazioni', cod: '', nome: 'Otturazione al colletto molare/premolare', prezzo: 90 },
  { id: 15, cat: 'Otturazioni', cod: '', nome: 'Otturazione al colletto incisivo/canino', prezzo: 90 },
  // ── ORTODONZIA TRADIZIONALE ──
  { id: 16, cat: 'Ortodonzia', cod: '', nome: 'RPE Espansore Rapido del Palato', prezzo: 700 },
  { id: 17, cat: 'Ortodonzia', cod: '', nome: 'Estetic plus', prezzo: 1600 },
  // ── GNATOLOGIA ──
  { id: 18, cat: 'Gnatologia', cod: '', nome: 'Placca di svincolo', prezzo: 280 },
  { id: 19, cat: 'Gnatologia', cod: '', nome: 'Byte', prezzo: 140 },
  // ── PROTESI ──
  { id: 20, cat: 'Protesi', cod: '', nome: 'Provvisorio in resina', prezzo: 50 },
  { id: 21, cat: 'Protesi', cod: '', nome: 'Protesi removibile', prezzo: 180 },
  { id: 22, cat: 'Protesi', cod: '', nome: 'Moncone', prezzo: 150 },
  { id: 23, cat: 'Protesi', cod: '', nome: 'Corona stampata ceramica composito', prezzo: 450 },
  { id: 24, cat: 'Protesi', cod: '', nome: 'Capsula zirconio ceramica', prezzo: 600 },
  { id: 25, cat: 'Protesi', cod: '', nome: 'Capsula lega ceramica', prezzo: 500 },
  // ── PROTESI FISSA ──
  { id: 26, cat: 'Protesi Fissa', cod: '', nome: 'Protesi fissa immediata in resina rinforzata', prezzo: 1800 },
  { id: 27, cat: 'Protesi Fissa', cod: '', nome: 'Protesi fissa con barra fusa', prezzo: 2500 },
  { id: 28, cat: 'Protesi Fissa', cod: '', nome: 'Moncone implantare', prezzo: 150 },
  { id: 29, cat: 'Protesi Fissa', cod: '', nome: 'Impianto corona su moncone', prezzo: 1400 },
  { id: 30, cat: 'Protesi Fissa', cod: '', nome: '4 MUA con torretta', prezzo: 720 },
  { id: 31, cat: 'Protesi Fissa', cod: '', nome: '6 MUA con torretta', prezzo: 1080 },
  // ── PROTESI MOBILE ──
  { id: 32, cat: 'Protesi Mobile', cod: '', nome: 'Protesi totale mobile', prezzo: 1000 },
  { id: 33, cat: 'Protesi Mobile', cod: '', nome: 'Protesi con gancio a filo', prezzo: 600 },
  { id: 34, cat: 'Protesi Mobile', cod: '', nome: 'Locator', prezzo: 500 },
  // ── CORONE E PONTI ──
  { id: 35, cat: 'Corone e Ponti', cod: '', nome: 'Corona provvisoria', prezzo: 60 },
  { id: 36, cat: 'Corone e Ponti', cod: '', nome: 'Corona metallo ceramica', prezzo: 550 },
  { id: 37, cat: 'Corone e Ponti', cod: '', nome: 'Corona in zirconio su dente naturale', prezzo: 520 },
  { id: 38, cat: 'Corone e Ponti', cod: '', nome: 'Corona in composito micro-ceramico', prezzo: 480 },
  { id: 39, cat: 'Corone e Ponti', cod: '', nome: 'Corona avvitata in zirconio', prezzo: 550 },
  // ── ENDODONZIA ──
  { id: 40, cat: 'Endodonzia', cod: '', nome: 'Devitalizzazione un canale', prezzo: 150 },
  { id: 41, cat: 'Endodonzia', cod: '', nome: 'Devitalizzazione premolare', prezzo: 190 },
  { id: 42, cat: 'Endodonzia', cod: '', nome: 'Devitalizzazione molare', prezzo: 230 },
  { id: 43, cat: 'Endodonzia', cod: '', nome: 'Ritrattamento endodontico pluri', prezzo: 280 },
  // ── PEDODONZIA ──
  { id: 44, cat: 'Pedodonzia', cod: '', nome: 'Otturazione deciduo', prezzo: 50 },
  { id: 45, cat: 'Pedodonzia', cod: '', nome: 'Devitalizzazione deciduo', prezzo: 80 },
  // ── IGIENE ORALE E PROFILASSI ──
  { id: 46, cat: 'Igiene', cod: '', nome: 'Ablazione tartaro', prezzo: 50 },
  { id: 47, cat: 'Igiene', cod: '', nome: 'Sbiancamento Prophy Jet', prezzo: 40 },
  { id: 48, cat: 'Igiene', cod: '', nome: 'Sbiancamento professionale', prezzo: 129 },
  { id: 49, cat: 'Igiene', cod: '', nome: 'Sbiancamento professionale in studio', prezzo: 119 },
  // ── ORTODONZIA INVISIBILE (FlexiLigner — prezzo scontato ×4) ──
  { id: 50, cat: 'Ortodonzia Invisibile', cod: '', nome: 'Esthetic One (1-6 allineatori)', prezzo: 780 },
  { id: 51, cat: 'Ortodonzia Invisibile', cod: '', nome: 'Esthetic+ One (7-12 allineatori)', prezzo: 1300 },
  { id: 52, cat: 'Ortodonzia Invisibile', cod: '', nome: 'Simple One (13-20 allineatori)', prezzo: 1872 },
  { id: 53, cat: 'Ortodonzia Invisibile', cod: '', nome: 'Simple+ One (21-26 allineatori)', prezzo: 2408 },
  { id: 54, cat: 'Ortodonzia Invisibile', cod: '', nome: 'Pro One (27-32 allineatori)', prezzo: 3056 },
  { id: 55, cat: 'Ortodonzia Invisibile', cod: '', nome: 'Pro+ One (33+ allineatori)', prezzo: 3536 },
  { id: 56, cat: 'Ortodonzia Invisibile', cod: '', nome: 'Esthetic doppia arcata (1-6 allineatori)', prezzo: 1300 },
  { id: 57, cat: 'Ortodonzia Invisibile', cod: '', nome: 'Esthetic+ doppia arcata (7-12 allineatori)', prezzo: 2340 },
  { id: 58, cat: 'Ortodonzia Invisibile', cod: '', nome: 'Simple doppia arcata (13-20 allineatori)', prezzo: 3056 },
  { id: 59, cat: 'Ortodonzia Invisibile', cod: '', nome: 'Simple+ doppia arcata (21-26 allineatori)', prezzo: 3640 },
  { id: 60, cat: 'Ortodonzia Invisibile', cod: '', nome: 'Pro doppia arcata (27-32 allineatori)', prezzo: 4160 },
  { id: 61, cat: 'Ortodonzia Invisibile', cod: '', nome: 'Pro+ doppia arcata (33+ allineatori)', prezzo: 4864 },
  // ── RADIOLOGIA ──
  { id: 62, cat: 'Radiologia', cod: '', nome: 'Ortopantomografia', prezzo: 0 },
];

export const DEF_TPL = [
  { id: 1, nome: 'Reminder appuntamento', testo: 'Gentile {nome},\nricordiamo il suo appuntamento:\n📅 {data} alle {ora}\n🦷 {tipo}\nPer variazioni contattarci entro 24h.\nGrazie, Studio Dentistico.' },
  { id: 2, nome: 'Preventivo pronto', testo: 'Gentile {nome},\nil suo preventivo è pronto.\nTotale: {totale}\nSiamo a disposizione per informazioni.\nGrazie, Studio Dentistico.' },
  { id: 3, nome: 'Piano di cura riepilogo', testo: 'Gentile {nome},\ndi seguito il piano di cura:\n\n{voci}\n\n💰 Totale: {totale}\n\nGrazie, Studio Dentistico.' },
  { id: 4, nome: 'Sollecito controllo', testo: 'Gentile {nome},\nè il momento del suo controllo periodico.\nContattarci per fissare un appuntamento.\nGrazie, Studio Dentistico.' },
];

export const DEF_STUDIO = {
  management_control_mode: 'base',
  vertical: 'dentistico',
  nome: 'Dott. Luca Simondi',
  spec: 'Medico Odontoiatra · Chirurgo Orale · Medico Estetico',
  iscr: 'Iscr. Ordine Medici ed Odontoiatri Cuneo 0577',
  addr1: 'Corso Galileo Ferraris, 11bis — Cuneo',
  addr2: 'Corso Romano Scagliola, 159 — Neive',
  tel: '320 5505397',
  email: 'dottorsimondi@gmail.com',
  piva: '03800670042',
  note: '',
};

export const DEF_APP_TYPES = [
  { id: 1, nome: 'Visita di controllo', colore: '#1A6B8A' },
  { id: 2, nome: 'Igiene', colore: '#2EC4B6' },
  { id: 3, nome: 'Conservativa', colore: '#2D9E61' },
  { id: 4, nome: 'Endodonzia', colore: '#7C3AED' },
  { id: 5, nome: 'Chirurgia', colore: '#E63946' },
  { id: 6, nome: 'Protesi', colore: '#F4A261' },
  { id: 7, nome: 'Ortodonzia', colore: '#EC4899' },
  { id: 8, nome: 'Urgenza', colore: '#DC2626' },
];

export const VERTICALI_DISPONIBILI = [
  { id: 'medico_chirurgo', label: 'Medico chirurgo' },
  { id: 'dentistico', label: 'Medico odontoiatra' },
  { id: 'psicologo', label: 'Psicologo' },
  { id: 'fisioterapista', label: 'Fisioterapista' },
  { id: 'professionista_sanitario', label: 'Professionista sanitario' },
  { id: 'massaggiatore', label: 'Massaggiatore' },
  { id: 'massofisioterapista', label: 'Massofisioterapista' },
  { id: 'personal_trainer', label: 'Personal trainer' },
  { id: 'altro', label: 'Altro' },
];

// Verticali abilitati a generare la ricetta medica (richiede iscrizione
// all'Ordine dei Medici e degli Odontoiatri).
export const VERTICALI_CON_RICETTA = new Set(['medico_chirurgo', 'dentistico']);

/* ── CATEGORIE PRESTAZIONI PER VERTICAL ──
   Elenco proposto nel menu "Categoria" quando si aggiunge una voce al
   listino (Listino.jsx). Ogni vertical ha il proprio elenco pertinente;
   quelli senza un elenco dedicato usano CATEGORIE_PRESTAZIONI_GENERICO.
   Per aggiungere un nuovo vertical con categorie su misura basta aggiungere
   una chiave qui — nessun'altra modifica serve altrove. ── */
export const CATEGORIE_PRESTAZIONI_GENERICO = ['Visita', 'Trattamento', 'Consulenza', 'Altro'];

export const CATEGORIE_PRESTAZIONI_PER_VERTICAL = {
  dentistico: ['Igiene', 'Conservativa', 'Endodonzia', 'Protesi', 'Chirurgia', 'Ortodonzia', 'Radiologia', 'Parodontologia', 'Altro'],
  fisioterapista: ['Valutazione', 'Terapia manuale', 'Rieducazione funzionale', 'Terapie strumentali', 'Altro'],
  massofisioterapista: ['Valutazione', 'Terapia manuale', 'Rieducazione funzionale', 'Terapie strumentali', 'Altro'],
  massaggiatore: ['Valutazione', 'Massaggio', 'Trattamento', 'Altro'],
  psicologo: ['Colloquio', 'Valutazione', 'Percorso terapeutico', 'Altro'],
  personal_trainer: ['Valutazione', 'Allenamento individuale', 'Allenamento di gruppo', 'Programma', 'Altro'],
};

export const getCategoriePrestazioni = (vertical) =>
  CATEGORIE_PRESTAZIONI_PER_VERTICAL[vertical] || CATEGORIE_PRESTAZIONI_GENERICO;

/* ── BRAND PER VERTICAL ──
   Ogni professione ha una propria declinazione del brand Poliedra (logo +
   sottotitolo), non solo un generico "Salus" per tutto ciò che non è
   odontoiatria — coerente con l'obiettivo di comunicazione verticale per
   professione. I file dei loghi vivono in src/assets/logo-poliedra-{slug}-
   outline.png (bianco, per sfondo scuro) e -transparent.png (teal, per
   sfondo chiaro); vanno importati staticamente da chi li usa (App.jsx,
   RegisterScreen.jsx) perché Vite non fa import dinamici da stringa. I
   vertical senza uno slug dedicato qui sotto usano "salus" (brand
   generico) — capita per chi è intenzionalmente ampio (professionista
   sanitario, altro), non ha senso inventare un nome per una categoria
   catch-all. Aggiungere un vertical con brand proprio è solo questa riga
   + i due PNG corrispondenti. ── */
export const LOGO_SLUG_PER_VERTICAL = {
  dentistico: 'dental',
  fisioterapista: 'fisio',
  massofisioterapista: 'fisio',
  psicologo: 'mind',
  massaggiatore: 'wellness',
  personal_trainer: 'fit',
  medico_chirurgo: 'medical',
};

// POL-UX-002: etichetta breve del vertical per il lockup di brand testuale
// "POLIEDRA" + descrittore (sidebar/header) — stessa chiave slug di sopra,
// non il vertical grezzo, così i due si aggiornano insieme. "salus" è il
// default per chi non ha uno slug dedicato (vedi commento sopra).
export const LOGO_SLUG_LABEL = {
  dental: 'Dental', fisio: 'Physio', mind: 'Mind',
  wellness: 'Wellness', fit: 'Fit', medical: 'Medical', salus: 'Salus',
};
export const getLogoSlug = (vertical) => LOGO_SLUG_PER_VERTICAL[vertical] || 'salus';

// Anamnesi medica standard per i verticali con formazione medica
// (odontoiatra, medico chirurgo): set fisso, non personalizzabile dallo
// studio — coerente con l'idea che qui serve un'anamnesi clinica
// riconosciuta, non una checklist libera. Gli altri verticali usano
// invece STORIA_CLINICA_MODELLO_BASE, personalizzabile.
export const ANAMNESI_MEDICA_STANDARD = [
  { chiave: 'cardiopatie', titolo: 'Cardiopatie / problemi cardiovascolari' },
  { chiave: 'ipertensione', titolo: 'Ipertensione arteriosa' },
  { chiave: 'diabete', titolo: 'Diabete' },
  { chiave: 'epatite', titolo: 'Epatite / malattie del fegato' },
  { chiave: 'hiv', titolo: 'HIV / immunodeficienza' },
  { chiave: 'coagulazione', titolo: 'Disturbi della coagulazione' },
  { chiave: 'respiratorie', titolo: 'Malattie respiratorie (asma, BPCO...)' },
  { chiave: 'renali', titolo: 'Malattie renali' },
  { chiave: 'tiroide', titolo: 'Disturbi della tiroide' },
  { chiave: 'epilessia', titolo: 'Epilessia / disturbi neurologici' },
  { chiave: 'oncologiche', titolo: 'Patologie oncologiche, pregresse o in corso' },
  { chiave: 'gravidanza', titolo: 'Gravidanza in corso o allattamento' },
  { chiave: 'interventi_chirurgici', titolo: 'Interventi chirurgici pregressi' },
  { chiave: 'protesi_impiantate', titolo: 'Protesi o dispositivi impiantati (pacemaker, protesi articolari...)' },
  { chiave: 'terapia_anticoagulante', titolo: 'Terapia anticoagulante o antiaggregante in corso' },
  { chiave: 'fumo', titolo: 'Fumatore' },
  { chiave: 'alcol', titolo: 'Consumo di alcol' },
];

// Modello base per la storia clinica modulabile (verticali non medici):
// punto di partenza generico che lo studio personalizza dal Setup —
// aggiunge, toglie o rinomina voci a piacere.
export const STORIA_CLINICA_MODELLO_BASE = [
  { chiave: 'condizioni_generali', titolo: 'Condizioni di salute generali rilevanti' },
  { chiave: 'terapie_in_corso', titolo: 'Terapie o trattamenti in corso' },
  { chiave: 'allergie_note', titolo: 'Allergie note' },
  { chiave: 'interventi_pregressi', titolo: 'Interventi o traumi pregressi nella zona di interesse' },
  { chiave: 'dolore_sintomi', titolo: 'Dolore o sintomi attuali da segnalare' },
];


/* ── DEFAULT GENERICI (professionisti non dentistici) ──
   Usati in fase di primo accesso quando lo studio ha un vertical diverso da 'dentistico'.
   Niente terminologia odontoiatrica: il professionista personalizza da qui. */
export const DEF_TPL_GENERICO = [
  { id: 1, nome: 'Reminder appuntamento', testo: 'Gentile {nome},\nle ricordiamo il suo appuntamento:\n📅 {data} alle {ora}\nPer variazioni contattarci entro 24h.\nGrazie.' },
  { id: 2, nome: 'Preventivo pronto', testo: 'Gentile {nome},\nil suo preventivo è pronto.\nTotale: {totale}\nSiamo a disposizione per informazioni.\nGrazie.' },
  { id: 3, nome: 'Piano di trattamento riepilogo', testo: 'Gentile {nome},\ndi seguito il riepilogo:\n\n{voci}\n\n💰 Totale: {totale}\n\nGrazie.' },
  { id: 4, nome: 'Sollecito controllo', testo: 'Gentile {nome},\nè il momento del suo controllo periodico.\nContattarci per fissare un appuntamento.\nGrazie.' },
];

export const DEF_APP_TYPES_GENERICO = [
  { id: 1, nome: 'Prima visita', colore: '#1A6B8A' },
  { id: 2, nome: 'Visita di controllo', colore: '#2EC4B6' },
  { id: 3, nome: 'Trattamento', colore: '#2D9E61' },
  { id: 4, nome: 'Urgenza', colore: '#DC2626' },
];

/* ── TIPI APPUNTAMENTO PER VERTICAL ──
   Precaricati alla prima apertura di un nuovo studio (App.jsx), stesso
   ruolo di CATEGORIE_PRESTAZIONI_PER_VERTICAL sopra: ogni professione ha
   nomi di appuntamento pertinenti invece del generico "Prima visita /
   Trattamento". I vertical senza un elenco dedicato usano
   DEF_APP_TYPES_GENERICO. Sono solo un punto di partenza: lo studio può
   rinominarli, cambiarli di colore o aggiungerne altri da Impostazioni. ── */
export const APP_TYPES_PER_VERTICAL = {
  fisioterapista: [
    { id: 1, nome: 'Prima valutazione', colore: '#1A6B8A' },
    { id: 2, nome: 'Seduta di fisioterapia', colore: '#2EC4B6' },
    { id: 3, nome: 'Rieducazione funzionale', colore: '#2D9E61' },
    { id: 4, nome: 'Urgenza', colore: '#DC2626' },
  ],
  massofisioterapista: [
    { id: 1, nome: 'Prima valutazione', colore: '#1A6B8A' },
    { id: 2, nome: 'Seduta di fisioterapia', colore: '#2EC4B6' },
    { id: 3, nome: 'Rieducazione funzionale', colore: '#2D9E61' },
    { id: 4, nome: 'Urgenza', colore: '#DC2626' },
  ],
  psicologo: [
    { id: 1, nome: 'Primo colloquio', colore: '#1A6B8A' },
    { id: 2, nome: 'Seduta', colore: '#2EC4B6' },
    { id: 3, nome: 'Colloquio di verifica', colore: '#2D9E61' },
    { id: 4, nome: 'Urgenza', colore: '#DC2626' },
  ],
  massaggiatore: [
    { id: 1, nome: 'Prima seduta', colore: '#1A6B8A' },
    { id: 2, nome: 'Massaggio', colore: '#2EC4B6' },
    { id: 3, nome: 'Trattamento', colore: '#2D9E61' },
    { id: 4, nome: 'Pacchetto', colore: '#7C3AED' },
  ],
  personal_trainer: [
    { id: 1, nome: 'Valutazione iniziale', colore: '#1A6B8A' },
    { id: 2, nome: 'Allenamento individuale', colore: '#2EC4B6' },
    { id: 3, nome: 'Allenamento di gruppo', colore: '#2D9E61' },
    { id: 4, nome: 'Test / valutazione periodica', colore: '#F4A261' },
  ],
};

export const getAppTypesDefault = (vertical) =>
  vertical === 'dentistico' ? DEF_APP_TYPES
  : APP_TYPES_PER_VERTICAL[vertical] || DEF_APP_TYPES_GENERICO;

export const COLORI_DISPONIBILI = [
  '#1A6B8A', '#2EC4B6', '#2D9E61', '#7C3AED', '#E63946', '#F4A261',
  '#EC4899', '#DC2626', '#0EA5E9', '#84CC16', '#F59E0B', '#6366F1',
  '#14B8A6', '#A855F7', '#64748B',
];

// Categorie di spesa base — unica fonte di verità condivisa da Spese.jsx e
// Costi.jsx (prima duplicata identica nei due file) e dal prompt dell'edge
// function estrai-spesa-documento, che deve restituire SEMPRE uno di questi
// valori (l'AI non conosce le categorie personalizzate per studio, quelle
// restano una scelta manuale — vedi mergeCategorieSpesa).
export const CATEGORIE_SPESA = ['Materiali', 'Attrezzature', 'Affitto', 'Condominio', 'Personale', 'Utenze', 'Assicurazioni', 'Software', 'Formazione', 'Tasse', 'Altro'];

// Unisce le categorie base a quelle personalizzate dallo studio (colonna
// studio_info.categorie_spesa_custom), mantenendo "Altro" sempre in fondo e
// senza duplicati (anche se lo studio ne aggiunge una già esistente).
export const mergeCategorieSpesa = (custom) => {
  const base = CATEGORIE_SPESA.filter((c) => c !== 'Altro');
  const extra = (custom || []).filter((c) => c && !base.includes(c));
  return [...base, ...extra, 'Altro'];
};

/* ── PIANI E FUNZIONALITÀ ──
   Default per piano; ogni studio può avere override individuali (feature_overrides
   su Supabase, impostabili dalla Dashboard Master) che sovrascrivono questi default. */
// NOTA: max_pazienti/max_utenti sono replicati anche in Supabase (tabella
// plan_limits) per l'enforcement server-side reale (trigger su patients e
// studio_users). Se cambi questi numeri, aggiornali anche lì — sono la
// fonte di verità per il blocco effettivo, questi qui sono solo per il
// rendering immediato lato client (messaggi di soft-limit, UI).
// La fatturazione (fatture, rimborsi) è sempre disponibile su ogni piano:
// è un obbligo fiscale, non una feature a pagamento — per questo non ha
// un toggle qui.
export const PIANI_FEATURES_DEFAULT = {
  base: { whatsapp: false, whatsapp_automatico: false, archivio_documenti: false, spese: false, custom_logo: true, custom_colors: false, controllo_gestione: false, max_pazienti: 60, max_utenti: 1, assistente_ai: 'off', multi_operatore: false, google_calendar_sync: false },
  pro: { whatsapp: true, whatsapp_automatico: false, archivio_documenti: true, spese: true, custom_logo: true, custom_colors: false, controllo_gestione: false, max_pazienti: null, max_utenti: 3, assistente_ai: 'off', multi_operatore: false, google_calendar_sync: false },
  premium: { whatsapp: true, whatsapp_automatico: false, archivio_documenti: true, spese: true, custom_logo: true, custom_colors: true, controllo_gestione: true, max_pazienti: null, max_utenti: null, assistente_ai: 'off', multi_operatore: false, google_calendar_sync: false },
};

// Livelli dell'assistente AI, dal più limitato al più completo.
export const ASSISTENTE_AI_LIVELLI = [
  { id: 'off', label: 'Disattivato' },
  { id: 'base', label: 'Base (solo guida al software)' },
  { id: 'pro', label: 'Pro (guida + lettura dati)' },
  { id: 'premium', label: 'Premium (completo, azioni incluse)' },
];

// Livello di autonomia dell'agente AI (dial indipendente dal piano/livello
// assistente_ai): quanto può fare da solo, in chat e nei consigli proattivi.
// rank: usato per confrontare il livello scelto dallo studio con il tetto
// massimo impostato dal super admin (agente_azione_max in feature_overrides).
export const LIVELLI_AZIONE_AGENTE = [
  { id: 'consulente', rank: 0, label: 'Consulente (solo lettura e consigli)', descr: 'Nessuna azione di scrittura in chat, nessuna scansione commerciale proattiva. Resta attivo per analisi e consigli CFO/marketing.' },
  { id: 'medio', rank: 1, label: 'Medio (azioni con conferma)', descr: 'Ogni azione di scrittura in chat richiede conferma esplicita. Niente scanner commerciale automatico nei consigli proattivi.' },
  { id: 'su_richiesta', rank: 2, label: 'Su richiesta (esegue solo se richiesto)', descr: 'Esegue subito, senza conferme aggiuntive, le azioni di scrittura che chiedi esplicitamente in chat. Non prende mai iniziativa da solo: niente scanner commerciale automatico nei consigli proattivi.' },
  { id: 'completo', rank: 3, label: 'Completo (attivo)', descr: 'Comportamento pieno: azioni dirette dove previsto, scanner commerciale proattivo incluso — può anche proporre di sua iniziativa opportunità commerciali nei consigli del giorno.' },
];

export const FEATURE_TOGGLES = [
  { id: 'whatsapp', label: 'WhatsApp (manuale)' },
  { id: 'whatsapp_automatico', label: 'WhatsApp Automatico (AI + promemoria)' },
  { id: 'archivio_documenti', label: 'Archivio documenti avanzato (ricerca, export batch)' },
  { id: 'spese', label: 'Spese studio' },
  { id: 'custom_logo', label: 'Logo personalizzato' },
  { id: 'custom_colors', label: 'Colori del brand coordinati col logo' },
  { id: 'controllo_gestione', label: 'Controllo di Gestione' },
  { id: 'multi_operatore', label: 'Agenda multi-utente e multi-postazione' },
  { id: 'google_calendar_sync', label: 'Sincronizzazione Google Calendar' },
];

export const computeFeatures = (piano, overrides) => {
  const base = PIANI_FEATURES_DEFAULT[piano] || PIANI_FEATURES_DEFAULT.base;
  return { ...base, ...(overrides || {}) };
};

export const NAV = [
  { id: 'home', l: 'Home', ic: 'home' },
  { id: 'paz', l: 'Pazienti', ic: 'pz' },
  { id: 'piani', l: 'Piani', ic: 'plan' },
  { id: 'paga', l: 'Pagamenti', ic: 'pay' },
  { id: 'listino', l: 'Listino', ic: 'list' },
  { id: 'agenda', l: 'Agenda', ic: 'cal' },
  { id: 'richiami', l: 'Richiami', ic: 'clk' },
  { id: 'spese', l: 'Spese', ic: 'spe' },
  { id: 'controllo', l: 'Controllo', ic: 'chart' },
  { id: 'archivio', l: 'Documenti', ic: 'folder' },
  { id: 'wa', l: 'WhatsApp', ic: 'wa' },
  { id: 'agenteai', l: 'Agente AI', ic: 'bot' },
  { id: 'set', l: 'Setup', ic: 'set' },
];

/* ── DOCK MOBILE PERSONALIZZABILE ──
   Struttura salvata in studio_info.dock_settings (jsonb):
   {
     iconStyle: 'outline' | 'filled' | 'vivid',
     slots: ['home','agenda','__menu__','paga','wa'],   // 5 posizioni fisse, '__menu__' è lo slot rialzato centrale
     menuItems: ['paz','piani','listino','spese','archivio','set'],  // ordine nel popup
   }
   Il dock ha SEMPRE 5 posizioni; lo slot centrale (indice 2) è normalmente il pulsante
   "menu" rialzato che apre il popup — ma può essere sostituito da una voce diretta
   se lo studio preferisce così (in tal caso niente popup: 5 scorciatoie dirette). */
export const DOCK_MENU_SLOT = '__menu__';

export const DEF_DOCK_SETTINGS = {
  iconStyle: 'vivid',
  slots: ['home', 'agenda', DOCK_MENU_SLOT, 'paga', 'wa'],
  menuItems: ['paz', 'piani', 'listino', 'richiami', 'spese', 'archivio', 'agenteai', 'set'],
};

// Tutte le voci disponibili per comporre dock/popup, indicizzate per id (comodo per i <select>)
export const NAV_BY_ID = Object.fromEntries(NAV.map((n) => [n.id, n]));

// Unisce le impostazioni dock salvate (studio_info.dock_settings) con i
// default correnti. Una volta che uno studio salva un dock_settings, quel
// menuItems resta fisso in DB: senza questo "riempi i mancanti", ogni nuova
// voce di menu aggiunta in futuro (com'è successo con Richiami e Agente AI)
// resterebbe invisibile per sempre a chi ha già un dock personalizzato,
// anche dopo un aggiornamento dell'app — stesso problema già risolto per i
// widget di Dashboard (vedi loadWidgets in Dashboard.jsx).
// POL-UX-001: "home" must always be reachable from the dock — a saved
// custom 5-slot layout that dropped it (e.g. an older client that allowed
// it, or a manual DB edit) would otherwise leave the user with no way back
// to Home short of a full reload. Force it back into slot 0 rather than
// silently discarding the rest of the customization.
export const mergeDockSettings = (saved) => {
  const s = saved || {};
  const menuItems = [...(s.menuItems || DEF_DOCK_SETTINGS.menuItems)];
  DEF_DOCK_SETTINGS.menuItems.forEach((id) => { if (!menuItems.includes(id)) menuItems.push(id); });
  let slots = s.slots?.length === 5 ? [...s.slots] : [...DEF_DOCK_SETTINGS.slots];
  if (!slots.includes('home')) { slots.pop(); slots.unshift('home'); }
  return {
    ...DEF_DOCK_SETTINGS,
    ...s,
    slots,
    menuItems,
  };
};

/* ── AGENDA PERSONALIZZABILE ──
   Struttura salvata in studio_info.agenda_settings (jsonb).
   hiddenWeekdays: array di numeri getDay() da nascondere nella vista Settimana
   (0=Domenica … 6=Sabato). Esempio: [0] nasconde solo la domenica, [0,6] nasconde il weekend intero. */
export const DEF_AGENDA_SETTINGS = {
  hiddenWeekdays: [],
  oraInizio: 8,
  oraFine: 20,
  slotMin: 30,
  zoom: 1,
  durataDefault: 45,
};

// Quali tipi di documento vengono salvati automaticamente nell'archivio
// (visibile in scheda paziente) quando si genera il PDF. true = archivia,
// false = solo condividi/scarica senza tenerne una copia. Personalizzabile
// per tipo dal Setup, così ogni studio decide cosa conservare.
export const DEF_DOCUMENTI_SETTINGS = {
  ricetta: true,
  esami: true,
  certificato: true,
  lettera: true,
  protocollo: false, // istruzioni standard, spesso non serve tenerne archivio
  vuoto: false, // documento libero/vario, non sempre da archiviare
  fattura: true,
  rimborso: true,
};
