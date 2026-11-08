import { useEffect, useRef, useState } from 'react';
// Pointer/canvas technique reused from PadFirma; isolated from Studio imports.
export function Firma({ onUsa, onChiudi }) {
  const canvas = useRef(null), point = useRef(null);
  const [drawn, setDrawn] = useState(false), [remember, setRemember] = useState(true);
  const [saved, setSaved] = useState(() => { try { return localStorage.getItem('personal-pdf-firma-v1'); } catch { return null; } });
  const [error, setError] = useState('');
  useEffect(() => {
    const c = canvas.current, dpr = Math.min(devicePixelRatio || 1, 2);
    c.width = c.clientWidth * dpr; c.height = 180 * dpr;
    const ctx = c.getContext('2d'); ctx.scale(dpr, dpr); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#17263c';
  }, []);
  const pos = e => { const r = canvas.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  return <div className="pdf-sheet" role="dialog" aria-label="Disegna la firma">
    <h2>La tua firma</h2><p>Firma elettronica semplice. Disegnala con il dito, poi posizionala sulla pagina.</p>
    {saved && <button onClick={() => onUsa(saved)}><img className="pdf-saved-signature" src={saved} alt="Firma salvata" />Usa firma salvata</button>}
    <canvas ref={canvas} aria-label="Spazio firma" style={{ width: '100%', height: 180, touchAction: 'none', background: 'white', border: '1px dashed #8395a8' }}
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); point.current = pos(e); }}
      onPointerMove={e => { if (!point.current) return; const p = pos(e), c = canvas.current.getContext('2d'); c.beginPath(); c.moveTo(point.current.x, point.current.y); c.lineTo(p.x, p.y); c.stroke(); point.current = p; setDrawn(true); }}
      onPointerUp={() => { point.current = null; }} onPointerCancel={() => { point.current = null; }} />
    <label><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Ricorda su questo dispositivo</label>
    <div className="pdf-row"><button onClick={() => { const c = canvas.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); setDrawn(false); }}>Rifai</button>
      <button disabled={!drawn} onClick={() => { const png = canvas.current.toDataURL('image/png'); if (remember) { try { localStorage.setItem('personal-pdf-firma-v1', png); } catch { setError('Memoria locale non disponibile. Disattiva “Ricorda” per usare la firma solo ora.'); return; } } onUsa(png); }}>Usa questa firma</button>
      <button onClick={onChiudi}>Indietro</button></div>
    {saved && <button onClick={() => { try { localStorage.removeItem('personal-pdf-firma-v1'); setSaved(null); } catch { setError('Impossibile rimuovere la firma dal dispositivo.'); } }}>Dimentica firma salvata</button>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
