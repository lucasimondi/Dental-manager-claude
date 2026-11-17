import { useEffect, useRef, useState } from 'react';
import { ritaglioFirma, testoOggi } from './operazioni.js';
import { INCHIOSTRI, INCHIOSTRO_PREDEFINITO, pressioneUtile, larghezzaTratto, opacitaTratto, smorza, tocchi, granelli, ricolora } from './biro.js';
// FIRMA-BIRO (PO 2026-11-17): tratto da penna a sfera (larghezza e intensità secondo velocità e
// pressione, grana dell'inchiostro, goccia all'appoggio), inchiostro Bic nero o blu ricordato sul telefono.
// Pointer/canvas technique reused from PadFirma; isolated from Studio imports.
// Smoothed strokes (midpoint curves) and a PNG cropped to the drawn ink, so the
// signature placed on the page has no empty margins and keeps its proportions.
// SCAN-PDF-MANAGER (PO 2026-11-11: «Firma salvata»): firma e sigla ricordate separatamente sul
// dispositivo, un tocco per riusarle; sigla anche su tutte le pagine; data di oggi come timbro.
const CHIAVI = { firma: 'personal-pdf-firma-v1', sigla: 'personal-pdf-sigla-v1' };
const CHIAVE_INCHIOSTRO = 'personal-pdf-inchiostro-v1';
const leggi = (k) => { try { return localStorage.getItem(k); } catch { return null; } };

export function pngTesto(testo, { px = 64, colore = '#14233a' } = {}) {
  const c = document.createElement('canvas'), ctx = c.getContext('2d');
  const font = `600 ${px}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.font = font;
  c.width = Math.ceil(ctx.measureText(testo).width + px * .4); c.height = Math.ceil(px * 1.35);
  ctx.font = font; ctx.fillStyle = colore; ctx.textBaseline = 'middle';
  ctx.fillText(testo, px * .2, c.height / 2);
  return c.toDataURL('image/png');
}

// Un tocco d'inchiostro: cerchio pieno con l'opacità del momento.
function tocca(ctx, colore, t) {
  if (t.a <= 0) return;
  ctx.globalAlpha = t.a; ctx.fillStyle = colore;
  ctx.beginPath(); ctx.arc(t.x, t.y, Math.max(0.35, t.r), 0, Math.PI * 2); ctx.fill();
}

export function Firma({ onUsa, onChiudi, pagine = 1 }) {
  const canvas = useRef(null), stroke = useRef(null), bounds = useRef(null);
  const [inchiostro, setInchiostroStato] = useState(() => (INCHIOSTRI[leggi(CHIAVE_INCHIOSTRO)] ? leggi(CHIAVE_INCHIOSTRO) : INCHIOSTRO_PREDEFINITO));
  const colore = INCHIOSTRI[inchiostro].colore;
  const setInchiostro = (k) => { setInchiostroStato(k); try { localStorage.setItem(CHIAVE_INCHIOSTRO, k); } catch { /* facoltativo */ } };
  const [tipo, setTipo] = useState('firma');
  const [drawn, setDrawn] = useState(false), [remember, setRemember] = useState(true), [tutte, setTutte] = useState(false);
  const [saved, setSaved] = useState(() => ({ firma: leggi(CHIAVI.firma), sigla: leggi(CHIAVI.sigla) }));
  const [error, setError] = useState('');
  const salvata = saved[tipo];
  const pulisci = () => { const c = canvas.current; if (!c) return; c.getContext('2d').clearRect(0, 0, c.width, c.height); bounds.current = null; setDrawn(false); };
  useEffect(() => {
    // Almeno 2× (3× sui telefoni che lo hanno): la firma resta nitida quando si ingrandisce il PDF.
    const c = canvas.current, dpr = Math.max(2, Math.min(devicePixelRatio || 1, 3));
    c.width = c.clientWidth * dpr; c.height = 200 * dpr;
    c.getContext('2d').scale(dpr, dpr);
  }, []);
  // Cambiare inchiostro a metà firma ricolora quello che c'è già (la grana resta).
  useEffect(() => {
    const c = canvas.current; if (!c || !bounds.current) return;
    const ctx = c.getContext('2d');
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = colore; ctx.fillRect(0, 0, c.width, c.height); ctx.restore();
  }, [colore]);
  useEffect(() => { pulisci(); setTutte(tipo === 'sigla' && pagine > 1); setError(''); }, [tipo]); // eslint-disable-line react-hooks/exhaustive-deps
  // Fine tratto: la grana della sfera (puntini che tolgono un filo d'inchiostro, solo sul tratto appena fatto).
  const finisci = () => {
    const s = stroke.current; stroke.current = null; if (!s) return;
    const ctx = canvas.current.getContext('2d'), m = 3;
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#000';
    for (const g of granelli({ x0: s.box.x0 - m, y0: s.box.y0 - m, x1: s.box.x1 + m, y1: s.box.y1 + m })) { ctx.globalAlpha = g.a; ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  };
  const pos = e => { const r = canvas.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const allarga = p => { const b = bounds.current; bounds.current = b ? { x0: Math.min(b.x0, p.x), y0: Math.min(b.y0, p.y), x1: Math.max(b.x1, p.x), y1: Math.max(b.y1, p.y) } : { x0: p.x, y0: p.y, x1: p.x, y1: p.y }; };
  const consegna = async (png, extra = {}) => onUsa(await ricolora(png, colore).catch(() => png), { tipo, tutte: tutte && pagine > 1, inchiostro, ...extra });
  const usa = () => {
    const c = canvas.current, dpr = c.width / c.clientWidth;
    const r = ritaglioFirma(bounds.current, { width: c.clientWidth, height: c.clientHeight }, 8);
    const out = document.createElement('canvas'); out.width = Math.round(r.width * dpr); out.height = Math.round(r.height * dpr);
    out.getContext('2d').drawImage(c, r.x * dpr, r.y * dpr, out.width, out.height, 0, 0, out.width, out.height);
    const png = out.toDataURL('image/png');
    if (remember) { try { localStorage.setItem(CHIAVI[tipo], png); setSaved(s => ({ ...s, [tipo]: png })); } catch { setError('Memoria locale non disponibile. Disattiva “Ricorda” per usarla solo ora.'); return; } }
    consegna(png);
  };
  const dimentica = () => { try { localStorage.removeItem(CHIAVI[tipo]); setSaved(s => ({ ...s, [tipo]: null })); } catch { setError('Impossibile rimuovere dal dispositivo.'); } };
  const nome = tipo === 'firma' ? 'firma' : 'sigla';
  return <div className="pdf-sheet" role="dialog" aria-label="Firma, sigla o data">
    <h2>{tipo === 'firma' ? 'La tua firma' : 'La tua sigla'}</h2>
    <div className="pdf-tabs" role="tablist" aria-label="Cosa inserire">
      <button role="tab" aria-selected={tipo === 'firma'} onClick={() => setTipo('firma')}>Firma</button>
      <button role="tab" aria-selected={tipo === 'sigla'} onClick={() => setTipo('sigla')}>Sigla</button>
      <button onClick={() => onUsa(pngTesto(testoOggi(), { colore }), { tipo: 'data', tutte: false })}>Data di oggi</button>
    </div>
    <div className="pdf-inchiostri" role="radiogroup" aria-label="Colore della biro">
      {Object.entries(INCHIOSTRI).map(([k, v]) => <button key={k} type="button" role="radio" aria-checked={inchiostro === k} className={`pdf-inchiostro${inchiostro === k ? ' attivo' : ''}`} onClick={() => setInchiostro(k)}><span className="pdf-inchiostro-punto" style={{ background: v.colore }} />{v.nome}</button>)}
    </div>
    <p>Firma elettronica semplice. Disegnala con il dito (o con la penna, che sente la pressione), poi posizionala sulla pagina.</p>
    {salvata && <button className="pdf-saved" onClick={() => consegna(salvata)}><img className="pdf-saved-signature" src={salvata} alt={`${nome} salvata`} />Usa {nome} salvata</button>}
    <canvas ref={canvas} aria-label={`Spazio ${nome}`} className="pdf-pad"
      onPointerDown={e => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const p = pos(e), pr = pressioneUtile(e.nativeEvent), w = larghezzaTratto(0, pr), a = opacitaTratto(0, pr);
        stroke.current = { last: p, mid: p, t: e.timeStamp, v: 0, w, a, wMid: w, aMid: a, box: { x0: p.x, y0: p.y, x1: p.x, y1: p.y } }; allarga(p);
        // Appoggio: una minima goccia d'inchiostro, come la sfera che tocca il foglio.
        tocca(canvas.current.getContext('2d'), colore, { x: p.x, y: p.y, r: w * 0.62, a: Math.min(0.97, a + 0.05) }); setDrawn(true);
      }}
      onPointerMove={e => {
        const s = stroke.current; if (!s) return;
        const ctx = canvas.current.getContext('2d');
        for (const ev of e.nativeEvent.getCoalescedEvents?.() || [e.nativeEvent]) {
          const p = pos(ev), dt = Math.max(1, (ev.timeStamp || e.timeStamp) - s.t);
          const pr = pressioneUtile(ev);
          s.v = smorza(s.v, Math.hypot(p.x - s.last.x, p.y - s.last.y) / dt);
          const w = smorza(s.w, larghezzaTratto(s.v, pr), 0.4), a = smorza(s.a, opacitaTratto(s.v, pr), 0.4);
          const mid = { x: (s.last.x + p.x) / 2, y: (s.last.y + p.y) / 2 };
          // Curva morbida (punto medio → punto medio, controllo nell'ultimo punto), campionata in tocchi.
          const lunghezza = Math.hypot(s.last.x - s.mid.x, s.last.y - s.mid.y) + Math.hypot(mid.x - s.last.x, mid.y - s.last.y);
          const passi = Math.max(1, Math.ceil(lunghezza / 1.5));
          let prima = { x: s.mid.x, y: s.mid.y, w: s.wMid, a: s.aMid };
          for (let i = 1; i <= passi; i++) {
            const t = i / passi, u = 1 - t;
            const q = { x: u * u * s.mid.x + 2 * u * t * s.last.x + t * t * mid.x, y: u * u * s.mid.y + 2 * u * t * s.last.y + t * t * mid.y,
              w: s.wMid + (w - s.wMid) * t, a: s.aMid + (a - s.aMid) * t };
            tocchi({ x0: prima.x, y0: prima.y, w0: prima.w, a0: prima.a, x1: q.x, y1: q.y, w1: q.w, a1: q.a }).forEach(k => tocca(ctx, colore, k));
            prima = q;
          }
          ctx.globalAlpha = 1;
          Object.assign(s, { last: p, mid, t: ev.timeStamp || e.timeStamp, w, a, wMid: w, aMid: a }); allarga(p);
          s.box = { x0: Math.min(s.box.x0, p.x), y0: Math.min(s.box.y0, p.y), x1: Math.max(s.box.x1, p.x), y1: Math.max(s.box.y1, p.y) };
        }
      }}
      onPointerUp={() => { finisci(); }} onPointerCancel={() => { finisci(); }} />
    <label className="pdf-check"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Ricorda su questo dispositivo</label>
    {pagine > 1 && <label className="pdf-check"><input type="checkbox" checked={tutte} onChange={e => setTutte(e.target.checked)} /> Metti su tutte le {pagine} pagine</label>}
    <div className="pdf-row"><button onClick={pulisci}>Rifai</button>
      <button className="pdf-primary" disabled={!drawn} onClick={usa}>Usa questa {nome}</button>
      <button onClick={onChiudi}>Indietro</button></div>
    {salvata && <button onClick={dimentica}>Dimentica {nome} salvata</button>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
