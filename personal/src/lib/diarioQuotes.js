// Traduzioni italiane redazionali di passi in pubblico dominio; riferimenti verificati.
export const DIARY_QUOTES = Object.freeze([
  { text: 'Amor fati: sia questo il mio amore d’ora in poi.', author: 'Friedrich Nietzsche', work: 'La gaia scienza, § 276', source: 'https://www.gutenberg.org/cache/epub/52124/pg52124-images.html' },
  { text: 'Mentre rimandiamo, la vita passa.', author: 'Seneca', work: 'Lettere a Lucilio, 1, 2', source: 'https://pages.pomona.edu/~cmc24747/sources/seneca/sen_ep_1.htm' },
  { text: 'Ci turbano i giudizi sulle cose, non le cose.', author: 'Epitteto', work: 'Manuale, 5', source: 'https://www.gutenberg.org/files/45109/45109-h/45109-h.htm' },
  { text: 'Desidera che gli eventi accadano come accadono.', author: 'Epitteto', work: 'Manuale, 8', source: 'https://www.gutenberg.org/files/45109/45109-h/45109-h.htm' },
  { text: 'In nessun luogo ci si ritira più tranquillamente che nella propria anima.', author: 'Marco Aurelio', work: 'Ricordi, IV, 3', source: 'https://www.gutenberg.org/cache/epub/6920/pg6920-images.html' },
  { text: 'Una vita senza esame non è degna di essere vissuta.', author: 'Socrate, in Platone', work: 'Apologia, 38a', source: 'https://www.gutenberg.org/files/1656/1656-h/1656-h.htm' },
  { text: 'La saggezza è meditazione della vita, non della morte.', author: 'Baruch Spinoza', work: 'Etica, IV, proposizione 67', source: 'https://www.gutenberg.org/cache/epub/971/pg971-images.html' },
  { text: 'La felicità è un’attività dell’anima secondo virtù.', author: 'Aristotele', work: 'Etica Nicomachea, I, 7', source: 'https://www.gutenberg.org/files/8438/8438-h/8438-h' },
]);
export function quoteForPage(page) {
  let hash = 0;
  for (const char of String(page.id || '')) hash = (Math.imul(hash, 31) + char.codePointAt(0)) >>> 0;
  return DIARY_QUOTES[hash % DIARY_QUOTES.length];
}
