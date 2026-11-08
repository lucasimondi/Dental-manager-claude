import { useEffect, useRef, useState } from 'react';
import { ritaglioFirma } from './operazioni.js';
// Pointer/canvas technique reused from PadFirma; isolated from Studio imports.
// Smoothed strokes (midpoint curves) and a PNG cropped to the drawn ink, so the
// signature placed on the page has no empty margins and keeps its proportions.
const CHIAVE = 'personal-pdf-firma-v1';
export function Firma({ onUsa, onChiudi }) {
  const canvas = useRef(null), stroke = useRef(null), bounds = useRef(null);
  const [drawn, setDrawn] = useState(false), [remember, setRemember] = useState(true);
  const [saved, setSaved] = useState(() => { try { return localStorage.getItem(CHIAVE); } catch { return null; } });
  const [error, setError] = useState('');
  useEffect(() => {
    const c = canvas.current, dpr = Math.min(devicePixelRatio || 1, 2);
    c.width = c.clientWidth * dpr; c.height = 200 * dpr;
    const ctx = c.getContext('2d'); ctx.scale(dpr, dpr); ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#14233a';
  }, []);
  const pos = e => { const r = canvas.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const allarga = p => { const b = bounds.current; bounds.current = b ? { x0: Math.min(b.x0, p.x), y0: Math.min(b.y0, p.y), x1: Math.max(b.x1, p.x), y1: Math.max(b.y1, p.y) } : { x0: p.x, y0: p.y, x1: p.x, y1: p.y }; };
  const pulisci = () => { const c = canvas.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); bounds.current = null; setDrawn(false); };
  const usa = () => {
    const c = canvas.current, dpr = c.width / c.clientWidth;
    const r = ritaglioFirma(bounds.current, { width: c.clientWidth, height: c.clientHeight }, 8);
    const out = document.createElement('canvas'); out.width = Math.round(r.width * dpr); out.height = Math.round(r.height * dpr);
    out.getContext('2d').drawImage(c, r.x * dpr, r.y * dpr, out.width, out.height, 0, 0, out.width, out.height);
    const png = out.toDataURL('image/png');
    if (remember) { try { localStorage.setItem(CHIAVE, png); } catch { setError('Memoria locale non disponibile. Disattiva “Ricorda” per usare la firma solo ora.'); return; } }
    onUsa(png);
  };
  return <div className="pdf-sheet" role="dialog" aria-label="Disegna la firma">
    <h2>La tua firma</h2><p>Firma elettronica semplice. Disegnala con il dito, poi posizionala sulla pagina.</p>
    {saved && <button className="pdf-saved" onClick={() => onUsa(saved)}><img className="pdf-saved-signature" src={saved} alt="Firma salvata" />Usa firma salvata</button>}
    <canvas ref={canvas} aria-label="Spazio firma" className="pdf-pad"
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
    <div className="pdf-row"><button onClick={pulisci}>Rifai</button>
      <button className="pdf-primary" disabled={!drawn} onClick={usa}>Usa questa firma</button>
      <button onClick={onChiudi}>Indietro</button></div>
    {saved && <button onClick={() => { try { localStorage.removeItem(CHIAVE); setSaved(null); } catch { setError('Impossibile rimuovere la firma dal dispositivo.'); } }}>Dimentica firma salvata</button>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
