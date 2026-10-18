// POL-VITA-015 — Foto e video: album, anni e luoghi, visore a tutto schermo con scorrimento,
// catalogazione (album, luogo, titolo, data) di una foto o di più foto insieme.
import { useEffect, useMemo, useRef, useState } from 'react';
import { archivioDb } from './lib/supabasePersonal.js';
import { anteprimaFile } from './lib/archivio.js';
import { fotoEVideo, album as raggruppaAlbum, perAnno, luoghi as elencoLuoghi, catalogaFoto, eVideo, dataFoto, DA_CATALOGARE, ALBUM_PREDEFINITI } from './lib/foto.js';
import { dataBreve, titoloDoc, tokenSessione, Vuoto, Sezione, Chips, Segmenti } from './ui.jsx';
import { Miniatura } from './Miniatura.jsx';
import { IconaIndietro, IconaFreccia, IconaApri, IconaFile, IconaPiu, IconaChiudi } from './Icone.jsx';

const COLORE = '#7c3aed';

function Tessera({ f, onApri, selezionata, onSeleziona }) {
  return (
    <button className={`pp-foto${selezionata ? ' scelta' : ''}`} onClick={() => (onSeleziona ? onSeleziona(f) : onApri(f))} aria-label={titoloDoc(f)}>
      <Miniatura doc={f} colore={COLORE} grande />
      {eVideo(f) && <span className="pp-foto-video" aria-hidden="true">▶</span>}
      {onSeleziona && <span className="pp-foto-spunta" aria-hidden="true">{selezionata ? '✓' : ''}</span>}
    </button>
  );
}

function Griglia({ foto, onApri, scelte, onSeleziona }) {
  return (
    <div className="pp-griglia-foto">
      {foto.map((f) => <Tessera key={f.id} f={f} onApri={onApri} selezionata={scelte?.has(f.id)} onSeleziona={onSeleziona} />)}
    </div>
  );
}

// Scelta dell'album: quelli già usati, i predefiniti e "Nuovo album".
function SceltaAlbum({ valore, esistenti, onScegli }) {
  const [nuovo, setNuovo] = useState(null);
  const voci = [...new Set([...esistenti.filter((a) => a !== DA_CATALOGARE), ...ALBUM_PREDEFINITI])];
  if (nuovo != null) {
    return (
      <form className="pp-voce pp-voce-nuova" onSubmit={(e) => { e.preventDefault(); if (nuovo.trim()) onScegli(nuovo.trim()); }}>
        <input autoFocus value={nuovo} onChange={(e) => setNuovo(e.target.value)} placeholder="Nome del nuovo album (es. Mare 2025)" aria-label="Nome del nuovo album" />
        <button type="submit" className="pp-chip-azione" disabled={!nuovo.trim()}>Crea</button>
        <button type="button" className="pp-icona-bottone pp-piccolo" aria-label="Annulla" onClick={() => setNuovo(null)}><IconaChiudi size={16} /></button>
      </form>
    );
  }
  return (
    <select className="pp-select" value={valore || ''} aria-label="Album" onChange={(e) => (e.target.value === '__nuovo' ? setNuovo('') : onScegli(e.target.value))}>
      <option value="">{DA_CATALOGARE}</option>
      {voci.map((a) => <option key={a} value={a}>{a}</option>)}
      <option value="__nuovo">+ Nuovo album…</option>
    </select>
  );
}

export function VistaFoto({ ctx, albumIniziale = null }) {
  const { esegui, apri, versione, aggiorna, mostra } = ctx;
  const [foto, setFoto] = useState(null);
  const [modo, setModo] = useState(albumIniziale ? 'tutte' : 'album');
  const [filtroAlbum, setFiltroAlbum] = useState(albumIniziale);
  const [luogo, setLuogo] = useState('');
  const [soloVideo, setSoloVideo] = useState(false);
  const [scelte, setScelte] = useState(null);
  useEffect(() => { esegui(async () => setFoto(await fotoEVideo(archivioDb))); }, [esegui, versione]);
  const elencoAlbum = useMemo(() => raggruppaAlbum(foto || []), [foto]);
  if (!foto) return <Vuoto>Carico le foto…</Vuoto>;
  if (!foto.length) return <Vuoto>Ancora nessuna foto o video. Usa il + e scegli "Foto o video".</Vuoto>;

  const visibili = foto.filter((f) => (!filtroAlbum || (f.album || DA_CATALOGARE) === filtroAlbum)
    && (!luogo || f.luogo === luogo) && (!soloVideo || eVideo(f)));
  const apriFoto = (f) => apri({ tipo: 'foto', ids: visibili.map((x) => x.id), indice: visibili.findIndex((x) => x.id === f.id), titolo: filtroAlbum || 'Foto' });
  const seleziona = (f) => setScelte((s) => { const n = new Set(s); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); return n; });
  const spostaScelte = (nome) => esegui(async () => {
    await catalogaFoto(archivioDb, [...scelte], { album: nome });
    mostra(`${scelte.size} ${scelte.size === 1 ? 'foto spostata' : 'foto spostate'} in ${nome || DA_CATALOGARE}`);
    setScelte(null); aggiorna();
  });
  const luoghiNoti = elencoLuoghi(foto);

  return (
    <div className="pp-area-foto">
      <div className="pp-foto-riassunto">
        <strong>{foto.length}</strong> elementi · {elencoAlbum.filter((a) => a.nome !== DA_CATALOGARE).length} album
        {foto.some(eVideo) && <> · {foto.filter(eVideo).length} video</>}
      </div>
      <Segmenti voci={[['album', 'Album'], ['anni', 'Anni'], ['tutte', 'Tutte']]} attiva={modo} onScegli={(m) => { setModo(m); if (m === 'album') setFiltroAlbum(null); }} />
      {modo !== 'album' && (
        <>
          {filtroAlbum && (
            <div className="pp-filtro-attivo">
              <button className="pp-indietro" onClick={() => { setFiltroAlbum(null); setModo('album'); }}><IconaIndietro size={18} /><span>Album</span></button>
              <strong>{filtroAlbum}</strong>
            </div>
          )}
          <Chips voci={[['', 'Ovunque'], ...luoghiNoti.map((l) => [l, l]), ['__video', 'Solo video']]} attiva={soloVideo ? '__video' : luogo}
            onScegli={(v) => { if (v === '__video') { setSoloVideo(!soloVideo); } else { setSoloVideo(false); setLuogo(v); } }} />
          <div className="pp-azioni pp-azioni-piccole">
            {scelte
              ? <>
                <span className="pp-riga-meta">{scelte.size} scelte · sposta in</span>
                <SceltaAlbum valore="" esistenti={elencoAlbum.map((a) => a.nome)} onScegli={(nome) => scelte.size && spostaScelte(nome)} />
                <button className="pp-bottone pp-bottone-chiaro" onClick={() => setScelte(null)}>Fine</button>
              </>
              : <button className="pp-bottone pp-bottone-chiaro" onClick={() => setScelte(new Set())}>Seleziona e cataloga</button>}
          </div>
        </>
      )}

      {modo === 'album' && (
        <div className="pp-album">
          {elencoAlbum.map((a) => (
            <button key={a.nome} className={`pp-album-voce${a.nome === DA_CATALOGARE ? ' da-catalogare' : ''}`} onClick={() => { setFiltroAlbum(a.nome); setModo('tutte'); }}>
              <span className="pp-album-copertina"><Miniatura doc={a.copertina} colore={COLORE} grande /></span>
              <span className="pp-album-nome">{a.nome}</span>
              <span className="pp-riga-meta">{a.n} {a.n === 1 ? 'elemento' : 'elementi'}{a.anni.length ? ` · ${a.anni[0]}${a.anni.length > 1 ? `–${a.anni[a.anni.length - 1]}` : ''}` : ''}</span>
            </button>
          ))}
        </div>
      )}
      {modo === 'anni' && perAnno(visibili).map(([anno, elenco]) => (
        <Sezione key={anno} titolo={anno} azione={<span className="pp-riga-meta">{elenco.length}</span>}>
          <Griglia foto={elenco} onApri={apriFoto} scelte={scelte} onSeleziona={scelte ? seleziona : null} />
        </Sezione>
      ))}
      {modo === 'tutte' && (visibili.length
        ? <Griglia foto={visibili} onApri={apriFoto} scelte={scelte} onSeleziona={scelte ? seleziona : null} />
        : <Vuoto>Nessuna foto con questi filtri.</Vuoto>)}
    </div>
  );
}

/* ---------- visore: una foto alla volta, scorrimento a sinistra e a destra ---------- */
const cacheGrandi = new Map();
function immagineGrande(f) {
  if (!cacheGrandi.has(f.drive_file_id)) {
    cacheGrandi.set(f.drive_file_id, (async () => {
      const file = await anteprimaFile({ token: await tokenSessione(), driveFileId: f.drive_file_id });
      return `data:${file.mime};base64,${file.dati}`;
    })().catch((e) => { cacheGrandi.delete(f.drive_file_id); throw e; }));
  }
  return cacheGrandi.get(f.drive_file_id);
}

export function PaginaFoto({ ids, indice: iniziale = 0, ctx }) {
  const { esegui, apri, aggiorna, mostra } = ctx;
  const [tutte, setTutte] = useState(null);
  const [i, setI] = useState(Math.max(0, iniziale));
  const [src, setSrc] = useState(null);
  const [errore, setErrore] = useState(null);
  const [modifica, setModifica] = useState(false);
  const tocco = useRef(null);
  useEffect(() => { esegui(async () => setTutte(await fotoEVideo(archivioDb))); }, [esegui]);
  const elenco = useMemo(() => (tutte ? ids.map((id) => tutte.find((f) => f.id === id)).filter(Boolean) : []), [tutte, ids]);
  const f = elenco[i];
  useEffect(() => {
    setSrc(null); setErrore(null);
    if (!f || eVideo(f) || !f.drive_file_id) return undefined;
    let vivo = true;
    immagineGrande(f).then((s) => vivo && setSrc(s), (e) => vivo && setErrore(e.message));
    const prossima = elenco[i + 1];
    if (prossima && !eVideo(prossima) && prossima.drive_file_id) immagineGrande(prossima).catch(() => {});
    return () => { vivo = false; };
  }, [f, elenco, i]);
  if (!tutte) return <Vuoto>Carico…</Vuoto>;
  if (!f) return <Vuoto>Foto non trovata.</Vuoto>;
  const vai = (d) => { setModifica(false); setI((x) => Math.min(Math.max(x + d, 0), elenco.length - 1)); };
  const salva = (campi) => esegui(async () => {
    const [r] = await catalogaFoto(archivioDb, f.id, campi);
    setTutte((t) => t.map((x) => (x.id === f.id ? { ...x, ...r } : x)));
    aggiorna(); mostra('Salvato');
  });
  const albumEsistenti = [...new Set(tutte.map((x) => x.album).filter(Boolean))];

  return (
    <div className="pp-visore">
      <div className="pp-visore-immagine"
        onTouchStart={(e) => { tocco.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - (tocco.current ?? e.changedTouches[0].clientX); tocco.current = null; if (Math.abs(dx) > 50) vai(dx < 0 ? 1 : -1); }}>
        {eVideo(f) ? (
          <div className="pp-visore-video">
            <span aria-hidden="true">▶</span>
            <p>Video</p>
            {f.drive_url && <a className="pp-bottone" href={f.drive_url} target="_blank" rel="noreferrer"><IconaApri size={18} /> Guarda il video</a>}
          </div>
        ) : src ? <img src={src} alt={titoloDoc(f)} /> : (
          <div className="pp-visore-attesa">{errore ? <>{errore}<br />Usa "Apri l'originale".</> : <><span className="pp-rotella" /> Carico la foto…</>}</div>
        )}
        {i > 0 && <button className="pp-visore-freccia sx" onClick={() => vai(-1)} aria-label="Foto precedente"><IconaIndietro size={22} /></button>}
        {i < elenco.length - 1 && <button className="pp-visore-freccia dx" onClick={() => vai(1)} aria-label="Foto successiva"><IconaFreccia size={22} /></button>}
      </div>
      <p className="pp-riga-meta pp-visore-conto">{i + 1} di {elenco.length}</p>
      <h2 className="pp-visore-titolo">{titoloDoc(f)}</h2>
      <p className="pp-riga-meta">{[dataBreve(dataFoto(f)), f.luogo, f.album || DA_CATALOGARE].filter(Boolean).join(' · ')}</p>

      <div className="pp-campo"><span>Album</span>
        <SceltaAlbum valore={f.album || ''} esistenti={albumEsistenti} onScegli={(a) => salva({ album: a })} />
      </div>
      {!modifica ? (
        <div className="pp-azioni pp-azioni-piccole">
          <button className="pp-bottone pp-bottone-chiaro" onClick={() => setModifica({ titolo: f.titolo || '', luogo: f.luogo || '', data_documento: f.data_documento || '' })}>Titolo, luogo e data</button>
          {f.drive_url && <a className="pp-bottone pp-bottone-chiaro" href={f.drive_url} target="_blank" rel="noreferrer"><IconaApri size={16} /> Apri l'originale</a>}
          <button className="pp-bottone pp-bottone-chiaro" onClick={() => apri({ tipo: 'documento', id: f.id })}><IconaFile size={16} /> Scheda</button>
        </div>
      ) : (
        <div className="pp-modifica">
          <label className="pp-campo"><span>Titolo</span><input value={modifica.titolo} onChange={(e) => setModifica({ ...modifica, titolo: e.target.value })} /></label>
          <div className="pp-due">
            <label className="pp-campo"><span>Luogo</span><input list="pp-luoghi" value={modifica.luogo} onChange={(e) => setModifica({ ...modifica, luogo: e.target.value })} placeholder="es. Sampeyre" />
              <datalist id="pp-luoghi">{elencoLuoghi(tutte).map((l) => <option key={l} value={l} />)}</datalist>
            </label>
            <label className="pp-campo"><span>Data</span><input type="date" value={modifica.data_documento} onChange={(e) => setModifica({ ...modifica, data_documento: e.target.value })} /></label>
          </div>
          <div className="pp-azioni">
            <button className="pp-bottone" onClick={() => { salva(modifica); setModifica(false); }}>Salva</button>
            <button className="pp-bottone pp-bottone-chiaro" onClick={() => setModifica(false)}>Annulla</button>
          </div>
        </div>
      )}
      {f.riassunto && !/catalogo provvisorio/i.test(f.riassunto) && <p className="pp-paragrafo">{f.riassunto}</p>}
      <button className="pp-riga pp-riga-aggiungi pp-riga-sola" onClick={() => apri({ tipo: 'carica', opzioni: { fascicolo: 'foto_video', album: f.album || null } })}><IconaPiu size={18} /><span>Aggiungi foto o video{f.album ? ` a ${f.album}` : ''}</span></button>
    </div>
  );
}
