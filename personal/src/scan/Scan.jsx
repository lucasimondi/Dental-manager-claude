// SCAN-HOME (PO 2026-11-10) — «Scan»: l'app della Home per scansionare, allegare foto e firmare PDF.
// È lo strumento «Scansiona o allega» di Personal aperto da solo (lib/scan.js): niente dock né
// sezioni, si parte già con Scatta · Foto · PDF e file. «PDF e firma» apre il gestore PDF di Personal
// (firma con il dito, testo, disegno, pagine). Archiviare usa la stessa pagina di Personal; dopo
// l'archiviazione gli altri file restano disponibili. Nessuna nuova tabella, nessun invio automatico.
// SCAN-HUB (PO 2026-11-12): Scan si apre su una Home (ScanHome) con scanner, strumenti e Recenti;
// lo scanner è una pagina sopra la Home (archiviare lascia lo scanner aperto sotto).
import { useCallback, useEffect, useRef, useState } from 'react';
import { PaginaScansione } from '../Aggiungi.jsx';
import { Pagina } from '../Pagina.jsx';
import { archivioDb } from '../lib/supabasePersonal.js';
import { conteggiFascicoli } from '../lib/archivio.js';
import { CHAT_VUOTA } from '../lib/chat.js';
import { IMPOSTAZIONI_PREDEFINITE, leggiImpostazioni, salvaImpostazioni } from '../lib/impostazioni.js';
import { indirizzoPersonal, strumentoDaIndirizzo } from '../lib/scan.js';
import { pagina, titoloPagina, eModulo } from '../sezioni/index.js';
import { useIngressoPdf } from '../pdf/useIngressoPdf.js';
import { installaPonte } from '../lib/nativo.js';
import { PaginaPdf } from '../pdf/PaginaPdf.jsx';
import { nomeAutomatico, documento, aggiornaDocumento, salvaDocumenti, aggiungiDettagli, proteggiMemoria, elencoDocumenti, cartelleCreate, elencoCartelle } from '../lib/libreria.js';
import { ScanHome } from './ScanHome.jsx';
import { Documenti, SceltaCartella } from './Documenti.jsx';
import { creaMiniatura } from './miniaturaFile.js';
import { IconaOggi, IconaDocumenti, IconaImpostazioni, IconaFotocamera, IconaAltro } from '../Icone.jsx';
import { CartaIdentita } from './CartaIdentita.jsx';
import { EstraiTesto } from './EstraiTesto.jsx';
import { Traduci } from './Traduci.jsx';
import { Scheda } from './Scheda.jsx';
import { PdfInWord } from './PdfInWord.jsx';
import { GrigliaStrumenti } from './ScanHome.jsx';
import { categoriaDa } from './categorie.js';
import { ImpostazioniScan } from './ImpostazioniScan.jsx';
import { leggiImpostazione } from './impostazioniScan.js';

// SCAN-HUB (PO 2026-11-12): le pagine proprie di Scan, aperte dalla Home sopra di essa. Le altre
// (archiviazione, gestore PDF) sono quelle di Personal (sezioni/index.js).
const PAGINE_SCAN = {
  scanner: { titolo: 'Scanner', modulo: true, render: (p, { ctx }) => <PaginaScansione files={p.files} ctx={ctx} sostituisci={ctx.apri} opzioni={{ destinazione: true, nomePredefinito: p.nomeAuto }} /> },
  tessera: { titolo: "Carta d'identità", modulo: true, render: (p, { ctx }) => <CartaIdentita ctx={ctx} sostituisci={ctx.apri} /> },
  testo: { titolo: 'Estrai testo', modulo: true, render: (p, { ctx }) => <EstraiTesto ctx={ctx} fileIniziale={p.file} /> },
  // SCAN-ORGANIZZA: scheda del documento (proposta D) e «PDF in Word».
  scheda: { titolo: 'Documento', modulo: true, render: (p, { ctx, chiudi }) => <Scheda ctx={ctx} id={p.id} chiudi={chiudi} /> },
  parola: { titolo: 'PDF in Word', modulo: true, render: (p, { ctx }) => <PdfInWord ctx={ctx} /> },
  traduci: { titolo: 'Traduci', modulo: true, render: (p, { ctx }) => <Traduci ctx={ctx} testoIniziale={p.testo} fileIniziale={p.file} /> },
  impostazioniScan: { titolo: 'Impostazioni di Scan', render: () => <ImpostazioniScan /> },
  pdfStrumento: { titolo: 'Gestore PDF', modulo: true, render: (p, { ctx, chiudi, sostituisci }) => <PaginaPdf strumento={p.strumento} file={p.file} ctx={ctx} chiudi={chiudi} sostituisci={sostituisci} /> },
};
const paginaScan = (tipo) => PAGINE_SCAN[tipo] || pagina(tipo);
const titoloScan = (p) => p.titolo || (PAGINE_SCAN[p.tipo] ? PAGINE_SCAN[p.tipo].titolo : titoloPagina(p));

// «Metti sulla Home»: Chrome/Android offre l'installazione, su iPhone si spiega il gesto.
function useInstalla() {
  const evento = useRef(null);
  const [puo, setPuo] = useState(false);
  const installata = (() => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch { return false; } })();
  useEffect(() => {
    const prendi = (e) => { e.preventDefault(); evento.current = e; setPuo(true); };
    const fatto = () => setPuo(false);
    window.addEventListener('beforeinstallprompt', prendi);
    window.addEventListener('appinstalled', fatto);
    return () => { window.removeEventListener('beforeinstallprompt', prendi); window.removeEventListener('appinstalled', fatto); };
  }, []);
  const iphone = !installata && /iphone|ipad|ipod/i.test(navigator.userAgent || '');
  const installa = async () => { const e = evento.current; if (!e) return; evento.current = null; setPuo(false); await e.prompt(); };
  return { installata, puo, iphone, installa };
}

export function Scan({ email }) {
  const [pagine, setPagine] = useState([]);
  const [errore, setErrore] = useState(null);
  const [toast, setToast] = useState(null);
  const [occupato, setOccupato] = useState(0);
  const [versione, setVersione] = useState(0);
  const [recenti, setRecenti] = useState(0); // SCAN-HUB: ricarica Recenti e «I miei documenti»
  const [vista, setVista] = useState('home'); // SCAN-ORGANIZZA: Home · File · Strumenti · Impostazioni
  const camera = useRef(null);
  const [salvaIn, setSalvaIn] = useState(null); // { files, cartelle } foglio «Salva in…»
  useEffect(() => { proteggiMemoria(); }, []);
  const [fascicoli, setFascicoli] = useState([]);
  const [chat, setChat] = useState(CHAT_VUOTA);
  const [impostazioni, setImpostazioni] = useState(() => JSON.parse(JSON.stringify(IMPOSTAZIONI_PREDEFINITE)));
  const contatore = useRef(0);
  const timer = useRef(null);
  const { installata, puo, iphone, installa } = useInstalla();

  useEffect(() => { conteggiFascicoli(archivioDb).then(setFascicoli).catch(() => {}); }, [versione]);
  useEffect(() => { leggiImpostazioni(archivioDb).then(setImpostazioni).catch(() => {}); }, []);
  const mostra = useCallback((t, azione = null) => {
    clearTimeout(timer.current); setToast({ testo: t, azione });
    timer.current = setTimeout(() => setToast(null), azione ? 7000 : 2600);
  }, []);
  const esegui = useCallback(async (fn) => {
    setErrore(null); setOccupato((n) => n + 1);
    try { await fn(); } catch (e) { setErrore(e.message || String(e)); } finally { setOccupato((n) => n - 1); }
  }, []);
  const aggiorna = useCallback(() => setVersione((v) => v + 1), []);
  const apri = useCallback((p) => { if (p.tipo === 'scanner' && !p.nomeAuto) p = { ...p, nomeAuto: nomeAutomatico(new Date(), leggiImpostazione('scan-prefisso')) }; contatore.current += 1; setErrore(null); setPagine((st) => [...st, { ...p, chiave: contatore.current }]); }, []);
  const indietro = useCallback(() => { setErrore(null); setPagine((st) => st.slice(0, -1)); }, []);
  const sostituisci = useCallback((p) => {
    contatore.current += 1;
    setPagine((st) => {
      // Keep the working batch after archiving one file; the other files remain available.
      return [...st.slice(0, -1), { ...p, chiave: contatore.current }];
    });
  }, []);
  // Il resto di Personal (sezioni, chat) si apre nell'app Personal.
  const vai = useCallback((sezione) => { window.location.href = indirizzoPersonal(sezione); }, []);
  // SCAN-PDF: «Condividi → Scan» (Android) e «Apri con → Scan» (computer) aprono il PDF nel gestore.
  const ricevi = useCallback((p) => {
    if (p.files?.length > 1) apri({ tipo: 'scanner', files: p.files });
    else apri(p);
  }, [apri]);
  useIngressoPdf(ricevi, setErrore);
  // SCAN-MLKIT: nell'app Android, PDF e foto da «Condividi / Apri con → Poliedra Scan».
  useEffect(() => { installaPonte((files) => ricevi(files.length === 1 && files[0].type === 'application/pdf' ? { tipo: 'pdf', file: files[0] } : { tipo: 'scanner', files })); }, [ricevi]);
  useEffect(() => {
    const coda = window.launchQueue;
    let daFile = false;
    if (coda?.setConsumer) coda.setConsumer(async (p) => {
      if (!p?.files?.length) return;
      daFile = true;
      try { ricevi({ tipo: 'pdf', files: await Promise.all(p.files.map((h) => h.getFile())) }); } catch (e) { setErrore(e.message); }
    });
    if (strumentoDaIndirizzo() === 'pdf') setTimeout(() => { if (!daFile) apri({ tipo: 'pdf' }); }, 0);
  }, [apri, ricevi]);

  const salvaImp = useCallback(async (nuove) => {
    setImpostazioni(nuove);
    try { setImpostazioni(await salvaImpostazioni(archivioDb, nuove)); } catch (e) { setErrore(`Impostazioni non salvate: ${e.message}`); }
  }, []);
  const ctx = {
    esegui, aggiorna, mostra, versione, impostazioni, salvaImp, fascicoli, apri, indietro, vai, sotto: null, chat, setChat,
    aggiungi: () => { setPagine([]); },
    // SCAN-HUB: i file creati, condivisi o scaricati restano nei Recenti di questo telefono.
    // SCAN-LIBRERIA: ogni file creato, condiviso, scaricato o archiviato finisce in «I miei documenti»;
    // la miniatura si disegna subito dopo, senza far aspettare.
    ricorda: (files, opzioni) => {
      // SCAN-ORGANIZZA: categoria scelta da sola dal nome (e dopo dal testo letto), finché l'utente non la cambia.
      const categorie = opzioni?.categorie || [...files].map((f) => categoriaDa({ nome: f.name, origine: opzioni?.origine }));
      salvaDocumenti(files, { cartella: leggiImpostazione('scan-cartella'), ...opzioni, categorie }).then(async (ids) => {
        setRecenti((n) => n + 1);
        for (const [i, id] of ids.entries()) { const m = await creaMiniatura(files[i]); if (m) await aggiungiDettagli(id, { miniatura: m }); }
        setRecenti((n) => n + 1);
        // SCAN-OCR-MLKIT: testo per la ricerca (ML Kit nell'app; nel browser solo il testo già nei PDF).
        const { testoPerRicerca } = await import('../pdf/ocr.js');
        for (const [i, id] of ids.entries()) {
          const t = await testoPerRicerca(files[i]).catch(() => '');
          if (!t) continue;
          await aggiungiDettagli(id, { testo: t });
          const d = await documento(id).catch(() => null);
          if (d?.categoriaAuto !== false && d?.categoria === 'generali') await aggiornaDocumento(id, { categoria: categoriaDa({ nome: d.nome, testo: t }) });
        }
        setRecenti((n) => n + 1);
      }).catch((e) => mostra(`Non salvato in «I miei documenti»: ${e.message}`));
    },
    // SCAN-LIBRERIA: «Salva in I miei documenti» con la scelta della cartella.
    salvaIn: async (files) => {
      const [d, c] = await Promise.all([elencoDocumenti(), cartelleCreate()]).catch(() => [[], []]);
      setSalvaIn({ files, cartelle: elencoCartelle(d, c) });
    },
    aggiornaLibreria: () => setRecenti((n) => n + 1),
    apriChat: () => vai('poliedron'),
    pagato: () => vai('conti'),
  };
  const sopra = pagine.length > 0;
  // SCAN-HUB: dalla griglia della Home allo strumento.
  function strumento(id) {
    if (id === 'scanner' || id === 'unisci') apri({ tipo: 'scanner' });
    else if (id === 'tessera' || id === 'testo' || id === 'traduci') apri({ tipo: id });
    else if (id === 'pdf') apri({ tipo: 'pdf' });
    else if (id === 'firma' || id === 'comprimi' || id === 'pagine') apri({ tipo: 'pdfStrumento', strumento: id });
    else if (id === 'parola') apri({ tipo: 'parola' });
    else if (id === 'archivio') vai('documenti');
    else if (id === 'personali') vai('personali');
  }

  return (
    <div className="pp-app pp-scan">
      <header className="pp-testata">
        <div className="pp-testata-titoli">
          <a className="pp-brand" href={indirizzoPersonal()} aria-label="Apri Poliedron Personal"><span className="pp-brand-moderno"><img src="/scan-192.png" alt="" width="24" height="24" /></span><span>Poliedron <small>SCAN</small></span></a>
          <h1>{{ home: 'Scan', file: 'I miei documenti', strumenti: 'Strumenti', impostazioni: 'Impostazioni' }[vista]}</h1>
        </div>
      </header>
      {occupato > 0 && <div className="pp-barra-caricamento" aria-hidden="true" />}
      {errore && !sopra && <p className="pp-messaggio pp-messaggio-errore" role="alert">{errore}</p>}
      <main className="pp-contenuto pp-scan-contenuto">
        <input ref={camera} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => { const f = [...e.target.files]; e.target.value = ''; if (f.length) apri({ tipo: 'scanner', files: f }); }} />
        {vista === 'home' && <ScanHome ctx={ctx} versioneRecenti={recenti} onStrumento={strumento} onDocumenti={() => setVista('file')} onFiles={(files) => files.length && apri({ tipo: 'scanner', files })} />}
        {vista === 'file' && <Documenti ctx={ctx} versione={recenti} onCambia={() => setRecenti((n) => n + 1)} onStrumento={strumento} />}
        {vista === 'strumenti' && <GrigliaStrumenti completa onStrumento={strumento} />}
        {vista === 'impostazioni' && <ImpostazioniScan />}
        {!installata && (puo || iphone) && (
          <div className="pp-scan-installa">
            {puo ? <button className="pp-bottone pp-bottone-chiaro pp-bottone-largo" onClick={installa}>Metti «Scan» sulla schermata Home</button>
              : <p className="pp-riga-meta">Per averla sulla Home: tocca Condividi ↑ e poi «Aggiungi alla schermata Home».</p>}
          </div>
        )}
      </main>
      {!sopra && (
        <nav className="scan-schede" aria-label="Sezioni di Scan">
          <button aria-current={vista === 'home' ? 'page' : undefined} onClick={() => setVista('home')}><IconaOggi size={22} /><span>Home</span></button>
          <button aria-current={vista === 'file' ? 'page' : undefined} onClick={() => setVista('file')}><IconaDocumenti size={22} /><span>File</span></button>
          <button className="scan-schede-scatta" aria-label="Scatta e scansiona" onClick={() => camera.current.click()}><span><IconaFotocamera size={26} /></span></button>
          <button aria-current={vista === 'strumenti' ? 'page' : undefined} onClick={() => setVista('strumenti')}><IconaAltro size={22} /><span>Strumenti</span></button>
          <button aria-current={vista === 'impostazioni' ? 'page' : undefined} onClick={() => setVista('impostazioni')}><IconaImpostazioni size={22} /><span>Impostazioni</span></button>
        </nav>
      )}
      {pagine.map((p, i) => (
        <Pagina key={p.chiave} titolo={titoloScan(p)} visibile={i === pagine.length - 1} onIndietro={indietro} senzaChiudi={Boolean(PAGINE_SCAN[p.tipo]?.modulo) || eModulo(p.tipo)}>
          {i === pagine.length - 1 && errore && <p className="pp-messaggio pp-messaggio-errore" role="alert">{errore}</p>}
          {paginaScan(p.tipo)?.render(p, { ctx, chiudi: indietro, sostituisci, email }) ?? null}
        </Pagina>
      ))}
      {salvaIn && <SceltaCartella cartelle={salvaIn.cartelle} titolo="Salva in I miei documenti" onChiudi={() => setSalvaIn(null)}
        onScegli={(cartella) => { ctx.ricorda(salvaIn.files, { cartella }); setSalvaIn(null); mostra(`Salvato in «${cartella}» · I miei documenti`); }} />}
      {toast && (
        <div className={`pp-toast${toast.azione ? ' pp-toast-azione' : ''}`} role="status">
          <span>{toast.testo}</span>
          {toast.azione && <button onClick={() => { const { fai } = toast.azione; setToast(null); esegui(async () => mostra(await fai())); }}>{toast.azione.etichetta}</button>}
        </div>
      )}
    </div>
  );
}
