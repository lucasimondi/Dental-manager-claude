// SCAN-HOME (PO 2026-11-10) — «Scan»: l'app della Home per scansionare, allegare foto e firmare PDF.
// È lo strumento «Scansiona o allega» di Personal aperto da solo (lib/scan.js): niente dock né
// sezioni, si parte già con Scatta · Foto · PDF e file. «PDF e firma» apre il gestore PDF di Personal
// (firma con il dito, testo, disegno, pagine). Archiviare usa la stessa pagina di Personal; dopo
// l'archiviazione gli altri file restano disponibili. Nessuna nuova tabella, nessun invio automatico.
import { useCallback, useEffect, useRef, useState } from 'react';
import { PaginaScansione } from '../Aggiungi.jsx';
import { Pagina } from '../Pagina.jsx';
import { archivioDb } from '../lib/supabasePersonal.js';
import { conteggiFascicoli } from '../lib/archivio.js';
import { CHAT_VUOTA } from '../lib/chat.js';
import { IMPOSTAZIONI_PREDEFINITE, leggiImpostazioni, salvaImpostazioni } from '../lib/impostazioni.js';
import { indirizzoPersonal, strumentoDaIndirizzo } from '../lib/scan.js';
import { pagina, titoloPagina, eModulo } from '../sezioni/index.js';
import { IconaScansiona, IconaFile } from '../Icone.jsx';
import { useIngressoPdf } from '../pdf/useIngressoPdf.js';

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
  const [filesRicevuti, setFilesRicevuti] = useState(null);
  const [pagine, setPagine] = useState([]);
  const [errore, setErrore] = useState(null);
  const [toast, setToast] = useState(null);
  const [occupato, setOccupato] = useState(0);
  const [versione, setVersione] = useState(0);
  const [giro, setGiro] = useState(0); // nuova sessione esplicita
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
  const vai = useCallback((sezione) => { window.location.href = indirizzoPersonal(sezione); }, []);
  // SCAN-PDF: «Condividi → Scan» (Android) e «Apri con → Scan» (computer) aprono il PDF nel gestore.
  const ricevi = useCallback((p) => {
    if (p.files?.length > 1) setFilesRicevuti(p.files);
    else apri(p);
  }, [apri]);
  useIngressoPdf(ricevi, setErrore);
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
    aggiungi: () => { setPagine([]); setFilesRicevuti(null); setGiro((g) => g + 1); },
    apriChat: () => vai('poliedron'),
    pagato: () => vai('conti'),
  };
  const sopra = pagine.length > 0;

  return (
    <div className="pp-app pp-scan">
      <header className="pp-testata">
        <div className="pp-testata-titoli">
          <a className="pp-brand" href={indirizzoPersonal()} aria-label="Apri Poliedron Personal"><span className="pp-brand-moderno"><img src="/scan-192.png" alt="" width="24" height="24" /></span><span>Poliedron <small>SCAN</small></span></a>
          <h1>Scan</h1>
        </div>
      </header>
      {occupato > 0 && <div className="pp-barra-caricamento" aria-hidden="true" />}
      {errore && !sopra && <p className="pp-messaggio pp-messaggio-errore" role="alert">{errore}</p>}
      <main className="pp-contenuto pp-scan-contenuto">
        <div className="pp-scan-strumenti" role="group" aria-label="Strumenti">
          <span className="pp-scan-strumento attivo"><IconaScansiona size={20} /> Scansiona o allega</span>
          <button className="pp-scan-strumento" onClick={() => apri({ tipo: 'pdf' })}><IconaFile size={20} /> PDF e firma</button>
          <button className="pp-scan-strumento" onClick={() => vai('documenti')}><IconaFile size={20} /> Archivio</button>
        </div>
        <PaginaScansione key={giro} files={filesRicevuti} ctx={ctx} sostituisci={apri} opzioni={{ destinazione: true }} />
        {!installata && (puo || iphone) && (
          <div className="pp-scan-installa">
            {puo ? <button className="pp-bottone pp-bottone-chiaro pp-bottone-largo" onClick={installa}>Metti «Scan» sulla schermata Home</button>
              : <p className="pp-riga-meta">Per averla sulla Home: tocca Condividi ↑ e poi «Aggiungi alla schermata Home».</p>}
          </div>
        )}
      </main>
      {pagine.map((p, i) => (
        <Pagina key={p.chiave} titolo={titoloPagina(p)} visibile={i === pagine.length - 1} onIndietro={indietro} senzaChiudi={eModulo(p.tipo)}>
          {i === pagine.length - 1 && errore && <p className="pp-messaggio pp-messaggio-errore" role="alert">{errore}</p>}
          {pagina(p.tipo)?.render(p, { ctx, chiudi: indietro, sostituisci, email }) ?? null}
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
