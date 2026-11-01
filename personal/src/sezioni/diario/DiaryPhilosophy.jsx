import { useEffect, useMemo, useRef, useState } from 'react';
import { DIARY_AUTHORS, DIARY_ERAS, DIARY_QUOTES, DIARY_SCHOOLS, DIARY_THEMES, filterDiaryQuotes, quoteKindLabel, quoteText } from '../../lib/diarioQuotes.js';

export function DiaryPhilosophy({ pages, page, onChoose, onClose }) {
  const [filters, setFilters] = useState({ era: '', school: '', theme: '', query: '' });
  const [limit, setLimit] = useState(24), [error, setError] = useState('');
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  const matches = useMemo(() => filterDiaryQuotes(filters), [filters]);
  const used = useMemo(() => new Map(pages.map((p, i) => [p.quoteId, { id: p.id, number: i + 1 }])), [pages]);
  function filter(key, value) { setFilters((f) => ({ ...f, [key]: value })); setLimit(24); }
  return <div className="af-panel af-philosophy" role="dialog" aria-labelledby="af-philosophy-title" onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
    <div className="af-panel-heading"><div><small>VOCI ATTRAVERSO IL TEMPO</small><h2 id="af-philosophy-title" tabIndex={-1} ref={heading}>La biblioteca dei pensieri</h2></div><button onClick={onClose} aria-label="Chiudi biblioteca">×</button></div>
    <p className="af-panel-intro">{DIARY_QUOTES.length} pensieri · {DIARY_AUTHORS.length} filosofi · {Object.keys(DIARY_ERAS).length} epoche. Ogni pagina, una voce diversa.</p>
    <div className="af-philosophy-filters">
      <label className="af-philosophy-search">Autore, parola o opera<input type="search" value={filters.query} onChange={(e) => filter('query', e.target.value)} placeholder="Seneca, libertà, tempo…" /></label>
      <label>Epoca<select value={filters.era} onChange={(e) => filter('era', e.target.value)}><option value="">Tutte le epoche</option>{Object.entries(DIARY_ERAS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label>Corrente<select value={filters.school} onChange={(e) => filter('school', e.target.value)}><option value="">Tutte le correnti</option>{DIARY_SCHOOLS.map((school) => <option key={school}>{school}</option>)}</select></label>
      <label>Tema<select value={filters.theme} onChange={(e) => filter('theme', e.target.value)}><option value="">Tutti i temi</option>{DIARY_THEMES.map((theme) => <option key={theme}>{theme}</option>)}</select></label>
      <button className="af-filter-reset" onClick={() => { setFilters({ era: '', school: '', theme: '', query: '' }); setLimit(24); }}>Azzera filtri</button>
    </div>
    <p className="af-library-count" role="status">{matches.length ? `${matches.length} pensieri trovati` : 'Nessun pensiero corrisponde ai filtri. Prova ad ampliarli.'}</p>
    {error && <p className="af-panel-error" role="alert">{error}</p>}
    <div className="af-philosophy-list">{matches.slice(0, limit).map((q) => {
      const location = used.get(q.id), current = page.quoteId === q.id, elsewhere = location && location.id !== page.id;
      return <article key={q.id} className={current ? 'af-thought-current' : ''}>
        <div className="af-thought-meta"><span>{DIARY_ERAS[q.era]}</span><span>{q.theme}</span></div>
        <p className="af-thought-text">{quoteText(q)}</p><h3>{q.author}</h3><p className="af-thought-work">{q.work}</p><p className="af-thought-kind">{q.school} · {quoteKindLabel(q)}</p>
        <div className="af-thought-actions"><a href={q.source} target="_blank" rel="noopener noreferrer" aria-label={`Leggi la fonte: ${q.author}, ${q.work}`}>Leggi la fonte ↗</a><button disabled={current || !!elsewhere} onClick={() => { try { onChoose(q.id); } catch (e) { setError(e.message); } }}>{current ? 'Su questa pagina' : elsewhere ? `Già a pagina ${location.number}` : 'Scegli per questa pagina'}</button></div>
      </article>;
    })}</div>
    {matches.length > limit && <button className="af-primary af-library-more" onClick={() => setLimit((n) => n + 24)}>Mostra altri pensieri</button>}
    <p className="af-library-note">Biblioteca selezionata e ampliabile. Le traduzioni sono redazionali; le rielaborazioni sono indicate come «Riflessione dal testo». I pensieri già usati restano consultabili, ma non si ripetono sulle altre pagine.</p>
  </div>;
}
