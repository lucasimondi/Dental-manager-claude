import { useEffect, useRef, useState } from 'react';
import { ritaglioFirma, testoOggi } from './operazioni.js';
// Pointer/canvas technique reused from PadFirma; isolated from Studio imports.
// Smoothed strokes (midpoint curves) and a PNG cropped to the drawn ink, so the
// signature placed on the page has no empty margins and keeps its proportions.
// SCAN-PDF-MANAGER (PO 2026-11-11: «Firma salvata»): firma e sigla ricordate separatamente sul
// dispositivo, un tocco per riusarle; sigla anche su tutte le pagine; data di oggi come timbro.
const CHIAVI = { firma: 'personal-pdf-firma-v1', sigla: 'personal-pdf-sigla-v1' };
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

export function Firma({ onUsa, onChiudi, pagine = 1 }) {
  const canvas = useRef(null), stroke = useRef(null), bounds = useRef(null);
  const [tipo, setTipo] = useState('firma');
  const [drawn, setDrawn] = useState(false), [remember, setRemember] = useState(true), [tutte, setTutte] = useState(false);
  const [saved, setSaved] = useState(() => ({ firma: leggi(CHIAVI.firma), sigla: leggi(CHIAVI.sigla) }));
  const [error, setError] = useState('');
  const salvata = saved[tipo];
  const pulisci = () => { const c = canvas.current; if (!c) return; c.getContext('2d').clearRect(0, 0, c.width, c.height); bounds.current = null; setDrawn(false); };
  useEffect(() => {
    const c = canvas.current, dpr = Math.min(devicePixelRatio || 1, 2);
    c.width = c.clientWidth * dpr; c.height = 200 * dpr;
    const ctx = c.getContext('2d'); ctx.scale(dpr, dpr); ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#14233a';
  }, []);
  useEffect(() => { pulisci(); setTutte(tipo === 'sigla' && pagine > 1); setError(''); }, [tipo]); // eslint-disable-line react-hooks/exhaustive-deps
  const pos = e => { const r = canvas.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const allarga = p => { const b = bounds.current; bounds.current = b ? { x0: Math.min(b.x0, p.x), y0: Math.min(b.y0, p.y), x1: Math.max(b.x1, p.x), y1: Math.max(b.y1, p.y) } : { x0: p.x, y0: p.y, x1: p.x, y1: p.y }; };
  const consegna = (png, extra = {}) => onUsa(png, { tipo, tutte: tutte && pagine > 1, ...extra });
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
      <button onClick={() => onUsa(pngTesto(testoOggi()), { tipo: 'data', tutte: false })}>Data di oggi</button>
    </div>
    <p>Firma elettronica semplice. Disegnala con il dito, poi posizionala sulla pagina.</p>
    {salvata && <button className="pdf-saved" onClick={() => consegna(salvata)}><img className="pdf-saved-signature" src={salvata} alt={`${nome} salvata`} />Usa {nome} salvata</button>}
    <canvas ref={canvas} aria-label={`Spazio ${nome}`} className="pdf-pad"
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); const p = pos(e); stroke.current = { last: p, mid: p }; allarga(p); const ctx = canvas.current.getContext('2d'); ctx.beginPath(); ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fillStyle = ctx.strokeStyle; ctx.fill(); setDrawn(true); }}
      onPointerMove={e => {
        const s = stroke.current; if (!s) return;
        const ctx = canvas.current.getContext('2d');
        for (const ev of e.nativeEvent.getCoalescedEvents?.() || [e.nativeEvent]) {
          const p = pos(ev), mid = { x: (s.last.x + p.x) / 2, y: (s.last.y + p.y) / 2 };
          ctx.beginPath(); ctx.moveTo(s.mid.x, s.mid.y); ctx.quadraticCurveTo(s.last.x, s.last.y, mid.x, mid.y); ctx.stroke();
          s.last = p; s.mid = mid; allarga(p);
        }
      }}
      onPointerUp={() => { stroke.current = null; }} onPointerCancel={() => { stroke.current = null; }} />
    <label className="pdf-check"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Ricorda su questo dispositivo</label>
    {pagine > 1 && <label className="pdf-check"><input type="checkbox" checked={tutte} onChange={e => setTutte(e.target.checked)} /> Metti su tutte le {pagine} pagine</label>}
    <div className="pdf-row"><button onClick={pulisci}>Rifai</button>
      <button className="pdf-primary" disabled={!drawn} onClick={usa}>Usa questa {nome}</button>
      <button onClick={onChiudi}>Indietro</button></div>
    {salvata && <button onClick={dimentica}>Dimentica {nome} salvata</button>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
