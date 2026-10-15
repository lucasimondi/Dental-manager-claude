// POL-VITA-006 — tasto + : tutte le aggiunte in un foglio (scansione, foto, fotocamera, file da
// altre app o cloud, documento personale, spesa, incasso, pagamento da fare, evento) e pagina di
// scansione multipagina che produce un PDF.
import { useEffect, useRef, useState } from 'react';
import { elaboraPagina, creaPdf } from './lib/scansione.js';
import { Segmenti } from './ui.jsx';
import {
  IconaFotocamera, IconaFile, IconaPortafoglio, IconaCalendario, IconaEuro, IconaChiudi, IconaScansiona, IconaFoto,
  IconaNuvola, IconaRuota, IconaCestino, IconaPiu,
} from './Icone.jsx';

const VOCI = [
  ['Archivia un documento', [
    ['scansiona', 'Scansiona', 'più pagine → PDF', IconaScansiona],
    ['fotocamera', 'Fotocamera', 'scatta una foto', IconaFotocamera],
    ['libreria', 'Foto', 'dalla libreria', IconaFoto],
    ['file', 'File', 'iCloud, Drive, altre app', IconaNuvola],
    ['personale', 'Documento personale', "carta d'identità, codice fiscale…", IconaPortafoglio],
  ]],
  ['Conti e agenda', [
    ['spesa', 'Spesa', 'registra un\'uscita', IconaEuro],
    ['incasso', 'Incasso', 'registra un\'entrata', IconaEuro],
    ['pagamento', 'Pagamento da fare', 'promemoria con scadenza', IconaFile],
    ['evento', 'Evento', 'in agenda', IconaCalendario],
  ]],
];

export function FoglioAggiungi({ onScegli, onChiudi }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onChiudi();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onChiudi]);
  return (
    <div className="pp-velo" onClick={onChiudi}>
      <div className="pp-foglio" role="dialog" aria-label="Aggiungi" onClick={(e) => e.stopPropagation()}>
        <div className="pp-foglio-maniglia" />
        <div className="pp-foglio-testa"><span>Aggiungi</span>
          <button className="pp-icona-bottone pp-piccolo" onClick={onChiudi} aria-label="Chiudi"><IconaChiudi size={18} /></button>
        </div>
        <div className="pp-foglio-corpo">
          {VOCI.map(([titolo, voci]) => (
            <section key={titolo} className="pp-aggiungi-gruppo">
              <h3>{titolo}</h3>
              <div className="pp-aggiungi">
                {voci.map(([id, nome, sotto, Icona]) => (
                  <button key={id} className={`pp-aggiungi-voce pp-av-${id}`} onClick={() => onScegli(id)}>
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
export function PaginaScansione({ ctx, sostituisci }) {
  const { mostra } = ctx;
  const [pagine, setPagine] = useState([]); // { file, rotazione, url, larghezza, altezza }
  const [modo, setModo] = useState('documento');
  const [lavoro, setLavoro] = useState(null);
  const [nome, setNome] = useState('');
  const scatto = useRef(null);
  const galleria = useRef(null);

  // Rielabora tutte le pagine quando cambia il modo.
  useEffect(() => {
    if (!pagine.length) return;
    let vivo = true;
    (async () => {
      setLavoro('Miglioro le pagine…');
      const nuove = [];
      for (const p of pagine) nuove.push({ ...p, ...(await elaboraPagina(p.file, { modo, rotazione: p.rotazione })) });
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
    setPagine((xs) => xs.map((x, j) => (j === i ? { ...x, rotazione, ...r } : x)));
  };
  const togli = (i) => setPagine((xs) => xs.filter((_, j) => j !== i));
  const sposta = (i, d) => setPagine((xs) => { const a = [...xs]; const [x] = a.splice(i, 1); a.splice(i + d, 0, x); return a; });
  const fine = async () => {
    setLavoro('Creo il PDF…');
    try {
      const pdf = await creaPdf(pagine, nome || `Scansione ${new Date().toLocaleDateString('it-IT')}`);
      sostituisci({ tipo: 'carica', file: pdf, opzioni: { descrizione: nome } });
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
    </>
  );
}
