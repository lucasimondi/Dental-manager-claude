// PR #337 — pezzi di Esplora file stile Windows 11: menu contestuale (popover su desktop, foglio dal basso su
// mobile, con riga rapida, sottomenu, scorciatoie e separatori), finestra di anteprima (riduci, ingrandisci,
// chiudi), Proprietà, Gestisci accesso Drive, Sposta in… / Duplica in…, avvisi (Annulla / Riprova).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { preparaFile, comeFile } from '../../lib/condividi.js';
import { tokenSessione } from '../../ui.jsx';
import { IconaCartellaW11, IconaFileW11 } from '../../IconeW11.jsx';
import { posizioneMenu, dimensioneLeggibile, dataLeggibile, tipoLeggibile, tipoFile, proprietaDrive, accessoDrive, comeAprire, ripristinaVersioneDrive } from '../../lib/esplora.js';
import { snapDa, vicina, zoom } from '../../lib/apertura.js';

/* ---------- icone lineari 16 px ---------- */
const D = {
  apri: 'M2.5 5h4l1.5 1.5h5.5v7h-11z', 'apri-con': 'M3 3h10v10H3zM6 8h4M8 6l2 2-2 2', condividi: 'M8 2v8M5 5l3-3 3 3M3 9v4h10V9',
  taglia: 'M5 12a1.6 1.6 0 1 0 0 .01M11 12a1.6 1.6 0 1 0 0 .01M6.2 10.8 12 3M9.8 10.8 4 3', copia: 'M5 5h8v8H5zM3 11V3h8',
  duplica: 'M5 5h8v8H5zM3 11V3h8M9 7v4M7 9h4', incolla: 'M5.5 3h5v2h-5zM4 4H3v10h10V4h-1', 'incolla-qui': 'M5.5 3h5v2h-5zM4 4H3v10h10V4h-1',
  rinomina: 'M3 13h2.5l7-7-2.5-2.5-7 7zM9.5 4.5 12 7', sposta: 'M2.5 8h10M9 4.5 12.5 8 9 11.5', preferito: 'm8 2.5 1.7 3.5 3.8.5-2.8 2.6.7 3.8L8 11.1l-3.4 1.8.7-3.8L2.5 6.5l3.8-.5z',
  zip: 'M4 2h6l3 3v9H4zM8 4v1M8 6v1M8 8v1M7.3 10h1.4v2H7.3z', scarica: 'M8 2v8M5 7l3 3 3-3M3 13h10', proprieta: 'M3 3h10v10H3zM5.5 6h5M5.5 8.5h5M5.5 11h3',
  elimina: 'M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9', nuova: 'M2.5 5h4l1.5 1.5h5.5v7h-11zM8 8.5v3M6.5 10h3', aggiorna: 'M12.5 8a4.5 4.5 0 1 1-1.3-3.2M12.5 3v2.5H10',
  vista: 'M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3zM9 9h4v4H9z', 'seleziona-tutto': 'M3 3h10v10H3zM5.5 8l1.8 1.8L10.5 6.5',
  'condividi-sistema': 'M8 2v8M5 5l3-3 3 3M3 9v4h10V9',
  ordina: 'M4.5 3v10M2.5 11l2 2 2-2M11.5 13V3M9.5 5l2-2 2 2', altro: 'M3.5 8h.01M8 8h.01M12.5 8h.01', ripristina: 'M3.5 8a4.5 4.5 0 1 0 1.3-3.2M3.5 3v2.5H6',
  carica: 'M8 11V3M5 6l3-3 3 3M3 13h10', doc: 'M4 2h5.5L12 4.5V14H4zM6 7h4M6 9.5h4M6 12h2.5', foglio: 'M3 3h10v10H3zM3 6.5h10M3 10h10M6.5 3v10',
  riquadro: 'M2.5 3h11v10h-11zM9.5 3v10', pannello: 'M2.5 3h11v10h-11zM6 3v10', deseleziona: 'M3 3h10v10H3z', inverti: 'M3 3h10v10H3zM3 13 13 3',
  'scheda-nuova': 'M2.5 4.5h6v-2h5v11h-11zM8 7.5v3M6.5 9h3', 'copia-percorso': 'M5 5h8v8H5zM3 11V3h8M7 9h4', 'proprieta-cartella': 'M3 3h10v10H3zM5.5 6h5M5.5 8.5h5M5.5 11h3',
  'mostra-cartella': 'M2.5 5h4l1.5 1.5h5.5v7h-11zM7 10h4M9.5 8.5 11 10l-1.5 1.5', 'copia-in': 'M5 5h8v8H5zM3 11V3h8M8 9h3M10 7.5 11.5 9 10 10.5',
  estrai: 'M4 2h6l3 3v9H4zM8 7v5M6 10l2 2 2-2', 'elimina-definitivo': 'M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9M6.5 7l3 4M9.5 7l-3 4',
};
D.con = D['apri-con']; D.cond = D.condividi; D.nuovo = D.nuova;
// Voci senza icona (scelte con ✓, colonne, gruppi): spazio vuoto, così i testi restano allineati.
export const IcoMenu = ({ id, size = 16 }) => {
  const d = D[id] || D[String(id).split(':')[0]];
  if (!d) return <span className="esp-ico-vuota" style={{ width: size, height: size, display: 'inline-block', flexShrink: 0 }} aria-hidden="true" />;
  return <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true"><path d={d} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
};

/* ---------- menu contestuale ---------- */
export function MenuContestuale({ menu, struttura, mobile, schermo, onScegli, onChiudi }) {
  const [sotto, setSotto] = useState(null); // { id, voci, y }
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const timerSotto = useRef(null); // i sottomenu si aprono (e chiudono) in hover dopo 300 ms, come in Windows
  useEffect(() => () => clearTimeout(timerSotto.current), []);
  const inHover = (f) => { clearTimeout(timerSotto.current); timerSotto.current = setTimeout(f, 300); };
  const apertoIl = useRef(Date.now());
  useLayoutEffect(() => {
    if (mobile || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ ...posizioneMenu(menu.x, menu.y, r.width, r.height, schermo.l, schermo.a), largo: r.width });
  }, [menu.x, menu.y, mobile, schermo.l, schermo.a, struttura]);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') { e.stopPropagation(); if (sotto) setSotto(null); else onChiudi(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [sotto, onChiudi]);
  // Al rilascio del dito il telefono genera un «click» proprio dove compare il menu: per un attimo lo si ignora.
  const pronto = () => Date.now() - apertoIl.current > 450;
  const scegli = (v, e) => { if (!pronto() || !v.attiva) return; if (v.sotto) { clearTimeout(timerSotto.current); setSotto({ id: v.id, nome: v.nome, voci: v.sotto, y: e?.currentTarget?.getBoundingClientRect?.().top }); return; } onScegli(v.id); };
  const voce = (v, i) => (v.separatore ? <div key={`s${i}`} className="esp-menu-sep" role="separator" /> : (
    <button key={v.id} type="button" role="menuitem" className={`esp-menu-voce${sotto?.id === v.id ? ' aperta' : ''}`} disabled={!v.attiva}
      aria-haspopup={v.sotto ? 'menu' : undefined} aria-expanded={v.sotto ? sotto?.id === v.id : undefined} onClick={(e) => scegli(v, e)}
      onMouseEnter={(e) => {
        if (mobile) return;
        const y = e.currentTarget.getBoundingClientRect().top;
        if (v.sotto && v.attiva) { if (sotto?.id !== v.id) inHover(() => setSotto({ id: v.id, nome: v.nome, voci: v.sotto, y })); else clearTimeout(timerSotto.current); }
        else if (!v.sotto && !e.currentTarget.closest('.esp-sottomenu')) inHover(() => setSotto(null));
        else clearTimeout(timerSotto.current);
      }}
      onMouseLeave={() => clearTimeout(timerSotto.current)}>
      <IcoMenu id={v.id} /><span className="esp-menu-nome">{v.nome}</span>
      {v.tasto && <kbd className="esp-menu-tasto">{v.tasto}</kbd>}
      {v.sotto && <span className="esp-menu-freccia" aria-hidden="true">›</span>}
    </button>
  ));
  const rapide = struttura.rapide?.length ? (
    <div className="esp-menu-rapide" role="group" aria-label="Azioni rapide">
      {struttura.rapide.map((r) => <button key={r.id} type="button" className="esp-menu-rapida" disabled={!r.attiva} title={r.nome} aria-label={r.nome} onClick={() => pronto() && r.attiva && onScegli(r.id)}><IcoMenu id={r.id} size={18} /></button>)}
    </div>
  ) : null;
  if (mobile) {
    return (
      <div className="esp-velo esp-velo-foglio" onClick={() => pronto() && onChiudi()}>
        <div className="esp-foglio-menu" role="menu" aria-label="Menu" onClick={(e) => e.stopPropagation()}>
          <div className="esp-foglio-maniglia" />
          {sotto ? (
            <>
              <button type="button" className="esp-menu-voce esp-menu-indietro" onClick={() => setSotto(null)}><span aria-hidden="true">‹</span><span className="esp-menu-nome">{sotto.nome}</span></button>
              {sotto.voci.map(voce)}
            </>
          ) : <>{menu.titolo && <p className="esp-foglio-titolo">{menu.titolo}</p>}{rapide}{struttura.voci.map(voce)}</>}
        </div>
      </div>
    );
  }
  // Sottomenu accanto al menu (a destra; a sinistra se non c'è spazio), sempre dentro lo schermo.
  const largo = pos?.largo || 232;
  const sottoLargo = 260;
  const sx = pos && pos.left + largo + sottoLargo > schermo.l - 8 ? pos.left - sottoLargo + 4 : (pos?.left || 0) + largo - 4;
  return (
    <div className="esp-velo-menu" onMouseDown={(e) => { if (e.target === e.currentTarget) onChiudi(); }} onContextMenu={(e) => { e.preventDefault(); onChiudi(); }}>
      <div ref={ref} className="esp-menu" role="menu" style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: 0 }}>
        {rapide}{struttura.voci.map(voce)}
      </div>
      {sotto && pos && (
        <div className="esp-menu esp-sottomenu" role="menu" aria-label={sotto.nome}
          style={{ left: Math.max(8, sx), top: Math.max(8, Math.min((sotto.y || pos.top) - 6, schermo.a - (sotto.voci.length * 40 + 16) - 8)) }}>
          {sotto.voci.map(voce)}
        </div>
      )}
    </div>
  );
}

/* ---------- finestra stile Win11 ---------- */
// Barra del titolo con riduci / ingrandisci / chiudi; su desktop si trascina dal titolo e si aggancia ai
// bordi (sinistra / destra = metà schermo, in alto = ingrandita), con l'anteprima dell'aggancio.
export function Finestra({ titolo, icona, stato: statoDato, onStato: onStatoDato, onChiudi, children, classe = '', strumenti = null }) {
  const [statoLocale, setStatoLocale] = useState('normale');
  const stato = statoDato ?? statoLocale;
  const onStato = onStatoDato || setStatoLocale;
  const [pos, setPos] = useState(null); // { x, y } della finestra normale spostata
  const [anteprimaSnap, setAnteprimaSnap] = useState(null);
  const ref = useRef(null);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onChiudi(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onChiudi]);
  const trascina = (e) => {
    if (e.button !== 0 || e.target.closest('button') || window.matchMedia?.('(pointer: coarse)').matches) return;
    const r = ref.current.getBoundingClientRect();
    const dx = e.clientX - r.left; const dy = e.clientY - r.top;
    let mosso = false;
    const muovi = (ev) => {
      if (!mosso && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 4) return;
      if (!mosso && stato !== 'normale') { onStato('normale'); }
      mosso = true;
      setPos({ x: Math.max(0, Math.min(ev.clientX - dx, window.innerWidth - 120)), y: Math.max(0, Math.min(ev.clientY - dy, window.innerHeight - 40)) });
      setAnteprimaSnap(snapDa(ev.clientX, ev.clientY, window.innerWidth));
    };
    const fine = (ev) => {
      window.removeEventListener('pointermove', muovi); window.removeEventListener('pointerup', fine);
      setAnteprimaSnap(null);
      const s = mosso ? snapDa(ev.clientX, ev.clientY, window.innerWidth) : null;
      if (s) { setPos(null); onStato(s); }
    };
    window.addEventListener('pointermove', muovi); window.addEventListener('pointerup', fine);
  };
  if (stato === 'ridotta') {
    return <button type="button" className="esp-finestra-ridotta" onClick={() => onStato('normale')} aria-label={`Ripristina ${titolo}`}>{icona}<span>{titolo}</span></button>;
  }
  const grande = stato !== 'normale';
  return (
    <div className={`esp-velo esp-velo-finestra esp-snap-${stato}${stato === 'ingrandita' ? ' ingrandita' : ''}`}>
      {anteprimaSnap && <div className={`esp-snap-anteprima esp-snap-anteprima-${anteprimaSnap}`} aria-hidden="true" />}
      <section ref={ref} className={`esp-finestra ${classe}`} role="dialog" aria-label={titolo} style={!grande && pos ? { position: 'fixed', left: pos.x, top: pos.y, margin: 0 } : undefined}>
        <header className="esp-finestra-titolo" onPointerDown={trascina} onDoubleClick={() => { setPos(null); onStato(stato === 'ingrandita' ? 'normale' : 'ingrandita'); }}>
          {icona}<span className="esp-finestra-nome">{titolo}</span>
          {strumenti}
          <div className="esp-finestra-tasti">
            <button type="button" onClick={() => onStato('ridotta')} aria-label="Riduci a icona" title="Riduci a icona"><svg viewBox="0 0 10 10" width="10" height="10"><path d="M1 5h8" stroke="currentColor" /></svg></button>
            <button type="button" onClick={() => { setPos(null); onStato(grande ? 'normale' : 'ingrandita'); }} aria-label={grande ? 'Ripristina' : 'Ingrandisci'} title={grande ? 'Ripristina' : 'Ingrandisci'}>
              <svg viewBox="0 0 10 10" width="10" height="10"><rect x="1.5" y="1.5" width="7" height="7" rx="1" fill="none" stroke="currentColor" /></svg>
            </button>
            <button type="button" className="esp-finestra-chiudi" onClick={onChiudi} aria-label="Chiudi" title="Chiudi"><svg viewBox="0 0 10 10" width="10" height="10"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" /></svg></button>
          </div>
        </header>
        <div className="esp-finestra-corpo">{children}</div>
      </section>
    </div>
  );
}

/* ---------- visualizzatore: PDF con pagine e zoom, immagini con ←/→ e zoom ---------- */
async function apriPdf(base64) {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist/legacy/build/pdf.js'), import('pdfjs-dist/legacy/build/pdf.worker.min.js?url')]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs.getDocument({ data: Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)) }).promise;
}
function VisorePdf({ dati, livello, pagina, onPagine }) {
  const tela = useRef(null);
  const contenitore = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [errore, setErrore] = useState(null);
  useEffect(() => { let vivo = true; apriPdf(dati).then((p) => { if (vivo) { setPdf(p); onPagine(p.numPages); } }).catch((e) => vivo && setErrore(e.message)); return () => { vivo = false; }; }, [dati]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!pdf || !tela.current) return undefined;
    let compito = null; let vivo = true;
    pdf.getPage(pagina).then((pg) => {
      if (!vivo) return;
      const base = pg.getViewport({ scale: 1 });
      const adatta = ((contenitore.current?.clientWidth || 600) - 24) / base.width;
      const scala = adatta * livello;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const v = pg.getViewport({ scale: scala * dpr });
      const c = tela.current;
      c.width = v.width; c.height = v.height; c.style.width = `${v.width / dpr}px`; c.style.height = `${v.height / dpr}px`;
      compito = pg.render({ canvasContext: c.getContext('2d'), viewport: v });
    });
    return () => { vivo = false; compito?.cancel?.(); };
  }, [pdf, pagina, livello]);
  if (errore) return <p className="esp-nota">{errore}</p>;
  return <div ref={contenitore} className="esp-visore-pagina">{!pdf && <p className="esp-nota"><span className="pp-rotella" /> Carico il PDF…</p>}<canvas ref={tela} aria-label={`Pagina ${pagina}`} /></div>;
}

export function FinestraAnteprima({ doc, tipo, titolo, stato, onStato, onChiudi, onApriScheda, elenco = [], onCambia }) {
  const [file, setFile] = useState(null); // { dati, mime }
  const [url, setUrl] = useState(null);
  const [errore, setErrore] = useState(null);
  const [livello, setLivello] = useState(1);
  const [pagina, setPagina] = useState(1);
  const [pagine, setPagine] = useState(0);
  const immagini = elenco.filter((d) => comeAprire(d).tipo === 'immagine');
  const prec = tipo === 'immagine' ? vicina(immagini, doc.id, -1) : null;
  const succ = tipo === 'immagine' ? vicina(immagini, doc.id, 1) : null;
  useEffect(() => {
    let vivo = true; let u = null;
    setFile(null); setUrl(null); setErrore(null); setPagina(1); setPagine(0); setLivello(1);
    tokenSessione().then((t) => preparaFile(doc.drive_file_id, t)).then((f) => {
      if (!vivo) return;
      if (tipo === 'video' || tipo === 'audio') { u = URL.createObjectURL(comeFile(f)); setUrl(u); } else setFile(f);
    }).catch((e) => vivo && setErrore(e.message));
    return () => { vivo = false; if (u) URL.revokeObjectURL(u); };
  }, [doc.drive_file_id, tipo]);
  // Tastiera: ←/→ immagini o pagine, + / − zoom, 0 adatta.
  useEffect(() => {
    const k = (e) => {
      if (e.target.closest?.('input, textarea, select')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { if (tipo === 'immagine' && succ) { e.preventDefault(); onCambia?.(succ); } else if (tipo === 'pdf' && pagina < pagine) { e.preventDefault(); setPagina((p) => p + 1); } }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { if (tipo === 'immagine' && prec) { e.preventDefault(); onCambia?.(prec); } else if (tipo === 'pdf' && pagina > 1) { e.preventDefault(); setPagina((p) => p - 1); } }
      else if (e.key === '+' || e.key === '=') setLivello((z) => zoom(z, 1));
      else if (e.key === '-') setLivello((z) => zoom(z, -1));
      else if (e.key === '0') setLivello(1);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [tipo, succ, prec, pagina, pagine, onCambia]);
  const strumenti = (tipo === 'pdf' || tipo === 'immagine') ? (
    <div className="esp-visore-strumenti" role="toolbar" aria-label="Visualizzatore" onPointerDown={(e) => e.stopPropagation()}>
      {tipo === 'pdf' && <>
        <button type="button" onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina <= 1} aria-label="Pagina precedente" title="Pagina precedente (←)">‹</button>
        <span className="esp-visore-pagine" aria-live="polite">{pagina} / {pagine || '…'}</span>
        <button type="button" onClick={() => setPagina((p) => Math.min(pagine, p + 1))} disabled={!pagine || pagina >= pagine} aria-label="Pagina successiva" title="Pagina successiva (→)">›</button>
      </>}
      <button type="button" onClick={() => setLivello((z) => zoom(z, -1))} aria-label="Riduci zoom" title="Riduci (−)">−</button>
      <button type="button" className="esp-visore-zoom" onClick={() => setLivello(1)} aria-label="Adatta alla finestra" title="Adatta (0)">{Math.round(livello * 100)}%</button>
      <button type="button" onClick={() => setLivello((z) => zoom(z, 1))} aria-label="Aumenta zoom" title="Ingrandisci (+)">+</button>
    </div>
  ) : null;
  return (
    <Finestra titolo={titolo} icona={<IconaFileW11 tipo={tipoFile(doc)} size={16} />} stato={stato} onStato={onStato} onChiudi={onChiudi} classe="esp-finestra-anteprima" strumenti={strumenti}>
      <div className="esp-visore" onWheel={(e) => { if (e.ctrlKey) { e.preventDefault(); setLivello((z) => zoom(z, e.deltaY > 0 ? -1 : 1)); } }}>
        {!file && !url && !errore && <p className="esp-nota"><span className="pp-rotella" /> Carico…</p>}
        {errore && <p className="esp-nota">{errore}</p>}
        {tipo === 'pdf' && file && <VisorePdf dati={file.dati} livello={livello} pagina={pagina} onPagine={setPagine} />}
        {tipo === 'immagine' && file && <div className="esp-visore-pagina"><img src={`data:${file.mime};base64,${file.dati}`} alt={titolo} style={{ width: `${livello * 100}%` }} /></div>}
        {tipo === 'immagine' && prec && <button type="button" className="esp-visore-freccia sinistra" onClick={() => onCambia?.(prec)} aria-label="Immagine precedente" title="Precedente (←)">‹</button>}
        {tipo === 'immagine' && succ && <button type="button" className="esp-visore-freccia destra" onClick={() => onCambia?.(succ)} aria-label="Immagine successiva" title="Successiva (→)">›</button>}
        {tipo === 'video' && url && <video src={url} controls playsInline className="esp-media" />}
        {tipo === 'audio' && url && <audio src={url} controls className="esp-media-audio" />}
      </div>
      <div className="esp-finestra-piede">
        {tipo === 'immagine' && immagini.length > 1 && <span className="esp-nota">{immagini.findIndex((d) => d.id === doc.id) + 1} di {immagini.length}</span>}
        <button type="button" className="esp-bottone" onClick={onApriScheda}>Apri la scheda del documento</button>
      </div>
    </Finestra>
  );
}

/* ---------- Proprietà ---------- */
export function DialogoProprieta({ voce, cosa, percorsoApp, onChiudi }) {
  const [drive, setDrive] = useState(null);
  const [giro, setGiro] = useState(0);
  const [ripristino, setRipristino] = useState(null); // { versione, fase: 'conferma'|'lavoro'|'fatto'|'errore', testo }
  useEffect(() => {
    let vivo = true;
    tokenSessione().then((token) => proprietaDrive({ token, id: voce.id, cartella: cosa === 'cartella' }))
      .then((r) => vivo && setDrive(r)).catch((e) => vivo && setDrive({ errore: e.message }));
    return () => { vivo = false; };
  }, [voce.id, cosa, giro]);
  const ripristina = async (v) => {
    setRipristino({ versione: v, fase: 'lavoro' });
    try { await ripristinaVersioneDrive({ token: await tokenSessione(), id: voce.id, versione: v.id }); setRipristino({ versione: v, fase: 'fatto' }); setGiro((n) => n + 1); }
    catch (e) { setRipristino({ versione: v, fase: 'errore', testo: e.message }); }
  };
  const file = cosa !== 'cartella';
  const righe = [
    ['Tipo', file ? tipoLeggibile(voce) : 'Cartella di file'],
    ['Percorso in Poliedra', percorsoApp],
    ['Percorso su Drive', drive?.percorso || (drive ? '—' : '…')],
    ['Dimensione', file ? (dimensioneLeggibile(drive?.dimensione ?? voce.dimensione_byte) || '—') : '—'],
    ['Creato', dataLeggibile(drive?.creato || voce.creato_il) || '—'],
    ['Modificato', dataLeggibile(drive?.modificato || voce.modificato_il) || '—'],
    ['Proprietario', drive?.proprietario || (drive ? '—' : '…')],
  ];
  return (
    <Finestra titolo={`Proprietà · ${file ? voce.titolo || voce.nome_file_originale || 'Documento' : voce.nome}`} icona={file ? <IconaFileW11 tipo={tipoFile(voce)} size={16} /> : <IconaCartellaW11 size={16} />} onChiudi={onChiudi} classe="esp-finestra-piccola">
      <dl className="esp-proprieta">{righe.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      {drive?.errore && <p className="esp-nota">Drive non ha risposto: {drive.errore}</p>}
      {file && drive?.versioni && (
        <>
          <h3 className="esp-sezione">Cronologia versioni su Drive</h3>
          {drive.versioni.length ? (
            <ul className="esp-versioni">{drive.versioni.map((v, i) => (
              <li key={v.id}><span>{dataLeggibile(v.quando)}{i === 0 ? ' (attuale)' : ''}</span><span>{v.chi || ''}</span><span>{dimensioneLeggibile(v.dimensione)}</span>
                {i > 0 && <button type="button" className="esp-bottone esp-bottone-piccolo" disabled={ripristino?.fase === 'lavoro'} onClick={() => setRipristino({ versione: v, fase: 'conferma' })}>Ripristina</button>}
              </li>
            ))}</ul>
          ) : <p className="esp-nota">Una sola versione.</p>}
          {ripristino?.fase === 'conferma' && (
            <div className="esp-conferma" role="alertdialog">
              <p>Ripristinare la versione del {dataLeggibile(ripristino.versione.quando)}? Diventa la versione attuale; quelle di adesso restano nella cronologia.</p>
              <div className="esp-dialogo-azioni"><button type="button" className="esp-bottone" onClick={() => setRipristino(null)}>Annulla</button><button type="button" className="esp-bottone esp-bottone-blu" onClick={() => ripristina(ripristino.versione)}>Ripristina</button></div>
            </div>
          )}
          {ripristino?.fase === 'lavoro' && <p className="esp-nota"><span className="pp-rotella" /> Ripristino su Drive…</p>}
          {ripristino?.fase === 'fatto' && <p className="esp-nota" role="status">Versione ripristinata su Drive.</p>}
          {ripristino?.fase === 'errore' && <p className="esp-nota esp-errore" role="alert">Non ripristinata: {ripristino.testo}</p>}
        </>
      )}
      {drive?.link && <div className="esp-finestra-piede"><a className="esp-bottone" href={drive.link} target="_blank" rel="noopener noreferrer">Apri in Drive</a></div>}
    </Finestra>
  );
}

/* ---------- Gestisci accesso Drive ---------- */
export function DialogoAccesso({ doc, titolo, onChiudi }) {
  const [stato, setStato] = useState(null);
  const [email, setEmail] = useState('');
  const [ruolo, setRuolo] = useState('reader');
  const [lavoro, setLavoro] = useState(false);
  const [conferma, setConferma] = useState(null);
  const chiama = async (corpo) => {
    setLavoro(true);
    try { setStato(await accessoDrive({ token: await tokenSessione(), id: doc.id, ...corpo })); }
    catch (e) { setStato((s) => ({ ...(s || {}), errore: e.message })); }
    finally { setLavoro(false); setConferma(null); }
  };
  useEffect(() => { chiama({ operazione: 'leggi' }); }, [doc.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const pubblico = stato?.permessi?.some((p) => p.tipo === 'anyone');
  const ruoli = { owner: 'Proprietario', writer: 'Può modificare', reader: 'Può vedere', commenter: 'Può commentare' };
  return (
    <Finestra titolo={`Gestisci accesso · ${titolo}`} icona={<IconaFileW11 tipo={tipoFile(doc)} size={16} />} onChiudi={onChiudi} classe="esp-finestra-piccola">
      {!stato && <p className="esp-nota"><span className="pp-rotella" /> Leggo i permessi su Drive…</p>}
      {stato?.errore && <p className="esp-nota esp-errore" role="alert">{stato.errore}</p>}
      {stato?.permessi && (
        <>
          <ul className="esp-permessi">
            {stato.permessi.map((p) => (
              <li key={p.id}>
                <span><strong>{p.tipo === 'anyone' ? 'Chiunque abbia il link' : p.nome || p.email}</strong>{p.email && p.nome ? <small>{p.email}</small> : null}</span>
                <span className="esp-permesso-ruolo">{ruoli[p.ruolo] || p.ruolo}</span>
                {p.ruolo !== 'owner' && p.tipo !== 'anyone' && <button type="button" className="esp-bottone" disabled={lavoro} onClick={() => chiama({ operazione: 'togli', permesso: p.id })}>Togli</button>}
              </li>
            ))}
          </ul>
          <label className="esp-interruttore">
            <input type="checkbox" checked={!!pubblico} disabled={lavoro || (stato.clinico && !pubblico)} onChange={(e) => chiama({ operazione: 'link', attivo: e.target.checked })} />
            <span>Chiunque abbia il link può vedere{stato.clinico ? ' (non per i documenti dei pazienti)' : ''}</span>
          </label>
          <form className="esp-aggiungi-persona" onSubmit={(e) => { e.preventDefault(); if (email.trim()) setConferma({ email: email.trim(), ruolo }); }}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@esempio.it" aria-label="Email della persona" />
            <select value={ruolo} onChange={(e) => setRuolo(e.target.value)} aria-label="Permesso"><option value="reader">Può vedere</option><option value="writer">Può modificare</option></select>
            <button type="submit" className="esp-bottone" disabled={lavoro || !email.trim()}>Aggiungi</button>
          </form>
          {conferma && (
            <div className="esp-conferma" role="alertdialog">
              <p>Dare a <strong>{conferma.email}</strong> il permesso «{ruoli[conferma.ruolo]}» su questo file? Drive non manda email: il link lo invii tu.</p>
              <div className="esp-dialogo-azioni">
                <button type="button" className="esp-bottone" onClick={() => setConferma(null)}>Annulla</button>
                <button type="button" className="esp-bottone esp-bottone-blu" onClick={() => chiama({ operazione: 'aggiungi', email: conferma.email, ruolo: conferma.ruolo }).then(() => setEmail(''))}>Conferma</button>
              </div>
            </div>
          )}
        </>
      )}
    </Finestra>
  );
}

/* ---------- Sposta in… / Duplica in… ---------- */
export function FoglioSpostaIn({ disp, titolo = 'Sposta in…', voci, onScegli, onChiudi }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onChiudi(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onChiudi]);
  return (
    <div className="esp-velo" onClick={onChiudi}>
      <div className={`esp-dialogo esp-dialogo-${disp} esp-sposta`} role="dialog" aria-label={titolo.replace('…', '')} onClick={(e) => e.stopPropagation()}>
        <h2>{titolo}</h2>
        <ul className="esp-sposta-lista">
          {voci.map((v) => (
            <li key={v.id}>
              <button type="button" disabled={v.vietata} onClick={() => onScegli(v.id)} style={{ paddingLeft: 12 + v.livello * 16 }}>
                <IconaCartellaW11 size={18} /><span>{v.nome}</span>{v.attuale && <em>attuale</em>}
              </button>
            </li>
          ))}
        </ul>
        <div className="esp-dialogo-azioni"><button type="button" className="esp-bottone" onClick={onChiudi}>Annulla</button></div>
      </div>
    </div>
  );
}

/* ---------- avvisi: riuscito con Annulla, errore con Riprova ---------- */
export function Avviso({ avviso, onChiudi }) {
  if (!avviso) return null;
  const errore = avviso.tipo === 'errore';
  return (
    <div className={`esp-avviso${errore ? ' errore' : ''}`} role={errore ? 'alert' : 'status'}>
      {errore && <span className="esp-avviso-icona" aria-hidden="true">!</span>}
      <span className="esp-avviso-testo">{avviso.testo}</span>
      {avviso.azione && <button type="button" onClick={() => { const a = avviso.azione; onChiudi(); a.fai(); }}>{avviso.azione.nome}</button>}
      <button type="button" className="esp-avviso-chiudi" onClick={onChiudi} aria-label="Chiudi avviso">✕</button>
    </div>
  );
}
