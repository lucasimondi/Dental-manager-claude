import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { trovaAngoli } from '../lib/prospettiva.js';
import { smussaAngoli, passoScatto, MESSAGGI_FASE } from '../lib/scannerVivo.js';
import { IconaFoto, IconaChiudi } from '../Icone.jsx';
import { useIndietro } from '../lib/indietro.js';
// SCAN-VIVO (PO 2026-11-24: «non è lo Scan, ma scatta foto, bisogna avere lo Scan forte come quello di
// Google»). Fotocamera dal vivo a tutto schermo: il contorno del foglio segue l'inquadratura, con
// «Automatico» scatta da sola quando il foglio è fermo; si scattano più pagine di fila, «Fine» torna
// all'elenco. Le foto restano sul telefono finché non si archivia. Se la fotocamera non si può usare
// (permesso negato, browser vecchio) si torna alla fotocamera del telefono (onNonDisponibile).
const CHIAVE_AUTO = 'scan-scatto-automatico-v1';
const leggiAuto = () => { try { return localStorage.getItem(CHIAVE_AUTO) !== '0'; } catch { return true; } };
const LATO_ANALISI = 480;
const TIENI_MS = 450; // SCAN-BORDI: un fotogramma perso non fa sparire il contorno

export const fotocameraDisponibile = () => Boolean(globalThis.navigator?.mediaDevices?.getUserMedia);

export function Fotocamera({ onScatto, onFine, onGalleria, onNonDisponibile, pagine = 0, miniatura = null }) {
  const video = useRef(null), area = useRef(null), analisi = useRef(null), flusso = useRef(null), stato = useRef({}), angoliVisti = useRef(null);
  const [angoli, setAngoli] = useState(null), [fase, setFase] = useState('cerca'), [avanzamento, setAvanzamento] = useState(0);
  const [auto, setAutoStato] = useState(leggiAuto), autoRef = useRef(auto); autoRef.current = auto;
  const [torcia, setTorcia] = useState(null), [lampo, setLampo] = useState(0), [pronta, setPronta] = useState(false), [rett, setRett] = useState(null);
  const occupata = useRef(false), grezzo = useRef({ q: null, t: -Infinity });
  useIndietro(true, () => { onFine(); }); // SCAN-INDIETRO: il tasto Indietro chiude la fotocamera, non l'app
  const setAuto = (v) => { setAutoStato(v); try { localStorage.setItem(CHIAVE_AUTO, v ? '1' : '0'); } catch { /* facoltativo */ } };

  // Riquadro del video mostrato (object-fit: contain) dentro l'area: il contorno SVG ci va sopra.
  const misura = useCallback(() => {
    const v = video.current, a = area.current; if (!v?.videoWidth || !a) return;
    const W = a.clientWidth, H = a.clientHeight, k = Math.min(W / v.videoWidth, H / v.videoHeight);
    const w = v.videoWidth * k, h = v.videoHeight * k; setRett({ left: (W - w) / 2, top: (H - h) / 2, width: w, height: h });
  }, []);

  const scatta = useCallback(async () => {
    const v = video.current; if (!v?.videoWidth || occupata.current) return;
    occupata.current = true; setLampo((n) => n + 1);
    try {
      let blob = null;
      // SCAN-BORDI: gli angoli dell'ultimo fotogramma (non smussati, senza ritardo) se recenti.
      const traccia = flusso.current?.getVideoTracks?.()[0], angoli = performance.now() - grezzo.current.t < 300 ? grezzo.current.q : angoliVisti.current;
      // Foto alla risoluzione piena del sensore se il browser lo permette e ha le stesse proporzioni del
      // video (così gli angoli trovati dal vivo valgono anche per la foto); altrimenti il fotogramma.
      if (globalThis.ImageCapture && traccia) {
        try {
          const foto = await new ImageCapture(traccia).takePhoto(), bmp = await createImageBitmap(foto);
          if (Math.abs(bmp.width / bmp.height - v.videoWidth / v.videoHeight) < 0.01) blob = foto;
          bmp.close();
        } catch { blob = null; }
      }
      if (!blob) {
        const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
        c.getContext('2d').drawImage(v, 0, 0);
        blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.92));
      }
      if (blob) {
        const file = new File([blob], `Scansione ${new Date().toLocaleTimeString('it-IT').replace(/:/g, '.')}.jpg`, { type: blob.type || 'image/jpeg' });
        // Gli angoli visti nell'inquadratura raddrizzano la foto (come gli scanner dei telefoni).
        if (angoli) Object.defineProperty(file, 'angoliScan', { value: angoli });
        onScatto(file);
      }
      navigator.vibrate?.(30);
    } finally { occupata.current = false; }
  }, [onScatto]);
  const scattaRef = useRef(scatta); scattaRef.current = scatta;

  useEffect(() => {
    let vivo = true, timer = null;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } } });
        if (!vivo) { s.getTracks().forEach((t) => t.stop()); return; }
        flusso.current = s; const v = video.current; v.srcObject = s; await v.play().catch(() => {});
        const tr = s.getVideoTracks()[0], cap = tr?.getCapabilities?.() || {};
        if (cap.torch) setTorcia(false);
        setPronta(true); misura();
        const ciclo = () => {
          if (!vivo) return;
          const vv = video.current;
          if (vv?.videoWidth && !occupata.current) {
            const k = LATO_ANALISI / Math.max(vv.videoWidth, vv.videoHeight), w = Math.round(vv.videoWidth * k), h = Math.round(vv.videoHeight * k);
            const c = analisi.current || (analisi.current = document.createElement('canvas'));
            if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
            const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(vv, 0, 0, w, h);
            const ora = performance.now(), recente = ora - grezzo.current.t < TIENI_MS ? grezzo.current.q : null;
            // SCAN-BORDI: con il foglio del fotogramma prima si riagganciano solo i lati (veloce).
            let q = null; try { q = trovaAngoli(ctx.getImageData(0, 0, w, h).data, w, h, { vicino: recente }); } catch { q = null; }
            if (q) grezzo.current = { q, t: ora };
            angoliVisti.current = q ? smussaAngoli(angoliVisti.current, q) : (recente ? angoliVisti.current : null);
            setAngoli(angoliVisti.current);
            const r = passoScatto(stato.current, q, performance.now(), { auto: autoRef.current });
            stato.current = r.st; setFase(autoRef.current || r.fase !== 'fermo' ? r.fase : 'manuale'); setAvanzamento(autoRef.current ? r.avanzamento : 0);
            if (r.fase === 'scatta') void scattaRef.current();
          }
          timer = setTimeout(ciclo, 80);
        };
        ciclo();
      } catch (e) { if (vivo) onNonDisponibile?.(e); }
    })();
    addEventListener('resize', misura);
    return () => { vivo = false; clearTimeout(timer); removeEventListener('resize', misura); flusso.current?.getTracks().forEach((t) => t.stop()); flusso.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cambiaTorcia = async () => {
    const tr = flusso.current?.getVideoTracks()[0]; if (!tr || torcia === null) return;
    try { await tr.applyConstraints({ advanced: [{ torch: !torcia }] }); setTorcia(!torcia); } catch { setTorcia(null); }
  };
  const punti = angoli && ['tl', 'tr', 'br', 'bl'].map((k) => `${angoli[k].x},${angoli[k].y}`).join(' ');
  const messaggio = !pronta ? 'Apro la fotocamera…' : MESSAGGI_FASE[fase];

  return createPortal(<div className="scan-camera" role="dialog" aria-modal="true" aria-label="Scanner">
    <div className="scan-camera-barra">
      <button className="scan-camera-tondo" aria-label="Chiudi scanner" onClick={onFine}><IconaChiudi size={22} /></button>
      <div className="scan-camera-auto" role="radiogroup" aria-label="Modo di scatto">
        <button role="radio" aria-checked={auto} onClick={() => setAuto(true)}>Automatico</button>
        <button role="radio" aria-checked={!auto} onClick={() => setAuto(false)}>Manuale</button>
      </div>
      {torcia !== null ? <button className={`scan-camera-tondo${torcia ? ' acceso' : ''}`} aria-pressed={torcia} aria-label="Torcia" onClick={cambiaTorcia}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M13 2 5 14h6l-1 8 8-12h-6l1-8Z" /></svg></button> : <span className="scan-camera-vuoto" />}
    </div>
    <div className="scan-camera-area" ref={area}>
      <video ref={video} playsInline muted onLoadedMetadata={misura} aria-label="Inquadratura della fotocamera" />
      {rett && <svg className="scan-camera-contorno" style={rett} viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
        {punti && <polygon points={punti} className={`fase-${fase}`} vectorEffect="non-scaling-stroke" />}
      </svg>}
      <p className="scan-camera-messaggio" role="status" aria-live="polite">{messaggio}</p>
      {lampo > 0 && <div key={lampo} className="scan-camera-lampo" aria-hidden="true" />}
    </div>
    <div className="scan-camera-comandi">
      <button className="scan-camera-tondo grande" aria-label="Scegli dalla galleria" onClick={onGalleria}><IconaFoto size={24} /></button>
      <button className="scan-camera-scatto" aria-label="Scatta" disabled={!pronta} onClick={scatta} style={{ '--avanzamento': avanzamento }}><span /></button>
      <button className="scan-camera-fine" aria-label={`Fine, ${pagine} ${pagine === 1 ? 'pagina' : 'pagine'}`} onClick={onFine} disabled={!pagine}>
        {miniatura ? <img src={miniatura} alt="" /> : <span className="scan-camera-segnaposto" />}
        {pagine > 0 && <b>{pagine}</b>}
        <span>Fine</span>
      </button>
    </div>
  </div>, document.body);
}
