// POL-VITA-006 — tasto + : tutte le aggiunte in un foglio (scansione, foto, fotocamera, file da
// altre app o cloud, documento personale, spesa, incasso, pagamento da fare, evento) e pagina di
// scansione multipagina che produce un PDF.
import { useEffect, useRef, useState } from 'react';
import { elaboraPagina, creaPdf } from './lib/scansione.js';
import { Segmenti } from './ui.jsx';
import { Ritaglio } from './Ritaglio.jsx';
import {
  IconaFotocamera, IconaFile, IconaPortafoglio, IconaCalendario, IconaEuro, IconaChiudi, IconaScansiona, IconaFoto,
  IconaNuvola, IconaRuota, IconaCestino, IconaTaglia, IconaPiu, IconaNote, IconaLucchetto, IconaIndietro,
} from './Icone.jsx';

// DOCK-PER-TE passo 3 (PO 2026-11-08): + → Per te con Documento, Spesa, Foto, Nota e Password;
// Documento, Spesa e Foto aprono le loro tre scelte. Il resto (incassi, agenda) sotto.
const VOCI = [
  ['Per te', [
    ['documento', 'Documento', 'scansiona, foto o file', IconaScansiona],
    ['spesa', 'Spesa', 'scontrino, foto o a mano', IconaEuro],
    ['foto', 'Foto', "nell'album personale", IconaFoto],
    ['nota', 'Nota', 'scrivi subito', IconaNote],
    ['password', 'Password', 'nel registro', IconaLucchetto],
  ]],
  ['Conti e agenda', [
    ['incasso', 'Incasso', 'registra un\'entrata', IconaEuro],
    ['pagamento', 'Pagamento da fare', 'promemoria con scadenza', IconaFile],
    ['personale', 'Documento personale', "carta d'identità, codice fiscale…", IconaPortafoglio],
    ['evento', 'Evento', 'in agenda', IconaCalendario],
    ['appuntamento', 'Appuntamento', 'paziente dello studio', IconaCalendario],
  ]],
];
export const SCELTE = {
  documento: ['Documento', [
    ['scansiona', 'Scansiona', 'più pagine → PDF', IconaScansiona],
    ['fotocamera', 'Scatta foto', 'una foto, archiviata subito', IconaFotocamera],
    ['file', 'Carica file', 'iCloud, Drive, altre app', IconaNuvola],
    ['pdf', 'Apri e firma un PDF', 'senza archiviarlo', IconaFile],
  ]],
  spesa: ['Spesa', [
    ['spesaScontrino', 'Scansiona scontrino', 'fotografa la ricevuta', IconaFotocamera],
    ['spesaFile', 'Foto o file', 'ricevuta già sul telefono', IconaNuvola],
    ['spesaManuale', 'Inserimento manuale', 'solo importo e data', IconaEuro],
  ]],
  foto: ['Foto', [
    ['fotoCamera', 'Fotocamera', "scatta e salva nell'album", IconaFotocamera],
    ['fotoGalleria', 'Galleria', 'scegli dal telefono', IconaFoto],
  ]],
};

export function FoglioAggiungi({ onScegli, onChiudi, iniziale = null }) {
  const [livello, setLivello] = useState(SCELTE[iniziale] ? iniziale : null);
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onChiudi();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onChiudi]);
  const gruppi = livello ? [SCELTE[livello]] : VOCI;
  return (
    <div className="pp-velo" onClick={onChiudi}>
      <div className="pp-foglio" role="dialog" aria-label={livello ? SCELTE[livello][0] : 'Aggiungi'} onClick={(e) => e.stopPropagation()}>
        <div className="pp-foglio-maniglia" />
        <div className="pp-foglio-testa">
          {livello && <button className="pp-icona-bottone pp-piccolo" onClick={() => setLivello(null)} aria-label="Indietro"><IconaIndietro size={18} /></button>}
          <span>{livello ? SCELTE[livello][0] : 'Aggiungi'}</span>
          <button className="pp-icona-bottone pp-piccolo" onClick={onChiudi} aria-label="Chiudi"><IconaChiudi size={18} /></button>
        </div>
        <div className="pp-foglio-corpo">
          {gruppi.map(([titolo, voci]) => (
            <section key={titolo} className="pp-aggiungi-gruppo">
              {!livello && <h3>{titolo}</h3>}
              <div className="pp-aggiungi">
                {voci.map(([id, nome, sotto, Icona]) => (
                  <button key={id} className={`pp-aggiungi-voce pp-av-${id}`} onClick={() => (SCELTE[id] ? setLivello(id) : onScegli(id))}>
                    <span className="pp-aggiungi-icona"><Icona size={22} /></span>
                    <span className="pp-aggiungi-nome">{nome}</span>
                    <span className="pp-aggiungi-sotto">{sotto}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- scansione ---------- */
export function PaginaScansione({ ctx, sostituisci, opzioni = {} }) {
  const { mostra } = ctx;
  const [pagine, setPagine] = useState([]); // { file, rotazione, url, larghezza, altezza }
  const [modo, setModo] = useState('documento');
  const [lavoro, setLavoro] = useState(null);
  const [nome, setNome] = useState('');
  const [taglia, setTaglia] = useState(null); // { i, url } pagina da ritagliare
  const scatto = useRef(null);
  const galleria = useRef(null);

  // Rielabora tutte le pagine quando cambia il modo.
  useEffect(() => {
    if (!pagine.length) return;
    let vivo = true;
    (async () => {
      setLavoro('Miglioro le pagine…');
      const nuove = [];
      for (const p of pagine) nuove.push({ ...p, ...(await elaboraPagina(p.file, { modo, rotazione: p.rotazione, ritaglio: p.ritaglio })) });
      if (vivo) { setPagine(nuove); setLavoro(null); }
    })().catch(() => setLavoro(null));
    return () => { vivo = false; };
  }, [modo]); // eslint-disable-line react-hooks/exhaustive-deps

  const aggiungi = async (files) => {
    const elenco = [...(files || [])].filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    if (!elenco.length) return;
    setLavoro('Preparo la pagina…');
    try {
      const nuove = [];
      for (const file of elenco) nuove.push({ file, rotazione: 0, ...(await elaboraPagina(file, { modo })) });
      setPagine((p) => [...p, ...nuove]);
    } catch { mostra('Foto non leggibile'); }
    setLavoro(null);
  };
  const ruota = async (i) => {
    const p = pagine[i];
    const rotazione = (p.rotazione + 90) % 360;
    const r = await elaboraPagina(p.file, { modo, rotazione });
    setPagine((xs) => xs.map((x, j) => (j === i ? { ...x, rotazione, ritaglio: null, ...r } : x)));
  };
  // MIA-SALUTE: ritaglio della pagina sull'immagine intera (ruotata), poi si rielabora.
  const apriRitaglio = async (i) => { const p = pagine[i]; const r = await elaboraPagina(p.file, { modo: 'originale', rotazione: p.rotazione }); setTaglia({ i, url: r.url }); };
  const ritaglia = async (ritaglio) => {
    const { i } = taglia; setTaglia(null);
    const p = pagine[i];
    const r = await elaboraPagina(p.file, { modo, rotazione: p.rotazione, ritaglio });
    setPagine((xs) => xs.map((x, j) => (j === i ? { ...x, ritaglio, ...r } : x)));
  };
  const togli = (i) => setPagine((xs) => xs.filter((_, j) => j !== i));
  const sposta = (i, d) => setPagine((xs) => { const a = [...xs]; const [x] = a.splice(i, 1); a.splice(i + d, 0, x); return a; });
  const fine = async () => {
    setLavoro('Creo il PDF…');
    try {
      const pdf = await creaPdf(pagine, nome || `Scansione ${new Date().toLocaleDateString('it-IT')}`);
      sostituisci({ tipo: 'carica', file: pdf, opzioni: { ...opzioni, descrizione: nome || opzioni.descrizione || '' } });
    } catch (e) { mostra(`PDF non creato: ${e.message}`); setLavoro(null); }
  };

  return (
    <>
      <input ref={scatto} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { aggiungi(e.target.files); e.target.value = ''; }} />
      <input ref={galleria} type="file" accept="image/*" multiple hidden onChange={(e) => { aggiungi(e.target.files); e.target.value = ''; }} />
      <p className="pp-riga-meta pp-spiegazione">Fotografa ogni pagina dall'alto, su un piano scuro. Le pagine diventano un unico PDF.</p>
      <Segmenti voci={[['documento', 'Bianco e nero'], ['colore', 'Colori'], ['originale', 'Originale']]} attiva={modo} onScegli={setModo} />
      <div className="pp-scansione">
        {pagine.map((p, i) => (
          <figure key={`${i}-${p.file.name}-${p.file.lastModified}`} className="pp-scansione-pagina">
            <img src={p.url} alt={`Pagina ${i + 1}`} />
            <figcaption>
              <span>{i + 1}</span>
              <button aria-label={`Ruota pagina ${i + 1}`} onClick={() => ruota(i)}><IconaRuota size={18} /></button>
              <button aria-label={`Ritaglia pagina ${i + 1}`} onClick={() => apriRitaglio(i)}><IconaTaglia size={18} /></button>
              {i > 0 && <button aria-label={`Sposta prima la pagina ${i + 1}`} onClick={() => sposta(i, -1)}>‹</button>}
              {i < pagine.length - 1 && <button aria-label={`Sposta dopo la pagina ${i + 1}`} onClick={() => sposta(i, 1)}>›</button>}
              <button aria-label={`Togli pagina ${i + 1}`} onClick={() => togli(i)}><IconaCestino size={18} /></button>
            </figcaption>
          </figure>
        ))}
        <button className="pp-scansione-nuova" onClick={() => scatto.current.click()}>
          <IconaFotocamera size={30} /><span>{pagine.length ? 'Scatta la pagina successiva' : 'Scatta la prima pagina'}</span>
        </button>
      </div>
      <button className="pp-testo-link" onClick={() => galleria.current.click()}><IconaPiu size={16} /> Aggiungi pagine dalle foto</button>
      {pagine.length > 0 && (
        <>
          <label className="pp-campo"><span>Nome (facoltativo)</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Es. Contratto affitto" />
          </label>
          <button className="pp-bottone pp-bottone-largo" disabled={!!lavoro} onClick={fine}>
            {lavoro || `Crea PDF (${pagine.length} ${pagine.length === 1 ? 'pagina' : 'pagine'}) e archivia`}
          </button>
        </>
      )}
      {lavoro && !pagine.length && <p className="pp-riga-meta"><span className="pp-rotella" /> {lavoro}</p>}
      {taglia && <Ritaglio src={taglia.url} iniziale={pagine[taglia.i]?.ritaglio} onFatto={ritaglia} onAnnulla={() => setTaglia(null)} />}
    </>
  );
}
