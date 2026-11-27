// SFONDI (PO 2026-11-27: "Dammi la possibilità di variare gli sfondi, colori più alcuni sfondi belli tra cui quello"):
// sfondi delle Home del telefono di Studio e Personale. Tutti scuri, così le scritte bianche si leggono sempre.
// Disegni originali (onde, aurora, montagne) in CSS/SVG statico, nessuna immagine esterna. La scelta resta su questo
// dispositivo, separata per Studio e Personale (ognuno parte dal suo sfondo di sempre).
const svg = (corpo) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 390 844' preserveAspectRatio='none'>${corpo}</svg>`)}") center bottom / 100% 100% no-repeat`;
const onde = (base, a, b) => `${svg(`<path d='M-40 620C80 480 220 520 430 380V844H-40Z' fill='${a}'/><path d='M120 844C200 700 300 690 430 600V844Z' fill='${b}'/>`)}, ${base}`;

export const SFONDI = [
  { id: 'petrolio', nome: 'Petrolio', base: '#0b3b47', css: onde('#0b3b47', '#0f4f5c', '#136472') },
  { id: 'blu', nome: 'Blu', base: '#0e3560', css: onde('#0e3560', '#14497f', '#1a5a98') },
  { id: 'aurora', nome: 'Aurora', base: '#121a33', css: 'radial-gradient(120% 60% at 15% 20%, rgba(46,196,207,.45), transparent 60%), radial-gradient(90% 55% at 90% 45%, rgba(130,90,220,.45), transparent 60%), radial-gradient(100% 50% at 40% 100%, rgba(20,120,160,.5), transparent 65%), #121a33' },
  { id: 'tramonto', nome: 'Tramonto', base: '#3a2150', css: `${svg("<path d='M-40 640C90 560 250 600 430 520V844H-40Z' fill='#5a2346' opacity='.85'/><path d='M-40 760C120 690 260 720 430 660V844H-40Z' fill='#3a1733'/>")}, linear-gradient(170deg, #2d1b4e 0%, #6b2d5c 52%, #b8563f 100%)` },
  { id: 'montagne', nome: 'Montagne', base: '#1f2d44', css: `${svg("<path d='M-10 600L80 470 150 540 240 400 330 520 400 450V844H-10Z' fill='#2a3b55'/><path d='M-10 700L100 590 190 660 290 560 400 650V844H-10Z' fill='#16233a'/>")}, linear-gradient(180deg, #2b4365 0%, #1f2d44 70%)` },
  { id: 'bosco', nome: 'Bosco', base: '#12352a', css: onde('#12352a', '#1a4a39', '#24604a') },
  { id: 'vino', nome: 'Vino', base: '#3b1426', css: onde('#3b1426', '#52203a', '#6a2b4c') },
  { id: 'ardesia', nome: 'Ardesia', base: '#1f262e', css: onde('#1f262e', '#2a333d', '#36414d') },
];
export const COLORI = [
  ['c-petrolio', 'Petrolio', '#0b3b47'], ['c-blu', 'Blu', '#0e3560'], ['c-notte', 'Notte', '#141a33'], ['c-verde', 'Verde', '#14432f'],
  ['c-bordeaux', 'Bordeaux', '#4a1630'], ['c-viola', 'Viola', '#2e2250'], ['c-terra', 'Terra', '#4a2c1a'], ['c-grafite', 'Grafite', '#22272e'],
].map(([id, nome, base]) => ({ id, nome, base, css: base }));

const TUTTI = Object.fromEntries([...SFONDI, ...COLORI].map((s) => [s.id, s]));
export const PREDEFINITO = { studio: 'petrolio', personale: 'blu' };
export const chiaveSfondo = (spazio) => `poliedra-sfondo-${spazio}-v1`;
export const sfondo = (id, spazio = 'studio') => TUTTI[id] || TUTTI[PREDEFINITO[spazio]] || SFONDI[0];

export function leggiSfondo(spazio, storage = globalThis.localStorage) {
  try { const id = storage?.getItem(chiaveSfondo(spazio)); return TUTTI[id] ? id : PREDEFINITO[spazio]; } catch { return PREDEFINITO[spazio]; }
}
export function salvaSfondo(spazio, id, storage = globalThis.localStorage) {
  if (!TUTTI[id]) return leggiSfondo(spazio, storage);
  try { storage?.setItem(chiaveSfondo(spazio), id); } catch { /* facoltativo: resta per questa visita */ }
  return id;
}
