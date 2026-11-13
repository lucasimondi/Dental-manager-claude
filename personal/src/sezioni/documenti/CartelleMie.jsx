// POL-VITA-031 CARTELLE-MIE — le tue cartelle e sottocartelle.
// Dentro una cartella: sottocartelle e documenti, selezionabili insieme («Seleziona» o tieni premuto
// un documento). Sulle cose scelte: Invia (file singoli o ZIP, con password facoltativa), Sposta,
// Togli dalla cartella, Rinomina, Archivia. Le cartelle non si cancellano: si archiviano.
// Un documento può stare in più cartelle; i file su Drive non si spostano.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { cercaChiedi } from '../../lib/archivio.js';
import { interpretaDomanda } from '../../lib/interpreta.js';
import {
  caricaCartelleMie, creaCartella, rinominaCartella, spostaCartelle, archiviaCartelle,
  documentiDellaCartella, aggiungiDocumenti, togliDocumenti, destinazioniPossibili, elencoConPercorso, percorso, cartelleDelDocumento,
} from '../../lib/cartelleMie.js';
import { preparaVoci, scaricaFile, creaZip, MAX_FILE_ZIP } from '../../lib/pacchetto.js';
import { preparaFile, comeFile, condividi, scaricaDocumento } from '../../lib/condividi.js';
import { Vuoto, Gruppo, titoloDoc, dataBreve, tokenSessione } from '../../ui.jsx';
import { IconaChiudi, IconaDocumenti, IconaPiu, IconaCondividi, IconaLucchetto, IconaFreccia, IconaCerca } from '../../Icone.jsx';
import { VoceDocumento } from './Selezione.jsx';

const MAX_FILE_SINGOLI = 20;

/* ---------- fogli ---------- */
function Foglio({ titolo, onChiudi, children }) {
  return (
    <div className="pp-velo" onClick={onChiudi}>
      <div className="pp-foglio" role="dialog" aria-label={titolo} onClick={(e) => e.stopPropagation()}>
        <div className="pp-foglio-maniglia" />
        <div className="pp-foglio-testa"><span>{titolo}</span>
          <button type="button" className="pp-icona-bottone pp-piccolo" onClick={onChiudi} aria-label="Chiudi"><IconaChiudi size={18} /></button>
        </div>
        <div className="pp-foglio-corpo">{children}</div>
      </div>
    </div>
  );
}

// Un nome (nuova cartella, rinomina). Niente window.prompt: nell'app Android non compare.
export function FoglioNome({ titolo, iniziale = '', etichetta = 'Salva', onConferma, onChiudi }) {
  const [nome, setNome] = useState(iniziale);
  const invia = (e) => { e.preventDefault(); if (nome.trim()) onConferma(nome.trim()); };
  return (
    <Foglio titolo={titolo} onChiudi={onChiudi}>
      <form onSubmit={invia}>
        <label className="pp-campo">Nome
          <input autoFocus value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} placeholder="Es. Casa, Auto, Commercialista 2026" />
        </label>
        <button type="submit" className="pp-bottone pp-mie-largo" disabled={!nome.trim()}>{etichetta}</button>
      </form>
    </Foglio>
  );
}

// Scegli una delle tue cartelle (o creane una nuova lì per lì).
export function FoglioCartelleMie({ titolo, cartelle, escludi = null, radice = false, onScegli, onChiudi, ctx }) {
  const [filtro, setFiltro] = useState('');
  const [nuova, setNuova] = useState(false);
  const voci = elencoConPercorso(escludi ? cartelle.filter((c) => !escludi.has(c.id)) : cartelle)
    .filter((v) => !filtro || v.nome.toLowerCase().includes(filtro.toLowerCase()));
  if (nuova) {
    return <FoglioNome titolo="Nuova cartella" etichetta="Crea e scegli" onChiudi={() => setNuova(false)}
      onConferma={(nome) => ctx.esegui(async () => { const c = await creaCartella(archivioDb, { nome }); onScegli(c.id, c.nome); })} />;
  }
  return (
    <Foglio titolo={titolo} onChiudi={onChiudi}>
      <div className="pp-cerca pp-cerca-foglio"><IconaCerca size={16} /><input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Cerca una cartella" aria-label="Cerca una cartella" /></div>
      <Gruppo>
        <button type="button" className="pp-riga" onClick={() => setNuova(true)}><IconaPiu size={18} /><span className="pp-riga-testo"><span className="pp-riga-titolo">Nuova cartella…</span></span></button>
        {radice && <button type="button" className="pp-riga" onClick={() => onScegli(null, 'Le mie cartelle')}><span className="pp-riga-testo"><span className="pp-riga-titolo">Le mie cartelle</span><span className="pp-riga-meta">in cima, fuori da altre cartelle</span></span></button>}
        {voci.map((v) => (
          <button key={v.id} type="button" className="pp-riga" onClick={() => onScegli(v.id, v.nome)}>
            <IconaDocumenti size={18} /><span className="pp-riga-testo"><span className="pp-riga-titolo">{v.nome}</span></span>
          </button>
        ))}
        {!voci.length && !radice && <p className="pp-vuoto">Nessuna cartella: creane una.</p>}
      </Gruppo>
    </Foglio>
  );
}

// Aggiungi documenti a questa cartella cercandoli (stessa ricerca di «Chiedi»).
function FoglioAggiungi({ ctx, giaDentro, onAggiungi, onChiudi }) {
  const [testo, setTesto] = useState('');
  const [trovati, setTrovati] = useState([]);
  const [scelti, setScelti] = useState(new Set());
  useEffect(() => {
    const q = interpretaDomanda(testo, { persone: ctx.impostazioni?.persone || [] });
    if (q.vuota || testo.trim().length < 2) { setTrovati([]); return undefined; }
    let vivo = true;
    const t = setTimeout(() => { cercaChiedi(archivioDb, { testo: q.testo, filtri: q.filtri, limite: 50 }).then((r) => { if (vivo) setTrovati(r); }).catch(() => {}); }, 300);
    return () => { vivo = false; clearTimeout(t); };
  }, [testo]); // eslint-disable-line react-hooks/exhaustive-deps
  const tocca = (id) => setScelti((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <Foglio titolo="Aggiungi documenti" onChiudi={onChiudi}>
      <div className="pp-cerca pp-cerca-foglio"><IconaCerca size={16} /><input autoFocus value={testo} onChange={(e) => setTesto(e.target.value)} placeholder="Cerca: bollette luce 2025, polizza auto…" aria-label="Cerca documenti da aggiungere" /></div>
      <Gruppo>
        {trovati.map((d) => {
          const dentro = giaDentro.has(d.id);
          const scelto = scelti.has(d.id);
          return (
            <button key={d.id} type="button" className={`pp-riga${scelto ? ' scelta' : ''}`} disabled={dentro} onClick={() => tocca(d.id)} aria-pressed={scelto}>
              <span className={`pp-casella${scelto || dentro ? ' scelta' : ''}`} aria-hidden="true">{scelto || dentro ? '✓' : ''}</span>
              <span className="pp-riga-testo"><span className="pp-riga-titolo">{titoloDoc(d)}</span><span className="pp-riga-meta">{dentro ? 'già nella cartella' : [d.ente, dataBreve(d.data_documento || d.email_data)].filter(Boolean).join(' · ')}</span></span>
            </button>
          );
        })}
        {testo.trim().length >= 2 && !trovati.length && <p className="pp-vuoto">Nessun documento.</p>}
      </Gruppo>
      <button type="button" className="pp-bottone pp-mie-largo" disabled={!scelti.size} onClick={() => onAggiungi([...scelti])}>{scelti.size ? `Aggiungi ${scelti.size}` : 'Scegli i documenti'}</button>
    </Foglio>
  );
}

// Invia: file singoli o ZIP, password facoltativa; poi Condividi / Scarica (toccati da te).
function FoglioInvia({ nomeIniziale, nCartelle, nDocumenti, onPrepara, stato, onChiudi, mostra }) {
  const singoliPossibili = nCartelle === 0 && nDocumenti > 0 && nDocumenti <= MAX_FILE_SINGOLI;
  const [formato, setFormato] = useState(singoliPossibili && nDocumenti === 1 ? 'file' : 'zip');
  const [nome, setNome] = useState(nomeIniziale);
  const [conPassword, setConPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [ripeti, setRipeti] = useState('');
  const [protezione, setProtezione] = useState('forte');
  const erroreP = conPassword && (password.length < 4 ? 'Almeno 4 caratteri' : password !== ripeti ? 'Le due password non coincidono' : null);
  const pronto = stato?.fase === 'pronto';
  const condividiOra = async () => {
    try {
      const r = await condividi({ titolo: nome, file: stato.files.length === 1 ? stato.files[0] : null, files: stato.files });
      if (r === 'non_disponibile') mostra('Condivisione non disponibile qui: usa «Scarica»');
    } catch (e) { mostra(e.message); }
  };
  return (
    <Foglio titolo="Invia" onChiudi={onChiudi}>
      {!stato && (
        <>
          <p className="pp-riga-meta pp-mie-riassunto">{[nCartelle ? `${nCartelle} ${nCartelle === 1 ? 'cartella' : 'cartelle'} con le sottocartelle` : null, nDocumenti ? `${nDocumenti} ${nDocumenti === 1 ? 'documento' : 'documenti'}` : null].filter(Boolean).join(' e ')}</p>
          {singoliPossibili && (
            <div className="pp-segmenti pp-mie-segmenti" role="group" aria-label="Formato">
              <button type="button" className={formato === 'file' ? 'attivo' : ''} onClick={() => setFormato('file')}>File singoli</button>
              <button type="button" className={formato === 'zip' ? 'attivo' : ''} onClick={() => setFormato('zip')}>Un file ZIP</button>
            </div>
          )}
          {formato === 'zip' && (
            <>
              <label className="pp-campo">Nome dello ZIP
                <input value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} />
              </label>
              <label className="pp-invio-opzione pp-mie-opzione"><input type="checkbox" checked={conPassword} onChange={(e) => setConPassword(e.target.checked)} /><IconaLucchetto size={16} /> Proteggi con una password</label>
              {conPassword && (
                <>
                  <label className="pp-campo">Password
                    <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </label>
                  <label className="pp-campo">Ripeti la password
                    <input type="password" autoComplete="new-password" value={ripeti} onChange={(e) => setRipeti(e.target.value)} />
                  </label>
                  <div className="pp-mie-protezione" role="radiogroup" aria-label="Protezione">
                    <label><input type="radio" name="protezione" checked={protezione === 'forte'} onChange={() => setProtezione('forte')} /> <span><strong>Forte (AES-256)</strong><br />Si apre con 7-Zip, WinRAR, Keka o le app File di Android; non con Esplora risorse di Windows né con l’Utility Archivio del Mac.</span></label>
                    <label><input type="radio" name="protezione" checked={protezione === 'compatibile'} onChange={() => setProtezione('compatibile')} /> <span><strong>Compatibile</strong><br />Si apre quasi ovunque, ma la protezione è debole.</span></label>
                  </div>
                  <p className="pp-riga-meta">La password non viene salvata: comunicala a parte (non nello stesso messaggio).</p>
                  {erroreP && (password || ripeti) && <p className="pp-mie-errore" role="alert">{erroreP}</p>}
                </>
              )}
            </>
          )}
          <button type="button" className="pp-bottone pp-mie-largo" disabled={!!erroreP || (formato === 'zip' && !nome.trim())}
            onClick={() => onPrepara({ formato, nome: nome.trim() || nomeIniziale, password: conPassword ? password : '', protezione })}>
            {formato === 'zip' ? 'Prepara lo ZIP' : 'Prepara i file'}
          </button>
        </>
      )}
      {stato?.fase === 'lavoro' && <p className="pp-riga-meta pp-mie-riassunto"><span className="pp-rotella" /> {stato.totale ? `Preparo ${stato.fatti} di ${stato.totale}…` : 'Raccolgo i documenti…'}</p>}
      {stato?.fase === 'errore' && <p className="pp-mie-errore" role="alert">{stato.messaggio}</p>}
      {pronto && (
        <>
          <p className="pp-mie-pronto">{stato.files.length === 1 ? stato.files[0].name : `${stato.files.length} file`} pronto{stato.files.length === 1 ? '' : 'i'}{stato.password ? ' · con password' : ''}</p>
          {stato.esclusi.length > 0 && <p className="pp-riga-meta">Non inclusi: {stato.esclusi.slice(0, 5).join(', ')}{stato.esclusi.length > 5 ? ` e altri ${stato.esclusi.length - 5}` : ''}</p>}
          <div className="pp-mie-azioni-finali">
            <button type="button" className="pp-bottone" onClick={condividiOra}><IconaCondividi size={18} /> Condividi</button>
            <button type="button" className="pp-bottone pp-bottone-chiaro" onClick={() => stato.files.forEach((f) => scaricaDocumento(f))}>Scarica</button>
          </div>
        </>
      )}
    </Foglio>
  );
}

/* ---------- pagina di una cartella (id null = Le mie cartelle) ---------- */
export function PaginaCartellaMia({ id = null, ctx }) {
  const { esegui, apri, mostra, versione } = ctx;
  const [cartelle, setCartelle] = useState(null);
  const [documenti, setDocumenti] = useState(null);
  const [sel, setSel] = useState(null); // { cartelle: Set, documenti: Set } o null
  const [foglio, setFoglio] = useState(null);
  const [invio, setInvio] = useState(null); // { cartelleScelte, documentiScelti, nome } quando il foglio Invia è aperto
  const [statoInvio, setStatoInvio] = useState(null);
  const [rinfresca, setRinfresca] = useState(0);
  const ricarica = () => setRinfresca((n) => n + 1);

  useEffect(() => {
    let vivo = true;
    esegui(async () => {
      const c = await caricaCartelleMie(archivioDb);
      const d = id ? await documentiDellaCartella(archivioDb, id) : [];
      if (vivo) { setCartelle(c); setDocumenti(d); }
    });
    return () => { vivo = false; };
  }, [id, versione, rinfresca, esegui]);

  const attuale = cartelle?.find((c) => c.id === id) || null;
  const figli = useMemo(() => (cartelle || []).filter((c) => (c.padre_id || null) === id && !c.archiviata_il)
    .sort((a, b) => (a.posizione - b.posizione) || a.nome.localeCompare(b.nome, 'it')), [cartelle, id]);
  const archiviate = useMemo(() => (cartelle || []).filter((c) => c.archiviata_il), [cartelle]);
  const briciole = cartelle && id ? percorso(cartelle, id) : [];
  const giaDentro = useMemo(() => new Set((documenti || []).map((d) => d.id)), [documenti]);

  const scelteC = [...(sel?.cartelle || [])];
  const scelteD = [...(sel?.documenti || [])];
  const nScelti = scelteC.length + scelteD.length;
  const toccaCartella = (c) => setSel((s) => { const n = new Set(s.cartelle); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return { ...s, cartelle: n }; });
  const toccaDoc = (d, avvia = false) => setSel((s) => {
    const base = s || { cartelle: new Set(), documenti: new Set() };
    const n = new Set(base.documenti);
    if (avvia && !s) n.add(d.id); else if (n.has(d.id)) n.delete(d.id); else n.add(d.id);
    return { ...base, documenti: n };
  });
  const tutti = () => setSel(nScelti === figli.length + (documenti?.length || 0) ? { cartelle: new Set(), documenti: new Set() } : { cartelle: new Set(figli.map((c) => c.id)), documenti: new Set((documenti || []).map((d) => d.id)) });
  const fatto = (msg) => { setFoglio(null); setSel(null); ricarica(); ctx.aggiorna?.(); mostra(msg); };

  const apriInvio = (cartelleScelte, documentiScelti, nome) => { setStatoInvio(null); setInvio({ cartelleScelte, documentiScelti, nome }); };
  const prepara = useCallback(async ({ formato, nome, password, protezione }) => {
    setStatoInvio({ fase: 'lavoro', fatti: 0, totale: 0 });
    try {
      const { voci, esclusi, cartelleVuote } = await preparaVoci(archivioDb, { cartelle, cartelleScelte: invio.cartelleScelte, documentiScelti: invio.documentiScelti });
      if (!voci.length) { setStatoInvio({ fase: 'errore', messaggio: esclusi.length ? `Nessun file da inviare (${esclusi.join(', ')}).` : 'Nessun documento nelle cartelle scelte.' }); return; }
      if (voci.length > MAX_FILE_ZIP) { setStatoInvio({ fase: 'errore', messaggio: `Sono ${voci.length} file: al massimo ${MAX_FILE_ZIP} alla volta. Scegli meno cartelle.` }); return; }
      const token = await tokenSessione();
      const { file, errori } = await scaricaFile(voci, (d) => preparaFile(d.drive_file_id, token).then(comeFile), (fatti, totale) => setStatoInvio({ fase: 'lavoro', fatti, totale }));
      if (!file.length) { setStatoInvio({ fase: 'errore', messaggio: 'Non sono riuscito a scaricare i file. Riprova tra poco.' }); return; }
      const files = formato === 'zip'
        ? [await creaZip({ nome, file, cartelleVuote, password, protezione })]
        : file.map((f) => f.file);
      setStatoInvio({ fase: 'pronto', files, password: !!password, esclusi: [...esclusi, ...errori.map((e) => `${e} (non scaricato)`)] });
    } catch (e) { setStatoInvio({ fase: 'errore', messaggio: e.message || String(e) }); }
  }, [cartelle, invio]);

  if (!cartelle || !documenti) return <Vuoto>Carico…</Vuoto>;
  if (id && !attuale) return <Vuoto>Questa cartella non c’è più.</Vuoto>;

  const soloCartelle = scelteC.length > 0 && !scelteD.length;
  const soloDocumenti = scelteD.length > 0 && !scelteC.length;

  return (
    <div className="pp-mie">
      <nav className="pp-briciole" aria-label="Percorso">
        <button type="button" onClick={() => id && apri({ tipo: 'cartella-mia', id: null })} aria-current={id ? undefined : 'page'}>Le mie cartelle</button>
        {briciole.map((b, i) => (
          <span key={b.id}><IconaFreccia size={12} />
            <button type="button" onClick={() => i < briciole.length - 1 && apri({ tipo: 'cartella-mia', id: b.id })} aria-current={i === briciole.length - 1 ? 'page' : undefined}>{b.nome}</button>
          </span>
        ))}
      </nav>
      <h1 className="pp-mie-titolo">{attuale ? attuale.nome : 'Le mie cartelle'}</h1>

      {!sel && (
        <div className="pp-mie-comandi">
          <button type="button" className="pp-chip-azione" onClick={() => setFoglio('nuova')}><IconaPiu size={16} /> {id ? 'Sottocartella' : 'Nuova cartella'}</button>
          {id && <button type="button" className="pp-chip-azione" onClick={() => setFoglio('aggiungi')}><IconaPiu size={16} /> Documenti</button>}
          {id && <button type="button" className="pp-chip-azione" onClick={() => apriInvio([id], [], attuale.nome)}><IconaCondividi size={16} /> Invia tutta</button>}
          {id && <button type="button" className="pp-chip-azione" onClick={() => setFoglio('rinomina-attuale')}>Rinomina</button>}
          {(figli.length > 0 || documenti.length > 0) && <button type="button" className="pp-chip-azione" onClick={() => setSel({ cartelle: new Set(), documenti: new Set() })}>Seleziona</button>}
        </div>
      )}

      {figli.length > 0 && (
        <div className="pp-mie-griglia">
          {figli.map((c) => {
            const scelta = sel?.cartelle.has(c.id);
            return (
              <button key={c.id} type="button" className={`pp-mia-cartella${scelta ? ' scelta' : ''}`} aria-pressed={sel ? !!scelta : undefined}
                onClick={() => (sel ? toccaCartella(c) : apri({ tipo: 'cartella-mia', id: c.id }))}>
                {sel && <span className={`pp-casella${scelta ? ' scelta' : ''}`} aria-hidden="true">{scelta ? '✓' : ''}</span>}
                <span className="pp-mia-cartella-icona" aria-hidden="true"><IconaDocumenti size={22} /></span>
                <span className="pp-mia-cartella-nome">{c.nome}</span>
                <span className="pp-riga-meta">{[c.n_sottocartelle ? `${c.n_sottocartelle} ${c.n_sottocartelle === 1 ? 'cartella' : 'cartelle'}` : null, `${c.n_documenti} doc.`].filter(Boolean).join(' · ')}</span>
              </button>
            );
          })}
        </div>
      )}

      {id && documenti.length > 0 && (
        <div className="pp-gruppo pp-mie-documenti">
          {documenti.map((d) => <VoceDocumento key={d.id} doc={d} modo="righe" selezione={sel ? sel.documenti : null} onApri={(x) => apri({ tipo: 'documento', id: x.id })} onSeleziona={toccaDoc} />)}
        </div>
      )}

      {!figli.length && !documenti.length && (
        <Vuoto>{id ? 'Cartella vuota. Aggiungi documenti con «+ Documenti», oppure da qualsiasi elenco: «Seleziona» → «Cartella».' : 'Nessuna cartella. Creane una con «Nuova cartella»: dentro puoi fare sottocartelle e mettere documenti.'}</Vuoto>
      )}

      {!id && archiviate.length > 0 && !sel && (
        <button type="button" className="pp-chiedi-classica" onClick={() => setFoglio('archiviate')}>Cartelle archiviate ({archiviate.length})</button>
      )}

      {sel && (
        <div className="pp-barra-selezione" role="toolbar" aria-label="Azioni sulle cose scelte">
          <div className="pp-barra-selezione-testa">
            <strong>{nScelti ? `${nScelti} ${nScelti === 1 ? 'scelta' : 'scelte'}` : 'Tocca cartelle e documenti'}</strong>
            <span>
              <button type="button" className="pp-testo-link" onClick={tutti}>{nScelti === figli.length + documenti.length ? 'Nessuno' : 'Tutti'}</button>
              <button type="button" className="pp-icona-bottone pp-piccolo" onClick={() => setSel(null)} aria-label="Esci dalla selezione"><IconaChiudi size={16} /></button>
            </span>
          </div>
          <div className="pp-barra-selezione-azioni">
            <button type="button" disabled={!nScelti} onClick={() => apriInvio(scelteC, (documenti || []).filter((d) => sel.documenti.has(d.id)), scelteC.length === 1 && !scelteD.length ? figli.find((c) => c.id === scelteC[0])?.nome : attuale?.nome || 'Documenti')}><IconaCondividi size={18} /><span>Invia</span></button>
            <button type="button" disabled={!nScelti} onClick={() => setFoglio('sposta')}><IconaDocumenti size={18} /><span>Sposta</span></button>
            {id && <button type="button" disabled={!soloDocumenti} onClick={() => esegui(async () => { await togliDocumenti(archivioDb, id, scelteD); fatto(`${scelteD.length} tolti dalla cartella (restano in archivio)`); })}><span className="pp-tre-punti">−</span><span>Togli</span></button>}
            <button type="button" disabled={!(soloCartelle && scelteC.length === 1)} onClick={() => setFoglio('rinomina')}><span className="pp-tre-punti">Aa</span><span>Rinomina</span></button>
            <button type="button" disabled={!soloCartelle} onClick={() => esegui(async () => { await archiviaCartelle(archivioDb, scelteC, true); fatto(`${scelteC.length === 1 ? 'Cartella archiviata' : `${scelteC.length} cartelle archiviate`}: le ritrovi in «Cartelle archiviate»`); })}><span className="pp-tre-punti">⌂</span><span>Archivia</span></button>
          </div>
        </div>
      )}

      {foglio === 'nuova' && <FoglioNome titolo={id ? `Nuova sottocartella in ${attuale.nome}` : 'Nuova cartella'} etichetta="Crea" onChiudi={() => setFoglio(null)}
        onConferma={(nome) => esegui(async () => { await creaCartella(archivioDb, { nome, padre_id: id }); fatto(`Cartella «${nome}» creata`); })} />}
      {foglio === 'rinomina-attuale' && <FoglioNome titolo="Rinomina la cartella" iniziale={attuale.nome} onChiudi={() => setFoglio(null)}
        onConferma={(nome) => esegui(async () => { await rinominaCartella(archivioDb, id, nome); fatto('Cartella rinominata'); })} />}
      {foglio === 'rinomina' && scelteC.length === 1 && <FoglioNome titolo="Rinomina la cartella" iniziale={figli.find((c) => c.id === scelteC[0])?.nome || ''} onChiudi={() => setFoglio(null)}
        onConferma={(nome) => esegui(async () => { await rinominaCartella(archivioDb, scelteC[0], nome); fatto('Cartella rinominata'); })} />}
      {foglio === 'aggiungi' && <FoglioAggiungi ctx={ctx} giaDentro={giaDentro} onChiudi={() => setFoglio(null)}
        onAggiungi={(ids) => esegui(async () => { await aggiungiDocumenti(archivioDb, id, ids); fatto(`${ids.length} ${ids.length === 1 ? 'documento aggiunto' : 'documenti aggiunti'}`); })} />}
      {foglio === 'sposta' && (
        <FoglioCartelleMie ctx={ctx} titolo={`Sposta ${nScelti} in…`} radice={scelteC.length > 0 && !scelteD.length}
          cartelle={scelteC.length ? destinazioniPossibili(cartelle, scelteC) : cartelle.filter((c) => !c.archiviata_il)}
          escludi={id ? new Set([id]) : null} onChiudi={() => setFoglio(null)}
          onScegli={(dest, nome) => esegui(async () => {
            if (scelteC.length) await spostaCartelle(archivioDb, scelteC, dest);
            if (scelteD.length && dest) { await aggiungiDocumenti(archivioDb, dest, scelteD); if (id) await togliDocumenti(archivioDb, id, scelteD); }
            fatto(`Spostati in «${nome}»`);
          })} />
      )}
      {foglio === 'archiviate' && (
        <Foglio titolo="Cartelle archiviate" onChiudi={() => setFoglio(null)}>
          <Gruppo>
            {archiviate.map((c) => (
              <div key={c.id} className="pp-riga">
                <span className="pp-riga-testo"><span className="pp-riga-titolo">{c.nome}</span><span className="pp-riga-meta">{c.n_documenti} doc. · archiviata il {dataBreve(c.archiviata_il)}</span></span>
                <button type="button" className="pp-chip-azione" onClick={() => esegui(async () => { await archiviaCartelle(archivioDb, [c.id], false); fatto(`«${c.nome}» ripristinata`); })}>Ripristina</button>
              </div>
            ))}
          </Gruppo>
        </Foglio>
      )}
      {invio && <FoglioInvia nomeIniziale={invio.nome || 'Documenti'} nCartelle={invio.cartelleScelte.length} nDocumenti={invio.documentiScelti.length}
        stato={statoInvio} onPrepara={prepara} mostra={mostra} onChiudi={() => { setInvio(null); setStatoInvio(null); }} />}
    </div>
  );
}

/* ---------- riquadro per «Chiedi»: le tue cartelle sempre a portata di mano ---------- */
export function CartelleInCima({ ctx }) {
  const { apri, versione } = ctx;
  const [cartelle, setCartelle] = useState(null);
  useEffect(() => {
    let vivo = true;
    caricaCartelleMie(archivioDb, { ancheArchiviate: false }).then((c) => { if (vivo) setCartelle(c); }).catch(() => { if (vivo) setCartelle([]); });
    return () => { vivo = false; };
  }, [versione]);
  if (!cartelle) return null;
  const radici = cartelle.filter((c) => !c.padre_id).slice(0, 8);
  return (
    <section className="pp-chiedi-blocco" aria-label="Le mie cartelle">
      <div className="pp-mie-testa">
        <h2 className="pp-chiedi-h2">Le mie cartelle</h2>
        <button type="button" className="pp-testo-link" onClick={() => apri({ tipo: 'cartella-mia', id: null })}>{radici.length ? 'Tutte' : 'Crea'}</button>
      </div>
      {radici.length ? (
        <div className="pp-mie-fila">
          {radici.map((c) => (
            <button key={c.id} type="button" className="pp-mia-cartella pp-mia-cartella-piccola" onClick={() => apri({ tipo: 'cartella-mia', id: c.id })}>
              <span className="pp-mia-cartella-icona" aria-hidden="true"><IconaDocumenti size={20} /></span>
              <span className="pp-mia-cartella-nome">{c.nome}</span>
              <span className="pp-riga-meta">{c.n_documenti} doc.</span>
            </button>
          ))}
          <button type="button" className="pp-mia-cartella pp-mia-cartella-piccola pp-mia-nuova" onClick={() => apri({ tipo: 'cartella-mia', id: null })} aria-label="Nuova cartella">
            <span className="pp-mia-cartella-icona" aria-hidden="true"><IconaPiu size={20} /></span>
            <span className="pp-mia-cartella-nome">Nuova</span>
          </button>
        </div>
      ) : (
        <button type="button" className="pp-chiedi-dafare" onClick={() => apri({ tipo: 'cartella-mia', id: null })}>
          <span className="pp-chiedi-giorno" aria-hidden="true"><IconaPiu size={20} /></span>
          <span className="pp-chiedi-dafare-testo"><span className="pp-chiedi-dafare-titolo">Crea le tue cartelle</span><span className="pp-chiedi-meta">Con sottocartelle, da inviare anche in ZIP con password</span></span>
        </button>
      )}
    </section>
  );
}

/* ---------- nella scheda di un documento: in quali cartelle è, e aggiungilo ---------- */
export function NelleMieCartelle({ doc, ctx }) {
  const { esegui, apri, mostra, versione } = ctx;
  const [cartelle, setCartelle] = useState(null);
  const [dentro, setDentro] = useState([]);
  const [foglio, setFoglio] = useState(false);
  const [rinfresca, setRinfresca] = useState(0);
  useEffect(() => {
    let vivo = true;
    Promise.all([caricaCartelleMie(archivioDb, { ancheArchiviate: false }), cartelleDelDocumento(archivioDb, doc.id)])
      .then(([c, d]) => { if (vivo) { setCartelle(c); setDentro(d); } }).catch(() => { if (vivo) setCartelle([]); });
    return () => { vivo = false; };
  }, [doc.id, versione, rinfresca]);
  if (!cartelle) return null;
  const sue = cartelle.filter((c) => dentro.includes(c.id));
  return (
    <div className="pp-mie-nel-doc">
      <span className="pp-riga-meta">Nelle mie cartelle</span>
      <div className="pp-mie-chips">
        {sue.map((c) => <button key={c.id} type="button" className="pp-chiedi-chip" onClick={() => apri({ tipo: 'cartella-mia', id: c.id })}>{percorso(cartelle, c.id).map((p) => p.nome).join(' › ')}</button>)}
        <button type="button" className="pp-chip-azione" onClick={() => setFoglio(true)}><IconaPiu size={14} /> Cartella</button>
      </div>
      {foglio && <FoglioCartelleMie ctx={ctx} titolo="Metti in una tua cartella" cartelle={cartelle} escludi={new Set(dentro)} onChiudi={() => setFoglio(false)}
        onScegli={(dest, nome) => esegui(async () => { await aggiungiDocumenti(archivioDb, dest, [doc.id]); setFoglio(false); setRinfresca((n) => n + 1); mostra(`Nella cartella «${nome}»`); })} />}
    </div>
  );
}
