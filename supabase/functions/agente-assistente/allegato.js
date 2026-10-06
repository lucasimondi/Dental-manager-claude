// POL-AI-008: un documento (PDF) o una foto allegati a un messaggio della
// Chat Poliedron. Logica pura (niente rete, niente database), testata da
// tests/poliedronAllegati.test.mjs.
//
// Il file arriva in base64 insieme alla richiesta, viene letto dal modello
// solo nel turno corrente e non viene salvato da nessuna parte: la
// cronologia della chat contiene solo il testo e, nei metadata del
// messaggio, nome/tipo/dimensione.

export const TIPI_ALLEGATO = Object.freeze({
  'application/pdf': 'document',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
});

// Limiti in byte del file decodificato. Le immagini sono già ridotte
// dall'app (lato lungo 2048 px, JPEG); 5 MB è il massimo che il modello
// accetta per un'immagine. I PDF restano entro 6 MB: la richiesta viaggia in
// JSON (base64, +33%) e la funzione la rielabora a ogni giro di strumenti.
export const MAX_BYTE_IMMAGINE = 5 * 1024 * 1024;
export const MAX_BYTE_PDF = 6 * 1024 * 1024;
const MAX_NOME = 200;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

const byteDaBase64 = (dati) => Math.floor((dati.length * 3) / 4) - (dati.endsWith('==') ? 2 : dati.endsWith('=') ? 1 : 0);

/** Restituisce l'allegato normalizzato o lancia un Error con un messaggio per l'utente. */
export function validaAllegato(allegato) {
  if (!allegato || typeof allegato !== 'object' || Array.isArray(allegato)) throw new Error('Allegato non valido.');
  const { media_type: tipo, data: dati, nome } = allegato;
  const genere = Object.prototype.hasOwnProperty.call(TIPI_ALLEGATO, tipo) ? TIPI_ALLEGATO[tipo] : null;
  if (!genere) throw new Error('Formato non supportato: allega un PDF o una foto (JPEG, PNG, WebP).');
  if (typeof dati !== 'string' || !dati || dati.length % 4 !== 0 || !BASE64.test(dati)) throw new Error('Allegato non valido.');
  const byte = byteDaBase64(dati);
  const massimo = genere === 'document' ? MAX_BYTE_PDF : MAX_BYTE_IMMAGINE;
  if (byte > massimo) throw new Error(`Il file è troppo grande (massimo ${Math.round(massimo / 1024 / 1024)} MB).`);
  const nomePulito = typeof nome === 'string' ? nome.replace(/[\u0000-\u001f]/g, '').trim().slice(0, MAX_NOME) : '';
  return { genere, tipo, dati, nome: nomePulito || (genere === 'document' ? 'documento.pdf' : 'immagine') };
}

/**
 * Sostituisce il testo dell'ultimo messaggio dell'utente con
 * [allegato, testo]. Il blocco dell'allegato è in cache: nel ciclo degli
 * strumenti viene rinviato a ogni passaggio senza essere rielaborato.
 */
export function messaggiConAllegato(messaggi, allegato) {
  const ultimo = messaggi[messaggi.length - 1];
  if (!ultimo || ultimo.role !== 'user' || typeof ultimo.content !== 'string') throw new Error('Allegato senza messaggio.');
  const blocco = {
    type: allegato.genere,
    source: { type: 'base64', media_type: allegato.tipo, data: allegato.dati },
    cache_control: { type: 'ephemeral' },
  };
  const testo = `${ultimo.content}\n\n(File allegato: "${allegato.nome}". Non viene salvato: se servono dati dal file, riportali nella risposta.)`;
  return [...messaggi.slice(0, -1), { role: 'user', content: [blocco, { type: 'text', text: testo }] }];
}

/** La conversazione restituita all'app non riporta indietro il contenuto del file. */
export function senzaDatiAllegato(messaggi) {
  return messaggi.map((m) => (Array.isArray(m.content)
    ? { ...m, content: m.content.map((b) => (b?.source?.type === 'base64' ? { type: 'text', text: '[file allegato]' } : b)) }
    : m));
}
