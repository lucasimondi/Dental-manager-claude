// STUDIO-TELEFONO: icona a colori di una voce dello Studio. I disegni sono costanti del codice (lib/iconeStudio.js),
// mai testo dell'utente: per questo si possono inserire come markup SVG.
import React from 'react';
import { DISEGNI_STUDIO, idIconaStudio } from '../lib/iconeStudio.js';

const STILE = { fill: '#000', stroke: 'none', flexShrink: 0 };

export const haIconaStudio = (id) => Boolean(idIconaStudio(id));

export default function IconaColoreStudio({ id, size = 24, className = 'st-icona-colore' }) {
  const k = idIconaStudio(id);
  if (!k) return null;
  return <svg className={className} viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" focusable="false" style={STILE} dangerouslySetInnerHTML={{ __html: DISEGNI_STUDIO[k] }} />;
}
