// SCAN-IMPOSTAZIONI (PO 2026-11-12, passo 4) — preferenze di Scan, solo su questo dispositivo
// (localStorage, come le scelte dello scanner che già esistevano: stesse chiavi, stessi valori).
export const LINGUE = [
  ['it', 'Italiano'], ['en', 'Inglese'], ['fr', 'Francese'], ['de', 'Tedesco'], ['es', 'Spagnolo'], ['pt', 'Portoghese'],
  ['ro', 'Rumeno'], ['sq', 'Albanese'], ['pl', 'Polacco'], ['uk', 'Ucraino'], ['ru', 'Russo'], ['ar', 'Arabo'], ['zh', 'Cinese'],
];
export const PREDEFINITE = {
  'scan-raddrizza-auto': true, // raddrizza le foto (nel browser; nell'app lo fa lo scanner Google)
  'scan-peso-leggero': false, // PDF leggero
  'scan-ocr': false, // testo ricercabile nei PDF creati
  'scan-cartella': 'Generale', // cartella dei file salvati in automatico
  'scan-prefisso': 'Scansione', // «Scansione 12-11-2026 13.42»
  'scan-lingua': 'en', // lingua di arrivo di Traduci
};
const BOOL = new Set(['scan-raddrizza-auto', 'scan-peso-leggero', 'scan-ocr']);
export function leggiImpostazione(chiave, memoria = globalThis.localStorage) {
  try {
    const v = memoria?.getItem(chiave);
    if (v === null || v === undefined) return PREDEFINITE[chiave];
    return BOOL.has(chiave) ? v === '1' : v;
  } catch { return PREDEFINITE[chiave]; }
}
export function salvaImpostazione(chiave, valore, memoria = globalThis.localStorage) {
  if (!(chiave in PREDEFINITE)) throw new Error(`Impostazione sconosciuta: ${chiave}`);
  try { memoria?.setItem(chiave, BOOL.has(chiave) ? (valore ? '1' : '0') : String(valore)); } catch { /* memoria non disponibile */ }
}
export const nomeLingua = (codice) => LINGUE.find(([c]) => c === codice)?.[1] || codice;
