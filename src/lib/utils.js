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
export const C = {
  bg: '#F0F4F8', sur: '#FFFFFF',
  pri: '#1A6B8A', priL: '#E8F4F8', priD: '#124E66',
  acc: '#2EC4B6',
  suc: '#2D9E61', sucL: '#E8F7EE',
  war: '#F4A261',
  dan: '#E63946', danL: '#FDECEA',
  pur: '#7C3AED', purL: '#EDE9FE',
  txt: '#1A202C', txm: '#4A5568', txl: '#718096', brd: '#E2E8F0',
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

/* ── RICHIAMI CLINICI: rilevamento automatico da nome prestazione ── */
const RICHIAMO_KEYWORDS = [
  { match: /igien/i, tipo: 'Igiene orale', mesi: 6 },
  { match: /implant|impiant/i, tipo: 'Controllo impianto', mesi: 3 },
];
export const rilevaRichiamo = (nomePrestazione) => {
  if (!nomePrestazione) return null;
  const found = RICHIAMO_KEYWORDS.find((k) => k.match.test(nomePrestazione));
  return found ? { tipo: found.tipo, mesi: found.mesi } : null;
};

export const SCADENZA_PRESET = [
  { label: '3 mesi', mesi: 3 },
  { label: '6 mesi', mesi: 6 },
  { label: '1 anno', mesi: 12 },
];

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
  { id: 'dentistico', label: 'Studio dentistico' },
  { id: 'medico_generico', label: 'Studio medico generico' },
  { id: 'estetico', label: 'Studio estetico / medicina estetica' },
  { id: 'psicologico', label: 'Studio psicologico' },
  { id: 'altro', label: 'Altro professionista sanitario' },
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

export const COLORI_DISPONIBILI = [
  '#1A6B8A', '#2EC4B6', '#2D9E61', '#7C3AED', '#E63946', '#F4A261',
  '#EC4899', '#DC2626', '#0EA5E9', '#84CC16', '#F59E0B', '#6366F1',
  '#14B8A6', '#A855F7', '#64748B',
];

export const NAV = [
  { id: 'home', l: 'Home', ic: 'home' },
  { id: 'paz', l: 'Pazienti', ic: 'pz' },
  { id: 'piani', l: 'Piani', ic: 'plan' },
  { id: 'paga', l: 'Pagamenti', ic: 'pay' },
  { id: 'listino', l: 'Listino', ic: 'list' },
  { id: 'agenda', l: 'Agenda', ic: 'cal' },
  { id: 'spese', l: 'Spese', ic: 'spe' },
  { id: 'archivio', l: 'Documenti', ic: 'plan' },
  { id: 'wa', l: 'WhatsApp', ic: 'wa' },
  { id: 'set', l: 'Setup', ic: 'set' },
];
