// PR #337 §4 — apertura diretta dei file e «App predefinite» (Impostazioni › Personale › App predefinite).
// Per ogni estensione Luca sceglie con cosa aprirla; senza scelta vale la regola di Windows-Poliedra:
// PDF, immagini, video e audio nel visualizzatore integrato, Google Docs e Office nel visualizzatore di
// Drive in una nuova scheda, il resto si scarica. Le scelte stanno in `impostazioni_app` (chiave
// `esplora_app_predefinite`), così valgono su tutti i dispositivi. Nessuno schema nuovo.
import { comeAprire, linkDrive, linkDocs } from './esplora.js';

export const APP_APERTURA = [
  ['anteprima', 'Anteprima Poliedra'],
  ['drive', 'Visualizzatore Google Drive'],
  ['docs', 'Google Documenti / Fogli'],
  ['browser', 'Nuova scheda del browser'],
  ['scarica', 'Scarica'],
  ['altra', 'Altra app…'],
  ['office', 'Word, Excel, PowerPoint del telefono'], // SCAN-GOOGLE-OFFICE: il file passa all'app Microsoft
];
export const nomeApp = (id) => APP_APERTURA.find(([k]) => k === id)?.[1] || 'Automatica';
// Le estensioni mostrate nelle Impostazioni (più quelle già scelte da Luca).
export const ESTENSIONI_COMUNI = ['pdf', 'jpg', 'png', 'heic', 'mp4', 'mp3', 'docx', 'xlsx', 'pptx', 'txt', 'zip', 'xml', 'eml'];
const DA_MIME = [[/pdf/, 'pdf'], [/jpe?g/, 'jpg'], [/png/, 'png'], [/heic/, 'heic'], [/gif/, 'gif'], [/webp/, 'webp'], [/mp4/, 'mp4'], [/mpeg|mp3/, 'mp3'],
  [/wordprocessingml/, 'docx'], [/msword/, 'doc'], [/spreadsheetml/, 'xlsx'], [/ms-excel/, 'xls'], [/presentationml/, 'pptx'], [/ms-powerpoint/, 'ppt'], [/google-apps\.document/, 'gdoc'],
  [/google-apps\.spreadsheet/, 'gsheet'], [/rfc822/, 'eml'], [/zip/, 'zip'], [/xml/, 'xml'], [/^text\/plain/, 'txt']];

export function estensioneDi(d = {}) {
  const dalNome = (String(d.nome_file_originale || '').match(/\.([a-z0-9]{1,5})$/i) || [])[1];
  if (dalNome) return dalNome.toLowerCase().replace('jpeg', 'jpg');
  const m = String(d.mime_type || '').toLowerCase();
  for (const [re, e] of DA_MIME) if (re.test(m)) return e;
  return '';
}

// Con cosa si apre questo file: la scelta di Luca per l'estensione, altrimenti la regola automatica.
// Risultato: { modo: 'anteprima'|'link'|'browser'|'scarica'|'altra'|'scheda', tipo?, url? }.
export function comeAprireCon(d = {}, predefinite = {}) {
  const auto = comeAprire(d);
  const app = predefinite?.[estensioneDi(d)];
  if (!app || !d.drive_file_id) return auto;
  if (app === 'anteprima') return auto.modo === 'anteprima' ? auto : { modo: 'scheda' };
  if (app === 'drive') return { modo: 'link', url: linkDrive(d) };
  if (app === 'docs') return { modo: 'link', url: linkDocs(d) || linkDrive(d) };
  if (app === 'browser' || app === 'scarica' || app === 'altra') return { modo: app };
  if (app === 'office') return { modo: 'altra' };
  return auto;
}
export const appAutomatica = (d = {}) => {
  const c = comeAprire(d);
  return c.modo === 'anteprima' || c.modo === 'scheda' ? 'anteprima' : c.modo === 'link' ? 'drive' : 'scarica';
};
export const cambiaApp = (predefinite, ext, app) => {
  const n = { ...(predefinite || {}) };
  if (!app) delete n[ext]; else n[ext] = app;
  return n;
};

const CHIAVE = 'esplora_app_predefinite';
const valide = new Set(APP_APERTURA.map(([k]) => k));
export async function caricaAppPredefinite(db) {
  const { data, error } = await db.from('impostazioni_app').select('valore').eq('chiave', CHIAVE).maybeSingle();
  if (error) throw new Error(error.message);
  const v = data?.valore && typeof data.valore === 'object' && !Array.isArray(data.valore) ? data.valore : {};
  return Object.fromEntries(Object.entries(v).filter(([e, a]) => /^[a-z0-9]{1,6}$/.test(e) && valide.has(a)));
}
export async function salvaAppPredefinite(db, mappa) {
  const { error } = await db.from('impostazioni_app').upsert({ chiave: CHIAVE, valore: mappa, aggiornato_il: new Date().toISOString() }, { onConflict: 'chiave' });
  if (error) throw new Error(error.message);
  return mappa;
}

/* ---------- finestra: snap ai bordi su desktop ---------- */
// Dove si aggancia la finestra lasciata col puntatore in (x, y): bordo sinistro = metà sinistra,
// destro = metà destra, alto = ingrandita, altrimenti nessuno.
export function snapDa(x, y, larghezza, margine = 8) {
  if (y <= margine) return 'ingrandita';
  if (x <= margine) return 'sinistra';
  if (x >= larghezza - margine) return 'destra';
  return null;
}
// Immagine precedente / successiva nella cartella (si ferma ai bordi).
export function vicina(elenco, id, passo) {
  const i = elenco.findIndex((d) => d.id === id);
  if (i < 0) return null;
  return elenco[i + passo] || null;
}
// Zoom del visualizzatore: da 25% a 400%, passi del 25%.
export const zoom = (z, passo) => Math.round(Math.max(0.25, Math.min(4, (Number(z) || 1) + passo * 0.25)) * 100) / 100;
