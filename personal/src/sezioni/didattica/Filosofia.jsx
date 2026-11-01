import { useEffect, useRef, useState } from 'react';
import { CAPITOLI } from './filosofia.js';
import './filosofia.css';

const SVILUPPATI = CAPITOLI.filter((c) => c.sections?.length);
const PARTI = [...new Set(CAPITOLI.map((c) => c.part))];
export function Filosofia({ ctx }) {
  const [id, setId] = useState(null);
  const [ricerca, setRicerca] = useState('');
  const [grande, setGrande] = useState(false);
  const heading = useRef(null);
  const chapter = SVILUPPATI.find((c) => c.id === id);
  const posizione = SVILUPPATI.findIndex((c) => c.id === id);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: 'start' });
  }, [id]);
  const apri = (next) => setId(next);
  const match = (c) => `${c.title} ${c.part}`.toLocaleLowerCase('it').includes(ricerca.trim().toLocaleLowerCase('it'));
  return <div className={`pf-library${grande ? ' pf-large' : ''}`}>
    <nav className="pf-toolbar" aria-label="Comandi di lettura">
      <button onClick={() => chapter ? apri(null) : ctx.vai('oggi')}>{chapter ? '← Indice' : '← Oggi'}</button>
      <span>Biblioteca / Filosofia</span>
      <button aria-pressed={grande} aria-label="Testo più grande" onClick={() => setGrande(!grande)}>A<span aria-hidden="true">a</span></button>
    </nav>
    {chapter ? <>
      <article className="pf-paper" aria-labelledby="pf-title">
        <p className="pf-eyebrow">Capitolo {CAPITOLI.indexOf(chapter) + 1} · {chapter.part}</p>
        <h1 ref={heading} tabIndex={-1} id="pf-title">{chapter.title}</h1>
        <p className="pf-subtitle">{chapter.subtitle}</p>
        {chapter.sections.map((s) => <section key={s.title}><h2>{s.title}</h2><p>{s.text}</p></section>)}
        <aside className="pf-question"><h2>Fermati a riflettere</h2><p>{chapter.question}</p><button onClick={() => ctx.vai('diario')}>Apri il diario amor fati ↗</button></aside>
        <section className="pf-sources"><h2>Fonti e letture</h2><p>Testo didattico originale. Gli esempi contemporanei sono esercizi editoriali. I riferimenti rimandano ai testi e agli studi; le edizioni online possono essere in inglese.</p><ul>{chapter.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title} ↗</a></li>)}</ul></section>
      </article>
      <nav className="pf-chapter-nav" aria-label="Naviga fra i capitoli disponibili">
        <button disabled={posizione === 0} onClick={() => apri(SVILUPPATI[posizione - 1].id)}>← Precedente</button>
        <span>{posizione + 1} / {SVILUPPATI.length}</span>
        <button disabled={posizione === SVILUPPATI.length - 1} onClick={() => apri(SVILUPPATI[posizione + 1].id)}>Successivo →</button>
      </nav>
      {posizione === SVILUPPATI.length - 1 && <p className="pf-end">Hai raggiunto la fine dei capitoli disponibili. Il seguito è indicato nell’indice come «Da sviluppare».</p>}
    </> : <>
      <header className="pf-cover"><p className="pf-eyebrow">Un percorso dalle origini al presente</p><h1 ref={heading} tabIndex={-1}>Filosofia</h1><p className="pf-cover-sub">Una storia delle domande umane</p><p>Un trattato da leggere con calma. Idee, argomenti e modi di vivere, dalle prime ricerche sul mondo alle sfide contemporanee.</p><button onClick={() => apri(SVILUPPATI[0].id)}>Inizia dal primo capitolo →</button><small>{CAPITOLI.length} capitoli nell’indice · {SVILUPPATI.length} disponibili</small></header>
      <section className="pf-index" aria-labelledby="pf-index-title"><h2 id="pf-index-title">Indice del trattato</h2><p>Il percorso segue principalmente la storia della filosofia occidentale, con aperture ad altre tradizioni. L’indice è il piano dell’opera: i capitoli già leggibili sono evidenziati.</p>
        <label className="pf-search">Cerca nell’indice<input type="search" value={ricerca} onChange={(e) => setRicerca(e.target.value)} placeholder="Autore, tema o periodo" /></label>
        {!CAPITOLI.some(match) && <p role="status">Nessun capitolo corrisponde alla ricerca.</p>}
        {PARTI.map((part, i) => { const items = CAPITOLI.filter((c) => c.part === part && match(c)); return items.length ? <section className="pf-part" key={part}><h3><span>Parte {i + 1}</span>{part}</h3><ol>{items.map((c) => <li key={c.id} value={CAPITOLI.indexOf(c) + 1}>{c.sections ? <button onClick={() => apri(c.id)}><span>{c.title}</span><small>Leggi ↗</small></button> : <div className="pf-planned"><span>{c.title}</span><small>Da sviluppare</small></div>}</li>)}</ol></section> : null; })}
      </section>
    </>}
  </div>;
}
