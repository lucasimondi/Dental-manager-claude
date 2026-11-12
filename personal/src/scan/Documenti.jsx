// SCAN-LIBRERIA (PO 2026-11-12) — «I miei documenti» di Scan: tutti i file creati in Scan, solo su
// questo telefono. Cerca (nome e testo riconosciuto), cartelle, ordina; per ogni file Apri, Condividi,
// Rinomina, Sposta, Salva sul telefono, Archivia (Personal o paziente dello Studio), Elimina.
// «Seleziona» per più file: Unisci in un PDF, Condividi, Sposta, Elimina.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CARTELLA_BASE, elencoDocumenti, cartelleCreate, creaCartella, eliminaCartella, fileDocumento, filtraDocumenti, elencoCartelle,
  formatoPeso, gruppoData, rinominaDocumento, spostaDocumenti, eliminaDocumenti, salvaDocumenti, ePdf, nomeAutomatico,
} from '../lib/libreria.js';
import { condividi, scaricaDocumento } from '../lib/condividi.js';
import { IconaCerca, IconaCondividi, IconaCestino, IconaDocumenti, IconaChiudi } from '../Icone.jsx';
import { creaMiniatura } from './miniaturaFile.js';

const ORDINI = [['recenti', 'Più recenti'], ['vecchi', 'Meno recenti'], ['nome', 'Nome A-Z'], ['peso', 'Più pesanti']];

export function apriFileDocumento(ctx, d) {
  return fileDocumento(d.id).then((file) => {
    if (ePdf(d) || (d.tipo || '').startsWith('image/')) ctx.apri({ tipo: 'pdf', ...(ePdf(d) ? { file } : { files: [file] }) });
    else scaricaDocumento(file);
  });
}
export async function condividiDocumenti(ctx, docs) {
  const files = await Promise.all(docs.map((d) => fileDocumento(d.id)));
  const esito = await condividi({ titolo: files.length === 1 ? files[0].name.replace(/\.[^.]+$/, '') : `${files.length} documenti`, files });
  if (esito === 'non_disponibile' || esito === 'link') { files.forEach(scaricaDocumento); ctx.mostra('Condivisione non disponibile: file scaricati.'); }
}

// Riga di un documento (usata anche nei Recenti della Home).
export function RigaDocumento({ d, selezionabile, scelto, onScegli, onApri, onCondividi, onMenu, menuAperto, children }) {
  return (
    <div className={`scan-recente${scelto ? ' scelto' : ''}`}>
      {selezionabile && <input type="checkbox" className="scan-doc-check" aria-label={`Seleziona ${d.nome}`} checked={scelto} onChange={onScegli} />}
      <button className="scan-recente-apri" onClick={selezionabile ? onScegli : onApri}>
        {d.miniatura ? <img className="scan-doc-mini" src={d.miniatura} alt="" />
          : <span className={`scan-recente-tipo${ePdf(d) ? ' pdf' : ''}`} aria-hidden="true">{ePdf(d) ? 'PDF' : (d.nome.match(/\.([^.]+)$/)?.[1] || 'FILE').slice(0, 4).toUpperCase()}</span>}
        <span className="scan-recente-testo"><strong>{d.nome.replace(/\.[^.]+$/, '')}</strong>
          <small>{new Date(d.modificato).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {formatoPeso(d.dimensione)}{d.cartella && d.cartella !== CARTELLA_BASE ? ` · ${d.cartella}` : ''}</small></span>
      </button>
      {!selezionabile && <>
        <button className="scan-recente-azione" aria-label={`Condividi ${d.nome}`} onClick={onCondividi}><IconaCondividi size={20} /></button>
        <button className="scan-recente-azione" aria-label={`Altre azioni per ${d.nome}`} aria-expanded={menuAperto} onClick={onMenu}>⋮</button>
      </>}
      {children}
    </div>
  );
}

// Foglio per scegliere la cartella (spostare o salvare), con «Nuova cartella».
export function SceltaCartella({ cartelle, titolo, onScegli, onChiudi }) {
  const [nuova, setNuova] = useState('');
  return (
    <div className="scan-scrim" role="dialog" aria-label={titolo} onClick={(e) => e.target === e.currentTarget && onChiudi()}>
      <section className="scan-foglio-azioni">
        <h2>{titolo}</h2>
        {cartelle.map((c) => <button key={c.nome} className="scan-voce" onClick={() => onScegli(c.nome)}><IconaDocumenti size={20} /> <span>{c.nome}</span> <small>{c.quanti}</small></button>)}
        <form className="scan-nuova-cartella" onSubmit={async (e) => { e.preventDefault(); if (nuova.trim()) onScegli(await creaCartella(nuova)); }}>
          <input aria-label="Nuova cartella" placeholder="Nuova cartella…" value={nuova} onChange={(e) => setNuova(e.target.value)} />
          <button className="pp-bottone" disabled={!nuova.trim()}>Crea</button>
        </form>
        <button className="pp-bottone pp-bottone-chiaro pp-bottone-largo" onClick={onChiudi}>Annulla</button>
      </section>
    </div>
  );
}

export function Documenti({ ctx, versione, onCambia }) {
  const { mostra } = ctx;
  const [docs, setDocs] = useState(null);
  const [create, setCreate] = useState([]);
  const [cerca, setCerca] = useState('');
  const [cartella, setCartella] = useState(null);
  const [ordine, setOrdine] = useState('recenti');
  const [menu, setMenu] = useState(null);
  const [scelti, setScelti] = useState(null); // Set di id in modalità selezione
  const [foglio, setFoglio] = useState(null); // { tipo: 'sposta'|'rinomina'|'elimina'|'cartella', ids, d }
  const [nome, setNome] = useState('');

  const carica = useCallback(() => {
    Promise.all([elencoDocumenti(), cartelleCreate()]).then(([d, c]) => { setDocs(d); setCreate(c); }).catch(() => { setDocs([]); setCreate([]); });
  }, []);
  useEffect(carica, [carica, versione]);
  const cambiato = () => { carica(); onCambia?.(); };
  const cartelle = useMemo(() => elencoCartelle(docs || [], create), [docs, create]);
  const visibili = useMemo(() => filtraDocumenti(docs || [], { cerca, cartella, ordine }), [docs, cerca, cartella, ordine]);
  const selezionati = (docs || []).filter((d) => scelti?.has(d.id));
  const prova = (fn) => async (...a) => { try { await fn(...a); } catch (e) { mostra(e.message || String(e)); } };

  const unisci = prova(async () => {
    const files = await Promise.all(selezionati.map((d) => fileDocumento(d.id)));
    const { unisciInPdf } = await import('../lib/pdfUnico.js');
    const { file, esclusi } = await unisciInPdf(files, nomeAutomatico(new Date(), 'Unione'));
    await salvaDocumenti([file], { cartella: cartella || selezionati[0]?.cartella || CARTELLA_BASE, miniature: [await creaMiniatura(file)] });
    setScelti(null); cambiato();
    mostra(esclusi.length ? `PDF creato. Non uniti: ${esclusi.join(', ')}` : `Creato «${file.name}».`);
  });

  const gruppi = [];
  for (const d of visibili) {
    const g = ordine === 'recenti' || ordine === 'vecchi' ? gruppoData(d.modificato) : '';
    if (gruppi.at(-1)?.[0] !== g) gruppi.push([g, []]);
    gruppi.at(-1)[1].push(d);
  }

  return (
    <div className="scan-documenti">
      <div className="scan-cerca">
        <IconaCerca size={20} />
        <input type="search" aria-label="Cerca nei documenti" placeholder="Cerca per nome o testo…" value={cerca} onChange={(e) => setCerca(e.target.value)} />
        {cerca && <button aria-label="Cancella ricerca" onClick={() => setCerca('')}><IconaChiudi size={18} /></button>}
      </div>
      <div className="scan-cartelle" role="tablist" aria-label="Cartelle">
        <button role="tab" aria-selected={!cartella} className={!cartella ? 'attiva' : ''} onClick={() => setCartella(null)}>Tutti <small>{docs?.length || 0}</small></button>
        {cartelle.map((c) => <button key={c.nome} role="tab" aria-selected={cartella === c.nome} className={cartella === c.nome ? 'attiva' : ''} onClick={() => setCartella(c.nome)}>{c.nome} <small>{c.quanti}</small></button>)}
        <button className="scan-cartella-nuova" onClick={() => setFoglio({ tipo: 'cartella' })}>+ Cartella</button>
      </div>
      <div className="scan-barra-elenco">
        <label><span className="pp-sr">Ordina</span><select value={ordine} onChange={(e) => setOrdine(e.target.value)} aria-label="Ordina">{ORDINI.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        {cartella && cartella !== CARTELLA_BASE && !scelti && <button className="pp-testo-link" onClick={() => setFoglio({ tipo: 'eliminaCartella' })}>Elimina cartella</button>}
        {visibili.length > 0 && <button className="pp-testo-link" onClick={() => setScelti(scelti ? null : new Set())}>{scelti ? 'Fine' : 'Seleziona'}</button>}
      </div>

      {docs && !docs.length && (
        <div className="scan-recenti-vuoto"><strong>Nessun documento ancora</strong><p>Scansiona o apri un file: i PDF che crei restano qui, solo su questo telefono, in cartelle tue.</p></div>
      )}
      {docs && docs.length > 0 && !visibili.length && <p className="pp-riga-meta">Nessun documento trovato{cerca ? ` per «${cerca}»` : ''}.</p>}

      {gruppi.map(([g, righe]) => (
        <div key={g || 'tutti'} className="scan-recenti-gruppo">
          {g && <h3>{g}</h3>}
          {righe.map((d) => (
            <RigaDocumento key={d.id} d={d} selezionabile={!!scelti} scelto={!!scelti?.has(d.id)}
              onScegli={() => setScelti((s) => { const n = new Set(s); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n; })}
              onApri={prova(() => apriFileDocumento(ctx, d))} onCondividi={prova(() => condividiDocumenti(ctx, [d]))}
              onMenu={() => setMenu(menu === d.id ? null : d.id)} menuAperto={menu === d.id}>
              {menu === d.id && (
                <div className="scan-recente-menu">
                  <button onClick={() => { setMenu(null); setNome(d.nome.replace(/\.[^.]+$/, '')); setFoglio({ tipo: 'rinomina', d }); }}>Rinomina</button>
                  <button onClick={() => { setMenu(null); setFoglio({ tipo: 'sposta', ids: [d.id] }); }}>Sposta in una cartella</button>
                  <button onClick={prova(async () => { setMenu(null); scaricaDocumento(await fileDocumento(d.id)); })}>Salva sul telefono</button>
                  {(ePdf(d) || (d.tipo || '').startsWith('image/')) && <button onClick={prova(async () => { setMenu(null); ctx.apri({ tipo: 'carica', file: await fileDocumento(d.id), opzioni: { descrizione: d.nome.replace(/\.[^.]+$/, ''), scelto: true, soloArchiviazione: true, nonAnalizzare: true, destinazione: true } }); })}>Archivia in Personal o Studio</button>}
                  <button className="pericolo" onClick={() => { setMenu(null); setFoglio({ tipo: 'elimina', ids: [d.id] }); }}><IconaCestino size={16} /> Elimina</button>
                </div>
              )}
            </RigaDocumento>
          ))}
        </div>
      ))}

      {scelti && (
        <div className="scan-azioni-selezione" role="toolbar" aria-label="Azioni sui documenti selezionati">
          <strong>{scelti.size} selezionati</strong>
          <button disabled={selezionati.length < 2} onClick={unisci}>Unisci in PDF</button>
          <button disabled={!selezionati.length} onClick={prova(() => condividiDocumenti(ctx, selezionati))}>Condividi</button>
          <button disabled={!selezionati.length} onClick={() => setFoglio({ tipo: 'sposta', ids: [...scelti] })}>Sposta</button>
          <button disabled={!selezionati.length} className="pericolo" onClick={() => setFoglio({ tipo: 'elimina', ids: [...scelti] })}>Elimina</button>
        </div>
      )}

      {foglio?.tipo === 'sposta' && <SceltaCartella cartelle={cartelle} titolo="Sposta in" onChiudi={() => setFoglio(null)}
        onScegli={prova(async (c) => { await spostaDocumenti(foglio.ids, c); setFoglio(null); setScelti(null); cambiato(); mostra(`Spostati in «${c}».`); })} />}
      {foglio?.tipo === 'cartella' && <SceltaCartella cartelle={cartelle} titolo="Cartelle" onChiudi={() => setFoglio(null)}
        onScegli={(c) => { setFoglio(null); setCartella(c); cambiato(); }} />}
      {foglio?.tipo === 'rinomina' && (
        <div className="scan-scrim" role="dialog" aria-label="Rinomina">
          <form className="scan-foglio-azioni" onSubmit={prova(async (e) => { e.preventDefault(); const n = await rinominaDocumento(foglio.d.id, nome); setFoglio(null); cambiato(); mostra(`Rinominato «${n}».`); })}>
            <h2>Rinomina</h2>
            <input className="scan-campo" aria-label="Nuovo nome" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
            <button className="pp-bottone pp-bottone-largo" disabled={!nome.trim()}>Salva nome</button>
            <button type="button" className="pp-bottone pp-bottone-chiaro pp-bottone-largo" onClick={() => setFoglio(null)}>Annulla</button>
          </form>
        </div>
      )}
      {(foglio?.tipo === 'elimina' || foglio?.tipo === 'eliminaCartella') && (
        <div className="scan-scrim" role="alertdialog" aria-label="Conferma eliminazione">
          <section className="scan-foglio-azioni">
            <h2>{foglio.tipo === 'elimina' ? (foglio.ids.length === 1 ? 'Eliminare il documento?' : `Eliminare ${foglio.ids.length} documenti?`) : `Eliminare la cartella «${cartella}»?`}</h2>
            <p>{foglio.tipo === 'elimina' ? 'Vengono tolti da questo telefono. Le copie già condivise, salvate o archiviate in Personal non cambiano.' : 'I documenti dentro passano in «Generale», nessun file viene eliminato.'}</p>
            <button className="pp-bottone pp-bottone-largo scan-pericolo" onClick={prova(async () => {
              if (foglio.tipo === 'elimina') await eliminaDocumenti(foglio.ids); else { await eliminaCartella(cartella); setCartella(null); }
              setFoglio(null); setScelti(null); cambiato();
            })}>Elimina</button>
            <button className="pp-bottone pp-bottone-chiaro pp-bottone-largo" onClick={() => setFoglio(null)}>Annulla</button>
          </section>
        </div>
      )}
    </div>
  );
}
