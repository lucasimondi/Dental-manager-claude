// SCAN-LIBRERIA + SCAN-ORGANIZZA (PO 2026-11-12: «Prova con a b d») — la scheda «File» di Scan,
// proposta A: ricerca (nome, testo letto, etichette), strumenti rapidi, schede Recenti · Cartelle ·
// Preferiti · Archivio, filtro per tipo, elenco o griglia, stella e «Telefono / Archivio» su ogni file.
// «Cartelle» mostra le categorie (proposta B, come «I miei ID», con le scadenze) e le cartelle create.
// Toccare un file apre la sua scheda (proposta D). Tutto solo su questo telefono.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CARTELLA_BASE, elencoDocumenti, cartelleCreate, creaCartella, eliminaCartella, fileDocumento, filtraDocumenti, elencoCartelle,
  formatoPeso, gruppoData, rinominaDocumento, spostaDocumenti, eliminaDocumenti, salvaDocumenti, ePdf, nomeAutomatico, aggiornaDocumento, tipoDi,
} from '../lib/libreria.js';
import { condividi, scaricaDocumento } from '../lib/condividi.js';
import { IconaCerca, IconaCondividi, IconaCestino, IconaDocumenti, IconaChiudi, IconaAltro } from '../Icone.jsx';
import { creaMiniatura } from './miniaturaFile.js';
import { FORMATI, esporta } from './esporta.js';
import { CATEGORIE, categoria as categoriaDi, avvisoScadenza } from './categorie.js';

const ORDINI = [['recenti', 'Più recenti'], ['vecchi', 'Meno recenti'], ['nome', 'Nome A-Z'], ['peso', 'Più pesanti']];
const SCHEDE = [['recenti', 'Recenti'], ['cartelle', 'Cartelle'], ['preferiti', 'Preferiti'], ['archivio', 'Archivio']];
const TIPI = [[null, 'Tutti'], ['pdf', 'PDF'], ['foto', 'Foto'], ['word', 'Word'], ['testo', 'Testo']];
const RAPIDI = [['firma', 'Firma PDF', '#b42318'], ['parola', 'PDF in Word', '#1f6fe5'], ['unisci', 'Unisci', '#6d4bd6'], ['traduci', 'Traduci', '#0f7a55']];
const COLORI_TIPO = { pdf: '#e5383b', foto: '#0f8a5f', word: '#2f6fd1', testo: '#667085' };

export const estensioneDi = (d) => (d.nome.match(/\.([^.]+)$/)?.[1] || 'FILE').slice(0, 4).toUpperCase();
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

// Riga di un documento (anche nei Recenti della Home): miniatura, nome, «Telefono / Archivio», stella, ⋮.
export function RigaDocumento({ d, selezionabile, scelto, onScegli, onApri, onCondividi, onStella, onMenu, menuAperto, children }) {
  const cat = categoriaDi(d.categoria);
  return (
    <div className={`scan-recente${scelto ? ' scelto' : ''}`}>
      {selezionabile && <input type="checkbox" className="scan-doc-check" aria-label={`Seleziona ${d.nome}`} checked={scelto} onChange={onScegli} />}
      <button className="scan-recente-apri" onClick={selezionabile ? onScegli : onApri}>
        {d.miniatura ? <span className="scan-doc-mini-box"><img className="scan-doc-mini" src={d.miniatura} alt="" /><em style={{ background: COLORI_TIPO[tipoDi(d)] }}>{estensioneDi(d)}</em></span>
          : <span className="scan-recente-tipo" style={{ background: COLORI_TIPO[tipoDi(d)] }} aria-hidden="true">{estensioneDi(d)}</span>}
        <span className="scan-recente-testo"><strong>{d.nome.replace(/\.[^.]+$/, '')}</strong>
          <small><span className={`scan-dove${d.archiviato ? ' archivio' : ''}`}>{d.archiviato ? 'Archivio' : 'Telefono'}</span>{cat.id !== 'generali' ? `${cat.nome} · ` : ''}{new Date(d.modificato).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} · {formatoPeso(d.dimensione)}</small></span>
      </button>
      {!selezionabile && <>
        {onStella && <button className={`scan-stella${d.preferito ? ' attiva' : ''}`} aria-label={d.preferito ? `Togli ${d.nome} dai preferiti` : `Aggiungi ${d.nome} ai preferiti`} aria-pressed={!!d.preferito} onClick={onStella}>★</button>}
        {onCondividi && !onStella && <button className="scan-recente-azione" aria-label={`Condividi ${d.nome}`} onClick={onCondividi}><IconaCondividi size={20} /></button>}
        {onMenu && <button className="scan-recente-azione" aria-label={`Altre azioni per ${d.nome}`} aria-expanded={menuAperto} onClick={onMenu}>⋮</button>}
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

// Proposta B: le categorie come card colorate, con il numero di file e gli avvisi di scadenza.
export function CardCategorie({ docs, onApri }) {
  const conta = {}; const scadenze = [];
  for (const d of docs) {
    conta[d.categoria || 'generali'] = (conta[d.categoria || 'generali'] || 0) + 1;
    const a = avvisoScadenza(d.scadenza);
    if (a) scadenze.push({ d, a });
  }
  scadenze.sort((x, y) => x.a.giorni - y.a.giorni);
  return (
    <>
      {scadenze.length > 0 && (
        <div className="scan-scadenze" role="status">
          {scadenze.slice(0, 3).map(({ d, a }) => <span key={d.id}><strong>{d.nome.replace(/\.[^.]+$/, '')}</strong> {a.testo}</span>)}
        </div>
      )}
      <div className="scan-categorie">
        {CATEGORIE.map((c) => (
          <button key={c.id} className="scan-categoria" style={{ background: c.sfondo, color: c.testo }} onClick={() => onApri(c.id)}>
            <span className="scan-categoria-sigla" style={{ color: c.icona }}>{c.sigla}</span>
            <strong>{c.nome}</strong>
            <span className="scan-categoria-quanti">{conta[c.id] || 0} {conta[c.id] === 1 ? 'file' : 'file'}</span>
            <span aria-hidden="true">›</span>
          </button>
        ))}
      </div>
    </>
  );
}

export function Documenti({ ctx, versione, onCambia, onStrumento }) {
  const { mostra } = ctx;
  const [docs, setDocs] = useState(null);
  const [create, setCreate] = useState([]);
  const [cerca, setCerca] = useState('');
  const [scheda, setScheda] = useState('recenti');
  const [dentro, setDentro] = useState(null); // { tipo: 'categoria'|'cartella', id }
  const [tipo, setTipo] = useState(null);
  const [griglia, setGriglia] = useState(false);
  const [ordine, setOrdine] = useState('recenti');
  const [menu, setMenu] = useState(null);
  const [scelti, setScelti] = useState(null);
  const [foglio, setFoglio] = useState(null);
  const [nome, setNome] = useState('');
  const [lavoro, setLavoro] = useState(null);

  const carica = useCallback(() => {
    Promise.all([elencoDocumenti(), cartelleCreate()]).then(([d, c]) => { setDocs(d); setCreate(c); }).catch(() => { setDocs([]); setCreate([]); });
  }, []);
  useEffect(carica, [carica, versione]);
  const cambiato = () => { carica(); onCambia?.(); };
  const cartelle = useMemo(() => elencoCartelle(docs || [], create), [docs, create]);
  const filtri = {
    cerca, tipo, ordine,
    preferiti: scheda === 'preferiti', archiviati: scheda === 'archivio',
    categoria: dentro?.tipo === 'categoria' ? dentro.id : null, cartella: dentro?.tipo === 'cartella' ? dentro.id : null,
  };
  const elenco = scheda !== 'cartelle' || dentro || cerca;
  const visibili = useMemo(() => filtraDocumenti(docs || [], filtri), [docs, cerca, tipo, ordine, scheda, dentro]); // eslint-disable-line react-hooks/exhaustive-deps
  const selezionati = (docs || []).filter((d) => scelti?.has(d.id));
  const prova = (fn) => async (...a) => { try { await fn(...a); } catch (e) { mostra(e.message || String(e)); } };
  const apriScheda = (d) => ctx.apri({ tipo: 'scheda', id: d.id });
  const stella = (d) => prova(async () => { await aggiornaDocumento(d.id, { preferito: !d.preferito }); cambiato(); });

  const unisci = prova(async () => {
    const files = await Promise.all(selezionati.map((d) => fileDocumento(d.id)));
    const { unisciInPdf } = await import('../lib/pdfUnico.js');
    const { file, esclusi } = await unisciInPdf(files, nomeAutomatico(new Date(), 'Unione'));
    await salvaDocumenti([file], { cartella: selezionati[0]?.cartella || CARTELLA_BASE, categorie: [selezionati[0]?.categoria || 'generali'], miniature: [await creaMiniatura(file)] });
    setScelti(null); cambiato();
    mostra(esclusi.length ? `PDF creato. Non uniti: ${esclusi.join(', ')}` : `Creato «${file.name}».`);
  });
  const esportaCome = (d, formato) => prova(async () => {
    setFoglio(null); setLavoro('Preparo…');
    try {
      const files = await esporta[formato](await fileDocumento(d.id), { onAvanzamento: setLavoro });
      ctx.ricorda?.(files, { cartella: d.cartella || CARTELLA_BASE });
      mostra(files.length > 1 ? `Create ${files.length} immagini.` : `Creato «${files[0].name}».`,
        { etichetta: 'Condividi', fai: async () => { const r = await condividi({ titolo: files[0].name, files }); if (r === 'non_disponibile' || r === 'link') { files.forEach(scaricaDocumento); return 'File scaricati.'; } return 'Pronto da condividere.'; } });
    } finally { setLavoro(null); }
  })();

  const gruppi = [];
  for (const d of visibili) {
    const g = ordine === 'recenti' || ordine === 'vecchi' ? gruppoData(d.modificato) : '';
    if (gruppi.at(-1)?.[0] !== g) gruppi.push([g, []]);
    gruppi.at(-1)[1].push(d);
  }
  const titoloDentro = dentro ? (dentro.tipo === 'categoria' ? categoriaDi(dentro.id).nome : dentro.id) : null;

  return (
    <div className="scan-documenti">
      <div className="scan-cerca">
        <IconaCerca size={20} />
        <input type="search" aria-label="Cerca nei documenti" placeholder="Cerca nome, testo o #etichetta…" value={cerca} onChange={(e) => setCerca(e.target.value)} />
        {cerca && <button aria-label="Cancella ricerca" onClick={() => setCerca('')}><IconaChiudi size={18} /></button>}
      </div>
      {onStrumento && (
        <div className="scan-rapidi" role="group" aria-label="Strumenti rapidi">
          {RAPIDI.map(([id, nomeR, colore]) => <button key={id} style={{ color: colore }} onClick={() => onStrumento(id)}>{nomeR}</button>)}
        </div>
      )}
      <div className="scan-schede-file" role="tablist" aria-label="Documenti">
        {SCHEDE.map(([id, n]) => <button key={id} role="tab" aria-selected={scheda === id} className={scheda === id ? 'attiva' : ''} onClick={() => { setScheda(id); setDentro(null); setScelti(null); }}>{n}</button>)}
      </div>

      {scheda === 'cartelle' && !dentro && !cerca && docs && (
        <>
          <CardCategorie docs={docs} onApri={(id) => setDentro({ tipo: 'categoria', id })} />
          <div className="scan-recenti-testa"><h2>Le tue cartelle</h2><button className="pp-testo-link" onClick={() => setFoglio({ tipo: 'cartella' })}>+ Cartella</button></div>
          {cartelle.map((c) => <button key={c.nome} className="scan-voce scan-voce-cartella" onClick={() => setDentro({ tipo: 'cartella', id: c.nome })}><IconaDocumenti size={20} /> <span>{c.nome}</span> <small>{c.quanti}</small></button>)}
        </>
      )}

      {elenco && (
        <>
          {dentro && (
            <div className="scan-dentro">
              <button className="pp-testo-link" onClick={() => { setDentro(null); setScelti(null); }}>‹ Cartelle</button>
              <h2>{titoloDentro}</h2>
              {dentro.tipo === 'cartella' && dentro.id !== CARTELLA_BASE && <button className="pp-testo-link" onClick={() => setFoglio({ tipo: 'eliminaCartella' })}>Elimina</button>}
            </div>
          )}
          <div className="scan-barra-elenco">
            <div className="scan-tipi" role="group" aria-label="Tipo di file">
              {TIPI.map(([id, n]) => <button key={n} aria-pressed={tipo === id} className={tipo === id ? 'attivo' : ''} onClick={() => setTipo(id)}>{n}</button>)}
            </div>
          </div>
          <div className="scan-barra-elenco">
            <label><span className="pp-sr">Ordina</span><select value={ordine} onChange={(e) => setOrdine(e.target.value)} aria-label="Ordina">{ORDINI.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <button className="scan-vista" aria-label={griglia ? 'Vista a elenco' : 'Vista a griglia'} aria-pressed={griglia} onClick={() => setGriglia(!griglia)}><IconaAltro size={20} /></button>
            {visibili.length > 0 && <button className="pp-testo-link" onClick={() => setScelti(scelti ? null : new Set())}>{scelti ? 'Fine' : 'Seleziona'}</button>}
          </div>
          {lavoro && <p className="pp-riga-meta" role="status"><span className="pp-rotella" /> {lavoro}</p>}
          {docs && !docs.length && <div className="scan-recenti-vuoto"><strong>Nessun documento ancora</strong><p>Scansiona o apri un file: i documenti restano qui, solo su questo telefono, ordinati per categoria.</p></div>}
          {docs && docs.length > 0 && !visibili.length && <p className="pp-riga-meta">{scheda === 'preferiti' && !cerca ? 'Nessun preferito: tocca ★ su un documento.' : scheda === 'archivio' && !cerca ? 'Nessun documento archiviato in Personal da Scan.' : `Nessun documento${cerca ? ` per «${cerca}»` : ''}.`}</p>}

          {griglia ? (
            <div className="scan-griglia-doc">
              {visibili.map((d) => (
                <button key={d.id} className={`scan-copertina${scelti?.has(d.id) ? ' scelto' : ''}`} onClick={() => (scelti ? setScelti((s) => { const n = new Set(s); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n; }) : apriScheda(d))}>
                  <span className="scan-copertina-img">{d.miniatura ? <img src={d.miniatura} alt="" /> : null}<em style={{ background: COLORI_TIPO[tipoDi(d)] }}>{estensioneDi(d)}</em>{d.preferito && <b aria-label="Preferito">★</b>}</span>
                  <strong>{d.nome.replace(/\.[^.]+$/, '')}</strong>
                  <small>{new Date(d.modificato).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</small>
                </button>
              ))}
            </div>
          ) : gruppi.map(([g, righe]) => (
            <div key={g || 'tutti'} className="scan-recenti-gruppo">
              {g && <h3>{g}</h3>}
              {righe.map((d) => (
                <RigaDocumento key={d.id} d={d} selezionabile={!!scelti} scelto={!!scelti?.has(d.id)}
                  onScegli={() => setScelti((s) => { const n = new Set(s); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n; })}
                  onApri={() => apriScheda(d)} onStella={stella(d)}
                  onMenu={() => setMenu(menu === d.id ? null : d.id)} menuAperto={menu === d.id}>
                  {menu === d.id && (
                    <div className="scan-recente-menu">
                      <button onClick={prova(async () => { setMenu(null); await condividiDocumenti(ctx, [d]); })}>Condividi</button>
                      <button onClick={() => { setMenu(null); setNome(d.nome.replace(/\.[^.]+$/, '')); setFoglio({ tipo: 'rinomina', d }); }}>Rinomina</button>
                      <button onClick={() => { setMenu(null); setFoglio({ tipo: 'sposta', ids: [d.id] }); }}>Sposta in una cartella</button>
                      <button onClick={() => { setMenu(null); setFoglio({ tipo: 'esporta', d }); }}>Esporta come Word, JPG, testo</button>
                      <button onClick={prova(async () => { setMenu(null); scaricaDocumento(await fileDocumento(d.id)); })}>Salva sul telefono</button>
                      <button className="pericolo" onClick={() => { setMenu(null); setFoglio({ tipo: 'elimina', ids: [d.id] }); }}><IconaCestino size={16} /> Elimina</button>
                    </div>
                  )}
                </RigaDocumento>
              ))}
            </div>
          ))}
        </>
      )}

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
        onScegli={(c) => { setFoglio(null); setDentro({ tipo: 'cartella', id: c }); cambiato(); }} />}
      {foglio?.tipo === 'esporta' && (
        <div className="scan-scrim" role="dialog" aria-label="Esporta" onClick={(e) => e.target === e.currentTarget && setFoglio(null)}>
          <section className="scan-foglio-azioni">
            <h2>Esporta «{foglio.d.nome.replace(/\.[^.]+$/, '')}»</h2>
            <p>Il documento originale resta com'è; il nuovo file va nella stessa cartella.</p>
            {FORMATI.filter(([f]) => f !== 'jpg' || ePdf(foglio.d)).map(([f, titolo, nota]) => (
              <button key={f} className="scan-voce" onClick={() => esportaCome(foglio.d, f)}><span>{titolo}</span><small>{nota}</small></button>
            ))}
            <button className="pp-bottone pp-bottone-chiaro pp-bottone-largo" onClick={() => setFoglio(null)}>Annulla</button>
          </section>
        </div>
      )}
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
            <h2>{foglio.tipo === 'elimina' ? (foglio.ids.length === 1 ? 'Eliminare il documento?' : `Eliminare ${foglio.ids.length} documenti?`) : `Eliminare la cartella «${dentro?.id}»?`}</h2>
            <p>{foglio.tipo === 'elimina' ? 'Vengono tolti da questo telefono. Le copie già condivise, salvate o archiviate in Personal non cambiano.' : 'I documenti dentro passano in «Generale», nessun file viene eliminato.'}</p>
            <button className="pp-bottone pp-bottone-largo scan-pericolo" onClick={prova(async () => {
              if (foglio.tipo === 'elimina') await eliminaDocumenti(foglio.ids); else { await eliminaCartella(dentro.id); setDentro(null); }
              setFoglio(null); setScelti(null); cambiato();
            })}>Elimina</button>
            <button className="pp-bottone pp-bottone-chiaro pp-bottone-largo" onClick={() => setFoglio(null)}>Annulla</button>
          </section>
        </div>
      )}
    </div>
  );
}
