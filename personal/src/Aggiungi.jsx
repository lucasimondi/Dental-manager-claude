// POL-VITA-006 — tasto + : tutte le aggiunte in un foglio (scansione, foto, fotocamera, file da
// altre app o cloud, documento personale, spesa, incasso, pagamento da fare, evento) e pagina di
// scansione multipagina che produce un PDF.
import { useEffect, useRef, useState } from 'react';
import { elaboraPagina, rilevaAngoli } from './lib/scansione.js';
import { pdfDaElementi, preparaAllegatiScan, tipoFile } from './lib/pdfUnico.js';
import { validaFile, MAX_PDF_BYTES } from './pdf/filePdf.js';
import { inviaCon, scaricaDocumento } from './lib/condividi.js';
import { Segmenti } from './ui.jsx';
import { Angoli } from './Angoli.jsx';
import { eScan, indirizzoScan } from './lib/scan.js';
import { daScannerNativo } from './lib/nativo.js';
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
// SCAN-PDF-MANAGER (PO 2026-11-11): raddrizza automatico, peso leggero e OCR restano scelti sul telefono.
const leggiScelta = (chiave, base) => { try { const v = localStorage.getItem(chiave); return v === null ? base : v === '1'; } catch { return base; } };
const salvaScelta = (chiave, v) => { try { localStorage.setItem(chiave, v ? '1' : '0'); } catch { /* memoria non disponibile */ } };
function useScelta(chiave, base) {
  const [v, setV] = useState(() => leggiScelta(chiave, base));
  return [v, (x) => { salvaScelta(chiave, x); setV(x); }];
}
export function PaginaScansione({ ctx, sostituisci, opzioni = {}, files: initialFiles }) {
  const { mostra } = ctx;
  const [pagine, setPagine] = useState([]); // foto: { id, tipo:'foto', file, rotazione, ritaglio, url, larghezza, altezza } · pdf: { id, tipo:'pdf', file }
  const [separati, setSeparati] = useState(false);
  const [esclusi, setEsclusi] = useState([]);
  const inCorso = useRef(false);
  const ricevuti = useRef(null);
  const [modo, setModo] = useState('colore');
  const [lavoro, setLavoro] = useState(null);
  const [nome, setNome] = useState(opzioni.descrizione || '');
  const [taglia, setTaglia] = useState(null); // { i, url, automatici } pagina da raddrizzare
  const [auto, setAuto] = useScelta('scan-raddrizza-auto', true);
  const [leggero, setLeggero] = useScelta('scan-peso-leggero', false);
  const [ocr, setOcr] = useScelta('scan-ocr', false);
  const [avanzamento, setAvanzamento] = useState('');
  const peso = leggero ? 'leggero' : 'normale';
  const [pronto, setPronto] = useState(null); // { chiave, file } PDF già pronto (iOS vuole il file prima del tocco)
  const scatto = useRef(null);
  const galleria = useRef(null);
  const altriFile = useRef(null);
  const titolo = nome.trim() || opzioni.descrizione || `Documento ${new Date().toLocaleDateString('it-IT')}`;
  const selezionate = pagine.filter(p => !esclusi.includes(p.id));
  const chiave = `${selezionate.map((p) => `${p.id}:${p.rotazione || 0}:${JSON.stringify(p.angoli || p.ritaglio || null)}:${p.url?.length || 0}`).join('|')}#${modo}#${titolo}#${separati}#${peso}#${ocr}`;

  // Rielabora le foto quando cambia il modo.
  useEffect(() => {
    if (!pagine.some((p) => p.tipo === 'foto')) return undefined;
    let vivo = true;
    (async () => {
      inCorso.current = true; setLavoro('Miglioro le pagine…');
      const nuove = [];
      for (const p of pagine) nuove.push(p.tipo === 'foto' ? { ...p, ...(await elaboraPagina(p.file, { modo, rotazione: p.rotazione, ritaglio: p.ritaglio, angoli: p.angoli, peso })) } : p);
      if (vivo) { setPagine(nuove); setLavoro(null); inCorso.current = false; }
    })().catch((e) => { if (vivo) { mostra(e.message || 'Impossibile migliorare le foto.'); setLavoro(null); inCorso.current = false; } });
    return () => { vivo = false; };
  }, [modo, peso]); // eslint-disable-line react-hooks/exhaustive-deps

  // Il PDF si prepara da solo poco dopo ogni modifica: Archivia, Mail e WhatsApp partono subito.
  useEffect(() => {
    setPronto(null);
    if (!selezionate.length || lavoro) return undefined;
    let vivo = true;
    const t = setTimeout(() => {
      preparaAllegatiScan(selezionate, titolo, separati, { ocr, onAvanzamento: (m) => vivo && setAvanzamento(m) })
        .then((files) => vivo && setPronto({ chiave, files, file: files[0] }))
        .catch((e) => vivo && setPronto({ chiave, errore: e.message }))
        .finally(() => vivo && setAvanzamento(''));
    }, 400);
    return () => { vivo = false; clearTimeout(t); setAvanzamento(''); };
  }, [chiave, lavoro]); // eslint-disable-line react-hooks/exhaustive-deps

  const aggiungi = async (files) => {
    const elenco = [...(files || [])];
    if (!elenco.length || inCorso.current) return;
    const altri = elenco.filter((f) => tipoFile(f) === 'altro');
    if (altri.length) {
      // Word, Excel e simili non diventano PDF: si archiviano così come sono.
      if (!pagine.length && elenco.length === 1) { sostituisci({ tipo: 'carica', file: altri[0], opzioni: { ...opzioni, scelto: true } }); return; }
      mostra(`Non uniti nel PDF: ${altri.map((f) => f.name).join(', ')}. Aggiungili da soli.`);
    }
    inCorso.current = true;
    setLavoro('Preparo la pagina…');
    try {
      const supportati = elenco.filter(f => tipoFile(f) !== 'altro');
      supportati.forEach(validaFile);
      if (pagine.length + supportati.length > 20) throw new Error('Puoi lavorare con un massimo di 20 documenti.');
      if ([...pagine.map(p => p.file), ...supportati].reduce((n, f) => n + f.size, 0) > MAX_PDF_BYTES) throw new Error('Il totale supera 40 MB. Aggiungi meno documenti.');
      const nuove = [];
      for (const file of elenco) {
        const t = tipoFile(file);
        prossimoId += 1;
        if (t === 'pdf') nuove.push({ id: prossimoId, tipo: 'pdf', file });
        else if (t === 'immagine') {
          // SCAN-MLKIT: le pagine dello scanner Google arrivano già raddrizzate.
          const r = await elaboraPagina(file, { modo, angoli: auto && !daScannerNativo(file) ? 'auto' : null, peso });
          nuove.push({ id: prossimoId, tipo: 'foto', file, rotazione: 0, ritaglio: null, ...r, rilevati: r.angoli });
        }
      }
      setPagine((p) => [...p, ...nuove]);
    } catch (e) { mostra(e.message || 'File non leggibile'); }
    finally { inCorso.current = false; setLavoro(null); }
  };
  useEffect(() => {
    if (initialFiles?.length && ricevuti.current !== initialFiles) { ricevuti.current = initialFiles; void aggiungi(initialFiles); }
  }, [initialFiles]); // eslint-disable-line react-hooks/exhaustive-deps
  const modificaFoto = async (fn) => {
    if (inCorso.current) return;
    inCorso.current = true; setLavoro('Aggiorno la foto…');
    try { await fn(); } catch (e) { mostra(e.message || 'Foto non leggibile'); }
    finally { inCorso.current = false; setLavoro(null); }
  };
  const ruota = async (i) => {
    const p = pagine[i];
    const rotazione = (p.rotazione + 90) % 360;
    const r = await elaboraPagina(p.file, { modo, rotazione, angoli: auto ? 'auto' : null, peso });
    setPagine((xs) => xs.map((x, j) => (j === i ? { ...x, rotazione, ritaglio: null, ...r, rilevati: r.angoli } : x)));
  };
  const apriAngoli = async (i) => {
    const p = pagine[i];
    const [r, automatici] = await Promise.all([elaboraPagina(p.file, { modo: 'originale', rotazione: p.rotazione }), p.rilevati !== undefined && p.rilevati !== null ? p.rilevati : rilevaAngoli(p.file, { rotazione: p.rotazione })]);
    setTaglia({ i, url: r.url, automatici });
  };
  const raddrizzaPagina = async (angoli) => {
    const { i, automatici } = taglia; setTaglia(null);
    const p = pagine[i];
    const r = await elaboraPagina(p.file, { modo, rotazione: p.rotazione, angoli, peso });
    setPagine((xs) => xs.map((x, j) => (j === i ? { ...x, ritaglio: null, ...r, rilevati: automatici } : x)));
  };
  const togli = (i) => setPagine((xs) => xs.filter((_, j) => j !== i));
  const sposta = (i, d) => setPagine((xs) => { const a = [...xs]; const [x] = a.splice(i, 1); a.splice(i + d, 0, x); return a; });
  const pronta = !lavoro && pronto?.file && pronto.chiave === chiave;
  // SCAN-HUB: in Scan i PDF archiviati, inviati o scaricati restano nei Recenti del telefono.
  const ricorda = (files) => ctx.ricorda?.(files);
  const archiviaFile = (file) => { ricorda([file]); sostituisci({ tipo: 'carica', file, opzioni: { ...opzioni, descrizione: file.name.replace(/\.pdf$/i, ''), scelto: true, soloArchiviazione: true, nonAnalizzare: true } }); };
  const archivia = () => { if (pronta) archiviaFile(pronto.file); };
  const modifica = async (elementi) => {
    if (inCorso.current) return;
    inCorso.current = true; setLavoro('Apro il PDF…');
    try {
      const file = await pdfDaElementi(elementi, elementi.length === 1 ? elementi[0].file.name.replace(/\.[^.]+$/, '') : titolo);
      ctx.apri({ tipo: 'pdf', file, onSave: (copia) => {
        if (elementi.length === pagine.length) setNome(copia.name.replace(/\.pdf$/i, ''));
        const ids = new Set(elementi.map(p => p.id));
        setPagine(xs => { const index = xs.findIndex(p => ids.has(p.id)); const restanti = xs.filter(p => !ids.has(p.id)); restanti.splice(index, 0, { id: ++prossimoId, tipo: 'pdf', file: copia }); return restanti; });
        setEsclusi(xs => xs.filter(id => !ids.has(id)));
      } });
    } catch (e) { mostra(e.message); }
    finally { inCorso.current = false; setLavoro(null); }
  };
  useEffect(() => {
    if (!pagine.length) return undefined;
    const avvisa = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', avvisa);
    return () => window.removeEventListener('beforeunload', avvisa);
  }, [pagine.length]);
  const invia = async (canale) => {
    if (!pronta) return;
    try { const r = await inviaCon(canale, { titolo, files: pronto.files }); if (r !== 'annullato') ricorda(pronto.files); if (r === 'non_disponibile') mostra('Questo browser non può allegare questi file: usa Scarica PDF e allegali dalla tua app.'); } catch (e) { mostra(e.message); }
  };
  const stato = lavoro || avanzamento || (!selezionate.length ? 'Seleziona almeno un documento' : pagine.length && !pronta ? (pronto?.errore ? `PDF non creato: ${pronto.errore}` : 'Preparo il PDF…') : null);

  return (
    <>
      <input ref={scatto} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => { aggiungi(e.target.files); e.target.value = ''; }} />
      <input ref={galleria} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => { aggiungi(e.target.files); e.target.value = ''; }} />
      <input ref={altriFile} type="file" accept="application/pdf,image/*,.heic,.heif,.doc,.docx,.xls,.xlsx,.odt,.ods,.txt,.rtf" multiple hidden onChange={(e) => { aggiungi(e.target.files); e.target.value = ''; }} />
      <fieldset disabled={!!lavoro} className="scan-controls"><div className="pp-sorgenti-rapide">
        <button className="pp-bottone" onClick={() => scatto.current.click()}><IconaFotocamera size={20} /> Scatta</button>
        <button className="pp-bottone pp-bottone-chiaro" onClick={() => galleria.current.click()}><IconaFoto size={20} /> Foto</button>
        <button className="pp-bottone pp-bottone-chiaro" onClick={() => altriFile.current.click()}><IconaFile size={20} /> PDF e file</button>
      </div>
      {pagine.length === 0 && <p className="pp-riga-meta pp-spiegazione">Scatta le pagine (dall'alto, su un piano scuro) o scegli foto e PDF: diventano un solo PDF. Il foglio si raddrizza da solo; tocca ✂ per sistemare gli angoli.</p>}
      <div className="scan-opzioni">
        <label><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Raddrizza automatico</label>
        <label><input type="checkbox" checked={leggero} onChange={(e) => setLeggero(e.target.checked)} /> PDF leggero</label>
        <label><input type="checkbox" checked={ocr} onChange={(e) => setOcr(e.target.checked)} /> Testo ricercabile (OCR)</label>
      </div>
      {pagine.some((p) => p.tipo === 'foto') && <Segmenti voci={[['colore', 'Nitida'], ['documento', 'Bianco e nero'], ['originale', 'Originale']]} attiva={modo} onScegli={setModo} />}
      {pagine.length > 0 && (
        <div className="pp-scansione">
          {pagine.map((p, i) => (
            <figure key={p.id} className="pp-scansione-pagina">
              {p.tipo === 'foto' && p.angoli && <span className="pp-scan-auto">Raddrizzata</span>}
              {p.tipo === 'foto' ? <img src={p.url} alt={`Pagina ${i + 1}`} /> : <div className="pp-scansione-pdf"><IconaFile size={30} /><span>{p.file.name}</span></div>}
              <figcaption>
                <label className="scan-select"><input type="checkbox" aria-label={`Seleziona documento ${i + 1}`} checked={!esclusi.includes(p.id)} onChange={() => setEsclusi(xs => xs.includes(p.id) ? xs.filter(id => id !== p.id) : [...xs, p.id])} />{i + 1}</label>
                {p.tipo === 'pdf' && <button className="scan-edit" onClick={() => modifica([p])}>Apri · Firma</button>}
                {p.tipo === 'foto' && <button aria-label={`Raddrizza o ritaglia pagina ${i + 1}`} onClick={() => modificaFoto(() => apriAngoli(i))}><IconaTaglia size={18} /></button>}
                {p.tipo === 'foto' && <button aria-label={`Ruota pagina ${i + 1}`} onClick={() => modificaFoto(() => ruota(i))}><IconaRuota size={18} /></button>}
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
      </fieldset>
      {pagine.length > 0 && (
        <>
          <div className="scan-selection-bar"><strong>{selezionate.length} di {pagine.length} selezionati</strong><button disabled={!!lavoro} className="pp-testo-link" onClick={() => setEsclusi(selezionate.length === pagine.length ? pagine.map(p => p.id) : [])}>{selezionate.length === pagine.length ? 'Deseleziona' : 'Seleziona tutti'}</button></div>
          <Segmenti voci={[[false, 'Un solo PDF'], [true, 'File separati']]} attiva={separati} onScegli={setSeparati} />
          {!separati && selezionate.filter(p => p.tipo === 'pdf').length > 0 && selezionate.length > 1 && <p className="pp-riga-meta">Unire fissa i campi compilati e può invalidare firme digitali esistenti. Gli originali restano intatti.</p>}
          <label className="pp-campo"><span>Nome (facoltativo)</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Es. Referto ecografia" />
          </label>
          <div className="pp-invio-salute">
            <button disabled={!pronta} onClick={() => invia('mail')}><IconaEmail size={18} /> Mail</button>
            <button className="pp-whatsapp" disabled={!pronta} onClick={() => invia('whatsapp')}><IconaChat size={18} /> WhatsApp</button>
          </div>
          <p className="pp-riga-meta">Mail e WhatsApp aprono la condivisione del telefono: scegli lì l’app destinataria.</p>
          {!separati && <div className="scan-output-actions">
            <button className="pp-bottone pp-bottone-chiaro" disabled={!pronta} onClick={() => modifica(selezionate)}>Apri · Modifica · Firma</button>
            <button className="pp-bottone" disabled={!pronta} onClick={archivia}>Archivia il PDF</button>
          </div>}
          {pronta && pronto.files.map((file, i) => <div className="scan-output-file" key={`${chiave}:${i}`}><span>{file.name}</span><button className="pp-testo-link" onClick={() => { scaricaDocumento(file); ricorda([file]); }}>Scarica PDF</button>{separati && <button className="pp-testo-link" onClick={() => archiviaFile(file)}>Archivia</button>}</div>)}
          {stato && <p className="pp-riga-meta" role="status">{stato}</p>}

        </>
      )}
      {lavoro && !pagine.length && <p className="pp-riga-meta"><span className="pp-rotella" /> {lavoro}</p>}
      <button className="pp-testo-link" onClick={() => sostituisci({ tipo: 'pdf' })}>Solo firmare o modificare un PDF, senza archiviarlo</button>
      {!eScan() && <a className="pp-testo-link" href={indirizzoScan()} target="_blank" rel="noreferrer">Metti «Scan» sulla schermata Home</a>}
      {taglia && <Angoli src={taglia.url} iniziale={pagine[taglia.i]?.angoli} automatici={taglia.automatici} onFatto={q => modificaFoto(() => raddrizzaPagina(q))} onAnnulla={() => setTaglia(null)} />}
    </>
  );
}
