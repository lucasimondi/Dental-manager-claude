import { useState } from 'react';
import { CARATTERI, COLORI_TESTO, GRANDEZZE, STILE_PREDEFINITO, normalizzaStile, fontCss } from './testoPdf.js';
// PDF-TESTO (PO 2026-11-24): scrivere un testo e scegliere carattere, colore, grandezza, grassetto e
// corsivo, con anteprima. Lo stile usato resta ricordato sul telefono per il testo successivo.
const CHIAVE = 'personal-pdf-testo-stile-v1';
export function stileRicordato() { try { return normalizzaStile(JSON.parse(localStorage.getItem(CHIAVE) || 'null') || STILE_PREDEFINITO); } catch { return { ...STILE_PREDEFINITO }; } }
const NOMI_COLORI = { nero: 'Nero', blu: 'Blu', rosso: 'Rosso', verde: 'Verde', grigio: 'Grigio' };

export function EditorTesto({ iniziale, onApplica, onElimina, onChiudi }) {
  const [testo, setTesto] = useState(iniziale?.testo || '');
  const [stile, setStileStato] = useState(() => normalizzaStile(iniziale?.stile || stileRicordato()));
  const setStile = (cambio) => setStileStato((s) => normalizzaStile({ ...s, ...cambio }));
  const applica = (e) => {
    e.preventDefault(); if (!testo.trim()) return;
    try { localStorage.setItem(CHIAVE, JSON.stringify(stile)); } catch { /* facoltativo */ }
    onApplica({ testo: testo.replace(/\s+$/, ''), stile });
  };
  return <form className="pdf-sheet pdf-editor-testo" role="dialog" aria-label={iniziale?.id ? 'Modifica testo' : 'Aggiungi testo'} onSubmit={applica}>
    <h2>{iniziale?.id ? 'Modifica testo' : 'Aggiungi testo'}</h2>
    <textarea aria-label="Testo da inserire" value={testo} rows={3} autoFocus placeholder="Scrivi qui…" onChange={(e) => setTesto(e.target.value)} />
    <fieldset className="pdf-scelte"><legend>Carattere</legend>
      <div role="radiogroup" aria-label="Carattere" className="pdf-scelte-righe">
        {Object.entries(CARATTERI).map(([k, v]) => <button key={k} type="button" role="radio" aria-checked={stile.carattere === k} className={stile.carattere === k ? 'attivo' : ''} style={{ fontFamily: v.css }} onClick={() => setStile({ carattere: k })}>{v.nome}</button>)}
      </div>
    </fieldset>
    <fieldset className="pdf-scelte"><legend>Colore</legend>
      <div role="radiogroup" aria-label="Colore del testo" className="pdf-colori">
        {Object.entries(COLORI_TESTO).map(([k, v]) => <button key={k} type="button" role="radio" aria-checked={stile.colore === k} aria-label={NOMI_COLORI[k]} title={NOMI_COLORI[k]} className={stile.colore === k ? 'attivo' : ''} onClick={() => setStile({ colore: k })}><span style={{ background: v }} /></button>)}
      </div>
    </fieldset>
    <fieldset className="pdf-scelte"><legend>Grandezza e stile</legend>
      <div className="pdf-grandezza">
        <button type="button" aria-label="Più piccolo" onClick={() => setStile({ grandezza: stile.grandezza - 1 })}>A−</button>
        <input type="range" aria-label="Grandezza del testo" min={GRANDEZZE.min} max={GRANDEZZE.max} step="1" value={stile.grandezza} onChange={(e) => setStile({ grandezza: Number(e.target.value) })} />
        <button type="button" aria-label="Più grande" onClick={() => setStile({ grandezza: stile.grandezza + 1 })}>A+</button>
        <output aria-label="Grandezza in punti">{stile.grandezza} pt</output>
      </div>
      <div className="pdf-scelte-righe">
        <button type="button" aria-pressed={stile.grassetto} onClick={() => setStile({ grassetto: !stile.grassetto })} style={{ fontWeight: 700 }}>Grassetto</button>
        <button type="button" aria-pressed={stile.corsivo} onClick={() => setStile({ corsivo: !stile.corsivo })} style={{ fontStyle: 'italic' }}>Corsivo</button>
      </div>
    </fieldset>
    <div className="pdf-anteprima-testo" aria-label="Anteprima" style={{ font: fontCss(stile, Math.min(30, stile.grandezza * 1.33)), color: COLORI_TESTO[stile.colore] }}>{testo || 'Anteprima del testo'}</div>
    <button className="pdf-primary" type="submit" disabled={!testo.trim()}>{iniziale?.id ? 'Applica' : 'Inserisci nella pagina'}</button>
    {iniziale?.id && <button type="button" onClick={onElimina}>Elimina testo</button>}
    <button type="button" onClick={onChiudi}>Annulla</button>
  </form>;
}
