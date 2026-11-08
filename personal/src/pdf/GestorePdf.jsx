import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as pdfjs from 'pdfjs-personal/build/pdf.mjs';
import workerUrl from 'pdfjs-personal/build/pdf.worker.min.mjs?url';
import { EventBus, PDFViewer, PDFLinkService, PDFFindController } from 'pdfjs-personal/web/pdf_viewer.mjs';
import 'pdfjs-personal/web/pdf_viewer.css';
import './pdf.css';
import { Firma } from './Firma.jsx';
import { validaFile, limitaFirma, posizioneFirma, incorporaFirme, organizzaPdf, unisciPdf, riordina, nomeCopia, condividiCopia } from './operazioni.js';
import { distanza } from '../lib/pinchZoom.js';
import { elaboraPagina, creaPdf } from '../lib/scansione.js';
import { scaricaDocumento } from '../lib/condividi.js';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
const misuraImmagine = src => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 }); img.onerror = () => reject(new Error('Firma non leggibile.')); img.src = src; });
const MODES = [['Leggi', pdfjs.AnnotationEditorType.NONE], ['Testo', pdfjs.AnnotationEditorType.FREETEXT], ['Disegno', pdfjs.AnnotationEditorType.INK], ['Evidenzia', pdfjs.AnnotationEditorType.HIGHLIGHT]];

function FirmaPagina({ signature, pageView, onChange, onRemove, editable }) {
  const gesture = useRef(null);
  // Keep React-owned DOM in its own host: PDF.js may replace page children on zoom.
  const [host] = useState(() => { const el = document.createElement('div'); el.className = 'pdf-signature-host'; return el; });
  useLayoutEffect(() => { if (host.parentNode !== pageView.div) pageView.div.appendChild(host); });
  useEffect(() => () => host.remove(), [host]);
  const start = (e, resize) => { if (!editable) return; e.stopPropagation(); e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); gesture.current = { x: e.clientX, y: e.clientY, resize, original: signature }; };
  const move = e => {
    const g = gesture.current; if (!g) return; e.stopPropagation();
    const r = pageView.div.getBoundingClientRect(), dx = (e.clientX - g.x) / r.width, dy = (e.clientY - g.y) / r.height;
    const s = g.original;
    onChange(limitaFirma(g.resize ? { ...s, width: s.width + dx, height: s.height + dy } : { ...s, x: s.x + dx, y: s.y + dy }));
  };
  const stop = e => { e.stopPropagation(); gesture.current = null; };
  return createPortal(<div className="pdf-signature" style={{ left: `${signature.x * 100}%`, top: `${signature.y * 100}%`, width: `${signature.width * 100}%`, height: `${signature.height * 100}%`, pointerEvents: editable ? 'auto' : 'none' }}
    onPointerDown={e => start(e, false)} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop}>
    <img src={signature.png} alt="Firma posizionata" draggable="false" />
    {editable && <><button className="pdf-signature-remove" aria-label="Rimuovi firma dalla pagina" onPointerDown={e => e.stopPropagation()} onClick={onRemove}>×</button>
    <button className="pdf-signature-resize" aria-label="Ridimensiona firma" onPointerDown={e => start(e, true)} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop}>↘</button></>}
  </div>, host);
}

export function GestorePdf({ file: initialFile, files: initialFiles, onClose, onArchive, onInfo, title, strumento }) {
  const root = useRef(null), container = useRef(null), pagesElement = useRef(null), runtime = useRef(null);
  const chooser = useRef(null), merger = useRef(null), alive = useRef(true), dirtyRef = useRef(false);
  const [source, setSource] = useState(null), [name, setName] = useState(initialFile?.name || 'Documento.pdf');
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [ready, setReady] = useState(false), [page, setPage] = useState(1), [count, setCount] = useState(0), [zoom, setZoom] = useState(1);
  const [mode, setMode] = useState(0), [signatures, setSignatures] = useState([]), [signatureOpen, setSignatureOpen] = useState(false);
  const [exportFile, setExportFile] = useState(null), [organize, setOrganize] = useState(null), [query, setQuery] = useState('');
  const [confirmClose, setConfirmClose] = useState(false), [password, setPassword] = useState(null), [passwordText, setPasswordText] = useState('');
  const [history, setHistory] = useState([]), [, repaint] = useState(0), [searchOpen, setSearchOpen] = useState(false);
  const markDirty = () => { dirtyRef.current = true; setExportFile(null); };
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const requestClose = () => { if (dirtyRef.current) setConfirmClose(true); else closeRef.current(); };
  const requestCloseRef = useRef(requestClose); requestCloseRef.current = requestClose;
  useEffect(() => {
    alive.current = true;
    const app = document.querySelector('.pp-app'), oldFocus = document.activeElement, overflow = document.body.style.overflow;
    if (app) app.inert = true; document.body.style.overflow = 'hidden'; root.current?.querySelector('button')?.focus();
    const key = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); requestCloseRef.current(); }
      if (e.key === 'Tab') { const els = [...root.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),[contenteditable="true"],a[href]')].filter(el => el.getClientRects().length); const first = els[0], last = els.at(-1); if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } }
    };
    const beforeUnload = e => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ''; } };
    document.addEventListener('keydown', key, true); window.addEventListener('beforeunload', beforeUnload);
    return () => { alive.current = false; if (app) app.inert = false; document.body.style.overflow = overflow; document.removeEventListener('keydown', key, true); window.removeEventListener('beforeunload', beforeUnload); oldFocus?.focus?.(); };
  }, []);
  const run = async (label, fn) => { setBusy(label); setError(''); try { await fn(); } catch (e) { if (alive.current) setError(e.message || 'Operazione non riuscita.'); } finally { if (alive.current) setBusy(''); } };
  async function importFiles(files) {
    if (!files.length) return;
    files.forEach(validaFile);
    if (files.reduce((n, f) => n + f.size, 0) > 40 * 1024 * 1024) throw new Error('Seleziona al massimo 40 MB per volta.');
    const converted = [];
    for (const f of files) converted.push(f.type.startsWith('image/') ? await creaPdf([await elaboraPagina(f, { modo: 'originale' })], f.name) : f);
    const bytes = await Promise.all(converted.map(f => f.arrayBuffer()));
    setName(converted.length > 1 ? 'Documenti uniti.pdf' : converted[0].name);
    setSignatures([]); setHistory([]); setSource(new Uint8Array(bytes.length > 1 ? await unisciPdf(bytes) : bytes[0]));
    dirtyRef.current = files.some(f => f.type.startsWith('image/')) || files.length > 1;
  }
  useEffect(() => { if (initialFile || initialFiles?.length) void run('Apro il documento…', () => importFiles(initialFiles || [initialFile])); }, [initialFile, initialFiles]);
  useEffect(() => {
    if (!source) return undefined;
    let cancelled = false; const abort = new AbortController();
    setReady(false); setExportFile(null); setPage(1); setMode(0);
    const bus = new EventBus(), link = new PDFLinkService({ eventBus: bus, externalLinkTarget: 2, externalLinkRel: 'noopener noreferrer' });
    const find = new PDFFindController({ eventBus: bus, linkService: link });
    const viewer = new PDFViewer({ container: container.current, viewer: pagesElement.current, eventBus: bus, linkService: link, findController: find, annotationEditorMode: pdfjs.AnnotationEditorType.NONE, annotationMode: pdfjs.AnnotationMode.ENABLE_FORMS, maxCanvasPixels: 4096 * 4096, abortSignal: abort.signal });
    link.setViewer(viewer);
    bus.on('pagesinit', () => { viewer.currentScaleValue = 'page-width'; setCount(viewer.pagesCount); setReady(true); });
    bus.on('pagechanging', e => setPage(e.pageNumber)); bus.on('scalechanging', e => setZoom(e.scale));
    bus.on('pagerendered', () => repaint(n => n + 1));
    bus.on('annotationeditorstateschanged', e => { if (!e.details?.isEmpty) setExportFile(null); });
    const task = pdfjs.getDocument({ data: source.slice(), isEvalSupported: false, enableXfa: false });
    task.onPassword = (update, reason) => { if (!cancelled) setPassword({ update, wrong: reason === pdfjs.PasswordResponses.INCORRECT_PASSWORD }); };
    runtime.current = { viewer, bus, task, doc: null };
    task.promise.then(async doc => {
      if (cancelled) return;
      runtime.current.doc = doc; doc.annotationStorage.onSetModified = markDirty;
      link.setDocument(doc); viewer.setDocument(doc);
      if (doc.isPureXfa) setMessage('Modulo XFA non supportato: usa l’applicazione che lo ha prodotto.');
    }).catch(e => { if (!cancelled) setError(e.message || 'PDF non leggibile.'); });
    return () => { cancelled = true; abort.abort(); viewer.setDocument(null); link.setDocument(null); void task.destroy(); runtime.current = null; };
  }, [source]);
  // Pinch changes PDF scale, not the app chrome; PDFViewer keeps rendering progressive.
  useEffect(() => {
    const el = container.current; if (!el) return undefined; let gesture = null;
    const start = e => { if (e.touches.length !== 2 || !runtime.current) return; const [a,b] = e.touches; gesture = { distance: distanza(a,b), scale: runtime.current.viewer.currentScale }; };
    const move = e => { if (!gesture || e.touches.length !== 2) return; e.preventDefault(); const v = runtime.current.viewer, old = v.currentScale; const scale = Math.max(.3, Math.min(4, gesture.scale * distanza(...e.touches) / gesture.distance)); const rect = el.getBoundingClientRect(), x = (e.touches[0].clientX + e.touches[1].clientX)/2 - rect.left, y = (e.touches[0].clientY + e.touches[1].clientY)/2 - rect.top, top = el.scrollTop, left = el.scrollLeft; v.currentScale = scale; el.scrollTop = (top + y) * scale / old - y; el.scrollLeft = (left + x) * scale / old - x; };
    const end = () => { gesture = null; };
    el.addEventListener('touchstart', start, { passive: true }); el.addEventListener('touchmove', move, { passive: false }); el.addEventListener('touchend', end); el.addEventListener('touchcancel', end);
    return () => { el.removeEventListener('touchstart', start); el.removeEventListener('touchmove', move); el.removeEventListener('touchend', end); el.removeEventListener('touchcancel', end); };
  }, []);
  const selectMode = value => { const rt = runtime.current; rt.viewer.annotationEditorMode = { mode: value }; setMode(value);
    // Readable default on phone: 14 pt free text instead of PDF.js' 10 pt.
    if (value === pdfjs.AnnotationEditorType.FREETEXT) rt.bus.dispatch('switchannotationeditorparams', { source: rt.viewer, type: pdfjs.AnnotationEditorParamsType.FREETEXT_SIZE, value: 14 }); };
  async function bytesWithEdits() {
    const rt = runtime.current; if (!rt?.doc) throw new Error('Attendi il caricamento del PDF.');
    selectMode(pdfjs.AnnotationEditorType.NONE); document.activeElement?.blur();
    const bytes = await rt.doc.saveDocument();
    return incorporaFirme(bytes, await Promise.all(signatures.map(async s => { const p = await rt.doc.getPage(s.page); return { ...s, position: posizioneFirma(s, p.getViewport({ scale: 1 })) }; })));
  }
  async function replaceWith(bytes) {
    const previous = await bytesWithEdits(); setHistory(h => [...h.slice(-3), previous]); setSignatures([]); setSource(bytes); setOrganize(null); markDirty();
  }
  // DOCK-PER-TE passo 2: dal documento si arriva già con lo strumento scelto (Firma, Modifica, Pagine).
  const strumentoUsato = useRef(false);
  useEffect(() => {
    if (!ready || strumentoUsato.current || !strumento) return;
    strumentoUsato.current = true;
    if (strumento === 'firma') setSignatureOpen(true);
    else if (strumento === 'modifica') selectMode(pdfjs.AnnotationEditorType.FREETEXT);
    else if (strumento === 'pagine') setOrganize(Array.from({ length: count }, (_, index) => ({ index, rotation: 0 })));
  }, [ready, strumento, count]); // eslint-disable-line react-hooks/exhaustive-deps
  const archive = () => { dirtyRef.current = false; onArchive(exportFile); };
  const editing = ready && !busy;
  return createPortal(<div ref={root} className="pdf-manager" role="dialog" aria-modal="true" aria-label="Gestore PDF" onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
    <header className="pdf-header"><button onClick={requestClose} disabled={!!busy}>Chiudi</button><div><strong>{title || name}</strong><small>Poliedron · PDF</small></div>{onInfo && <button onClick={() => { if (dirtyRef.current) setMessage('Salva o chiudi le modifiche prima di aprire le informazioni.'); else onInfo(); }}>Info</button>}<button disabled={!editing} className="pdf-primary" onClick={() => run('Preparo la copia…', async () => { const bytes = await bytesWithEdits(); setExportFile(new File([bytes], nomeCopia(name), { type: 'application/pdf' })); })}>Condividi</button></header>
    <div className="pdf-navigation"><button disabled={!editing || page === 1} aria-label="Pagina precedente" onClick={() => { runtime.current.viewer.currentPageNumber = page - 1; }}>‹</button><label>Pagina <input aria-label="Numero pagina" type="number" min="1" max={count} value={page} disabled={!editing} onChange={e => { const n = Number(e.target.value); if (n >= 1 && n <= count) runtime.current.viewer.currentPageNumber = n; }} /> / {count}</label><button disabled={!editing || page === count} aria-label="Pagina successiva" onClick={() => { runtime.current.viewer.currentPageNumber = page + 1; }}>›</button><button disabled={!editing} aria-label="Riduci zoom" onClick={() => { runtime.current.viewer.currentScale = Math.max(.3, zoom / 1.2); }}>−</button><button disabled={!editing} onClick={() => { runtime.current.viewer.currentScaleValue = 'page-width'; }}>{Math.round(zoom * 100)}%</button><button disabled={!editing} aria-label="Aumenta zoom" onClick={() => { runtime.current.viewer.currentScale = Math.min(4, zoom * 1.2); }}>+</button><button disabled={!editing} aria-label="Cerca nel testo" aria-expanded={searchOpen} onClick={() => setSearchOpen(o => !o)}>⌕</button></div>
    {searchOpen && <div className="pdf-search"><input autoFocus aria-label="Cerca nel PDF" placeholder="Cerca nel testo…" value={query} disabled={!editing} onChange={e => setQuery(e.target.value)} /><button disabled={!editing || !query} onClick={() => runtime.current.bus.dispatch('find', { source: runtime.current.viewer, type: 'again', query, caseSensitive: false, entireWord: false, highlightAll: true, findPrevious: false })}>Trova</button></div>}
    <main className="pdf-stage"><div className="pdf-scroll" ref={container} onInput={markDirty}><div className="pdfViewer" ref={pagesElement} /></div>
      {!source && <div className="pdf-empty"><h1>I tuoi PDF, qui.</h1><p>Apri, compila, firma e organizza. Il documento resta sul dispositivo finché scegli di condividerlo o archiviarlo.</p><button className="pdf-primary" disabled={!!busy} onClick={() => chooser.current.click()}>Apri PDF o foto</button><p>Puoi scegliere più foto per creare un PDF.</p></div>}
    </main>
    <div className="pdf-tools" aria-label="Strumenti PDF">{MODES.slice(0, 1).map(([label, value]) => <button key={value} disabled={!editing} aria-pressed={mode === value} onClick={() => selectMode(value)}>{label}</button>)}<button disabled={!editing} onClick={() => { selectMode(0); setSignatureOpen(true); }}>Firma</button>{MODES.slice(1).map(([label, value]) => <button key={value} disabled={!editing} aria-pressed={mode === value} onClick={() => selectMode(value)}>{label}</button>)}<button disabled={!editing} onClick={() => { runtime.current.bus.dispatch('editingaction', { source: runtime.current.viewer, name: 'undo' }); markDirty(); }}>Annulla</button><button disabled={!editing} onClick={() => setOrganize(Array.from({ length: count }, (_, index) => ({ index, rotation: 0 })))}>Pagine</button></div>
    {ready && signatures.map(s => { const pv = runtime.current?.viewer.getPageView(s.page - 1); return pv && <FirmaPagina key={s.id} signature={s} pageView={pv} editable={mode === 0 && !busy && !exportFile} onChange={next => { setSignatures(all => all.map(x => x.id === s.id ? next : x)); markDirty(); }} onRemove={() => { setSignatures(all => all.filter(x => x.id !== s.id)); markDirty(); }} />; })}
    <input ref={chooser} type="file" accept="application/pdf,image/*" multiple hidden onChange={e => { const files = [...e.target.files]; e.target.value = ''; void run('Preparo il documento…', () => importFiles(files)); }} />
    <input ref={merger} type="file" accept="application/pdf" multiple hidden onChange={e => { const files = [...e.target.files]; e.target.value = ''; if (!files.length) return; void run('Unisco i PDF…', async () => { files.forEach(validaFile); if (files.reduce((n,f) => n + f.size, source.length) > 40*1024*1024) throw new Error('Il totale supera 40 MB.'); const bytes = await bytesWithEdits(); await replaceWith(await unisciPdf([bytes, ...await Promise.all(files.map(f => f.arrayBuffer()))])); }); }} />
    {(busy || error || message) && <div className="pdf-status" role={error ? 'alert' : 'status'}>{busy || error || message}{!busy && <button aria-label="Chiudi avviso" onClick={() => { setMessage(''); setError(''); }}>×</button>}</div>}
    {signatureOpen && <div className="pdf-scrim"><Firma onChiudi={() => setSignatureOpen(false)} onUsa={png => { setSignatureOpen(false); void run('', async () => { const size = await misuraImmagine(png), view = runtime.current?.viewer.getPageView(page - 1)?.viewport; const width = .34, height = view ? width * (size.height / size.width) * (view.width / view.height) : .1; setSignatures(all => [...all, limitaFirma({ id: crypto.randomUUID(), page, png, x: .5, y: .72, width, height })]); markDirty(); setMessage('Trascina la firma dove serve. Usa l’angolo ↘ per ridimensionarla.'); }); }} /></div>}
    {exportFile && <div className="pdf-scrim"><section className="pdf-sheet" role="dialog" aria-label="Salva copia PDF"><h2>Condividi o salva</h2><p>{exportFile.name}</p><p>L’originale resta intatto. Scegli dove salvare questa versione.</p><button className="pdf-primary" onClick={() => run('Condivisione…', async () => { const result = await condividiCopia(exportFile); if (result === 'non_disponibile') throw new Error('Condivisione file non disponibile: usa Scarica.'); if (result === 'condiviso') { dirtyRef.current = false; setMessage('Copia condivisa.'); } })}>Condividi PDF</button><button onClick={() => { scaricaDocumento(exportFile); setMessage('Download avviato. Verifica il file nei download del telefono.'); }}>Scarica PDF</button>{onArchive && <button onClick={archive}>Salva nell’archivio come nuovo file</button>}<button onClick={() => setExportFile(null)}>Torna al documento</button></section></div>}
    {organize && <div className="pdf-scrim"><section className="pdf-sheet" role="dialog" aria-label="Organizza pagine"><h2>Organizza pagine</h2><p>Unione e riordino fissano i campi compilati: il loro testo resta visibile, ma non sarà più un modulo modificabile. Le firme digitali preesistenti possono perdere validità. L’originale resta intatto.</p><div className="pdf-page-list">{organize.map((p,i) => <div className="pdf-row" key={p.index}><strong>Pagina {p.index+1}</strong><span>{p.rotation}°</span><button disabled={!i} aria-label={`Sposta pagina ${p.index+1} prima`} onClick={() => setOrganize(riordina(organize,i,i-1))}>↑</button><button disabled={i===organize.length-1} aria-label={`Sposta pagina ${p.index+1} dopo`} onClick={() => setOrganize(riordina(organize,i,i+1))}>↓</button><button aria-label={`Ruota pagina ${p.index+1}`} onClick={() => setOrganize(organize.map((x,j) => j===i ? {...x,rotation:(x.rotation+90)%360}:x))}>↻</button><button disabled={organize.length===1} aria-label={`Elimina pagina ${p.index+1} dalla copia`} onClick={() => setOrganize(organize.filter((_,j)=>i!==j))}>×</button></div>)}</div><button disabled={!!busy} className="pdf-primary" onClick={() => run('Aggiorno le pagine…', async () => { const bytes=await bytesWithEdits(); await replaceWith(await organizzaPdf(bytes,organize)); })}>Applica alla copia</button><button disabled={!!busy} onClick={() => merger.current.click()}>Aggiungi altri PDF in fondo</button>{history.length>0 && <button disabled={!!busy} onClick={() => { setSource(history.at(-1)); setHistory(h=>h.slice(0,-1)); setSignatures([]); setOrganize(null); markDirty(); }}>Annulla ultima modifica pagine</button>}<button disabled={!!busy} onClick={() => setOrganize(null)}>Indietro</button></section></div>}
    {confirmClose && <div className="pdf-scrim"><section className="pdf-sheet" role="alertdialog" aria-label="Modifiche non salvate"><h2>Chiudere il documento?</h2><p>Le modifiche non esportate andranno perse. L’originale non cambia.</p><button onClick={() => setConfirmClose(false)}>Continua a lavorare</button><button onClick={() => { dirtyRef.current=false; closeRef.current(); }}>Chiudi senza salvare</button></section></div>}
    {password && <div className="pdf-scrim"><form className="pdf-sheet" onSubmit={e=>{ e.preventDefault(); password.update(passwordText); setPassword(null); setPasswordText(''); }}><h2>Password del PDF</h2>{password.wrong && <p>Password errata, riprova.</p>}<input aria-label="Password PDF" type="password" value={passwordText} onChange={e=>setPasswordText(e.target.value)} autoFocus /><button type="submit">Apri</button><button type="button" onClick={()=>{ void runtime.current?.task.destroy(); setPassword(null); setBusy(''); setError('Apertura annullata.'); }}>Annulla</button></form></div>}
  </div>, document.body);
}
