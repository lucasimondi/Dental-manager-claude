// POL-VITA-006 — tasto + : tutte le aggiunte in un foglio (scansione, foto, fotocamera, file da
// altre app o cloud, documento personale, spesa, incasso, pagamento da fare, evento) e pagina di
// scansione multipagina che produce un PDF.
import { useEffect, useRef, useState } from 'react';
import { elaboraPagina } from './lib/scansione.js';
import { pdfDaElementi, tipoFile } from './lib/pdfUnico.js';
import { inviaCon } from './lib/condividi.js';
import { Segmenti } from './ui.jsx';
import { Ritaglio } from './Ritaglio.jsx';
import {
  IconaFotocamera, IconaFile, IconaPortafoglio, IconaCalendario, IconaEuro, IconaChiudi, IconaScansiona, IconaFoto,
  IconaNuvola, IconaRuota, IconaCestino, IconaTaglia, IconaEmail, IconaChat, IconaNote, IconaLucchetto, IconaIndietro,
} from './Icone.jsx';

// DOCK-PER-TE passo 3 (PO 2026-11-08): + → Per te con Documento, Spesa, Foto, Nota e Password;
// Documento, Spesa e Foto aprono le loro tre scelte. Il resto (incassi, agenda) sotto.
const VOCI = [
  ['Per te', [
    ['documento', 'Documento', 'scansiona, foto o PDF → un PDF', IconaScansiona],
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

/* ---------- «Scansiona o allega»: l'unico strumento per aggiungere un documento ---------- */
// MIA-SALUTE (PO 2026-11-10: "Il tasto scansione e le modifiche applicate devono essere anche per
// gli altri documenti che voglio allegare, deve essere facile e veloce e deve essere uno solo").
// Scatti, foto dal telefono e PDF in un'unica lista: le foto si ritagliano e ruotano, tutto diventa
// un solo PDF da archiviare o da mandare subito con Mail / WhatsApp. Altri formati (Word, Excel…)
// si archiviano così come sono.
let prossimoId = 0;
export function PaginaScansione({ ctx, sostituisci, opzioni = {} }) {
  const { mostra } = ctx;
  const [pagine, setPagine] = useState([]); // foto: { id, tipo:'foto', file, rotazione, ritaglio, url, larghezza, altezza } · pdf: { id, tipo:'pdf', file }
  const [modo, setModo] = useState('colore');
  const [lavoro, setLavoro] = useState(null);
  const [nome, setNome] = useState(opzioni.descrizione || '');
  const [taglia, setTaglia] = useState(null); // { i, url } pagina da ritagliare
  const [pronto, setPronto] = useState(null); // { chiave, file } PDF già pronto (iOS vuole il file prima del tocco)
  const scatto = useRef(null);
  const galleria = useRef(null);
  const altriFile = useRef(null);
  const titolo = nome.trim() || opzioni.descrizione || `Documento ${new Date().toLocaleDateString('it-IT')}`;
  const chiave = `${pagine.map((p) => `${p.id}:${p.rotazione || 0}:${JSON.stringify(p.ritaglio || null)}:${p.url?.length || 0}`).join('|')}#${modo}#${titolo}`;

  // Rielabora le foto quando cambia il modo.
  useEffect(() => {
    if (!pagine.some((p) => p.tipo === 'foto')) return undefined;
    let vivo = true;
    (async () => {
      setLavoro('Miglioro le pagine…');
      const nuove = [];
      for (const p of pagine) nuove.push(p.tipo === 'foto' ? { ...p, ...(await elaboraPagina(p.file, { modo, rotazione: p.rotazione, ritaglio: p.ritaglio })) } : p);
      if (vivo) { setPagine(nuove); setLavoro(null); }
    })().catch(() => setLavoro(null));
    return () => { vivo = false; };
  }, [modo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Il PDF si prepara da solo poco dopo ogni modifica: Archivia, Mail e WhatsApp partono subito.
  useEffect(() => {
    setPronto(null);
    if (!pagine.length || lavoro) return undefined;
    let vivo = true;
    const t = setTimeout(() => { pdfDaElementi(pagine, titolo).then((file) => vivo && setPronto({ chiave, file })).catch((e) => vivo && setPronto({ chiave, errore: e.message })); }, 400);
    return () => { vivo = false; clearTimeout(t); };
  }, [chiave, lavoro]); // eslint-disable-line react-hooks/exhaustive-deps

  const aggiungi = async (files) => {
    const elenco = [...(files || [])];
    if (!elenco.length) return;
    const altri = elenco.filter((f) => tipoFile(f) === 'altro');
    if (altri.length) {
      // Word, Excel e simili non diventano PDF: si archiviano così come sono.
      if (!pagine.length && elenco.length === 1) { sostituisci({ tipo: 'carica', file: altri[0], opzioni: { ...opzioni, scelto: true } }); return; }
      mostra(`Non uniti nel PDF: ${altri.map((f) => f.name).join(', ')}. Aggiungili da soli.`);
    }
    setLavoro('Preparo la pagina…');
    try {
      const nuove = [];
      for (const file of elenco) {
        const t = tipoFile(file);
        prossimoId += 1;
        if (t === 'pdf') nuove.push({ id: prossimoId, tipo: 'pdf', file });
        else if (t === 'immagine') nuove.push({ id: prossimoId, tipo: 'foto', file, rotazione: 0, ritaglio: null, ...(await elaboraPagina(file, { modo })) });
      }
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
  const apriRitaglio = async (i) => { const p = pagine[i]; const r = await elaboraPagina(p.file, { modo: 'originale', rotazione: p.rotazione }); setTaglia({ i, url: r.url }); };
  const ritaglia = async (ritaglio) => {
    const { i } = taglia; setTaglia(null);
    const p = pagine[i];
    const r = await elaboraPagina(p.file, { modo, rotazione: p.rotazione, ritaglio });
    setPagine((xs) => xs.map((x, j) => (j === i ? { ...x, ritaglio, ...r } : x)));
  };
  const togli = (i) => setPagine((xs) => xs.filter((_, j) => j !== i));
  const sposta = (i, d) => setPagine((xs) => { const a = [...xs]; const [x] = a.splice(i, 1); a.splice(i + d, 0, x); return a; });
  const pronta = pronto?.file && pronto.chiave === chiave;
  const archivia = () => { if (pronta) sostituisci({ tipo: 'carica', file: pronto.file, opzioni: { ...opzioni, descrizione: nome || opzioni.descrizione || '', scelto: true } }); };
  const invia = async (canale) => {
    if (!pronta) return;
    try { const r = await inviaCon(canale, { titolo, files: [pronto.file] }); if (r === 'non_disponibile') mostra('Invio non disponibile qui: archivia e invia da Documenti'); } catch (e) { mostra(e.message); }
  };
  const stato = lavoro || (pagine.length && !pronta ? (pronto?.errore ? `PDF non creato: ${pronto.errore}` : 'Preparo il PDF…') : null);

  return (
    <>
      <input ref={scatto} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { aggiungi(e.target.files); e.target.value = ''; }} />
      <input ref={galleria} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => { aggiungi(e.target.files); e.target.value = ''; }} />
      <input ref={altriFile} type="file" accept="application/pdf,image/*,.heic,.heif,.doc,.docx,.xls,.xlsx,.odt,.ods,.txt,.rtf" multiple hidden onChange={(e) => { aggiungi(e.target.files); e.target.value = ''; }} />
      <div className="pp-sorgenti-rapide">
        <button className="pp-bottone" onClick={() => scatto.current.click()}><IconaFotocamera size={20} /> Scatta</button>
        <button className="pp-bottone pp-bottone-chiaro" onClick={() => galleria.current.click()}><IconaFoto size={20} /> Foto</button>
        <button className="pp-bottone pp-bottone-chiaro" onClick={() => altriFile.current.click()}><IconaFile size={20} /> PDF e file</button>
      </div>
      {pagine.length === 0 && <p className="pp-riga-meta pp-spiegazione">Scatta le pagine (dall'alto, su un piano scuro) o scegli foto e PDF: diventano un solo PDF. Tocca ✂ per ritagliare una foto.</p>}
      {pagine.some((p) => p.tipo === 'foto') && <Segmenti voci={[['colore', 'Nitida'], ['documento', 'Bianco e nero'], ['originale', 'Originale']]} attiva={modo} onScegli={setModo} />}
      {pagine.length > 0 && (
        <div className="pp-scansione">
          {pagine.map((p, i) => (
            <figure key={p.id} className="pp-scansione-pagina">
              {p.tipo === 'foto' ? <img src={p.url} alt={`Pagina ${i + 1}`} /> : <div className="pp-scansione-pdf"><IconaFile size={30} /><span>{p.file.name}</span></div>}
              <figcaption>
                <span>{i + 1}</span>
                {p.tipo === 'foto' && <button aria-label={`Ritaglia pagina ${i + 1}`} onClick={() => apriRitaglio(i)}><IconaTaglia size={18} /></button>}
                {p.tipo === 'foto' && <button aria-label={`Ruota pagina ${i + 1}`} onClick={() => ruota(i)}><IconaRuota size={18} /></button>}
                {i > 0 && <button aria-label={`Sposta prima la pagina ${i + 1}`} onClick={() => sposta(i, -1)}>‹</button>}
                {i < pagine.length - 1 && <button aria-label={`Sposta dopo la pagina ${i + 1}`} onClick={() => sposta(i, 1)}>›</button>}
                <button aria-label={`Togli pagina ${i + 1}`} onClick={() => togli(i)}><IconaCestino size={18} /></button>
              </figcaption>
            </figure>
          ))}
          <button className="pp-scansione-nuova" onClick={() => scatto.current.click()}>
            <IconaFotocamera size={30} /><span>Scatta un'altra pagina</span>
          </button>
        </div>
      )}
      {pagine.length > 0 && (
        <>
          <label className="pp-campo"><span>Nome (facoltativo)</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Es. Referto ecografia" />
          </label>
          <div className="pp-invio-salute">
            <button disabled={!pronta} onClick={() => invia('mail')}><IconaEmail size={18} /> Mail</button>
            <button className="pp-whatsapp" disabled={!pronta} onClick={() => invia('whatsapp')}><IconaChat size={18} /> WhatsApp</button>
          </div>
          <button className="pp-bottone pp-bottone-largo" disabled={!pronta} onClick={archivia}>
            {stato || `Archivia il PDF (${pagine.length} ${pagine.length === 1 ? 'elemento' : 'elementi'})`}
          </button>
        </>
      )}
      {lavoro && !pagine.length && <p className="pp-riga-meta"><span className="pp-rotella" /> {lavoro}</p>}
      <button className="pp-testo-link" onClick={() => sostituisci({ tipo: 'pdf' })}>Solo firmare o modificare un PDF, senza archiviarlo</button>
      {taglia && <Ritaglio src={taglia.url} iniziale={pagine[taglia.i]?.ritaglio} onFatto={ritaglia} onAnnulla={() => setTaglia(null)} />}
    </>
  );
}
