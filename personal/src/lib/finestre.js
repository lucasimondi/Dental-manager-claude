// PERSONAL-FINESTRE (PO 2026-11-24: «lavorare con più finestre come su Windows e poterle chiudere,
// ridurre ad icona, trascinare i file da una all'altra»; sul telefono «entrambe a scelta»).
// Stato puro delle finestre: ogni pagina aperta è una finestra { chiave, tipo, …, stato, x, y, w, h, z }.
// stato: 'ingrandita' (riempie lo spazio sopra la barra) | 'normale' (libera: si sposta e si
// ridimensiona) | 'ridotta' (solo l'icona nella barra). Coordinate in px CSS dell'area di lavoro.
// Sul telefono la prima volta si aprono ingrandite; la scelta (Ingrandisci/Ripristina) resta per tipo.

export const MIN_W = 280, MIN_H = 220, BARRA_TITOLO = 40;
export const telefono = (area) => area.w < 768 || area.h < 460; // telefono anche in orizzontale

const limita = (v, a, b) => Math.max(a, Math.min(b, v));
const zMax = (lista) => lista.reduce((m, f) => Math.max(m, f.z || 0), 0);

// Riquadro di una finestra libera dentro l'area: almeno la barra del titolo resta raggiungibile.
export function limitaRiquadro({ x, y, w, h }, area) {
  const W = limita(w, Math.min(MIN_W, area.w), area.w), H = limita(h, Math.min(MIN_H, area.h), area.h);
  return { x: limita(x, -(W - 80), area.w - 80), y: limita(y, 0, area.h - BARRA_TITOLO), w: W, h: H };
}

// Posizione della prossima finestra libera: a cascata (+28 px), ricomincia quando esce dall'area.
export function cascata(lista, area) {
  const w = Math.round(Math.min(area.w * (telefono(area) ? 0.92 : 0.62), 860)), h = Math.round(Math.min(area.h * (telefono(area) ? 0.7 : 0.78), 760));
  const n = lista.filter((f) => f.stato !== 'ridotta').length % 6;
  const x = Math.round((area.w - w) / 2 - 70 + n * 28), y = Math.round(Math.max(0, (area.h - h) / 2 - 50) + n * 28);
  return limitaRiquadro({ x, y, w, h }, area);
}

// Apre una finestra in primo piano. preferenza: 'ingrandita' | 'normale' | undefined (telefono → ingrandita).
export function apriFinestra(lista, pagina, area, preferenza) {
  const stato = preferenza || (telefono(area) ? 'ingrandita' : 'normale');
  return [...lista, { ...pagina, ...cascata(lista, area), stato, z: zMax(lista) + 1 }];
}

export const attiva = (lista) => lista.filter((f) => f.stato !== 'ridotta').sort((a, b) => b.z - a.z)[0] || null;

export function inPrimoPiano(lista, chiave) {
  const z = zMax(lista) + 1;
  return lista.map((f) => (f.chiave === chiave ? { ...f, z, stato: f.stato === 'ridotta' ? (f.prima || 'normale') : f.stato } : f));
}
export const riduci = (lista, chiave) => lista.map((f) => (f.chiave === chiave && f.stato !== 'ridotta' ? { ...f, prima: f.stato, stato: 'ridotta' } : f));
export const chiudi = (lista, chiave) => lista.filter((f) => f.chiave !== chiave);
export function ingrandisciRipristina(lista, chiave) {
  return lista.map((f) => (f.chiave === chiave ? { ...f, stato: f.stato === 'ingrandita' ? 'normale' : 'ingrandita' } : f));
}
// «Mostra desktop»: riduce tutte; ripetuto le rimette com'erano (come Windows).
export function mostraDesktop(lista) {
  if (lista.some((f) => f.stato !== 'ridotta')) return lista.map((f) => (f.stato === 'ridotta' ? f : { ...f, prima: f.stato, stato: 'ridotta', daDesktop: true }));
  return lista.map((f) => (f.daDesktop ? { ...f, stato: f.prima || 'normale', daDesktop: false } : f));
}
export function sposta(lista, chiave, riquadro, area) {
  return lista.map((f) => (f.chiave === chiave ? { ...f, ...limitaRiquadro({ ...f, ...riquadro }, area) } : f));
}
// Tocco sull'icona nella barra: se è già quella in primo piano si riduce, altrimenti viene avanti.
export function toccaIcona(lista, chiave) {
  const a = attiva(lista);
  return a?.chiave === chiave ? riduci(lista, chiave) : inPrimoPiano(lista, chiave);
}
// Sostituisce il contenuto della finestra (stessa posizione e stessa chiave nella barra).
export const sostituisciIn = (lista, chiave, pagina) => lista.map((f) => (f.chiave === chiave ? { ...f, ...pagina, chiave: f.chiave, nuova: pagina.chiave } : f));
// Dopo una rotazione o un ridimensionamento dello schermo le finestre libere restano dentro.
export const riadatta = (lista, area) => lista.map((f) => ({ ...f, ...limitaRiquadro(f, area) }));

const CHIAVE_PREF = 'personal-finestre-scelta-v1';
export function preferenzaTipo(tipo) { try { return JSON.parse(localStorage.getItem(CHIAVE_PREF) || '{}')[tipo]; } catch { return undefined; } }
export function ricordaTipo(tipo, stato) {
  if (stato !== 'ingrandita' && stato !== 'normale') return;
  try { const t = JSON.parse(localStorage.getItem(CHIAVE_PREF) || '{}'); t[tipo] = stato; localStorage.setItem(CHIAVE_PREF, JSON.stringify(t)); } catch { /* facoltativo */ }
}
