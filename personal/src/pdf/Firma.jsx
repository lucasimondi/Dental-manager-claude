import { useEffect, useRef, useState } from 'react';
import { ritaglioFirma, testoOggi } from './operazioni.js';
import { INCHIOSTRI, INCHIOSTRO_PREDEFINITO, OPACITA_LIVELLO, GRANA, casuale, nuovoTratto, aggiungiPunto, chiudiTratto, larghezze, contorno, salti, trama, riquadro, ricolora } from './biro.js';
// FIRMA-BIRO (PO 2026-11-17) + FIRMA-BIRO-2 (piano PO 2026-11-24): inchiostro Bic nero o blu ricordato
// sul telefono; ogni tratto è conservato come campioni {x, y, w, v} e ridisegnato dal vettore come
// poligono pieno a larghezza variabile (attacco, coda, pressione dalla velocità col dito o reale con la
// penna) su un livello opaco, poi salti d'inchiostro e grana della carta, composto a 0,95 sul pad.
// Pointer/canvas technique reused from PadFirma; isolated from Studio imports.
// PNG cropped to the drawn ink, so the signature placed on the page has no empty margins.
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

// Un tratto come poligono pieno: bordi levigati con quadratiche, cerchi all'attacco e alla coda.
function disegnaTratto(ctx, s) {
  const P = s.punti, n = P.length; if (!n) return;
  const ws = larghezze(s);
  if (n === 1) { ctx.beginPath(); ctx.arc(P[0].x, P[0].y, ws[0] * 0.6, 0, Math.PI * 2); ctx.fill(); return; }
  const { L, R } = contorno(P, ws);
  const lato = (q) => {
    for (let i = 1; i < q.length - 1; i++) ctx.quadraticCurveTo(q[i].x, q[i].y, (q[i].x + q[i + 1].x) / 2, (q[i].y + q[i + 1].y) / 2);
    ctx.lineTo(q[q.length - 1].x, q[q.length - 1].y);
  };
  ctx.beginPath(); ctx.moveTo(L[0].x, L[0].y); lato(L); ctx.lineTo(R[n - 1].x, R[n - 1].y); lato(R.slice().reverse()); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(P[n - 1].x, P[n - 1].y, ws[n - 1] / 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(P[0].x, P[0].y, ws[0] * 0.62, 0, Math.PI * 2); ctx.fill();
}

// Trama della carta (seme fisso): stessa grana a ogni ridisegno, nessuno "sfarfallio".
let tramaCache = null;
function motivoGrana(ctx) {
  if (!tramaCache) {
    const g = document.createElement('canvas'); g.width = g.height = GRANA.lato;
    const gx = g.getContext('2d'), img = gx.createImageData(GRANA.lato, GRANA.lato), alfa = trama(casuale(17));
    for (let i = 0; i < alfa.length; i++) img.data[i * 4 + 3] = alfa[i];
    gx.putImageData(img, 0, 0); tramaCache = g;
  }
  return ctx.createPattern(tramaCache, 'repeat');
}

export function Firma({ onUsa, onChiudi, pagine = 1 }) {
  const canvas = useRef(null), livello = useRef(null), tratti = useRef([]), attuale = useRef(null);
  const [inchiostro, setInchiostroStato] = useState(() => (INCHIOSTRI[leggi(CHIAVE_INCHIOSTRO)] ? leggi(CHIAVE_INCHIOSTRO) : INCHIOSTRO_PREDEFINITO));
  const colore = INCHIOSTRI[inchiostro].colore;
  const setInchiostro = (k) => { setInchiostroStato(k); try { localStorage.setItem(CHIAVE_INCHIOSTRO, k); } catch { /* facoltativo */ } };
  const [tipo, setTipo] = useState('firma');
  const [drawn, setDrawn] = useState(false), [remember, setRemember] = useState(true), [tutte, setTutte] = useState(false);
  const [saved, setSaved] = useState(() => ({ firma: leggi(CHIAVI.firma), sigla: leggi(CHIAVI.sigla) }));
  const [error, setError] = useState('');
  const salvata = saved[tipo];
  // Ridisegno completo dal vettore: tratti pieni sul livello, poi salti e grana tolti, composto a 0,95.
  const ridisegna = () => {
    const c = canvas.current, lv = livello.current; if (!c || !lv) return;
    const dpr = c.width / (c.clientWidth || 1), lx = lv.getContext('2d');
    lx.setTransform(1, 0, 0, 1, 0, 0); lx.globalCompositeOperation = 'source-over'; lx.globalAlpha = 1;
    lx.clearRect(0, 0, lv.width, lv.height);
    lx.setTransform(dpr, 0, 0, dpr, 0, 0); lx.fillStyle = colore;
    for (const s of tratti.current) disegnaTratto(lx, s);
    lx.globalCompositeOperation = 'destination-out'; lx.strokeStyle = '#000'; lx.lineCap = 'round';
    for (const s of tratti.current) for (const k of salti(s.punti)) { lx.globalAlpha = k.a; lx.lineWidth = k.larghezza; lx.beginPath(); lx.moveTo(k.x0, k.y0); lx.lineTo(k.x1, k.y1); lx.stroke(); }
    lx.setTransform(1, 0, 0, 1, 0, 0); lx.globalAlpha = GRANA.opacita; lx.fillStyle = motivoGrana(lx); lx.fillRect(0, 0, lv.width, lv.height);
    lx.globalAlpha = 1; lx.globalCompositeOperation = 'source-over';
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height);
    ctx.globalAlpha = OPACITA_LIVELLO; ctx.drawImage(lv, 0, 0); ctx.globalAlpha = 1;
  };
  const pulisci = () => { tratti.current = []; attuale.current = null; ridisegna(); setDrawn(false); };
  const annullaTratto = () => { tratti.current.pop(); attuale.current = null; ridisegna(); setDrawn(tratti.current.length > 0); };
  useEffect(() => {
    // Almeno 2× (3× sui telefoni che lo hanno): la firma resta nitida quando si ingrandisce il PDF.
    const c = canvas.current, dpr = Math.max(2, Math.min(devicePixelRatio || 1, 3));
    c.width = Math.round(c.clientWidth * dpr); c.height = 200 * dpr;
    const lv = document.createElement('canvas'); lv.width = c.width; lv.height = c.height; livello.current = lv;
  }, []);
  // Cambiare inchiostro a metà firma ridisegna tutto nel nuovo colore (stessa grana, stesso tratto).
  useEffect(() => { ridisegna(); }, [colore]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { pulisci(); setTutte(tipo === 'sigla' && pagine > 1); setError(''); }, [tipo]); // eslint-disable-line react-hooks/exhaustive-deps
  const campione = (ev) => {
    const r = canvas.current.getBoundingClientRect(), p = Number(ev.pressure);
    return { x: ev.clientX - r.left, y: ev.clientY - r.top, t: ev.timeStamp || performance.now(), pressione: ev.pointerType === 'pen' && p > 0 ? p : null };
  };
  const finisci = () => { const s = attuale.current; attuale.current = null; if (!s) return; chiudiTratto(s); ridisegna(); };
  const consegna = async (png, extra = {}) => onUsa(await ricolora(png, colore).catch(() => png), { tipo, tutte: tutte && pagine > 1, inchiostro, ...extra });
  const usa = () => {
    const c = canvas.current, dpr = c.width / c.clientWidth;
    const r = ritaglioFirma(riquadro(tratti.current), { width: c.clientWidth, height: c.clientHeight }, 8);
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
        const s = nuovoTratto(campione(e.nativeEvent)); attuale.current = s; tratti.current.push(s);
        ridisegna(); setDrawn(true);
      }}
      onPointerMove={e => {
        const s = attuale.current; if (!s) return;
        const lista = e.nativeEvent.getCoalescedEvents?.() || [];
        for (const ev of lista.length ? lista : [e.nativeEvent]) aggiungiPunto(s, campione(ev));
        ridisegna();
      }}
      onPointerUp={finisci} onPointerCancel={finisci} />
    <label className="pdf-check"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Ricorda su questo dispositivo</label>
    {pagine > 1 && <label className="pdf-check"><input type="checkbox" checked={tutte} onChange={e => setTutte(e.target.checked)} /> Metti su tutte le {pagine} pagine</label>}
    <div className="pdf-row"><button onClick={annullaTratto} disabled={!drawn}>Annulla tratto</button><button onClick={pulisci}>Rifai</button>
      <button className="pdf-primary" disabled={!drawn} onClick={usa}>Usa questa {nome}</button>
      <button onClick={onChiudi}>Indietro</button></div>
    {salvata && <button onClick={dimentica}>Dimentica {nome} salvata</button>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
