// SCAN-ORGANIZZA (PO 2026-11-12: «Prova con a b d») — proposta D: la scheda di un documento di
// «I miei documenti». In alto le pagine da scorrere; sotto stella, categoria, etichette, scadenza e
// le 10 azioni (Condividi, Firma, Modifica, Pagine, Testo, Word, Traduci, Comprimi, Sposta, Archivia),
// più Rinomina e Elimina. Tutto sul telefono; l'originale cambia solo con Firma/Modifica salvate come copia.
import { useCallback, useEffect, useState } from 'react';
import {
  CARTELLA_BASE, documento, fileDocumento, aggiornaDocumento, elencoDocumenti, cartelleCreate, elencoCartelle,
  spostaDocumenti, rinominaDocumento, eliminaDocumenti, formatoPeso, ePdf, tipoDi,
} from '../lib/libreria.js';
import { scaricaDocumento } from '../lib/condividi.js';
import { CATEGORIE, categoria as categoriaDi, avvisoScadenza, normalizzaEtichette } from './categorie.js';
import { condividiDocumenti, SceltaCartella, estensioneDi } from './Documenti.jsx';

const MAX_ANTEPRIME = 6;
async function anteprime(file) {
  if ((file.type || '').startsWith('image/')) return { pagine: 1, immagini: [URL.createObjectURL(file)] };
  if (!ePdf({ nome: file.name, tipo: file.type })) return { pagine: 0, immagini: [] };
  const { apriDocumento, disegnaPagina, liberaCanvas } = await import('../pdf/raster.js');
  const doc = await apriDocumento(new Uint8Array(await file.arrayBuffer()));
  const immagini = [];
  try {
    for (let n = 1; n <= Math.min(doc.numPages, MAX_ANTEPRIME); n += 1) {
      const { canvas } = await disegnaPagina(doc, n, { latoMax: 900 });
      immagini.push(canvas.toDataURL('image/jpeg', 0.8)); liberaCanvas(canvas);
    }
    return { pagine: doc.numPages, immagini };
  } finally { await doc.destroy(); }
}

const AZIONI = [
  ['condividi', 'Condividi', '↗', '#1f6fe5', '#eef4ff'],
  ['firma', 'Firma', '✍', '#b42318', '#fef0ef'],
  ['modifica', 'Modifica', 'Aa', '#344054', '#f2f4f7'],
  ['pagine', 'Pagine', '▤', '#0f8a5f', '#e3f4ec'],
  ['testo', 'Testo', 'T', '#1f6fe5', '#eef4ff'],
  ['word', 'Word', 'W', '#2f6fd1', '#e7effc'],
  ['traduci', 'Traduci', '文', '#6d4bd6', '#eee9fb'],
  ['comprimi', 'Comprimi', '⇲', '#c26a12', '#fdf1e2'],
  ['sposta', 'Sposta', '▭', '#475467', '#f2f4f7'],
  ['archivia', 'Archivia', '⇪', '#067647', '#ecfdf3'],
];
const SOLO_PDF = new Set(['firma', 'modifica', 'pagine', 'comprimi']);

export function Scheda({ ctx, id, chiudi }) {
  const { mostra } = ctx;
  const [d, setD] = useState(null);
  const [viste, setViste] = useState(null);
  const [foglio, setFoglio] = useState(null);
  const [testo, setTesto] = useState('');
  const [cartelle, setCartelle] = useState([]);
  const ricarica = useCallback(() => documento(id).then(setD).catch((e) => { mostra(e.message); chiudi?.(); }), [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { ricarica(); }, [ricarica]);
  useEffect(() => {
    let vivo = true; let urls = [];
    fileDocumento(id).then(anteprime).then((v) => { urls = v.immagini.filter((u) => u.startsWith('blob:')); if (vivo) setViste(v); }).catch(() => vivo && setViste({ pagine: 0, immagini: [] }));
    return () => { vivo = false; urls.forEach((u) => URL.revokeObjectURL(u)); };
  }, [id]);
  const prova = (fn) => async (...a) => { try { await fn(...a); } catch (e) { mostra(e.message || String(e)); } };
  const cambia = (campi) => prova(async () => { await aggiornaDocumento(id, campi); await ricarica(); ctx.aggiornaLibreria?.(); })();
  if (!d) return <p className="pp-riga-meta"><span className="pp-rotella" /> Apro il documento…</p>;

  const cat = categoriaDi(d.categoria);
  const pdf = ePdf(d);
  const avviso = avvisoScadenza(d.scadenza);
  const azione = (chiave) => prova(async () => {
    const file = await fileDocumento(id);
    if (chiave === 'condividi') await condividiDocumenti(ctx, [d]);
    else if (chiave === 'firma' || chiave === 'pagine' || chiave === 'comprimi') ctx.apri({ tipo: 'pdfStrumento', strumento: chiave, file });
    else if (chiave === 'modifica') ctx.apri({ tipo: 'pdfStrumento', strumento: 'modifica', file });
    else if (chiave === 'testo') {
      if (d.testo) { setTesto(d.testo); setFoglio('testo'); } else ctx.apri({ tipo: 'testo', file });
    } else if (chiave === 'word') {
      mostra('Preparo il file Word…');
      const { wordDa } = await import('./esporta.js');
      const files = await wordDa(file);
      ctx.ricorda?.(files, { cartella: d.cartella || CARTELLA_BASE, categorie: [d.categoria] });
      mostra(`Creato «${files[0].name}» in I miei documenti.`);
    } else if (chiave === 'traduci') ctx.apri({ tipo: 'traduci', file });
    else if (chiave === 'sposta') { const [docs, c] = await Promise.all([elencoDocumenti(), cartelleCreate()]); setCartelle(elencoCartelle(docs, c)); setFoglio('sposta'); }
    else if (chiave === 'archivia') {
      await aggiornaDocumento(id, { archiviato: true });
      ctx.apri({ tipo: 'carica', file, opzioni: { descrizione: d.nome.replace(/\.[^.]+$/, ''), scelto: true, soloArchiviazione: true, nonAnalizzare: true, destinazione: true } });
    }
  });

  return (
    <div className="scan-scheda">
      <div className="scan-scheda-pagine" aria-label="Pagine del documento">
        {viste === null && <p className="pp-riga-meta"><span className="pp-rotella" /> Preparo l'anteprima…</p>}
        {viste?.immagini.map((u, i) => <img key={i} src={u} alt={`Pagina ${i + 1}`} />)}
        {viste && !viste.immagini.length && <span className="scan-scheda-vuota">{estensioneDi(d)}</span>}
      </div>
      <div className="scan-scheda-info">
        <div className="scan-scheda-titolo">
          <span><strong>{d.nome.replace(/\.[^.]+$/, '')}</strong>
            <small>{estensioneDi(d)}{viste?.pagine ? ` · ${viste.pagine} ${viste.pagine === 1 ? 'pagina' : 'pagine'}${viste.pagine > MAX_ANTEPRIME ? ` (anteprima delle prime ${MAX_ANTEPRIME})` : ''}` : ''} · {formatoPeso(d.dimensione)} · {new Date(d.creato).toLocaleDateString('it-IT')}</small></span>
          <button className={`scan-stella grande${d.preferito ? ' attiva' : ''}`} aria-pressed={!!d.preferito} aria-label={d.preferito ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'} onClick={() => cambia({ preferito: !d.preferito })}>★</button>
        </div>
        <div className="scan-scheda-chip">
          <button className="scan-chip" style={{ background: cat.sfondo, color: cat.testo }} onClick={() => setFoglio('categoria')}>{cat.nome} ▾</button>
          <button className="scan-chip" onClick={prova(async () => { const [docs, c] = await Promise.all([elencoDocumenti(), cartelleCreate()]); setCartelle(elencoCartelle(docs, c)); setFoglio('sposta'); })}>Cartella: {d.cartella || CARTELLA_BASE}</button>
          <span className={`scan-chip ${d.archiviato ? 'verde' : 'blu'}`}>{d.archiviato ? 'Archiviato in Personal' : 'Solo sul telefono'}</span>
          {d.testo && <span className="scan-chip blu">Testo letto</span>}
          {(d.tag || []).map((t) => <button key={t} className="scan-chip" aria-label={`Togli l'etichetta ${t}`} onClick={() => cambia({ tag: (d.tag || []).filter((x) => x !== t) })}>#{t} ×</button>)}
          <button className="scan-chip" onClick={() => setFoglio('etichetta')}>+ etichetta</button>
          <button className={`scan-chip${avviso?.scaduto ? ' rosso' : avviso ? ' ambra' : ''}`} onClick={() => setFoglio('scadenza')}>{d.scadenza ? `Scade ${new Date(`${d.scadenza}T12:00:00`).toLocaleDateString('it-IT')}${avviso ? ` · ${avviso.testo}` : ''}` : '+ scadenza'}</button>
        </div>
        <div className="scan-scheda-azioni">
          {AZIONI.filter(([k]) => pdf || !SOLO_PDF.has(k)).filter(([k]) => tipoDi(d) !== 'word' || ['condividi', 'sposta', 'archivia'].includes(k)).map(([k, nome, sigla, colore, sfondo]) => (
            <button key={k} onClick={azione(k)}><span style={{ color: colore, background: sfondo }} aria-hidden="true">{sigla}</span>{nome}</button>
          ))}
        </div>
        <div className="scan-scheda-altro">
          <button className="pp-testo-link" onClick={() => { setTesto(d.nome.replace(/\.[^.]+$/, '')); setFoglio('rinomina'); }}>Rinomina</button>
          {pdf && <button className="pp-testo-link" onClick={prova(async () => ctx.apri({ tipo: 'scanner', files: [await fileDocumento(id)] }))}>Aggiungi pagine</button>}
          <button className="pp-testo-link" onClick={prova(async () => scaricaDocumento(await fileDocumento(id)))}>Salva sul telefono</button>
          <button className="pp-testo-link scan-testo-rosso" onClick={() => setFoglio('elimina')}>Elimina</button>
        </div>
      </div>

      {foglio === 'categoria' && (
        <div className="scan-scrim" role="dialog" aria-label="Categoria" onClick={(e) => e.target === e.currentTarget && setFoglio(null)}>
          <section className="scan-foglio-azioni">
            <h2>Categoria</h2>
            {CATEGORIE.map((c) => <button key={c.id} className="scan-voce" aria-pressed={c.id === cat.id} onClick={() => { setFoglio(null); cambia({ categoria: c.id, categoriaAuto: false }); }}><span className="scan-categoria-sigla piccola" style={{ color: c.icona, background: c.sfondo === '#ffffff' ? '#f2f4f7' : c.sfondo }}>{c.sigla}</span><span>{c.nome}</span>{c.id === cat.id && <small>✓</small>}</button>)}
          </section>
        </div>
      )}
      {foglio === 'sposta' && <SceltaCartella cartelle={cartelle} titolo="Sposta in" onChiudi={() => setFoglio(null)}
        onScegli={prova(async (c) => { await spostaDocumenti([id], c); setFoglio(null); await ricarica(); ctx.aggiornaLibreria?.(); mostra(`Spostato in «${c}».`); })} />}
      {(foglio === 'etichetta' || foglio === 'scadenza' || foglio === 'rinomina') && (
        <div className="scan-scrim" role="dialog" aria-label={foglio === 'etichetta' ? 'Nuova etichetta' : foglio === 'scadenza' ? 'Scadenza' : 'Rinomina'}>
          <form className="scan-foglio-azioni" onSubmit={prova(async (e) => {
            e.preventDefault();
            const v = new FormData(e.currentTarget).get('valore') || '';
            if (foglio === 'etichetta') cambia({ tag: normalizzaEtichette([...(d.tag || []), ...String(v).split(/[\s,]+/)]) });
            else if (foglio === 'scadenza') cambia({ scadenza: v || null });
            else { const n = await rinominaDocumento(id, v); await ricarica(); ctx.aggiornaLibreria?.(); mostra(`Rinominato «${n}».`); }
            setFoglio(null);
          })}>
            <h2>{foglio === 'etichetta' ? 'Nuova etichetta' : foglio === 'scadenza' ? 'Quando scade?' : 'Rinomina'}</h2>
            {foglio === 'scadenza' && <p>Per documenti d'identità, tessere, garanzie: l'avviso compare in «Cartelle» 90 giorni prima.</p>}
            {foglio === 'etichetta'
              ? <input className="scan-campo" name="valore" aria-label="Etichetta" placeholder="es. ecografia, mutuo, auto" autoFocus />
              : foglio === 'scadenza'
                ? <input className="scan-campo" name="valore" type="date" aria-label="Data di scadenza" defaultValue={d.scadenza || ''} />
                : <input className="scan-campo" name="valore" aria-label="Nuovo nome" defaultValue={testo} autoFocus />}
            <button className="pp-bottone pp-bottone-largo">Salva</button>
            {foglio === 'scadenza' && d.scadenza && <button type="button" className="pp-bottone pp-bottone-chiaro pp-bottone-largo" onClick={() => { setFoglio(null); cambia({ scadenza: null }); }}>Togli la scadenza</button>}
            <button type="button" className="pp-bottone pp-bottone-chiaro pp-bottone-largo" onClick={() => setFoglio(null)}>Annulla</button>
          </form>
        </div>
      )}
      {foglio === 'testo' && (
        <div className="scan-scrim" role="dialog" aria-label="Testo letto" onClick={(e) => e.target === e.currentTarget && setFoglio(null)}>
          <section className="scan-foglio-azioni">
            <h2>Testo letto</h2>
            <textarea className="scan-testo-area" readOnly value={testo} rows={12} />
            <button className="pp-bottone pp-bottone-largo" onClick={async () => { try { await navigator.clipboard.writeText(testo); mostra('Testo copiato.'); } catch { mostra('Copia non riuscita.'); } }}>Copia il testo</button>
            <button className="pp-bottone pp-bottone-chiaro pp-bottone-largo" onClick={() => setFoglio(null)}>Chiudi</button>
          </section>
        </div>
      )}
      {foglio === 'elimina' && (
        <div className="scan-scrim" role="alertdialog" aria-label="Conferma eliminazione">
          <section className="scan-foglio-azioni">
            <h2>Eliminare il documento?</h2>
            <p>Viene tolto da questo telefono. Le copie già condivise, salvate o archiviate in Personal non cambiano.</p>
            <button className="pp-bottone pp-bottone-largo scan-pericolo" onClick={prova(async () => { await eliminaDocumenti([id]); ctx.aggiornaLibreria?.(); chiudi?.(); })}>Elimina</button>
            <button className="pp-bottone pp-bottone-chiaro pp-bottone-largo" onClick={() => setFoglio(null)}>Annulla</button>
          </section>
        </div>
      )}
    </div>
  );
}
