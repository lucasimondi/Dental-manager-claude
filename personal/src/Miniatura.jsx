// POL-VITA-006 — anteprima piccola di un documento (miniatura di Drive), con l'icona del
// fascicolo finché non arriva o se non c'è. Si carica solo quando entra nello schermo.
import { useEffect, useRef, useState } from 'react';
import { miniatura } from './lib/miniature.js';
import { IconaFile } from './Icone.jsx';

export function Miniatura({ doc, colore, grande = false }) {
  const [src, setSrc] = useState(null);
  const el = useRef(null);
  const id = doc?.fascicolo === 'clinico_pazienti' ? null : doc?.drive_file_id;
  useEffect(() => {
    setSrc(null);
    if (!id || !el.current) return undefined;
    let vivo = true;
    const carica = () => miniatura(id).then((v) => { if (vivo) setSrc(v); });
    if (typeof IntersectionObserver === 'undefined') { carica(); return () => { vivo = false; }; }
    const oss = new IntersectionObserver((voci) => {
      if (voci.some((v) => v.isIntersecting)) { oss.disconnect(); carica(); }
    }, { rootMargin: '200px' });
    oss.observe(el.current);
    return () => { vivo = false; oss.disconnect(); };
  }, [id]);
  return (
    <span ref={el} className={`pp-mini${grande ? ' pp-mini-grande' : ''}${src ? ' pronta' : ''}`} style={{ '--c': colore }}>
      {src ? <img src={src} alt="" loading="lazy" /> : <IconaFile size={grande ? 28 : 18} />}
    </span>
  );
}
