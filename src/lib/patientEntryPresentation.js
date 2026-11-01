import { normalizza } from './ricercaPazienti.js';

// Search only the current studio's supplied list; free text remains valid.
export function searchTreatmentPrices(pricelist = [], query = '', limit = 6) {
  const text = normalizza(query), tokens = text.split(/\s+/).filter(Boolean);
  return pricelist.filter(item => typeof item?.nome === 'string' && item.nome.trim())
    .map((item, index) => {
      const name = normalizza(item.nome), haystack = normalizza([item.nome, item.cat, item.cod].filter(Boolean).join(' '));
      return { item, index, name, matches: tokens.every(token => haystack.includes(token)) };
    })
    .filter(row => row.matches)
    .sort((a, b) => Number(b.name === text) - Number(a.name === text) || Number(b.name.startsWith(text)) - Number(a.name.startsWith(text)) || a.index - b.index)
    .slice(0, limit).map(row => row.item);
}

// The visual viewport shrinks for the keyboard on browsers where 100dvh does not.
export function patientEntryViewport(viewport, layoutHeight) {
  const height = Number(viewport?.height);
  return { top: Math.max(0, Number(viewport?.offsetTop) || 0), height: Number.isFinite(height) && height > 0 ? height : layoutHeight };
}
