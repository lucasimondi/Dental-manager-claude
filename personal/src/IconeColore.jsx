// ICONE-START (PO 2026-11-26): icona a colori di un'app (stile Esplora file). I disegni sono costanti del codice
// (lib/iconeColore.js), mai testo dell'utente: per questo si possono inserire come markup SVG.
import { DISEGNI_COLORE, idIconaColore } from './lib/iconeColore.js';

// I colori sono nel disegno: niente tratto o riempimento ereditato dai contenitori (es. icone a tratto bianco).
const STILE = { fill: '#000', stroke: 'none', flexShrink: 0 };

export const haIconaColore = (id) => Boolean(idIconaColore(id));

export function IconaColore({ id, size = 24, className = 'pp-icona-colore' }) {
  const k = idIconaColore(id);
  if (!k) return null;
  return <svg className={className} viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" focusable="false" style={STILE} dangerouslySetInnerHTML={{ __html: DISEGNI_COLORE[k] }} />;
}
