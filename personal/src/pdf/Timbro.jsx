import { useEffect, useRef, useState } from 'react';
import { INCHIOSTRI_TIMBRO, FORME_TIMBRO, CARICHI, MAX_RIGHE, TIMBRO_PREDEFINITO, normalizzaTimbro, righeUsate, timbroVuoto, misureTimbro, impronta, inclinazione, dataOggi } from './timbro.js';
// PDF-TIMBRO (PO 2026-11-24): timbro configurabile (righe, forma, bordo, data, colore, quantità
// d'inchiostro) che esce come un timbro vero. La configurazione resta ricordata sul telefono.
// Ogni «Timbra» usa un seme nuovo: due timbri non vengono mai identici, come nella realtà.
const CHIAVE = 'personal-pdf-timbro-v1';
const FONT = '"Arial Narrow", "Roboto Condensed", "Helvetica Neue", Arial, sans-serif';
export function timbroRicordato() { try { return normalizzaTimbro(JSON.parse(localStorage.getItem(CHIAVE) || 'null') || TIMBRO_PREDEFINITO); } catch { return normalizzaTimbro(TIMBRO_PREDEFINITO); } }

// Disegna il timbro e restituisce un canvas trasparente. u = px per unità (altezza di una riga).
export function disegnaTimbro(config, { seme = 1, u = 60, oggi = dataOggi() } = {}) {
  const t = normalizzaTimbro(config), colore = INCHIOSTRI_TIMBRO[t.inchiostro].colore;
  const misura = document.createElement('canvas').getContext('2d');
  const font = (k, grassetto = true) => `${grassetto ? 700 : 600} ${Math.round(u * 0.78 * k)}px ${FONT}`;
  misura.font = font(1);
  const larghezzaTesto = (x) => misura.measureText(x).width / u;
  const { w, h } = misureTimbro(t, larghezzaTesto);
  const W = w * u, H = h * u, m = u * 0.9;
  const c = document.createElement('canvas'); c.width = Math.ceil(W + 2 * m); c.height = Math.ceil(H + 2 * m);
  const x = c.getContext('2d', { willReadFrequently: true });
  x.translate(m, m); x.fillStyle = colore; x.strokeStyle = colore; x.textAlign = 'center'; x.textBaseline = 'middle';
  const r = righeUsate(t), spesso = u * 0.13, fine = u * 0.055;
  const riga = (testo, cx, cy, k = 1, grassetto = true, maxW = W - u) => { x.font = font(k, grassetto); const l = x.measureText(testo).width; if (l > maxW) x.font = font(k * maxW / l, grassetto); x.fillText(testo, cx, cy); };
  if (t.forma === 'tondo') {
    const R = W / 2 - spesso / 2, cx = W / 2, cy = H / 2;
    x.lineWidth = spesso; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.stroke();
    x.lineWidth = fine; x.beginPath(); x.arc(cx, cy, R - u * 1.55, 0, Math.PI * 2); x.stroke();
    if (t.bordoDoppio) { x.beginPath(); x.arc(cx, cy, R - spesso * 1.6, 0, Math.PI * 2); x.stroke(); }
    const rt = R - u * 0.8;
    const arco = (testo, sopra) => {
      if (!testo) return;
      let k = 0.86; x.font = font(k);
      const spazio = u * 0.06, largo = () => [...testo].reduce((s, ch) => s + x.measureText(ch).width + spazio, 0);
      while (largo() / rt > Math.PI * 0.92 && k > 0.4) { k -= 0.04; x.font = font(k); }
      const T = largo() / rt; let a = sopra ? -Math.PI / 2 - T / 2 : Math.PI / 2 + T / 2;
      for (const ch of testo) {
        const d = (x.measureText(ch).width + spazio) / rt; a += sopra ? d / 2 : -d / 2;
        x.save(); x.translate(cx + rt * Math.cos(a), cy + rt * Math.sin(a)); x.rotate(sopra ? a + Math.PI / 2 : a - Math.PI / 2); x.fillText(ch, 0, 0); x.restore();
        a += sopra ? d / 2 : -d / 2;
      }
    };
    arco(r[0], true); arco(r[1], false);
    const centro = [...r.slice(2), ...(t.data ? [oggi] : [])];
    centro.forEach((testo, i) => riga(testo, cx, cy + (i - (centro.length - 1) / 2) * u * 1.15, i === 0 ? 0.95 : 0.85, true, (R - u * 1.7) * 1.8));
  } else {
    const ovale = t.forma === 'ovale';
    const bordo = (inset, lw) => {
      x.lineWidth = lw; x.beginPath();
      if (ovale) x.ellipse(W / 2, H / 2, W / 2 - inset, H / 2 - inset, 0, 0, Math.PI * 2);
      else x.roundRect(inset, inset, W - 2 * inset, H - 2 * inset, u * 0.18);
      x.stroke();
    };
    bordo(spesso / 2, spesso);
    if (t.bordoDoppio) bordo(spesso + u * 0.16, fine);
    const tutte = [...r, ...(t.data ? [oggi] : [])], passo = u * 1.3 * (ovale ? 1.12 : 1);
    tutte.forEach((testo, i) => riga(testo, W / 2, H / 2 + (i - (tutte.length - 1) / 2) * passo, i === 0 && r.length > 1 ? 1.12 : 1, i === 0 || !t.data || i < tutte.length - 1, ovale ? W * 0.74 : W - u * 0.9));
  }
  // Impronta: alfa moltiplicata per la copertura d'inchiostro (gradiente, chiazze, puntini vuoti).
  const k = impronta(seme, t.carico), dati = x.getImageData(0, 0, c.width, c.height), px = dati.data;
  for (let yy = 0; yy < c.height; yy++) for (let xx = 0; xx < c.width; xx++) {
    const i = (yy * c.width + xx) * 4 + 3; if (px[i]) px[i] = px[i] * k(xx / c.width, yy / c.height);
  }
  x.putImageData(dati, 0, 0);
  // Inclinazione e bordo appena sbavato (l'inchiostro si allarga un poco nella carta).
  const a = inclinazione(seme);
  const out = document.createElement('canvas');
  out.width = Math.ceil(Math.abs(c.width * Math.cos(a)) + Math.abs(c.height * Math.sin(a))); out.height = Math.ceil(Math.abs(c.width * Math.sin(a)) + Math.abs(c.height * Math.cos(a)));
  const o = out.getContext('2d');
  o.translate(out.width / 2, out.height / 2); o.rotate(a); o.filter = `blur(${(u * 0.012).toFixed(2)}px)`; o.globalAlpha = 0.93;
  o.drawImage(c, -c.width / 2, -c.height / 2);
  return out;
}

export function Timbro({ pagine = 1, onUsa, onChiudi }) {
  const [t, setT] = useState(timbroRicordato);
  const [tutte, setTutte] = useState(false);
  const anteprima = useRef(null);
  const cambia = (k, v) => setT((x) => normalizzaTimbro({ ...x, [k]: v }));
  useEffect(() => {
    const el = anteprima.current; if (!el || timbroVuoto(t)) return;
    const disegno = disegnaTimbro(t, { seme: 7, u: 40 });
    const ctx = el.getContext('2d'), scala = Math.min(1, el.width / disegno.width, el.height / disegno.height);
    ctx.clearRect(0, 0, el.width, el.height);
    ctx.drawImage(disegno, (el.width - disegno.width * scala) / 2, (el.height - disegno.height * scala) / 2, disegno.width * scala, disegno.height * scala);
  }, [t]);
  const timbra = () => {
    try { localStorage.setItem(CHIAVE, JSON.stringify(t)); } catch { /* facoltativo */ }
    const seme = (crypto.getRandomValues(new Uint32Array(1))[0] % 100000) + 1;
    onUsa(disegnaTimbro(t, { seme, u: 72 }).toDataURL('image/png'), { tipo: 'timbro', tutte: tutte && pagine > 1 });
  };
  return <section className="pdf-sheet pdf-timbro" role="dialog" aria-label="Timbro">
    <h2>Timbro</h2>
    <canvas ref={anteprima} className="pdf-timbro-anteprima" width="600" height="300" aria-label="Anteprima del timbro" role="img" />
    <fieldset className="pdf-scelte"><legend>Testo del timbro</legend>
      {Array.from({ length: MAX_RIGHE }, (_, i) => <input key={i} aria-label={`Riga ${i + 1} del timbro`} value={t.righe[i]} maxLength={40}
        placeholder={t.forma === 'tondo' ? ['Scritta in alto (sull’arco)', 'Scritta in basso (sull’arco)', 'Al centro', 'Al centro'][i] : `Riga ${i + 1}`}
        onChange={(e) => cambia('righe', t.righe.map((r, j) => (j === i ? e.target.value : r)))} />)}
    </fieldset>
    <fieldset className="pdf-scelte"><legend>Forma</legend>
      <div role="radiogroup" aria-label="Forma del timbro" className="pdf-scelte-righe">
        {Object.entries(FORME_TIMBRO).map(([k, v]) => <button key={k} type="button" role="radio" aria-checked={t.forma === k} className={t.forma === k ? 'attivo' : ''} onClick={() => cambia('forma', k)}>{v}</button>)}
      </div>
    </fieldset>
    <fieldset className="pdf-scelte"><legend>Inchiostro</legend>
      <div role="radiogroup" aria-label="Colore dell'inchiostro del timbro" className="pdf-colori">
        {Object.entries(INCHIOSTRI_TIMBRO).map(([k, v]) => <button key={k} type="button" role="radio" aria-checked={t.inchiostro === k} aria-label={v.nome} title={v.nome} className={t.inchiostro === k ? 'attivo' : ''} onClick={() => cambia('inchiostro', k)}><span style={{ background: v.colore }} /></button>)}
      </div>
      <div role="radiogroup" aria-label="Quantità d'inchiostro" className="pdf-scelte-righe">
        {Object.entries(CARICHI).map(([k, v]) => <button key={k} type="button" role="radio" aria-checked={t.carico === k} className={t.carico === k ? 'attivo' : ''} onClick={() => cambia('carico', k)}>{v.nome}</button>)}
      </div>
    </fieldset>
    <label className="pdf-check"><input type="checkbox" checked={t.bordoDoppio} onChange={(e) => cambia('bordoDoppio', e.target.checked)} /> Bordo doppio</label>
    <label className="pdf-check"><input type="checkbox" checked={t.data} onChange={(e) => cambia('data', e.target.checked)} /> Data di oggi nel timbro</label>
    {pagine > 1 && <label className="pdf-check"><input type="checkbox" checked={tutte} onChange={(e) => setTutte(e.target.checked)} /> Su tutte le {pagine} pagine</label>}
    <button className="pdf-primary" disabled={timbroVuoto(t)} onClick={timbra}>Timbra sulla pagina</button>
    <button onClick={onChiudi}>Annulla</button>
  </section>;
}
