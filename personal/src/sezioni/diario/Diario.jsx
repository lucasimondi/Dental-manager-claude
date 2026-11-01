import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { diaryId, PAGE_LENGTH, today, dateLabel, newPage, pageText, previousDate, searchDiary, splitText, loadDiary, savePage, prepareImage } from '../../lib/diario.js';
import { beginDiarySwipe, moveDiarySwipe, endDiarySwipe } from '../../lib/diarioSwipe.js';
import { assignDiaryQuotes, quoteForPage, quoteText, selectDiaryQuote } from '../../lib/diarioQuotes.js';
import { DiaryExport } from './DiaryExport.jsx';
import { DiaryPhilosophy } from './DiaryPhilosophy.jsx';
import './diario.css';

// Reading pages contain ordinary text. A bounded native editor owns writing/IME scroll.
function WritingEditor({ value, label, onChange, onDone, inputRef, selection, status }) {
  const dialog = useRef(null), done = useRef(null);
  useLayoutEffect(() => {
    const el = inputRef.current;
    el.focus({ preventScroll: true });
    const start = selection?.offset ?? el.value.length;
    el.setSelectionRange(start, start + (selection?.length || 0));
  }, [selection]);
  useLayoutEffect(() => {
    const app = document.getElementById('root'), wasInert = app?.inert;
    if (app) app.inert = true;
    return () => { if (app) app.inert = wasInert; };
  }, []);
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => {
      if (!dialog.current || !viewport) return;
      dialog.current.style.height = `${viewport.height}px`;
      dialog.current.style.top = `${viewport.offsetTop}px`;
    };
    resize(); viewport?.addEventListener('resize', resize); viewport?.addEventListener('scroll', resize);
    return () => { viewport?.removeEventListener('resize', resize); viewport?.removeEventListener('scroll', resize); };
  }, []);
  return createPortal(<div className="af-editor" ref={dialog} role="dialog" aria-modal="true" aria-label={label} onKeyDown={(e) => {
    if (e.key === 'Escape') { e.preventDefault(); onDone(); }
    if (e.key === 'Tab') { e.preventDefault(); (document.activeElement === inputRef.current ? done.current : inputRef.current)?.focus(); }
  }}>
    <div className="af-editor-toolbar"><span>{label}</span><button ref={done} onClick={onDone}>Fine</button></div>
    <textarea ref={inputRef} aria-label={label} value={value} onChange={(e) => onChange(e.target.value, e.nativeEvent.isComposing)} spellCheck />
    <p role="status">{status || 'Scrivi liberamente. La data viene aggiunta al primo pensiero.'}</p>
  </div>, document.body);
}

function PageQuote({ page, onBrowse }) {
  const quote = quoteForPage(page);
  return <div className="af-epigraph">{quote ? <blockquote className="af-quote"><p>{quoteText(quote)}</p><cite>{quote.author}<span>{quote.work}{quote.kind === 'thought' ? ' · Riflessione dal testo' : ''}</span></cite></blockquote> : <p className="af-quote-empty">Tutti i pensieri della biblioteca accompagnano già una pagina. Nessuna frase viene ripetuta.</p>}{onBrowse && <button className="af-browse-thoughts" onClick={onBrowse}>Esplora i pensieri <span aria-hidden="true">↗</span></button>}</div>;
}
function DockIcon({ name }) {
  const paths = { home: 'M3 11l9-8 9 8M5 10v11h5v-7h4v7h5V10', back: 'M15 5l-7 7 7 7', next: 'M9 5l7 7-7 7', book: 'M12 5C8 2 3 4 3 4v15s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1v15', write: 'M14 4l6 6M4 20l5-1L21 7l-5-5L4 14z', photo: 'M3 5h18v15H3zM3 16l5-5 5 5 3-3 5 5M16 8h.01', search: 'M21 21l-6-6M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0', export: 'M12 3v12M7 8l5-5 5 5M4 14v7h16v-7' };
  return <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

function CoverArt() { return <><span className="af-cover-border"><span className="af-edition">PENSIERI · RICORDI · VITA</span><span className="af-ornament">✧</span><strong>amor fati</strong><span className="af-cover-rule" /><em>Accogli ogni pagina della tua vita.</em><span className="af-cover-bottom">DIARIO PERSONALE<br /><span>Sfiora per aprire</span></span></span><span className="af-ribbon" /></>; }

// The turning sheet is a read-only snapshot; the live editor and save queue stay mounted.
function TurningSheet({ turn, pages }) {
  if (turn.cover) return <div className="af-turn-layer af-turn-forward" aria-hidden="true"><div className="af-turn-sheet"><div className="af-turn-front af-cover"><CoverArt /></div><div className="af-turn-back"><span>amor fati</span></div></div></div>;
  const p = turn.page;
  return <div className={`af-turn-layer af-turn-${turn.direction}`} aria-hidden="true">
    <div className="af-turn-sheet"><div className="af-turn-front af-paper">
      <div className="af-page-heading"><span>amor fati</span><span>{String(turn.pageIndex + 1).padStart(2, '0')}</span></div>
      <PageQuote page={p} />
      <div className="af-writing">{p.blocks.map((b, bi) => <div className="af-entry" key={b.id}>
        {previousDate(pages, turn.pageIndex, bi) !== b.date && <h2>{dateLabel(b.date)}</h2>}
        {b.type === 'image' ? <figure><img draggable={false} src={b.src} alt="" /><p className="af-printed-caption">{b.caption}</p></figure> : <p className="af-printed-text">{b.text}</p>}
      </div>)}</div><div className="af-page-footer"><span>amor fati</span><span>{turn.pageIndex + 1}</span></div>
    </div><div className="af-turn-back"><span>amor fati</span></div></div>
  </div>;
}

export function Diario({ db = archivioDb, active = true, ctx }) {
  const [pages, setPages] = useState([]);
  const pagesRef = useRef([]), dirty = useRef(new Set()), revisions = useRef(new Map()), saving = useRef(false), mounted = useRef(true);
  const [loaded, setLoaded] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState(''), [cover, setCover] = useState(true), [index, setIndex] = useState(0);
  const [query, setQuery] = useState(''), [date, setDate] = useState(''), [panel, setPanel] = useState(null), [jump, setJump] = useState(''), [turn, setTurn] = useState(null), [imageBusy, setImageBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const find = panel === 'search';
  const [focus, setFocus] = useState(null), [editing, setEditing] = useState(null);
  const editor = useRef(null), editorOpener = useRef(null);
  const fileInput = useRef(null), bookScroll = useRef(null), gesture = useRef(null), timer = useRef(null), turnLock = useRef(false), retryBlocked = useRef(false);
  const page = pages[index];
  const results = useMemo(() => searchDiary(pages, query, date), [pages, query, date]);

  useEffect(() => {
    mounted.current = true;
    loadDiary(db).then((data) => {
      if (!mounted.current) return;
      const initial = assignDiaryQuotes(data.length ? data : [newPage()]);
      initial.forEach((p) => revisions.current.set(p.id, p.revision));
      pagesRef.current = initial; setPages(initial); setIndex(initial.length - 1); setLoaded(true);
    }).catch((e) => { if (mounted.current) setError(`Impossibile aprire il diario: ${e.message}`); });
    return () => { mounted.current = false; clearTimeout(timer.current); };
  }, [db]);

  const commit = (next, changed) => {
    const assigned = assignDiaryQuotes(next);
    pagesRef.current = assigned; setPages(assigned);
    changed.forEach((id) => dirty.current.add(id)); setStatus('Da salvare…');
  };
  const flush = async () => {
    if (saving.current || retryBlocked.current || !dirty.current.size) return;
    saving.current = true; if (mounted.current) setStatus('Salvataggio…');
    try {
      while (dirty.current.size) {
        const id = dirty.current.values().next().value;
        const snapshot = pagesRef.current.find((p) => p.id === id);
        const revision = await savePage(db, { ...snapshot, revision: revisions.current.get(id) });
        revisions.current.set(id, revision);
        if (pagesRef.current.find((p) => p.id === id) === snapshot) dirty.current.delete(id);
      }
      if (mounted.current) { setStatus('Salvato'); setError(''); }
    } catch (e) { retryBlocked.current = true; if (mounted.current) { setError(`Non salvato: ${e.message}`); setStatus('Salvataggio da completare'); } }
    finally { saving.current = false; }
  };
  useEffect(() => { if (!loaded || !dirty.current.size) return; const t = setTimeout(flush, 650); return () => clearTimeout(t); }, [pages, loaded]);
  useEffect(() => {
    const warn = (e) => { if (dirty.current.size || saving.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  useLayoutEffect(() => {
    if (!focus || !active || turn) return;
    setEditing(focus.id);
  }, [focus, active, turn, index]);
  const editBlock = page?.blocks.find((b) => b.id === editing);
  function startWriting(id, event) {
    setPanel(null);
    editorOpener.current = event?.currentTarget || null;
    setFocus(null); setEditing(id);
  }
  function finishWriting() {
    editor.current?.blur(); setEditing(null); setFocus(null);
    const opener = editorOpener.current;
    requestAnimationFrame(() => { if (opener?.isConnected) opener.focus({ preventScroll: true }); });
  }


  async function goHome() {
    if (saving.current) { setStatus('Attendi il completamento del salvataggio…'); return; }
    await flush();
    if (dirty.current.size) return;
    setPanel(null); ctx?.vai('oggi');
  }
  function chooseQuote(quoteId) {
    const next = selectDiaryQuote(pagesRef.current, page.id, quoteId);
    commit(next, [page.id]); setPanel(null);
  }

  function cancelSwipe(e) {
    gesture.current = null;
    e?.currentTarget.classList.remove('af-swiping');
  }
  function swipeStart(e) {
    cancelSwipe(e);
    if (turnLock.current || e.target.closest('button,input,textarea')) return;
    gesture.current = beginDiarySwipe(e, e.currentTarget.clientWidth);
  }
  function swipeMove(e) {
    gesture.current = moveDiarySwipe(gesture.current, e);
    if (gesture.current?.axis === 'horizontal') {
      e.currentTarget.classList.add('af-swiping');
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.setPointerCapture(e.pointerId);
    } else e.currentTarget.classList.remove('af-swiping');
  }
  function swipeEnd(e) {
    const direction = endDiarySwipe(gesture.current, e);
    cancelSwipe(e);
    if (direction) go(index + direction);
  }

  function go(next) {
    if (turnLock.current || exportBusy) return;
    setPanel(null);
    if (next < 0) { setCover(true); bookScroll.current?.scrollTo({ top: 0 }); return; }
    if (next >= pagesRef.current.length) { addPage(); return; }
    const scroller = bookScroll.current;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (cover && !reduce && active) {
      turnLock.current = true; setTurn({ direction: 'forward', cover: true }); setCover(false); setIndex(next); setJump(''); scroller?.scrollTo({ top: 0 });
      clearTimeout(timer.current); timer.current = setTimeout(() => { setTurn(null); turnLock.current = false; }, 500); return;
    }
    if (cover || next === index || reduce || !active) { setCover(false); setIndex(next); setJump(''); scroller?.scrollTo({ top: 0 }); return; }
    const direction = next > index ? 'forward' : 'backward';
    const pageIndex = direction === 'forward' ? index : next;
    turnLock.current = true;
    // On a backward turn, the incoming sheet covers the old page before changing editor.
    setTurn({ direction, page: pagesRef.current[pageIndex], pageIndex });
    if (direction === 'forward') setIndex(next);
    setJump(''); scroller?.scrollTo({ top: 0 });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setIndex(next); setTurn(null); turnLock.current = false; }, 500);
  }
  function addPage() {
    if (turnLock.current || exportBusy) return;
    const list = pagesRef.current;
    const added = newPage((list.at(-1)?.order ?? -1) + 1);
    commit([...list, added], [added.id]); go(list.length); setFocus({ id: 'new' });
  }
  function write(id, text, composing = false) {
    const list = pagesRef.current, current = list[index];
    if (!current) return;
    const old = current.blocks.find((b) => b.id === id);
    if (old && old.date !== today() && text.startsWith(old.text) && text.length > old.text.length) { write(null, text.slice(old.text.length), composing); return; }
    const block = old ? { ...old, text } : { id: diaryId(), type: 'text', date: today(), text };
    if (!old && !text.trim()) return;
    // Existing entries keep their dates. A new paragraph uses the date of its first character.
    const blocks = old ? current.blocks.map((b) => b.id === id ? block : b) : [...current.blocks, block];
    const charsBefore = blocks.filter((b) => b.id !== block.id).reduce((n, b) => n + (b.text?.length || (b.type === 'image' ? 700 : 0)), 0);
    if (!composing && text.length > Math.max(350, PAGE_LENGTH - charsBefore)) {
      const [first, rest] = splitText(text, Math.max(350, PAGE_LENGTH - charsBefore));
      // Preserve trailing blocks and the next existing page: insert a fresh continuation page.
      const at = blocks.findIndex((b) => b.id === block.id);
      blocks[at] = { ...block, text: first };
      const following = list[index + 1];
      const chunks = []; let remaining = rest;
      while (remaining.length > PAGE_LENGTH) { const [part, tail] = splitText(remaining); chunks.push(part); remaining = tail; }
      chunks.push(remaining);
      const step = following ? (following.order - current.order) / (chunks.length + 1) : 1;
      const continuations = chunks.map((part, i) => ({ ...newPage(current.order + step * (i + 1)), blocks: [{ ...block, id: diaryId(), text: part }] }));
      continuations.at(-1).blocks.push(...blocks.splice(at + 1));
      const nextList = [...list.slice(0, index), { ...current, blocks }, ...continuations, ...list.slice(index + 1)];
      commit(nextList, [current.id, ...continuations.map((p) => p.id)]); setIndex(index + continuations.length); setFocus({ id: continuations.at(-1).blocks[0].id });
    } else {
      commit(list.map((p) => p.id === current.id ? { ...p, blocks } : p), [current.id]);
      if (!old) { setEditing(block.id); if (!composing) setFocus({ id: block.id }); }
    }
  }
  async function images(files) {
    if (imageBusy || !loaded) return;
    setImageBusy(true);
    try {
      for (const file of files) {
        const src = await prepareImage(file);
        if (!mounted.current) return;
        const list = pagesRef.current;
        // Resolve the destination by stable ID; async decoding must not move a photo into another entry.
        const destination = list.findIndex((p) => p.id === page.id);
        const target = list[destination];
        const block = { id: diaryId(), type: 'image', date: today(), src, caption: '' };
        if (pageText(target).length > 900 || target.blocks.filter((b) => b.type === 'image').length >= 2) {
          const next = { ...newPage((list.at(-1)?.order ?? 0) + 1), blocks: [block] };
          commit([...list, next], [next.id]); setIndex(list.length);
        } else commit(list.map((p) => p.id === target.id ? { ...p, blocks: [...p.blocks, block] } : p), [target.id]);
        setCover(false); setEditing(null); setFocus(null); setPanel(null);
      }
    } catch (e) { setError(e.message); }
    finally { if (mounted.current) setImageBusy(false); }
  }
  function caption(id, text) { const current = pagesRef.current[index]; commit(pagesRef.current.map((p) => p.id === current.id ? { ...p, blocks: p.blocks.map((b) => b.id === id ? { ...b, caption: text } : b) } : p), [current.id]); }
  function result(r) { if (turnLock.current || exportBusy) return; setPanel(null); go(r.page); setFocus({ id: r.blockId, offset: r.offset, length: r.length, reveal: true }); }
  return <section className={`af-diary${cover ? ' af-closed' : ''}`}  aria-label="Diario amor fati" onPaste={(e) => { const fs = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/')); if (fs.length) { e.preventDefault(); images(fs); } }} onDragOver={(e) => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); images([...e.dataTransfer.files]); }}>
    {error && <div className="af-error" role="alert">{error}{loaded && <button onClick={() => { retryBlocked.current = false; flush(); }}>Riprova salvataggio</button>}<button onClick={() => setPanel('export')}>Esporta una copia</button><span>Puoi conservare una copia prima di ricaricare.</span></div>}
    {!loaded ? <p role="status">{error ? 'Diario non aperto.' : 'Apro il tuo diario…'}</p> : <>
      {find && <div className="af-panel af-search" role="dialog" aria-label="Cerca nel diario"><div className="af-panel-heading"><h2>Ritrova un ricordo</h2><button onClick={() => setPanel(null)} aria-label="Chiudi ricerca">×</button></div><label>Cerca una parola o un ricordo<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cosa vuoi ritrovare?" /></label><label>Vai a una data<input type="date" value={date} onChange={(e) => { const d = e.target.value; setDate(d); const match = d && searchDiary(pagesRef.current, '', d)[0]; if (match) result(match); }} /></label>
        {(query.trim() || date) && <div className="af-results" aria-live="polite"><p>{results.length ? `${results.length} ${results.length === 1 ? 'passaggio trovato' : 'passaggi trovati'}` : 'Nessun ricordo trovato per questa ricerca.'}</p>{results.map((r) => <button key={`${r.page}-${r.blockId}`} onClick={() => result(r)}><small>{dateLabel(r.date)} · pagina {r.page + 1}</small><span>{r.excerpt}</span></button>)}</div>}
      </div>}
      <div className="af-scroll" ref={bookScroll}><div className="af-desk">
        {cover ? <button className="af-cover" onClick={() => go(index)} aria-label="Apri il diario amor fati"><CoverArt /></button>
          : <div className="af-book" aria-busy={!!turn}><div className="af-paper" onPointerDown={swipeStart} onPointerMove={swipeMove} onPointerUp={swipeEnd} onPointerCancel={cancelSwipe} onLostPointerCapture={(e) => { if (e.target === e.currentTarget) cancelSwipe(e); }}>
            <div className="af-page-heading"><span>amor fati</span><span>{String(index + 1).padStart(2, '0')}</span></div>
            <PageQuote page={page} onBrowse={() => setPanel('philosophy')} />
            <div className="af-writing">{page.blocks.map((b, bi) => <div key={b.id} className="af-entry">
              {previousDate(pages, index, bi) !== b.date && <h2>{dateLabel(b.date)}</h2>}
              {b.type === 'image' ? <figure><img draggable={false} src={b.src} alt={b.caption || 'Un ricordo incollato nel diario'} loading="lazy" /><p className="af-printed-caption">{b.caption}</p></figure>
                : <p className="af-printed-text">{b.text}</p>}
              <button className="af-edit-entry" onClick={(e) => startWriting(b.id, e)} disabled={imageBusy || !!turn}>{b.type === 'image' ? 'Modifica didascalia' : 'Modifica pensiero'}</button>
            </div>)}
              <button className="af-start-writing" onClick={(e) => startWriting('new', e)} disabled={imageBusy || !!turn}>{page.blocks.length ? 'Continua il tuo racconto…' : 'La tua storia, una pagina alla volta…'}</button>
            </div>
            <div className="af-page-footer"><span>{page.blocks.length ? 'Ogni giorno, una storia.' : 'Anche il silenzio ha la sua pagina.'}</span><span>{index + 1}</span></div>
          </div>{turn && <TurningSheet turn={turn} pages={pages} />}<button className="af-corner" disabled={!!turn} aria-label="Gira pagina" onClick={() => go(index + 1)} /></div>}
      </div></div>
      {panel === 'pages' && <div className="af-panel af-pages" role="dialog" aria-label="Pagine del diario"><div className="af-panel-heading"><h2>Le tue pagine</h2><button onClick={() => setPanel(null)} aria-label="Chiudi pagine">×</button></div><div className="af-pages-shortcuts"><button onClick={() => { setCover(true); bookScroll.current?.scrollTo({ top: 0 }); setPanel(null); }}>Copertina</button><button onClick={() => setPanel('philosophy')}>Biblioteca dei pensieri ↗</button></div><form onSubmit={(e) => { e.preventDefault(); go(Math.max(0, Math.min(pages.length - 1, Number(jump || index + 1) - 1))); }}><label>Vai alla pagina<input type="number" min="1" max={pages.length} value={jump || index + 1} onChange={(e) => setJump(e.target.value)} /></label><button className="af-primary">Apri</button></form><div className="af-page-list">{pages.map((p, i) => <button key={p.id} onClick={() => go(i)} aria-current={index === i ? 'page' : undefined}><span>{String(i + 1).padStart(2, '0')}</span><small>{pageText(p).slice(0, 45) || 'Una pagina ancora da vivere'}</small></button>)}</div><button className="af-primary" onClick={() => { setPanel(null); addPage(); }}>+ Aggiungi una pagina</button></div>}
      {panel === 'philosophy' && <DiaryPhilosophy pages={pages} page={page} onChoose={chooseQuote} onClose={() => setPanel(null)} />}
      {panel === 'export' && <DiaryExport pages={pages} current={index} onClose={() => setPanel(null)} onBusy={setExportBusy} />}
      {active && !turn && editing && (editing === 'new' || editBlock) && <WritingEditor inputRef={editor} selection={focus} label={editBlock?.type === 'image' ? 'Didascalia della fotografia' : editBlock ? `Pensiero del ${dateLabel(editBlock.date)}` : 'Scrivi un nuovo pensiero'} value={editBlock?.text ?? editBlock?.caption ?? ''} onChange={(text, composing) => editBlock?.type === 'image' ? caption(editBlock.id, text) : write(editBlock?.id || null, text, composing)} onDone={finishWriting} status={error || status} />}
      <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => { images([...e.target.files]); e.target.value = ''; }} />
      {status && <p className="af-status" role="status">{status}</p>}<p className="af-hint">La data appare quando inizi a scrivere. Puoi incollare immagini e lasciare pagine bianche.</p>
    </>}
      <nav className="af-dock" aria-label="Comandi del diario">
        <button className="af-dock-home" disabled={exportBusy || imageBusy || !!turn} onClick={goHome} aria-label="Torna alla Home" title="Home"><DockIcon name="home" /><small>Home</small></button>
        <span className="af-dock-separator" />
        <button disabled={!loaded || exportBusy || !!turn} onClick={() => cover ? go(0) : go(index - 1)} aria-label={cover ? 'Apri la prima pagina' : 'Pagina precedente'} title="Pagina precedente"><DockIcon name="back" /></button>
        <button className="af-dock-page" disabled={!loaded || exportBusy || !!turn} onClick={() => setPanel(panel === 'pages' ? null : 'pages')} aria-label={`Pagine del diario, pagina ${index + 1} di ${pages.length}`} aria-expanded={panel === 'pages'} title="Pagine e nuova pagina"><strong>{loaded ? index + 1 : '…'}</strong><small>{loaded ? `di ${pages.length}` : 'attendi'}</small></button>
        <button disabled={!loaded || exportBusy || !!turn} onClick={() => cover ? go(index) : go(index + 1)} aria-label="Pagina successiva" title="Pagina successiva"><DockIcon name="next" /></button>
        <span className="af-dock-separator" />
        <button className="af-dock-write" disabled={!loaded || exportBusy || imageBusy || !!turn} onClick={(e) => { if (cover) { go(index); setFocus({ id: 'new' }); } else startWriting('new', e); }} aria-label="Scrivi un pensiero" title="Scrivi"><DockIcon name="write" /></button>
        <button disabled={!loaded || exportBusy || imageBusy || !!turn} onClick={() => fileInput.current.click()} aria-label="Incolla foto o screenshot" title="Foto o screenshot"><DockIcon name="photo" /></button>
        <button disabled={!loaded || exportBusy || !!turn} onClick={() => setPanel(find ? null : 'search')} aria-label="Cerca nel diario" aria-expanded={find} title="Cerca"><DockIcon name="search" /></button>
        <button disabled={!loaded || exportBusy || !!turn} onClick={() => setPanel(panel === 'export' ? null : 'export')} aria-label="Esporta il diario" aria-expanded={panel === 'export'} title="Esporta PDF o JPEG"><DockIcon name="export" /></button>
      </nav>
  </section>;
}
