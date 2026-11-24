import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as pdfjs from 'pdfjs-personal/build/pdf.mjs';
import workerUrl from 'pdfjs-personal/build/pdf.worker.min.mjs?url';
import { EventBus, PDFViewer, PDFLinkService, PDFFindController } from 'pdfjs-personal/web/pdf_viewer.mjs';
import 'pdfjs-personal/web/pdf_viewer.css';
import './pdf.css';
import { Firma } from './Firma.jsx';
import { EditorTesto } from './EditorTesto.jsx';
import { COLORI_TESTO, CARATTERI, normalizzaStile, fontCss, righe, riquadroTesto, limitaPosizione, grandezzaDaLarghezza } from './testoPdf.js';
import { SalvaArchivio } from './SalvaArchivio.jsx';
import { CompilaCampi } from './CompilaCampi.jsx';
import { validaFile, limitaFirma, posizioneFirma, incorporaFirme, organizzaPdf, unisciPdf, riordina, nomeCopia, nomeDocumento, pagineDaIntervallo, condividiCopia, posizioniInserimento, formatoPeso } from './operazioni.js';
import { distanza } from '../lib/pinchZoom.js';
import { tipoFile } from '../lib/pdfUnico.js';
import { elaboraPagina, creaPdf } from '../lib/scansione.js';
import { scaricaDocumento } from '../lib/condividi.js';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
const misuraImmagine = src => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 }); img.onerror = () => reject(new Error('Firma non leggibile.')); img.src = src; });
// PDF-TESTO (PO 2026-11-24): «Testo» non usa più l'editor di PDF.js (difficile da spostare, senza scelte):
// è un elemento come la firma, con carattere, colore e grandezza, scritto nel PDF come testo vero.
const MODES = [['Leggi', pdfjs.AnnotationEditorType.NONE], ['Disegno', pdfjs.AnnotationEditorType.INK], ['Evidenzia', pdfjs.AnnotationEditorType.HIGHLIGHT]];
// Larghezza di una riga a grandezza 1 (pt), con la stessa famiglia metrica del PDF (Arial = Helvetica…).
let tela = null;
export const misuraRiga = (riga, stile) => { tela = tela || document.createElement('canvas').getContext('2d'); tela.font = fontCss(stile, 100); return tela.measureText(riga).width / 100; };
const pagina_pt = pv => ({ w: pv.viewport.width / pv.viewport.scale, h: pv.viewport.height / pv.viewport.scale });

function FirmaPagina({ signature, pageView, onChange, onRemove, onEdit, editable }) {
  const gesture = useRef(null);
  // Keep React-owned DOM in its own host: PDF.js may replace page children on zoom.
  const [host] = useState(() => { const el = document.createElement('div'); el.className = 'pdf-signature-host'; return el; });
  useLayoutEffect(() => { if (host.parentNode !== pageView.div) pageView.div.appendChild(host); });
  useEffect(() => () => host.remove(), [host]);
  const testo = signature.testo != null;
  const start = (e, resize) => { if (!editable) return; e.stopPropagation(); e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); gesture.current = { x: e.clientX, y: e.clientY, resize, original: signature, mosso: false }; };
  const move = e => {
    const g = gesture.current; if (!g) return; e.stopPropagation();
    if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > 6) g.mosso = true;
    if (!g.mosso) return;
    const r = pageView.div.getBoundingClientRect(), dx = (e.clientX - g.x) / r.width, dy = (e.clientY - g.y) / r.height;
    const s = g.original;
    if (testo) {
      // PDF-TESTO: ↘ cambia la grandezza (il riquadro segue il testo), trascinare sposta.
      if (!g.resize) return onChange(limitaPosizione({ ...s, x: s.x + dx, y: s.y + dy }));
      const stile = { ...s.stile, grandezza: grandezzaDaLarghezza(s.stile, s.width, s.width + dx) };
      return onChange(limitaPosizione({ ...s, stile, ...riquadroTesto(s.testo, stile, pagina_pt(pageView), misuraRiga) }));
    }
    onChange(limitaFirma(g.resize ? { ...s, width: s.width + dx, height: s.height + dy } : { ...s, x: s.x + dx, y: s.y + dy }));
  };
  // Un tocco senza trascinare su un testo lo apre per modificarlo.
  const stop = e => { e.stopPropagation(); const g = gesture.current; gesture.current = null; if (g && !g.mosso && !g.resize && testo && e.type === 'pointerup') onEdit?.(); };
  const altezzaPx = pageView.viewport.height * signature.height;
  return createPortal(<div className={`pdf-signature${testo ? ' pdf-testo' : ''}`} style={{ left: `${signature.x * 100}%`, top: `${signature.y * 100}%`, width: `${signature.width * 100}%`, height: `${signature.height * 100}%`, pointerEvents: editable ? 'auto' : 'none', ...(editable ? {} : { borderColor: 'transparent' }) }}
    onPointerDown={e => start(e, false)} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop}>
    {testo
      ? <div className="pdf-testo-righe" role="img" aria-label={`Testo: ${signature.testo}`} style={{ font: fontCss(normalizzaStile(signature.stile), altezzaPx / (righe(signature.testo).length * 1.2)), lineHeight: 1.2, color: COLORI_TESTO[normalizzaStile(signature.stile).colore] }}>{signature.testo}</div>
      : <img src={signature.png} alt="Firma posizionata" draggable="false" />}
    {editable && <><button className="pdf-signature-remove" aria-label={testo ? 'Rimuovi testo dalla pagina' : 'Rimuovi firma dalla pagina'} onPointerDown={e => e.stopPropagation()} onClick={onRemove}>×</button>
    {testo && <button className="pdf-testo-modifica" aria-label="Modifica testo" onPointerDown={e => e.stopPropagation()} onClick={onEdit}>✎</button>}
    <button className="pdf-signature-resize" aria-label={testo ? 'Cambia grandezza del testo' : 'Ridimensiona firma'} onPointerDown={e => start(e, true)} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop}>↘</button></>}
  </div>, host);
}

export function GestorePdf({ file: initialFile, files: initialFiles, onClose, onArchive, onSave, onInfo, title, strumento, onEsporta, ctx, origine, onApriDocumento }) {
  const root = useRef(null), container = useRef(null), pagesElement = useRef(null), runtime = useRef(null);
  const chooser = useRef(null), merger = useRef(null), alive = useRef(true), dirtyRef = useRef(false);
  const [source, setSource] = useState(null), [name, setName] = useState(initialFile?.name || 'Documento.pdf');
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [ready, setReady] = useState(false), [page, setPage] = useState(1), [count, setCount] = useState(0), [zoom, setZoom] = useState(1);
  const [mode, setMode] = useState(0), [signatures, setSignatures] = useState([]), [signatureOpen, setSignatureOpen] = useState(false);
  const [exportFile, setExportFile] = useState(null), [organize, setOrganize] = useState(null), [query, setQuery] = useState('');
  const [confirmClose, setConfirmClose] = useState(false), [password, setPassword] = useState(null), [passwordText, setPasswordText] = useState('');
  const [exportPartial, setExportPartial] = useState(false);
  const [rename, setRename] = useState(null), [renamed, setRenamed] = useState(false);
  const [range, setRange] = useState(''), [thumbnails, setThumbnails] = useState({});
  const [history, setHistory] = useState([]), [, repaint] = useState(0), [searchOpen, setSearchOpen] = useState(false);
  const [compress, setCompress] = useState(false);
  // DOCUMENTI-FIRMATI: firmato in questa sessione (firma o sigla) → titolo «… firmato», cartella Documenti firmati.
  const firmatoRef = useRef(false), [salvaArchivio, setSalvaArchivio] = useState(null);
  const [compila, setCompila] = useState(false);
  const [testoAperto, setTestoAperto] = useState(null); // PDF-TESTO: null | {} nuovo | elemento da modificare
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
    setRenamed(false); setMessage(''); setThumbnails({});
    if (files.reduce((n, f) => n + f.size, 0) > 40 * 1024 * 1024) throw new Error('Seleziona al massimo 40 MB per volta.');
    const converted = [];
    for (const f of files) converted.push(tipoFile(f) === 'immagine' ? await creaPdf([await elaboraPagina(f, { modo: 'originale' })], f.name) : f);
    const bytes = await Promise.all(converted.map(f => f.arrayBuffer()));
    setName(converted.length > 1 ? 'Documenti uniti.pdf' : converted[0].name);
    setSignatures([]); setHistory([]); setSource(new Uint8Array(bytes.length > 1 ? await unisciPdf(bytes) : bytes[0]));
    dirtyRef.current = files.some(f => tipoFile(f) === 'immagine') || files.length > 1;
  }
  useEffect(() => { if (initialFile || initialFiles?.length) void run('Apro il documento…', () => importFiles(initialFiles || [initialFile])); }, [initialFile, initialFiles]);
  useEffect(() => {
    if (!source) return undefined;
    let cancelled = false; const abort = new AbortController();
    setReady(false); setExportFile(null); setThumbnails({}); setPage(1); setMode(0);
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
  const selectMode = value => { const rt = runtime.current; rt.viewer.annotationEditorMode = { mode: value }; setMode(value); };
  // PDF-TESTO: nuovo testo al centro della pagina corrente (in alto), oppure modifica di quello toccato.
  const applicaTesto = ({ testo, stile }) => {
    const aperto = testoAperto; setTestoAperto(null);
    const n = aperto?.page || page, pv = runtime.current?.viewer.getPageView(n - 1); if (!pv) return;
    const misure = riquadroTesto(testo, normalizzaStile(stile), pagina_pt(pv), misuraRiga);
    if (aperto?.id) setSignatures(all => all.map(x => x.id === aperto.id ? limitaPosizione({ ...x, testo, stile, ...misure }) : x));
    else { setSignatures(all => [...all, limitaPosizione({ id: crypto.randomUUID(), page: n, testo, stile, ...misure, x: (1 - misure.width) / 2, y: .3 })]); setMessage('Trascina il testo dove serve. ↘ cambia la grandezza, ✎ o un tocco lo modifica.'); }
    markDirty();
  };
  async function bytesWithEdits() {
    const rt = runtime.current; if (!rt?.doc) throw new Error('Attendi il caricamento del PDF.');
    selectMode(pdfjs.AnnotationEditorType.NONE); document.activeElement?.blur();
    const bytes = await rt.doc.saveDocument();
    return incorporaFirme(bytes, await Promise.all(signatures.map(async s => { const p = await rt.doc.getPage(s.page); return { ...s, position: posizioneFirma(s, p.getViewport({ scale: 1 })) }; })));
  }
  async function replaceWith(bytes) {
    const previous = await bytesWithEdits(); setHistory(h => [...h.slice(-3), previous]); setSignatures([]); setSource(bytes); setOrganize(null); markDirty();
  }
  // SCAN-PDF-MANAGER: OCR e compressione lavorano sulla copia con le modifiche già fissate.
  async function transform(fn) {
    const previous = await bytesWithEdits(); const next = await fn(previous); if (!next || !alive.current) return;
    setHistory(h => [...h.slice(-3), previous]); setSignatures([]); setSource(next instanceof Uint8Array ? next : new Uint8Array(next)); setOrganize(null); markDirty();
  }
  const ocr = () => run('Leggo il testo…', () => transform(async bytes => {
    const { rendiRicercabile } = await import('./ocr.js');
    const r = await rendiRicercabile(bytes, { onAvanzamento: m => alive.current && setBusy(m) });
    if (!r.parole) { setMessage('Nessun testo nuovo da riconoscere: il PDF è già ricercabile oppure la scansione non è leggibile.'); return null; }
    setMessage(`Testo riconosciuto: ${r.parole} parole in ${r.pagine} ${r.pagine === 1 ? 'pagina' : 'pagine'}. Ora puoi cercarlo con ⌕ e copiarlo.${r.oltre ? ' Lette solo le prime 30 pagine.' : ''}`);
    return r.bytes;
  }));
  const comprimi = livello => { setCompress(false); void run('Comprimo…', () => transform(async bytes => {
    const { comprimiPdf } = await import('./comprimi.js');
    const r = await comprimiPdf(bytes, { livello, titolo: name.replace(/\.pdf$/i, ''), onAvanzamento: m => alive.current && setBusy(m) });
    if (!r.ridotto) { setMessage(`Già leggero (${formatoPeso(r.prima)}): compresso peserebbe ${formatoPeso(r.dopo)}, lasciato com’è.`); return null; }
    setMessage(`PDF compresso: da ${formatoPeso(r.prima)} a ${formatoPeso(r.dopo)}. Per renderlo di nuovo ricercabile usa «Testo (OCR)».`);
    return r.bytes;
  })); };
  const inserisci = (png, { tipo = 'firma', tutte = false } = {}) => { setSignatureOpen(false); void run('', async () => {
    const size = await misuraImmagine(png), viewer = runtime.current?.viewer;
    const aspetto = n => { const v = viewer?.getPageView(n - 1)?.viewport; return v ? v.width / v.height : 210 / 297; };
    const nuove = posizioniInserimento({ tipo, tutte, pagina: page, pagine: count, proporzione: size.height / size.width, aspetto }).map(p => ({ ...p, id: crypto.randomUUID(), png }));
    setSignatures(all => [...all, ...nuove]); markDirty(); if (tipo !== 'data') firmatoRef.current = true;
    setMessage(nuove.length > 1 ? `Inserita su ${nuove.length} pagine. Trascinala per spostarla su una pagina.` : 'Trascina dove serve. Usa l’angolo ↘ per ridimensionare.');
  }); };
  // DOCK-PER-TE passo 2: dal documento si arriva già con lo strumento scelto (Firma, Modifica, Pagine).
  const strumentoUsato = useRef(false);
  useEffect(() => {
    if (!ready || strumentoUsato.current || !strumento) return;
    strumentoUsato.current = true;
    if (strumento === 'firma') setSignatureOpen(true);
    else if (strumento === 'modifica') setTestoAperto({});
    else if (strumento === 'compila') setCompila(true);
    else if (strumento === 'comprimi') setCompress(true); // SCAN-HUB: «Comprimi PDF» dalla Home di Scan
    else if (strumento === 'pagine') setOrganize(Array.from({ length: count }, (_, index) => ({ index, rotation: 0 })));
  }, [ready, strumento, count]); // eslint-disable-line react-hooks/exhaustive-deps
  // Con il contesto dell'app: il foglio semplice (titolo, cartella, altro facoltativo); senza, la pagina di prima.
  // COMPILA-CAMPI: i valori vanno nei campi del modulo (memoria di PDF.js e casella sullo schermo).
  const inserisciCampi = righe => {
    const rt = runtime.current; if (!rt?.doc) return;
    let n = 0;
    for (const r of righe) for (const id of r.ids) {
      rt.doc.annotationStorage.setValue(id, { value: r.valore });
      root.current?.querySelectorAll(`[data-element-id="${id}"]`).forEach(el => { if ('value' in el) el.value = r.valore; });
      n++;
    }
    setCompila(false); markDirty();
    setMessage(`${righe.length} ${righe.length === 1 ? 'campo compilato' : 'campi compilati'}${n > righe.length ? ` (${n} caselle)` : ''}. Controlla il modulo, poi Salva / Invia.`);
  };
  const archive = () => { if (ctx) { setMessage(''); setError(''); setSalvaArchivio({ file: exportFile }); return; } onArchive(exportFile); if (!exportPartial) dirtyRef.current = false; };
  // Prime righe del PDF per il titolo suggerito (le pagine scansionate senza testo non ne danno).
  const testoPdf = async () => {
    const doc = runtime.current?.doc; if (!doc) return '';
    let testo = '';
    for (let n = 1; n <= Math.min(2, doc.numPages) && testo.length < 3000; n++) testo += ' ' + (await (await doc.getPage(n)).getTextContent()).items.map(i => i.str).join(' ');
    return testo.replace(/\s+/g, ' ').trim().slice(0, 3000);
  };
  useEffect(() => {
    if (!organize || !ready) return undefined;
    let cancelled = false, renderTask;
    const doc = runtime.current?.doc;
    (async () => {
      // Bound work for large PDFs; all pages remain accessible by number.
      for (const p of organize.slice(0, 60)) {
        const page = await doc.getPage(p.index + 1);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 110 / page.getViewport({ scale: 1 }).width });
        const canvas = document.createElement('canvas'); canvas.width = viewport.width; canvas.height = viewport.height;
        renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport, annotationMode: pdfjs.AnnotationMode.ENABLE });
        await renderTask.promise; if (cancelled) return;
        const url = canvas.toDataURL(); canvas.width = canvas.height = 0;
        setThumbnails(t => ({ ...t, [p.index]: url }));
      }
    })().catch(e => { if (!cancelled) setError(e.message || 'Anteprime non disponibili.'); });
    return () => { cancelled = true; renderTask?.cancel(); };
  }, [!!organize, ready, source]); // eslint-disable-line react-hooks/exhaustive-deps
  const editing = ready && !busy;
  return createPortal(<div ref={root} className="pdf-manager" role="dialog" aria-modal="true" aria-label="Gestore PDF" onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
    <header className="pdf-header"><button onClick={requestClose} disabled={!!busy}>Chiudi</button><div><strong>{renamed ? name : title || name}</strong><small>Poliedron · PDF</small></div>{onInfo && <button onClick={() => { if (dirtyRef.current) setMessage('Salva o chiudi le modifiche prima di aprire le informazioni.'); else onInfo(); }}>Info</button>}<button disabled={!editing} className="pdf-primary" onClick={() => run('Preparo la copia…', async () => { const bytes = await bytesWithEdits(); setExportPartial(false); setExportFile(new File([bytes], renamed ? nomeDocumento(name) : nomeCopia(name), { type: 'application/pdf' })); })}>Salva / Invia</button></header>
    <div className="pdf-navigation"><button disabled={!editing || page === 1} aria-label="Pagina precedente" onClick={() => { runtime.current.viewer.currentPageNumber = page - 1; }}>‹</button><label>Pagina <input aria-label="Numero pagina" type="number" min="1" max={count} value={page} disabled={!editing} onChange={e => { const n = Number(e.target.value); if (n >= 1 && n <= count) runtime.current.viewer.currentPageNumber = n; }} /> / {count}</label><button disabled={!editing || page === count} aria-label="Pagina successiva" onClick={() => { runtime.current.viewer.currentPageNumber = page + 1; }}>›</button><button disabled={!editing} aria-label="Riduci zoom" onClick={() => { runtime.current.viewer.currentScale = Math.max(.3, zoom / 1.2); }}>−</button><button disabled={!editing} onClick={() => { runtime.current.viewer.currentScaleValue = 'page-width'; }}>{Math.round(zoom * 100)}%</button><button disabled={!editing} aria-label="Aumenta zoom" onClick={() => { runtime.current.viewer.currentScale = Math.min(4, zoom * 1.2); }}>+</button><button disabled={!editing} aria-label="Cerca nel testo" aria-expanded={searchOpen} onClick={() => setSearchOpen(o => !o)}>⌕</button></div>
    {searchOpen && <div className="pdf-search"><input autoFocus aria-label="Cerca nel PDF" placeholder="Cerca nel testo…" value={query} disabled={!editing} onChange={e => setQuery(e.target.value)} /><button disabled={!editing || !query} onClick={() => runtime.current.bus.dispatch('find', { source: runtime.current.viewer, type: 'again', query, caseSensitive: false, entireWord: false, highlightAll: true, findPrevious: false })}>Trova</button></div>}
    <main className="pdf-stage"><div className="pdf-scroll" ref={container} onInput={markDirty}><div className="pdfViewer" ref={pagesElement} /></div>
      {!source && <div className="pdf-empty"><h1>I tuoi PDF, qui.</h1><p>Apri, compila, firma e organizza. Il documento resta sul dispositivo finché scegli di condividerlo o archiviarlo.</p><button className="pdf-primary" disabled={!!busy} onClick={() => chooser.current.click()}>Apri PDF o foto</button><p>Puoi scegliere più foto per creare un PDF.</p></div>}
    </main>
    <div className="pdf-tools" aria-label="Strumenti PDF"><button disabled={!editing} onClick={() => setRename(name.replace(/\.pdf$/i, ''))}>Rinomina</button>{MODES.slice(0, 1).map(([label, value]) => <button key={value} disabled={!editing} aria-pressed={mode === value} onClick={() => selectMode(value)}>{label}</button>)}<button disabled={!editing} onClick={() => { selectMode(0); setTestoAperto({}); }}>Testo</button><button disabled={!editing} onClick={() => { selectMode(0); setSignatureOpen(true); }}>Firma</button><button disabled={!editing} onClick={() => { selectMode(0); setCompila(true); }}>Compila</button>{MODES.slice(1).map(([label, value]) => <button key={value} disabled={!editing} aria-pressed={mode === value} onClick={() => selectMode(value)}>{label}</button>)}<button disabled={!editing} onClick={() => { runtime.current.bus.dispatch('editingaction', { source: runtime.current.viewer, name: 'undo' }); markDirty(); }}>Annulla</button><button disabled={!editing} onClick={() => setOrganize(Array.from({ length: count }, (_, index) => ({ index, rotation: 0 })))}>Pagine</button><button disabled={!editing} onClick={ocr}>Testo (OCR)</button><button disabled={!editing} onClick={() => setCompress(true)}>Comprimi</button>{history.length > 0 && <button disabled={!editing} onClick={() => { setSource(history.at(-1)); setHistory(h => h.slice(0, -1)); setSignatures([]); markDirty(); setMessage('Ultima modifica annullata.'); }}>Ripristina prima</button>}</div>
    {ready && signatures.map(s => { const pv = runtime.current?.viewer.getPageView(s.page - 1); return pv && <FirmaPagina key={s.id} signature={s} pageView={pv} editable={mode === 0 && !busy && !exportFile} onChange={next => { setSignatures(all => all.map(x => x.id === s.id ? next : x)); markDirty(); }} onRemove={() => { setSignatures(all => all.filter(x => x.id !== s.id)); markDirty(); }} onEdit={() => setTestoAperto(s)} />; })}
    <input ref={chooser} type="file" accept="application/pdf,image/*" multiple hidden onChange={e => { const files = [...e.target.files]; e.target.value = ''; void run('Preparo il documento…', () => importFiles(files)); }} />
    <input ref={merger} type="file" accept="application/pdf" multiple hidden onChange={e => { const files = [...e.target.files]; e.target.value = ''; if (!files.length) return; void run('Unisco i PDF…', async () => { files.forEach(validaFile); if (files.reduce((n,f) => n + f.size, source.length) > 40*1024*1024) throw new Error('Il totale supera 40 MB.'); const bytes = await bytesWithEdits(); await replaceWith(await unisciPdf([bytes, ...await Promise.all(files.map(f => f.arrayBuffer()))])); }); }} />
    {(busy || error || message) && <div className="pdf-status" role={error ? 'alert' : 'status'}>{busy || error || message}{!busy && <button aria-label="Chiudi avviso" onClick={() => { setMessage(''); setError(''); }}>×</button>}</div>}
    {testoAperto && <div className="pdf-scrim"><EditorTesto iniziale={testoAperto} onApplica={applicaTesto} onChiudi={() => setTestoAperto(null)} onElimina={() => { const id = testoAperto.id; setTestoAperto(null); setSignatures(all => all.filter(x => x.id !== id)); markDirty(); }} /></div>}
    {signatureOpen && <div className="pdf-scrim"><Firma pagine={count} onChiudi={() => setSignatureOpen(false)} onUsa={inserisci} /></div>}
    {exportFile && !salvaArchivio && <div className="pdf-scrim"><section className="pdf-sheet" role="dialog" aria-label="Salva copia PDF"><h2>Condividi o salva</h2><p>{exportFile.name} <span className="pdf-peso">· {formatoPeso(exportFile.size)}</span></p><p>L’originale resta intatto. Scegli dove salvare questa versione.</p><button disabled={!!busy} className="pdf-primary" onClick={() => run('Condivisione…', async () => { const result = await condividiCopia(exportFile); if (result === 'non_disponibile') throw new Error('Condivisione file non disponibile: usa Scarica.'); if (result === 'condiviso') { onEsporta?.(exportFile); if (!exportPartial) dirtyRef.current = false; setMessage('Copia condivisa.'); } })}>Condividi PDF</button><button onClick={() => { scaricaDocumento(exportFile); onEsporta?.(exportFile); setMessage('Download avviato. Verifica il file nei download del telefono.'); }}>Scarica PDF</button>{onSave && <button disabled={!!busy} className="pdf-primary" onClick={() => { onSave(exportFile); dirtyRef.current = false; }}>Usa questa copia in Scan</button>}{(onArchive || ctx) && <button disabled={!!busy} className={firmatoRef.current ? 'pdf-primary' : ''} onClick={archive}>{firmatoRef.current ? 'Salva firmato nell’archivio' : 'Salva nell’archivio come nuovo file'}</button>}<button onClick={() => setExportFile(null)}>Torna al documento</button></section></div>}
    {compila && ready && runtime.current?.doc && <div className="pdf-scrim"><CompilaCampi doc={runtime.current.doc} persona={ctx?.impostazioni?.persone?.[0]} onApplica={inserisciCampi} onChiudi={() => setCompila(false)} /></div>}
    {salvaArchivio && <div className="pdf-scrim"><SalvaArchivio file={salvaArchivio.file} origine={origine} firmato={firmatoRef.current} testoPdf={testoPdf} ctx={ctx}
      onSalvato={() => { if (!exportPartial) dirtyRef.current = false; }}
      onApri={onApriDocumento} onStudio={onArchive ? () => { const f = salvaArchivio.file; setSalvaArchivio(null); onArchive(f); if (!exportPartial) dirtyRef.current = false; } : undefined} onChiudi={() => { setSalvaArchivio(null); setExportFile(null); }} /></div>}
    {organize && <div className="pdf-scrim"><section className="pdf-sheet" role="dialog" aria-label="Organizza pagine"><h2>Organizza pagine</h2><label className="pdf-filename">Estrai pagine in un nuovo PDF<input aria-label="Pagine da estrarre" placeholder="Es. 1-3, 5" value={range} onChange={e => setRange(e.target.value)} /></label><button disabled={!!busy || !range.trim()} onClick={() => run('Estraggo le pagine…', async () => { const selection = pagineDaIntervallo(range, count); setExportPartial(true); const bytes = await organizzaPdf(await bytesWithEdits(), selection); setExportFile(new File([bytes], nomeDocumento(`${name.replace(/\.pdf$/i, '')} - estratto`), { type: 'application/pdf' })); setOrganize(null); })}>Estrai e salva</button><p>Unione e riordino fissano i campi compilati: il loro testo resta visibile, ma non sarà più un modulo modificabile. Le firme digitali preesistenti possono perdere validità. L’originale resta intatto.</p><div className="pdf-page-list">{organize.map((p,i) => <div className="pdf-row" key={p.index}>{thumbnails[p.index] && <img className="pdf-page-thumb" src={thumbnails[p.index]} alt={`Anteprima pagina ${p.index + 1}`} style={{ transform: `rotate(${p.rotation}deg)` }} />}<strong>Pagina {p.index+1}</strong><span>{p.rotation}°</span><button disabled={!!busy || !i} aria-label={`Sposta pagina ${p.index+1} prima`} onClick={() => setOrganize(riordina(organize,i,i-1))}>↑</button><button disabled={!!busy || i===organize.length-1} aria-label={`Sposta pagina ${p.index+1} dopo`} onClick={() => setOrganize(riordina(organize,i,i+1))}>↓</button><button disabled={!!busy} aria-label={`Ruota pagina ${p.index+1}`} onClick={() => setOrganize(organize.map((x,j) => j===i ? {...x,rotation:(x.rotation+90)%360}:x))}>↻</button><button disabled={!!busy || organize.length===1} aria-label={`Elimina pagina ${p.index+1} dalla copia`} onClick={() => setOrganize(organize.filter((_,j)=>i!==j))}>×</button></div>)}</div><button disabled={!!busy} className="pdf-primary" onClick={() => run('Aggiorno le pagine…', async () => { const bytes=await bytesWithEdits(); await replaceWith(await organizzaPdf(bytes,organize)); })}>Applica alla copia</button><button disabled={!!busy} onClick={() => merger.current.click()}>Aggiungi altri PDF in fondo</button>{history.length>0 && <button disabled={!!busy} onClick={() => { setSource(history.at(-1)); setHistory(h=>h.slice(0,-1)); setSignatures([]); setOrganize(null); markDirty(); }}>Annulla ultima modifica (pagine, OCR, compressione)</button>}<button disabled={!!busy} onClick={() => setOrganize(null)}>Indietro</button></section></div>}
    {compress && <div className="pdf-scrim"><section className="pdf-sheet" role="dialog" aria-label="Comprimi PDF"><h2>Comprimi PDF</h2><p>Peso attuale: {formatoPeso(source?.length || 0)}.</p><p>Le pagine diventano immagini più leggere, adatte a Mail e WhatsApp. Testo e campi non saranno più selezionabili (dopo puoi usare «Testo (OCR)»). L’originale resta intatto.</p><button className="pdf-primary" onClick={() => comprimi('media')}>Media · ben leggibile</button><button onClick={() => comprimi('forte')}>Forte · il più leggero</button><button onClick={() => setCompress(false)}>Indietro</button></section></div>}
    {rename !== null && <div className="pdf-scrim"><form className="pdf-sheet" onSubmit={e => { e.preventDefault(); try { setName(nomeDocumento(rename)); setRenamed(true); markDirty(); setRename(null); } catch (e) { setError(e.message); } }}><h2>Rinomina PDF</h2><input aria-label="Nuovo nome PDF" value={rename} onChange={e => setRename(e.target.value)} autoFocus required /><button className="pdf-primary" type="submit">Applica nome</button><button type="button" onClick={() => setRename(null)}>Annulla</button></form></div>}
    {confirmClose && <div className="pdf-scrim"><section className="pdf-sheet" role="alertdialog" aria-label="Modifiche non salvate"><h2>Chiudere il documento?</h2><p>Le modifiche non esportate andranno perse. L’originale non cambia.</p><button onClick={() => setConfirmClose(false)}>Continua a lavorare</button><button onClick={() => { dirtyRef.current=false; closeRef.current(); }}>Chiudi senza salvare</button></section></div>}
    {password && <div className="pdf-scrim"><form className="pdf-sheet" onSubmit={e=>{ e.preventDefault(); password.update(passwordText); setPassword(null); setPasswordText(''); }}><h2>Password del PDF</h2>{password.wrong && <p>Password errata, riprova.</p>}<input aria-label="Password PDF" type="password" value={passwordText} onChange={e=>setPasswordText(e.target.value)} autoFocus /><button type="submit">Apri</button><button type="button" onClick={()=>{ void runtime.current?.task.destroy(); setPassword(null); setBusy(''); setError('Apertura annullata.'); }}>Annulla</button></form></div>}
  </div>, document.body);
}
