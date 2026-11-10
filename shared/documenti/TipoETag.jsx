import React, { useState } from 'react';
import { TIPI_DOCUMENTO, normalizzaTag, normalizzaTipo, TAG_MAX } from './documentiStudio.js';
import './tipoETag.css';

// DOCUMENTI-TAG (PO 2026-11-10): tipo (anche nuovi, «etichette tipo») e tag liberi per trovare
// i documenti più facilmente. Uguale in Studio e in Personal. Tipi nuovi e tag usati di recente
// restano su questo telefono come suggerimenti.
const CHIAVE_TIPI = 'documenti_studio_tipi', CHIAVE_TAG = 'documenti_studio_tag';
const leggi = (k) => { try { const v = JSON.parse(globalThis.localStorage?.getItem(k) || '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch { return []; } };
const scrivi = (k, v) => { try { globalThis.localStorage?.setItem(k, JSON.stringify(v.slice(0, 30))); } catch { /* facoltativo */ } };
// Da chiamare dopo un salvataggio riuscito: i suggerimenti seguono l'uso.
export function ricordaTipoETag(tipo, tag) {
  if (tipo && !TIPI_DOCUMENTO.some((t) => t.id === tipo)) scrivi(CHIAVE_TIPI, [tipo, ...leggi(CHIAVE_TIPI).filter((t) => t !== tipo)]);
  if (tag?.length) scrivi(CHIAVE_TAG, [...tag, ...leggi(CHIAVE_TAG).filter((t) => !tag.includes(t))]);
}

export default function TipoETag({ tipo, onTipo, tag, onTag }) {
  const [nuovo, setNuovo] = useState(null);
  const [scritto, setScritto] = useState('');
  const tipi = [...TIPI_DOCUMENTO.map((t) => [t.id, t.nome]), ...leggi(CHIAVE_TIPI).map((t) => [t, t])];
  if (tipo && !tipi.some(([id]) => id === tipo)) tipi.push([tipo, tipo]);
  const suggeriti = leggi(CHIAVE_TAG).filter((t) => !tag.includes(t)).slice(0, 8);
  const aggiungiTag = (testo) => { const v = normalizzaTag([...tag, ...normalizzaTag(testo)]); onTag(v); setScritto(''); };
  const confermaTipo = () => { const t = normalizzaTipo(nuovo); if (nuovo?.trim()) onTipo(t); setNuovo(null); };
  return <div className="doc-etichette">
    {onTipo && <div className="doc-etichette-campo"><span>Tipo</span>
      <div className="doc-etichette-chips" role="radiogroup" aria-label="Tipo di documento">
        {tipi.map(([id, nome]) => <button key={id} type="button" role="radio" aria-checked={tipo === id} className={tipo === id ? 'attivo' : ''} onClick={() => onTipo(id)}>{nome}</button>)}
        {nuovo == null
          ? <button type="button" className="doc-etichette-nuovo" onClick={() => setNuovo('')}>+ Nuovo tipo</button>
          : <span className="doc-etichette-scrivi"><input autoFocus aria-label="Nuovo tipo" maxLength={40} value={nuovo} placeholder="Es. Radiografia" onChange={(e) => setNuovo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confermaTipo(); } if (e.key === 'Escape') setNuovo(null); }} /><button type="button" onClick={confermaTipo}>Aggiungi</button></span>}
      </div>
    </div>}
    <div className="doc-etichette-campo"><span>Tag (per trovarlo dopo)</span>
      <div className="doc-etichette-tag">
        {tag.map((t) => <span key={t} className="doc-etichette-tag-chip">#{t}<button type="button" aria-label={`Togli il tag ${t}`} onClick={() => onTag(tag.filter((x) => x !== t))}>×</button></span>)}
        {tag.length < TAG_MAX && <input aria-label="Aggiungi tag" value={scritto} placeholder={tag.length ? 'Altro tag…' : 'Es. impianto, rx, 2026'}
          onChange={(e) => { const v = e.target.value; if (/[,;\n]/.test(v)) aggiungiTag(v); else setScritto(v); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (scritto.trim()) aggiungiTag(scritto); } if (e.key === 'Backspace' && !scritto && tag.length) onTag(tag.slice(0, -1)); }}
          onBlur={() => { if (scritto.trim()) aggiungiTag(scritto); }} />}
      </div>
      {suggeriti.length > 0 && <div className="doc-etichette-suggeriti" aria-label="Tag usati di recente">{suggeriti.map((t) => <button key={t} type="button" onClick={() => aggiungiTag(t)}>+ {t}</button>)}</div>}
    </div>
  </div>;
}
