import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { diaryId, PAGE_LENGTH, today, dateLabel, newPage, pageText, previousDate, searchDiary, splitText, loadDiary, savePage, prepareImage } from '../../lib/diario.js';
import './diario.css';

function Writing({ value, onChange, inputRef, label, placeholder, onFocus, readOnly, active = true }) {
  const ref = useRef(null);
  useLayoutEffect(() => { if (!active) return; const el = ref.current; if (el) { el.style.height = 'auto'; el.style.height = `${Math.max(42, el.scrollHeight)}px`; } }, [value, active]);
  return <textarea ref={(el) => { ref.current = el; inputRef?.(el); }} aria-label={label} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value, e.nativeEvent.isComposing)} onFocus={onFocus} readOnly={readOnly} spellCheck />;
}

export function Diario({ db = archivioDb, active = true }) {
  const [pages, setPages] = useState([]);
  const pagesRef = useRef([]), dirty = useRef(new Set()), revisions = useRef(new Map()), saving = useRef(false), mounted = useRef(true);
  const [loaded, setLoaded] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState(''), [cover, setCover] = useState(true), [index, setIndex] = useState(0);
  const [query, setQuery] = useState(''), [date, setDate] = useState(''), [find, setFind] = useState(false), [jump, setJump] = useState(''), [turn, setTurn] = useState(''), [imageBusy, setImageBusy] = useState(false);
  const [focus, setFocus] = useState(null);
  const inputs = useRef(new Map()), fileInput = useRef(null), paper = useRef(null), gesture = useRef(null), timer = useRef(null), retryBlocked = useRef(false);
  const page = pages[index];
  const results = useMemo(() => searchDiary(pages, query, date), [pages, query, date]);

  useEffect(() => {
    mounted.current = true;
    loadDiary(db).then((data) => {
      if (!mounted.current) return;
      const initial = data.length ? data : [newPage()];
      initial.forEach((p) => revisions.current.set(p.id, p.revision));
      pagesRef.current = initial; setPages(initial); setIndex(initial.length - 1); setLoaded(true);
    }).catch((e) => { if (mounted.current) setError(`Impossibile aprire il diario: ${e.message}`); });
    return () => { mounted.current = false; clearTimeout(timer.current); };
  }, [db]);

  const commit = (next, changed) => {
    pagesRef.current = next; setPages(next);
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
    if (!focus || !active) return;
    const el = inputs.current.get(focus.id);
    if (el) { el.focus({ preventScroll: true }); if (el.setSelectionRange) el.setSelectionRange(focus.offset ?? el.value.length, (focus.offset ?? el.value.length) + (focus.length || 0)); if (focus.reveal) el.scrollIntoView({ block: 'nearest', behavior: 'auto' }); setFocus(null); }
  }, [focus, pages, index, cover, active]);

  function go(next) {
    if (next < 0) { setCover(true); return; }
    if (next >= pagesRef.current.length) { addPage(); return; }
    setTurn(next > index ? 'af-forward' : 'af-back'); clearTimeout(timer.current); timer.current = setTimeout(() => setTurn(''), 500);
    setCover(false); setIndex(next); setJump(''); paper.current?.closest('.pp-contenuto-diario')?.scrollTo({ top: 0 });
  }
  function addPage() {
    const list = pagesRef.current;
    const added = newPage((list.at(-1)?.order ?? -1) + 1);
    commit([...list, added], [added.id]); setCover(false); setIndex(list.length); setFocus({ id: 'new' });
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
      if (!old) setFocus({ id: block.id });
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
        setCover(false);
      }
    } catch (e) { setError(e.message); }
    finally { if (mounted.current) setImageBusy(false); }
  }
  function caption(id, text) { const current = pagesRef.current[index]; commit(pagesRef.current.map((p) => p.id === current.id ? { ...p, blocks: p.blocks.map((b) => b.id === id ? { ...b, caption: text } : b) } : p), [current.id]); }
  function download() {
    const blob = new Blob([JSON.stringify({ title: 'amor fati', version: 1, pages: pagesRef.current }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `amor-fati-${today()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function result(r) { go(r.page); setFocus({ id: r.blockId, offset: r.offset, length: r.length, reveal: true }); }
  const remember = (id) => (el) => { if (el) inputs.current.set(id, el); else inputs.current.delete(id); };
  return <section className="af-diary" aria-label="Diario amor fati" onPaste={(e) => { const fs = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/')); if (fs.length) { e.preventDefault(); images(fs); } }} onDragOver={(e) => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); images([...e.dataTransfer.files]); }}>
    <div className="af-tools">
      <button onClick={() => setCover(true)} aria-label="Mostra copertina">amor fati <span>il mio diario</span></button>
      <div><button onClick={() => setFind(!find)} aria-expanded={find}>Cerca</button><button onClick={download} disabled={!loaded} title="Scarica una copia completa con le immagini">Esporta</button></div>
    </div>
    {error && <div className="af-error" role="alert">{error}{loaded && <button onClick={() => { retryBlocked.current = false; flush(); }}>Riprova salvataggio</button>}<span>Puoi esportare una copia prima di ricaricare.</span></div>}
    {!loaded ? <p role="status">{error ? 'Diario non aperto.' : 'Apro il tuo diario…'}</p> : <>
      {find && <div className="af-search"><label>Cerca una parola o un ricordo<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cosa vuoi ritrovare?" /></label><label>Vai a una data<input type="date" value={date} onChange={(e) => { const d = e.target.value; setDate(d); const match = d && searchDiary(pagesRef.current, '', d)[0]; if (match) result(match); }} /></label>
        {(query.trim() || date) && <div className="af-results" aria-live="polite"><p>{results.length ? `${results.length} ${results.length === 1 ? 'passaggio trovato' : 'passaggi trovati'}` : 'Nessun ricordo trovato per questa ricerca.'}</p>{results.map((r) => <button key={`${r.page}-${r.blockId}`} onClick={() => result(r)}><small>{dateLabel(r.date)} · pagina {r.page + 1}</small><span>{r.excerpt}</span></button>)}</div>}
      </div>}
      <div className="af-desk">
        {cover ? <button className="af-cover" onClick={() => go(index)} aria-label="Apri il diario amor fati"><span className="af-cover-border"><span className="af-edition">PENSIERI · RICORDI · VITA</span><span className="af-ornament">✧</span><strong>amor fati</strong><span className="af-cover-rule" /><em>Accogli ogni pagina della tua vita.</em><span className="af-cover-bottom">DIARIO PERSONALE<br /><span>Sfiora per aprire</span></span></span><span className="af-ribbon" /></button>
          : <div className={`af-book ${turn}`}><div className="af-paper" ref={paper} onTouchStart={(e) => { if (!e.target.closest('textarea,input,button')) gesture.current = [e.touches[0].clientX, e.touches[0].clientY]; }} onTouchEnd={(e) => { if (!gesture.current) return; const [x, y] = gesture.current; gesture.current = null; const dx = e.changedTouches[0].clientX - x, dy = e.changedTouches[0].clientY - y; if (Math.abs(dx) > 75 && Math.abs(dy) < 55) go(index + (dx < 0 ? 1 : -1)); }}>
            <div className="af-page-heading"><span>amor fati</span><span>{String(index + 1).padStart(2, '0')}</span></div>
            <div className="af-writing">{page.blocks.map((b, bi) => <div key={b.id} className="af-entry">
              {previousDate(pages, index, bi) !== b.date && <h2>{dateLabel(b.date)}</h2>}
              {b.type === 'image' ? <figure><img src={b.src} alt={b.caption || 'Un ricordo incollato nel diario'} loading="lazy" /><Writing active={active} inputRef={remember(b.id)} label="Didascalia della fotografia" placeholder="Un pensiero per questa foto…" value={b.caption} onChange={(text) => caption(b.id, text)} readOnly={imageBusy} /></figure>
                : <Writing active={active} inputRef={remember(b.id)} label={`Pensiero del ${dateLabel(b.date)}`} value={b.text} onChange={(text, composing) => write(b.id, text, composing)} readOnly={imageBusy} />}
            </div>)}
              <Writing active={active} inputRef={remember('new')} label="Scrivi un nuovo pensiero" value="" placeholder={page.blocks.length ? 'Continua il tuo racconto…' : 'La tua storia, una pagina alla volta…'} onChange={(text, composing) => write(null, text, composing)} readOnly={imageBusy} />
            </div>
            <div className="af-page-footer"><span>{page.blocks.length ? 'Ogni giorno, una storia.' : 'Anche il silenzio ha la sua pagina.'}</span><span>{index + 1}</span></div>
          </div><button className="af-corner" aria-label="Gira pagina" onClick={() => go(index + 1)} /></div>}
      </div>
      <div className="af-navigation"><button onClick={() => cover ? go(0) : go(index - 1)} aria-label={cover ? 'Apri la prima pagina' : 'Pagina precedente'}>←</button><label>Pagina <input type="number" min="1" max={pages.length} value={jump || index + 1} onChange={(e) => setJump(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') go(Math.max(0, Math.min(pages.length - 1, Number(jump || index + 1) - 1))); }} onBlur={() => { if (jump) go(Math.max(0, Math.min(pages.length - 1, Number(jump) - 1))); }} aria-label="Vai alla pagina" /> di {pages.length}</label><button onClick={() => cover ? go(index) : go(index + 1)} aria-label="Pagina successiva">→</button></div>
      <div className="af-actions"><button onClick={() => fileInput.current.click()} disabled={imageBusy}>{imageBusy ? 'Incollo…' : '+ Foto o screenshot'}</button><button onClick={addPage} disabled={imageBusy}>+ Pagina</button></div>
      <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => { images([...e.target.files]); e.target.value = ''; }} />
      <p className="af-status" role="status">{status || 'Il tuo spazio, il tuo tempo.'}</p><p className="af-hint">La data appare quando inizi a scrivere. Puoi incollare immagini e lasciare pagine bianche.</p>
    </>}
  </section>;
}
