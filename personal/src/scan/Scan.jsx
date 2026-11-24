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
import { PaginaPdf } from '../pdf/PaginaPdf.jsx';
import { ricordaFile } from '../lib/recenti.js';
import { ScanHome } from './ScanHome.jsx';
import { CartaIdentita } from './CartaIdentita.jsx';
import { usePortale, useDocumentiInFinestra } from '../lib/portale.js';
import { preparaFile, comeFile } from '../lib/condividi.js';
import { tokenSessione } from '../ui.jsx';
import { EstraiTesto } from './EstraiTesto.jsx';

// SCAN-HUB (PO 2026-11-12): le pagine proprie di Scan, aperte dalla Home sopra di essa. Le altre
// (archiviazione, gestore PDF) sono quelle di Personal (sezioni/index.js).
const PAGINE_SCAN = {
  scanner: { titolo: 'Scanner', modulo: true, render: (p, { ctx }) => <PaginaScansione files={p.files} ctx={ctx} sostituisci={ctx.apri} opzioni={{ destinazione: true, fotocamera: Boolean(p.fotocamera) }} /> },
  tessera: { titolo: "Carta d'identità", modulo: true, render: (p, { ctx }) => <CartaIdentita ctx={ctx} sostituisci={ctx.apri} /> },
  testo: { titolo: 'Estrai testo', modulo: true, render: (p, { ctx }) => <EstraiTesto ctx={ctx} /> },
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

// PERSONAL-FINESTRE (PO 2026-11-24: «devo poterla usare a tutto schermo e dentro il desktop»): con
// `esterno` (il contesto di Personal) lo Scan vive in una finestra del desktop: le altre app si aprono
// nel desktop, Esplora fa da «Scegli da Poliedron», la condivisione resta a Personal.
export function Scan({ email, esterno = null }) {
  const incorporato = Boolean(esterno);
  const portale = usePortale();
  const [pagine, setPagine] = useState([]);
  const [errore, setErrore] = useState(null);
  const [toast, setToast] = useState(null);
  const [occupato, setOccupato] = useState(0);
  const [versione, setVersione] = useState(0);
  const [recenti, setRecenti] = useState(0); // SCAN-HUB: ricarica l'elenco Recenti
  const [fascicoli, setFascicoli] = useState([]);
  const [chat, setChat] = useState(CHAT_VUOTA);
  const [impostazioni, setImpostazioni] = useState(() => JSON.parse(JSON.stringify(IMPOSTAZIONI_PREDEFINITE)));
  const contatore = useRef(0);
  const timer = useRef(null);
  const { installata, puo, iphone, installa } = useInstalla();

  // SCAN-GRAFICA (PO 2026-11-24: «la grafica dello Scan nella prima pagina può andare ma non nelle altre,
  // deve essere coordinata»): il tema dello Scan vale anche per le pagine sopra e per il gestore PDF.
  useEffect(() => { const el = incorporato ? portale : document.body; el?.classList.add('scan-app'); return () => el?.classList.remove('scan-app'); }, [incorporato, portale]);
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
  const apri = useCallback((p) => { contatore.current += 1; setErrore(null); setPagine((st) => [...st, { ...p, chiave: contatore.current }]); }, []);
  const indietro = useCallback(() => { setErrore(null); setPagine((st) => st.slice(0, -1)); }, []);
  const sostituisci = useCallback((p) => {
    contatore.current += 1;
    setPagine((st) => {
      // Keep the working batch after archiving one file; the other files remain available.
      return [...st.slice(0, -1), { ...p, chiave: contatore.current }];
    });
  }, []);
  // Il resto di Personal (sezioni, chat) si apre nell'app Personal.
  const vai = useCallback((sezione) => { if (esterno) esterno.vai(sezione); else window.location.href = indirizzoPersonal(sezione); }, [esterno]);
  // SCAN-PDF: «Condividi → Scan» (Android) e «Apri con → Scan» (computer) aprono il PDF nel gestore.
  const ricevi = useCallback((p) => {
    if (p.files?.length > 1) apri({ tipo: 'scanner', files: p.files });
    else apri(p);
  }, [apri]);
  useIngressoPdf(ricevi, setErrore, !incorporato);
  useEffect(() => {
    const coda = window.launchQueue;
    let daFile = false;
    if (coda?.setConsumer && !incorporato) coda.setConsumer(async (p) => {
      if (!p?.files?.length) return;
      daFile = true;
      try { ricevi({ tipo: 'pdf', files: await Promise.all(p.files.map((h) => h.getFile())) }); } catch (e) { setErrore(e.message); }
    });
    if (!incorporato && strumentoDaIndirizzo() === 'pdf') setTimeout(() => { if (!daFile) apri({ tipo: 'pdf' }); }, 0);
  }, [apri, ricevi]);

  const salvaImp = useCallback(async (nuove) => {
    setImpostazioni(nuove);
    try { setImpostazioni(await salvaImpostazioni(archivioDb, nuove)); } catch (e) { setErrore(`Impostazioni non salvate: ${e.message}`); }
  }, []);
  const ctx = {
    esegui, aggiorna, mostra, versione, impostazioni, salvaImp, fascicoli, apri, indietro, vai, sotto: null, chat, setChat,
    aggiungi: () => { setPagine([]); },
    // SCAN-HUB: i file creati, condivisi o scaricati restano nei Recenti di questo telefono.
    ricorda: (files) => { ricordaFile(files).then(() => setRecenti((n) => n + 1)).catch(() => {}); },
    apriChat: () => vai('poliedron'),
    apriFinestra: esterno?.apriFinestra, // nel desktop: Esplora come finestra di scelta
    pagato: () => vai('conti'),
  };
  const sopra = pagine.length > 0;
  // PERSONAL-FINESTRE: documenti lasciati sulla finestra dello Scan (senza scanner aperto) → scanner con quei file.
  useDocumentiInFinestra(async (docs) => {
    try { const t = await tokenSessione(); const files = []; for (const d of docs) files.push(comeFile(await preparaFile(d.drive_file_id, t))); apri({ tipo: 'scanner', files }); }
    catch (e) { setErrore(e.message || 'Documento non scaricato.'); }
  }, incorporato && !pagine.some((p) => p.tipo === 'scanner'));
  // SCAN-HUB: dalla griglia della Home allo strumento.
  function strumento(id) {
    if (id === 'scanner') apri({ tipo: 'scanner', fotocamera: true }); // SCAN-VIVO: lo scanner parte dalla fotocamera
    else if (id === 'unisci') apri({ tipo: 'scanner' });
    else if (id === 'tessera' || id === 'testo') apri({ tipo: id });
    else if (id === 'pdf') apri({ tipo: 'pdf' });
    else if (id === 'firma' || id === 'comprimi' || id === 'pagine') apri({ tipo: 'pdfStrumento', strumento: id });
    else if (id === 'archivio') vai('documenti');
    else if (id === 'personali') vai('personali');
  }

  return (
    <div className={`pp-app pp-scan scan-app${incorporato ? ' scan-incorporato' : ''}`}>
      <header className="pp-testata">
        <div className="pp-testata-titoli">
          <a className="pp-brand" href={indirizzoPersonal()} aria-label="Apri Poliedron Personal"><span className="pp-brand-moderno"><img src="/scan-192.png" alt="" width="24" height="24" /></span><span>Poliedron <small>SCAN</small></span></a>
          {!incorporato && <h1>Scan</h1>}
          {!incorporato && <a className="scan-al-desktop" href={`${indirizzoPersonal()}${indirizzoPersonal().includes('?') ? '&' : '?'}finestra=scan`}>Apri nel desktop</a>}
        </div>
      </header>
      {occupato > 0 && <div className="pp-barra-caricamento" aria-hidden="true" />}
      {errore && !sopra && <p className="pp-messaggio pp-messaggio-errore" role="alert">{errore}</p>}
      <main className="pp-contenuto pp-scan-contenuto">
        <ScanHome ctx={ctx} coperta={sopra} versioneRecenti={recenti} onStrumento={strumento} onFiles={(files) => files.length && apri({ tipo: 'scanner', files })} />
        {!installata && (puo || iphone) && (
          <div className="pp-scan-installa">
            {puo ? <button className="pp-bottone pp-bottone-chiaro pp-bottone-largo" onClick={installa}>Metti «Scan» sulla schermata Home</button>
              : <p className="pp-riga-meta">Per averla sulla Home: tocca Condividi ↑ e poi «Aggiungi alla schermata Home».</p>}
          </div>
        )}
      </main>
      {pagine.map((p, i) => (
        <Pagina key={p.chiave} titolo={titoloScan(p)} visibile={i === pagine.length - 1} onIndietro={indietro} senzaChiudi={Boolean(PAGINE_SCAN[p.tipo]?.modulo) || eModulo(p.tipo)}>
          {i === pagine.length - 1 && errore && <p className="pp-messaggio pp-messaggio-errore" role="alert">{errore}</p>}
          {paginaScan(p.tipo)?.render(p, { ctx, chiudi: indietro, sostituisci, email }) ?? null}
        </Pagina>
      ))}
      {toast && (
        <div className={`pp-toast${toast.azione ? ' pp-toast-azione' : ''}`} role="status">
          <span>{toast.testo}</span>
          {toast.azione && <button onClick={() => { const { fai } = toast.azione; setToast(null); esegui(async () => mostra(await fai())); }}>{toast.azione.etichetta}</button>}
        </div>
      )}
    </div>
  );
}
