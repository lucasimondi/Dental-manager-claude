// PERSONAL-ESPLORA-WIN11 fase 3 — barra delle applicazioni e Start stile Windows 11.
// Sostituisce il dock (DOCK-UGUALE) senza cambiare destinazioni né viste salvate. Icone centrate:
// Start · Oggi · Agenda · Esplora file · Assistente · Personale; a destra ora, data e numero delle
// notifiche (i promemoria «Da fare», gli stessi delle notifiche sul telefono) → apre Da fare.
// Start sale dal basso: ricerca reale dell'archivio, «Aggiunte» (sezioni con pallino), «Consigliati»
// (file recenti del telefono, poi ultimi documenti), account ed Esci. Si chiude con un tocco fuori,
// con Indietro (Android / browser), con Esc o toccando di nuovo il logo.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { archivioDb } from './lib/supabasePersonal.js';
import { documentiRecenti, documentiDaGestire, cercaDocumenti, scadenzeAperte } from './lib/archivio.js';
import { contaDaFare } from './lib/daFare.js';
import { elencoRecenti, fileRecente } from './lib/recenti.js';
import { scaricaDocumento } from './lib/condividi.js';
import {
  voceAttiva, vociAperte, badgeBarra, vociStart, numeroNotifiche, oraData, nomeUtente, consigliati, etichettaNumero, accettaFile, APP_PER_FILE,
  AGGIUNTE, normalizzaStart, spostaAggiunta, togliAggiunta, cambiaDock, nelDock, vociBarra, appTrovate, scadenzeImminenti,
} from './lib/barra.js';
import { caricaPreferiti } from './lib/esplora.js';
import { statoCentro, ascoltaCentro, aggiornaCentro, conteggiCentro, leggiPosticipate, notificheDa, nuoveDaAvvisare, leggiViste, salvaViste } from './lib/centroNotifiche.js';
import { CentroNotifiche, ToastNotifiche } from './CentroNotifiche.jsx';
import { PannelloTrasferimenti } from './PannelloTrasferimenti.jsx';
import { statoDrive, ascoltaStatoDrive, attesaDrive, testoStatoDrive } from './lib/statoDrive.js';
import { sectionDestination } from '../../shared/agenda/navigation.js';
import { IconaCartellaW11, IconaFileW11 } from './IconeW11.jsx';
import { titoloDoc } from './ui.jsx';
import { IconaDock } from './IconeDock.jsx';
import {
  IconaOggi, IconaChat, IconaPerTe, IconaCerca, IconaDocumenti, IconaEuro, IconaPratiche, IconaPortafoglio, IconaNote,
  IconaLucchetto, IconaFoto, IconaImpostazioni, IconaEsci, IconaCalendario, IconaScansiona,
} from './Icone.jsx';
import gemmaPoliedron from '../../src/assets/icon-poliedra-gem.png';
import './barra.css';

const ICONE_START = {
  oggi: IconaOggi, agenda: IconaCalendario, documenti: IconaDocumenti, dafare: IconaPerTe, conti: IconaEuro, legal: IconaPratiche,
  pratiche: IconaPratiche, personali: IconaPortafoglio, diario: IconaNote, note: IconaNote, password: IconaLucchetto, foto: IconaFoto,
  concordato: IconaPratiche, scan: IconaScansiona, studio: (p) => <IconaDock n="brief" s={p.size} />, impostazioni: IconaImpostazioni,
};
const Numero = ({ n, classe = '' }) => { const t = etichettaNumero(n); return t ? <span className={`pb-pallino ${classe}`} aria-hidden="true">{t}</span> : null; };

// Pallini della barra e di Start: stessi criteri di Esplora, Da fare e Documenti (nessun conteggio nuovo
// sul server). Calcolati dopo il primo disegno, così l'apertura dell'app non rallenta.
export function useConteggiBarra(versione) {
  // PR #337 §8: scadenze, documenti da gestire e notifiche dalla stessa fonte del Centro notifiche e delle
  // cartelle di Esplora (lib/centroNotifiche.js): un'azione in un punto aggiorna tutti i pallini.
  const st = useSyncExternalStore(ascoltaCentro, statoCentro);
  const [altri, setAltri] = useState({});
  useEffect(() => {
    let vivo = true;
    const carica = () => {
      aggiornaCentro(archivioDb).catch(() => {});
      Promise.all([
        contaDaFare(archivioDb).catch(() => ({ aperte: 0, urgenti: 0 })),
        documentiDaGestire(archivioDb).then((l) => l.length).catch(() => 0),
        // file che lo script deve ancora sistemare su Drive (note '>cartella:…'): stato di sincronizzazione
        archivioDb.from('documenti').select('id', { count: 'exact', head: true }).like('drive_cartella', '>cartella:%').then((r) => r.count || 0, () => 0),
      ]).then(([dafare, documenti, inAttesa]) => { if (vivo) { setAltri({ dafare: dafare.aperte, documenti }); attesaDrive(inAttesa); } });
    };
    const t = setTimeout(carica, 1200); // dopo il primo disegno: l'apertura dell'app non rallenta
    const ogni = setInterval(() => aggiornaCentro(archivioDb).catch(() => {}), 5 * 60 * 1000);
    return () => { vivo = false; clearTimeout(t); clearInterval(ogni); };
  }, [versione]);
  if (!st.pronto) return altri;
  const c = conteggiCentro(st, { posticipate: leggiPosticipate() });
  return { ...altri, esplora: c.esplora, urgenti: c.scadenze, notifiche: c.notifiche };
}

// PR #337: un file trascinato da Esplora su un'icona della barra si apre con quell'app
// (Assistente = chat sul documento, Agenda = nuovo impegno con il link; Esplora apre l'anteprima da sé).
export function useApriCon(apri, apriChat) {
  useEffect(() => {
    const apriCon = (e) => {
      const { app, documento, link } = e.detail || {};
      if (!documento) return;
      if (app === 'poliedron') apriChat(documento);
      else if (app === 'agenda') apri({ tipo: 'evento', evento: { titolo: documento.titolo || 'Documento', note: link ? `Documento: ${link}` : '' } });
    };
    window.addEventListener('poliedra:apri-con', apriCon);
    return () => window.removeEventListener('poliedra:apri-con', apriCon);
  }, [apri, apriChat]);
}

function IconaVoce({ id }) {
  if (id === 'start') return <img className="pb-logo" src={gemmaPoliedron} alt="" draggable={false} />;
  if (id === 'drive-ok') return <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M6 15.5h8.5a3.2 3.2 0 0 0 .4-6.4A4.8 4.8 0 0 0 5.6 8 3.8 3.8 0 0 0 6 15.5Z" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="m8 11.5 1.6 1.6L12.5 10" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (id === 'drive-sync') return <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" className="pb-gira"><path d="M15 8.5A5.2 5.2 0 0 0 5.3 7M5 11.5a5.2 5.2 0 0 0 9.7 1.5M5.3 4.5V7H8M14.7 15.5V13H12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (id === 'drive-errore') return <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M6 15.5h8.5a3.2 3.2 0 0 0 .4-6.4A4.8 4.8 0 0 0 5.6 8 3.8 3.8 0 0 0 6 15.5Z" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M10 9v2.6M10 13.3v.1" stroke="#C42B1C" strokeWidth="1.6" strokeLinecap="round" /></svg>;
  if (id === 'cerca') return <IconaCerca size={24} />;
  if (id === 'campanella') return <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M10 3a4.5 4.5 0 0 0-4.5 4.5v3L4 13.5h12l-1.5-3v-3A4.5 4.5 0 0 0 10 3ZM8.2 15.5a1.9 1.9 0 0 0 3.6 0" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" /></svg>;
  if (id === 'oggi') return <IconaOggi size={24} />;
  if (id === 'agenda') return <IconaDock n="cal" s={24} />;
  if (id === 'esplora') return <IconaCartellaW11 size={24} />;
  if (id === 'poliedron') return <IconaChat size={24} />;
  if (id === 'altro') return <IconaPerTe size={24} />;
  const Icona = ICONE_START[id];
  return Icona ? <Icona size={24} /> : <IconaPerTe size={24} />;
}

export function BarraApplicazioni({ vista, pagine, conteggi = {}, email, vai, apri, onEsci, onCentro, centroAperto = false }) {
  const [start, setStart] = useState(false); // false | 'start' | 'cerca'
  const [impStart, setImpStart] = useState(() => normalizzaStart());
  useEffect(() => {
    let vivo = true;
    archivioDb.from('impostazioni_app').select('valore').eq('chiave', 'start_personal').maybeSingle()
      .then(({ data }) => { if (vivo && data?.valore) setImpStart(normalizzaStart(data.valore)); }, () => {});
    return () => { vivo = false; };
  }, []);
  const salvaStart = useCallback((nuove) => {
    const prima = impStart;
    setImpStart(nuove);
    archivioDb.from('impostazioni_app').upsert({ chiave: 'start_personal', valore: nuove, aggiornato_il: new Date().toISOString() }, { onConflict: 'chiave' })
      .then(({ error }) => { if (error) setImpStart(prima); }, () => setImpStart(prima));
  }, [impStart]);
  const voci = vociBarra(impStart.dock);
  const [centro, setCentro] = useState(false);
  const mobile = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 768);
  // Toast per gli eventi nuovi dall'ultima volta (la prima volta nessuno).
  const st = useSyncExternalStore(ascoltaCentro, statoCentro);
  const [toast, setToast] = useState([]);
  useEffect(() => {
    if (!st.pronto) return;
    const tutte = notificheDa(st, { posticipate: leggiPosticipate() });
    const nuove = nuoveDaAvvisare(tutte, leggiViste());
    salvaViste(tutte.map((n) => n.chiave));
    if (nuove.length) setToast((t) => [...nuove.slice(0, 3), ...t].slice(0, 3));
  }, [st.caricato]); // eslint-disable-line react-hooks/exhaustive-deps
  const [adesso, setAdesso] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setAdesso(new Date()), 20000); return () => clearInterval(t); }, []);
  const attiva = voceAttiva({ vista, pagine, start, dock: impStart.dock });
  const aperte = vociAperte({ vista, pagine, start, dock: impStart.dock });
  const drive = useSyncExternalStore(ascoltaStatoDrive, statoDrive);
  const { ora, data } = oraData(adesso);
  const notifiche = numeroNotifiche(conteggi);

  // Indietro chiude Start: una voce nella cronologia finché Start è aperto.
  const chiudi = useCallback(() => {
    setStart(false);
    if (window.history.state?.pbStart) window.history.back();
  }, []);
  const apriStart = (modo = 'start') => {
    if (!window.history.state?.pbStart) window.history.pushState({ ...(window.history.state || {}), pbStart: true }, '');
    setStart(modo);
  };
  // Tasto Win (premuto e lasciato da solo) o Ctrl+Esc: apre e chiude Start.
  useEffect(() => {
    let soloWin = false;
    const giu = (e) => {
      if (e.key === 'Meta' || e.key === 'OS') { soloWin = true; return; }
      soloWin = false;
      if (e.ctrlKey && e.key === 'Escape') { e.preventDefault(); if (start) chiudi(); else apriStart('start'); }
    };
    const su = (e) => { if ((e.key === 'Meta' || e.key === 'OS') && soloWin) { soloWin = false; if (start) chiudi(); else apriStart('start'); } };
    window.addEventListener('keydown', giu); window.addEventListener('keyup', su);
    return () => { window.removeEventListener('keydown', giu); window.removeEventListener('keyup', su); };
  });
  useEffect(() => {
    if (!start) return undefined;
    const indietro = () => setStart(false);
    const tasto = (e) => { if (e.key === 'Escape') chiudi(); };
    window.addEventListener('popstate', indietro);
    window.addEventListener('keydown', tasto);
    return () => { window.removeEventListener('popstate', indietro); window.removeEventListener('keydown', tasto); };
  }, [start, chiudi]);

  const tocca = (v) => {
    setCentro(false);
    if (v.id === 'start' || v.id === 'cerca') { if (start === v.id) chiudi(); else apriStart(v.id); return; }
    if (start) chiudi();
    if (v.azione) { esegui(v.azione); return; }
    if (v.pagina) apri({ tipo: v.pagina }); else vai(v.vista);
  };
  const apriCentro = () => { if (start) chiudi(); if (onCentro) onCentro(); else setCentro((c) => !c); };
  const esegui = (azione) => {
    chiudi();
    if (azione.vai) vai(azione.vai);
    else if (azione.apri) apri(azione.apri);
    else if (azione.href) window.location.assign(sectionDestination(azione.href, azione.href));
  };

  return (
    <>
      <PannelloTrasferimenti />
      {centro && <CentroNotifiche mobile={mobile} apri={apri} onChiudi={() => setCentro(false)} />}
      <ToastNotifiche toast={toast} onChiudi={(k) => setToast((t) => t.filter((x) => x.chiave !== k))}
        onApri={(n) => (n.documento_id ? apri({ tipo: 'documento', id: n.documento_id }) : n.pratica ? apri({ tipo: 'pratica', p: n.pratica }) : null)} />
      {start && <Start modo={start} conteggi={conteggi} email={email} onAzione={esegui} onChiudi={chiudi} apri={apri} onEsci={onEsci} imp={impStart} onImp={salvaStart} />}
      <nav className="pb-barra" aria-label="Barra delle applicazioni">
        <span className="pb-lato" aria-hidden="true" />
        <div className="pb-icone">
          {voci.map((v) => {
            const n = badgeBarra(v.id, conteggi);
            const etichetta = n ? `${v.nome}, ${n} ${v.id === 'oggi' ? 'urgenti' : 'da gestire'}` : v.nome;
            return (
              <button key={v.id} type="button" className={`pb-voce${attiva === v.id ? ' attiva' : ''}${aperte.has(v.id) ? ' aperta' : ''}`} onClick={() => tocca(v)}
                aria-label={etichetta} title={accettaFile(v.id) ? `${v.nome} · trascina qui un file: ${APP_PER_FILE[v.id].toLowerCase()}` : v.nome}
                aria-current={attiva === v.id && v.id !== 'start' && v.id !== 'cerca' ? 'page' : undefined}
                aria-expanded={v.id === 'start' || v.id === 'cerca' ? start === v.id : undefined}
                data-bersaglio={accettaFile(v.id) ? `app:${v.id}` : undefined}>
                <IconaVoce id={v.id} />
                <Numero n={n} />
              </button>
            );
          })}
        </div>
        <div className="pb-sistema">
          <span className={`pb-drive pb-drive-${drive.stato}`} role="status" title={testoStatoDrive(drive)} aria-label={testoStatoDrive(drive)}>
            <IconaVoce id={`drive-${drive.stato === 'ok' ? 'ok' : drive.stato === 'errore' ? 'errore' : 'sync'}`} />
          </span>
          {/* Clic su ora e data (o sulla campanella su mobile) → Centro notifiche. */}
          <button type="button" className={`pb-area${centroAperto || centro ? ' attiva' : ''}`} onClick={apriCentro} aria-expanded={centroAperto || centro} aria-haspopup="dialog"
            aria-label={`${ora}, ${data}. ${notifiche ? `${notifiche} notifiche` : 'Nessuna notifica'}: apri il Centro notifiche`}>
            <span className="pb-ora"><span>{ora}</span><span className="pb-data">{data}</span></span>
            <span className="pb-campanella"><IconaVoce id="campanella" /><Numero n={notifiche} /></span>
            {notifiche > 0 && <span className="pb-notifiche">{etichettaNumero(notifiche)}</span>}
          </button>
        </div>
      </nav>
    </>
  );
}

function Start({ modo = 'start', conteggi, email, onAzione, onChiudi, apri, onEsci, imp, onImp }) {
  const [testo, setTesto] = useState('');
  const [suggeriti, setSuggeriti] = useState(null);
  const [trovati, setTrovati] = useState(null); // documenti trovati mentre si scrive
  const [cartelle, setCartelle] = useState([]); // cartelle di Accesso rapido (Esplora)
  const [menuApp, setMenuApp] = useState(null); // { voce, i, x, y }
  const [presa, setPresa] = useState(null); // riordino: { da, a }
  const [conferma, setConferma] = useState(false);
  const campo = useRef(null);
  const griglia = useRef(null);
  const tocco = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  useEffect(() => {
    let vivo = true;
    Promise.all([elencoRecenti().catch(() => []), documentiRecenti(archivioDb, 6).catch(() => []), scadenzeAperte(archivioDb, 14).catch(() => []), caricaPreferiti(archivioDb).catch(() => [])])
      .then(([r, d, sc, pref]) => {
        if (!vivo) return;
        setSuggeriti([...scadenzeImminenti(sc).slice(0, 4), ...consigliati(r, d, 6)].slice(0, 8));
        setCartelle(pref.filter((p) => p.tipo === 'cartella'));
      });
    return () => { vivo = false; };
  }, []);
  // Scrivere appena Start è aperto = cercare (anche senza toccare il campo).
  useEffect(() => {
    const k = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1 || document.activeElement === campo.current) return;
      if (e.target.closest?.('input, textarea, select')) return;
      e.preventDefault(); campo.current?.focus(); setTesto((t) => t + e.key);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  useEffect(() => {
    const q = testo.trim();
    if (q.length < 2) { setTrovati(null); return undefined; }
    let vivo = true;
    const t = setTimeout(() => { cercaDocumenti(archivioDb, q, null, 8).then((l) => vivo && setTrovati((l || []).filter((d) => d.fascicolo !== 'clinico_pazienti'))).catch(() => vivo && setTrovati([])); }, 300);
    return () => { vivo = false; clearTimeout(t); };
  }, [testo]);
  const cerca = (e) => {
    e.preventDefault();
    onChiudi();
    apri({ tipo: 'ricerca', titolo: 'Cerca nel tuo archivio', testo: testo.trim() });
  };
  const apriSuggerito = async (s) => {
    onChiudi();
    if (s.tipo === 'documento') { apri({ tipo: 'documento', id: s.id }); return; }
    if (s.tipo === 'scadenza') { if (s.documento_id) apri({ tipo: 'documento', id: s.documento_id }); else onAzione({ vai: 'dafare' }); return; }
    try {
      const file = await fileRecente(s.id);
      if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) apri({ tipo: 'pdf', file }); else scaricaDocumento(file);
    } catch { /* il file non c'è più sul telefono */ }
  };
  const tipo = (s) => (/pdf/i.test(s.mime || '') || /\.pdf$/i.test(s.nome) ? 'pdf' : /^image\//.test(s.mime || '') ? 'immagine' : /word|sheet|excel|presentation/i.test(s.mime || '') ? 'office' : 'altro');
  // «Aggiunte»: app e cartelle fissate, con i pallini e nell'ordine scelto da Luca.
  const n = Object.fromEntries(vociStart(conteggi).map((v) => [v.id, v.n]));
  const fissateCartelle = cartelle.filter((c) => !imp.aggiunte.some((x) => x.tipo === 'cartella' && x.id === c.id));
  const aggiunte = [...imp.aggiunte, ...fissateCartelle.map((c) => ({ tipo: 'cartella', id: c.id }))];
  const voceDi = (x) => (x.tipo === 'app' ? { ...AGGIUNTE.find((a) => a.id === x.id), n: n[x.id] || 0 } : { id: x.id, nome: x.nome || (x.id === 'radice' ? 'Personale' : 'Cartella'), azione: { apri: { tipo: 'esplora', nodo: x.id } }, cartella: true });
  const nomiCartelle = useNomiCartelle(aggiunte.filter((x) => x.tipo === 'cartella').map((x) => x.id));
  const apriVoce = (v) => onAzione(v.azione);
  // Riordino col mouse: trascina un'icona sopra un'altra posizione.
  const premiApp = (e, i) => {
    if (e.button !== 0 || e.pointerType === 'touch') return;
    const x0 = e.clientX; const y0 = e.clientY; let mosso = false;
    const posizioni = () => [...griglia.current.querySelectorAll('[data-i]')].map((el) => ({ i: Number(el.dataset.i), r: el.getBoundingClientRect() }));
    const muovi = (ev) => {
      if (!mosso && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
      mosso = true;
      const sopra = posizioni().find((p) => ev.clientX >= p.r.left && ev.clientX <= p.r.right && ev.clientY >= p.r.top && ev.clientY <= p.r.bottom);
      setPresa({ da: i, a: sopra ? sopra.i : i });
    };
    const fine = () => {
      window.removeEventListener('pointermove', muovi); window.removeEventListener('pointerup', fine);
      setPresa((p) => { if (p && p.a !== p.da) onImp({ ...imp, aggiunte: spostaAggiunta(aggiunte, p.da, p.a) }); return null; });
      if (mosso) { const blocca = (ev) => { ev.stopPropagation(); ev.preventDefault(); window.removeEventListener('click', blocca, true); }; window.addEventListener('click', blocca, true); setTimeout(() => window.removeEventListener('click', blocca, true), 50); }
    };
    window.addEventListener('pointermove', muovi); window.addEventListener('pointerup', fine);
  };
  const lungo = useRef(null);
  // Start ha un transform: il menu si posiziona rispetto al pannello.
  const menuSu = (e, x, i) => { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); const p = e.currentTarget.closest('.pb-start').getBoundingClientRect(); setMenuApp({ voce: x, i, x: r.left - p.left + r.width / 2, y: r.top - p.top }); };
  const ordine = presa ? spostaAggiunta(aggiunte, presa.da, presa.a) : aggiunte;
  const appQui = appTrovate(testo);
  return (
    <div className="pb-velo" onClick={onChiudi}>
      <section className="pb-start" role="dialog" aria-label="Start" onClick={(e) => { e.stopPropagation(); if (menuApp) setMenuApp(null); }}>
        <form className="pb-cerca" onSubmit={cerca} role="search">
          <IconaCerca size={18} />
          <input ref={campo} autoFocus={modo === 'cerca' || !tocco} value={testo} onChange={(e) => setTesto(e.target.value)} placeholder="Cerca app, impostazioni e documenti" aria-label="Cerca nel tuo archivio" enterKeyHint="search"
            onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); if (testo) setTesto(''); else onChiudi(); } }} />
        </form>
        <div className="pb-start-corpo">
          {trovati !== null || appQui.length ? (
            <>
              <h2>Migliori risultati</h2>
              <div className="pb-consigliati pb-risultati">
                {appQui.map((a) => (
                  <button key={`a:${a.id}`} type="button" className="pb-consigliato" onClick={() => apriVoce(a)}>
                    <span className="pb-app-icona pb-icona-piccola">{(() => { const I = ICONE_START[a.id]; return a.id === 'esplora' ? <IconaCartellaW11 size={26} /> : I ? <I size={22} /> : null; })()}</span>
                    <span><strong>{a.nome}</strong><small>App</small></span>
                  </button>
                ))}
                {trovati === null && testo.trim().length >= 2 && <p className="pb-nota">Cerco…</p>}
                {trovati?.map((d) => (
                  <button key={d.id} type="button" className="pb-consigliato" onClick={() => { onChiudi(); apri({ tipo: 'documento', id: d.id }); }}>
                    <IconaFileW11 tipo={tipo({ mime: d.mime_type, nome: d.nome_file_originale || '' })} size={30} />
                    <span><strong>{titoloDoc(d)}</strong><small>{[d.ente, d.data_documento ? new Date(`${d.data_documento}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : null].filter(Boolean).join(' · ') || 'Documento'}</small></span>
                  </button>
                ))}
                {trovati?.length === 0 && !appQui.length && <p className="pb-nota">Nessun risultato per «{testo.trim()}».</p>}
              </div>
              <button type="button" className="pb-tutti" onClick={cerca}>Cerca «{testo.trim()}» in tutto l’archivio ›</button>
            </>
          ) : (
            <>
              <h2>Aggiunte</h2>
              <div className="pb-aggiunte" ref={griglia} role="list" aria-label="App e cartelle aggiunte (trascina per riordinare)">
                {ordine.map((x, i) => {
                  const v = voceDi(x);
                  if (!v?.nome) return null;
                  const Icona = ICONE_START[v.id];
                  const nome = x.tipo === 'cartella' ? (nomiCartelle[x.id] || v.nome) : v.nome;
                  return (
                    <button key={`${x.tipo}:${x.id}`} type="button" role="listitem" data-i={i} className={`pb-app${presa && presa.a === i ? ' presa' : ''}`}
                      onClick={() => apriVoce(v)} onPointerDown={(e) => premiApp(e, aggiunte.findIndex((y) => y.tipo === x.tipo && y.id === x.id))}
                      onContextMenu={(e) => menuSu(e, x, i)}
                      onTouchStart={(e) => { const t = e.currentTarget; clearTimeout(lungo.current); lungo.current = setTimeout(() => { navigator.vibrate?.(10); menuSu({ preventDefault() {}, currentTarget: t }, x, i); }, 500); }}
                      onTouchMove={() => clearTimeout(lungo.current)} onTouchEnd={() => clearTimeout(lungo.current)}
                      aria-label={v.n ? `${nome}, ${v.n}` : nome}>
                      <span className="pb-app-icona">{v.cartella || v.id === 'esplora' ? <IconaCartellaW11 size={32} /> : Icona ? <Icona size={26} /> : null}<Numero n={v.n} /></span>
                      <span className="pb-app-nome">{nome}</span>
                      {nelDock(imp.dock, x.id) && x.tipo === 'app' && <span className="pb-app-dock" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
              <h2>Consigliati</h2>
              <div className="pb-consigliati">
                {suggeriti === null && <p className="pb-nota">Carico…</p>}
                {suggeriti?.length === 0 && <p className="pb-nota">Niente di recente.</p>}
                {suggeriti?.map((s) => (
                  <button key={s.chiave} type="button" className={`pb-consigliato${s.tipo === 'scadenza' ? ' pb-scadenza' : ''}${s.scaduta ? ' scaduta' : ''}`} onClick={() => apriSuggerito(s)}>
                    {s.tipo === 'scadenza' ? <span className="pb-calendario" aria-hidden="true"><small>{new Date(s.quando).toLocaleDateString('it-IT', { month: 'short' })}</small><b>{new Date(s.quando).getUTCDate()}</b></span> : <IconaFileW11 tipo={tipo(s)} size={30} />}
                    <span><strong>{s.nome}</strong><small>{s.tipo === 'scadenza' ? `${s.scaduta ? 'Scaduta' : 'Scadenza'}${s.importo ? ` · ${Number(s.importo).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}` : ''}` : s.tipo === 'recente' ? 'Su questo telefono' : 'Nell’archivio'}{s.tipo !== 'scadenza' && s.quando ? ` · ${new Date(s.quando).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}` : ''}</small></span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <footer className="pb-start-piede">
          <span className="pb-utente"><span className="pb-avatar" aria-hidden="true">{nomeUtente(email).charAt(0)}</span>{nomeUtente(email)}</span>
          <span className="pb-piede-azioni">
            <button type="button" className={`pb-esci${conferma ? ' conferma' : ''}`} onClick={() => (conferma ? onEsci() : setConferma(true))} aria-label={conferma ? 'Tocca di nuovo per uscire' : 'Esci'} title="Esci">
              <IconaEsci size={18} />{conferma && <span>Tocca di nuovo per uscire</span>}
            </button>
            <button type="button" className="pb-esci" onClick={() => { onChiudi(); apri({ tipo: 'impostazioni' }); }} aria-label="Impostazioni" title="Impostazioni"><IconaImpostazioni size={20} /></button>
          </span>
        </footer>
        {menuApp && (
          <div className="pb-menu-app" role="menu" aria-label={voceDi(menuApp.voce)?.nome} style={{ left: menuApp.x, top: menuApp.y }} onClick={(e) => e.stopPropagation()}>
            {menuApp.voce.tipo === 'app' && (
              <button type="button" role="menuitem" onClick={() => { onImp({ ...imp, dock: cambiaDock(imp.dock, menuApp.voce.id) }); setMenuApp(null); }}>
                {nelDock(imp.dock, menuApp.voce.id) ? 'Togli dal dock' : 'Aggiungi al dock'}
              </button>
            )}
            <button type="button" role="menuitem" disabled={menuApp.i === 0} onClick={() => { onImp({ ...imp, aggiunte: spostaAggiunta(aggiunte, menuApp.i, menuApp.i - 1) }); setMenuApp(null); }}>Sposta prima</button>
            <button type="button" role="menuitem" disabled={menuApp.i >= aggiunte.length - 1} onClick={() => { onImp({ ...imp, aggiunte: spostaAggiunta(aggiunte, menuApp.i, menuApp.i + 1) }); setMenuApp(null); }}>Sposta dopo</button>
            <button type="button" role="menuitem" onClick={() => { onImp({ ...imp, aggiunte: togliAggiunta(aggiunte, menuApp.voce) }); setMenuApp(null); }}>Rimuovi da Start</button>
          </div>
        )}
      </section>
    </div>
  );
}

// Nomi delle cartelle fissate (lette una volta da Esplora).
function useNomiCartelle(ids) {
  const [nomi, setNomi] = useState({});
  const chiave = ids.join(',');
  useEffect(() => {
    const veri = ids.filter((id) => id !== 'radice');
    if (!veri.length) return undefined;
    let vivo = true;
    archivioDb.from('cartelle_mie').select('id, nome').in('id', veri).then(({ data }) => { if (vivo && data) setNomi(Object.fromEntries(data.map((c) => [c.id, c.nome]))); }, () => {});
    return () => { vivo = false; };
  }, [chiave]); // eslint-disable-line react-hooks/exhaustive-deps
  return { radice: 'Personale', ...nomi };
}
