// PERSONAL-ESPLORA-WIN11 — Esplora file stile Windows 11 (spec: docs/architecture/personal-esplora-win11.md).
// Fase 1: albero + contenuto (orizzontale: albero a sinistra; verticale: albero in alto con divisorio).
// Fase 2: ogni spostamento sposta anche il file su Drive nella cartella gemella.
// PR #337 (PO 2026-11-21): viste Icone grandi / medie / Elenco / Dettagli (salvate per cartella), apertura
// diretta (doppio clic su desktop, tocco su mobile) con anteprima in finestra, menu contestuale Win11
// (tasto destro / pressione prolungata 500 ms, foglio dal basso su mobile), selezione multipla
// (Ctrl/Maiusc su desktop, caselle su mobile), tastiera (F2, Canc, Ctrl+X/C/V/Z/A/D, Invio, Alt+Invio, F5).
// Regola: ogni azione passa PRIMA da Drive e l'interfaccia cambia solo a successo (lib/esplora.js
// eseguiCompleto); se non riesce, avviso con «Riprova». «Annulla» per 5 s (e Ctrl+Z) dopo spostamenti ed eliminazioni.
// Copia / Duplica (decisione del PO): il documento compare anche nell'altra cartella, nessun file nuovo su Drive.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { aggiornaDocumento, cestinaSuDrive, eliminaDocumenti, cercaDocumenti, scadenzeDelDocumento, caricaDocumento } from '../../lib/archivio.js';
import { eliminaConDrive } from '../../lib/eliminazioneSwipe.js';
import {
  caricaCartelleMie, creaCartella, rinominaCartella, spostaCartelle, archiviaCartelle,
  aggiungiDocumenti, togliDocumenti, aggiungiAScrivania, togliDaScrivania, spostaDocumenti,
} from '../../lib/cartelleMie.js';
import {
  RADICE, DA_CATALOGARE, CATEGORIE, ACCESSO_RAPIDO, CLINICO, nodoCategoria, codiceCategoria, eVirtuale, disposizione, colonneGriglia, altezzaAlbero,
  sottocartelle, padreDi, nomeNodo, percorsoNodo, antenati, categorieVisibili, documentiNelNodo, catalogati, calcolaPallini,
  etichettaPallino, testoStato, destinazioneValida, vociSpostaIn, operazioneSposta, operazioneAggiungi, inversa, applica,
  taglia, copia, incolla, nomeNuovaCartella, menuContestuale, tipoFile, caricaPosizioni, caricaDaGestire, contaDaCatalogare,
  paginaDaCatalogare, paginaCategoria, eseguiCompleto, documentiCartellaEsplora, documentiPerId,
  VISTE_ESPLORA, leggiViste, salvaVista, vistaDi, vistaConRotella, COLONNE_DETTAGLI, cambiaColonna, GRUPPI, raggruppa, leggiCartelle, salvaCartella, impostazioniDi, conMiniatura, righeDettagli, ordinaRighe, ordinaSuColonna, dimensioneLeggibile, dataLeggibile, tipoLeggibile,
  comeAprire, linkDrive, linkDocs, linkEmail, linkWhatsApp, ambienteApertura, seleziona, caricaPreferiti, salvaPreferiti, cambiaPreferito,
  HOME, PREFERITI, RECENTI, CESTINO, nodoCerca, datiCerca, FUORI,
  creaFileDrive, duplicaFileDrive, ripristinaFileDrive, segnaCestino, conCestino, nelCestino, documentiNelCestino, eZip,
} from '../../lib/esplora.js';
import { eseguiInCoda } from '../../lib/trasferimenti.js';
import { SceltaAppPredefinite } from '../../AppPredefinite.jsx';
import {
  nuovaScheda as creaScheda, nodoScheda, vaiInScheda, sostituisciInScheda, indietroScheda, avantiScheda, puoIndietro, puoAvanti, chiudiScheda, spostaScheda,
  nodoDaTesto, documentiNelSottoalbero, cartelleNelSottoalbero, filtraRisultati, cartelleTrovate, nelNome, evidenzia,
  leggiRecenti, ricordaRecente, leggiPannello, salvaPannello, larghezzaPannello, swipeApre, testoSelezione, nodoValido,
  SOGLIA_VIRTUALE, finestraVirtuale, indiceConTasto,
} from '../../lib/esploraNav.js';
import { TitoloSchede, BarraIndirizzi, CampoCerca, FiltriRicerca, BarraComandi, BarraStato, Riquadro } from './EsploraBarre.jsx';
import { inizioDrive, fineDrive } from '../../lib/statoDrive.js';
import { accettaFile, APP_PER_FILE } from '../../lib/barra.js';
import { aggiornaCentro, daGestireDa, statoCentro, ascoltaCentro } from '../../lib/centroNotifiche.js';
import { preparaFile, comeFile, condividi, scaricaDocumento } from '../../lib/condividi.js';
import { preparaVoci, scaricaFile, creaZip, MAX_FILE_ZIP } from '../../lib/pacchetto.js';
import { titoloDoc, tokenSessione } from '../../ui.jsx';
import { consegnaDocumenti } from '../../lib/portale.js';
import { useTrascina } from './Trascina.jsx';
import { miniatura } from '../../lib/miniature.js';
import { comeAprireCon, caricaAppPredefinite, estensioneDi } from '../../lib/apertura.js';
import { FoglioInvia } from './CartelleMie.jsx';
import { MenuContestuale, FinestraAnteprima, DialogoProprieta, DialogoAccesso, FoglioSpostaIn, Avviso, IcoMenu, Finestra } from './EsploraFinestre.jsx';
import { IconaCartellaW11, IconaFileW11 } from '../../IconeW11.jsx';
import './esplora.css';

export { IconaCartellaW11, IconaFileW11 };
const API = { spostaCartelle, spostaDocumenti, aggiungiDocumenti, togliDocumenti, aggiungiAScrivania, togliDaScrivania, archiviaCartelle, rinominaCartella, aggiornaDocumento };
const DURATA_ANNULLA = 5000;
const PRESSIONE_MS = 500;
const chiaveDi = (cosa, id) => `${cosa === 'cartella' ? 'cartella' : 'doc'}:${id}`;
const tocco = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

const Pallino = ({ n, piccolo = false }) => {
  const t = etichettaPallino(n);
  return t ? <span className={`esp-pallino${piccolo ? ' piccolo' : ''}`} aria-label={`${n} da gestire`}>{t}</span> : null;
};
const Freccia = ({ aperta }) => <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" style={{ transform: aperta ? 'rotate(90deg)' : 'none' }}><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const IcoLinea = ({ d }) => <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d={d} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const IcoStella = () => <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="m8 2.5 1.7 3.5 3.8.5-2.8 2.6.7 3.8L8 11.1l-3.4 1.8.7-3.8L2.5 6.5l3.8-.5z" fill="#F7B500" /></svg>;

// Miniatura reale (immagini e prima pagina dei PDF) dallo script, in cache nel telefono (IndexedDB).
function Miniatura({ doc, size }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let vivo = true;
    miniatura(doc.drive_file_id).then((u) => vivo && setSrc(u)).catch(() => {});
    return () => { vivo = false; };
  }, [doc.drive_file_id]);
  if (!src) return <IconaFileW11 tipo={tipoFile(doc)} size={Math.round(size * 0.93)} />;
  return <img className="esp-miniatura" src={src} alt="" width={size} height={size} loading="lazy" draggable={false} />;
}

/* ---------- Esplora ---------- */
// PERSONAL-FINESTRE: documenti consegnati a un'altra finestra (trascinati lì, o scelti con «Aggiungi»).
const consegnaA = consegnaDocumenti;
// scegliPer: chiave della finestra che ha chiesto i documenti (es. lo Scan): compare la barra «Aggiungi».
export function PaginaEsplora({ ctx, iniziale = RADICE, scegliPer = null, perNome = 'Scan', chiudi = null }) {
  const { apri, fascicoli = [] } = ctx;
  const [dati, setDati] = useState(null); // { cartelle, posizioni, titoli }
  const [daGestire, setDaGestire] = useState(new Map());
  const [nDaCatalogare, setNDaCatalogare] = useState(0);
  // PR #337 §2: schede, ognuna con la sua cronologia (Indietro / Avanti).
  const [tabs, setTabs] = useState(() => { const t = creaScheda(iniziale); return { schede: [t], attiva: t.id }; });
  const scheda = tabs.schede.find((t) => t.id === tabs.attiva) || tabs.schede[0];
  const nodo = nodoScheda(scheda);
  const cambiaScheda = (f) => setTabs((t) => ({ ...t, schede: t.schede.map((x) => (x.id === t.attiva ? f(x) : x)) }));
  const setNodo = (n) => cambiaScheda((x) => sostituisciInScheda(x, n));
  const [aperti, setAperti] = useState(() => new Set([RADICE, ACCESSO_RAPIDO])); // come in Windows: Accesso rapido aperto
  const [pannello, setPannello] = useState(() => leggiPannello());
  const [cassetto, setCassetto] = useState(false); // pannello di navigazione su mobile
  const [riquadro, setRiquadro] = useState(null); // null | 'anteprima' | 'dettagli'
  const [scadenzeSel, setScadenzeSel] = useState(null);
  const [recenti, setRecenti] = useState(() => leggiRecenti());
  const [appPredefinite, setAppPredefinite] = useState({});
  const [cestino, setCestino] = useState({ cartelle: [], docs: [] });
  const inputCarica = useRef(null);
  const [testoCerca, setTestoCerca] = useState('');
  const [filtri, setFiltri] = useState({ tipo: '', data: '', categoria: '' });
  const campoCerca = useRef(null);
  const visitate = useRef(new Map()); // cartella → { t, giro } (cache delle cartelle visitate)
  const timerCerca = useRef(null);
  const [cache, setCache] = useState(() => new Map()); // id documento → documento
  // PERSONAL-FINESTRE: dentro una finestra i fogli `fixed` sono relativi al corpo della finestra.
  const radiceRef = useRef(null);
  const origine = () => { const r = radiceRef.current?.closest?.('.pf-corpo')?.getBoundingClientRect(); return r ? { x: r.left, y: r.top, l: r.width, a: r.height } : { x: 0, y: 0 }; };
  const [lista, setLista] = useState(null); // cartelle virtuali: { nodo, documenti, prossimo, finito }
  const [caricando, setCaricando] = useState(false);
  const [menu, setMenu] = useState(null); // { cosa, sorgenti, x, y, titolo }
  const [foglio, setFoglio] = useState(null); // sposta | duplica | elimina | proprieta | accesso | zip
  const [avviso, setAvviso] = useState(null); // { testo, tipo, azione }
  const [appunti, setAppunti] = useState(null);
  const [nuova, setNuova] = useState(null); // { padre, nome }
  const [rinomina, setRinomina] = useState(null); // { cosa, id, nome }
  const [nascosti, setNascosti] = useState(() => new Set()); // documenti in eliminazione (Annulla possibile)
  const [rinfresca, setRinfresca] = useState(0);
  const [schermo, setSchermo] = useState(() => ({ l: window.innerWidth, a: window.innerHeight }));
  const [altezza, setAltezza] = useState(300);
  const [viste, setViste] = useState(() => leggiViste());
  const [impCartelle, setImpCartelle] = useState(() => leggiCartelle()); // ordinamento e gruppi per cartella
  const [larghezze, setLarghezze] = useState(() => Object.fromEntries(COLONNE_DETTAGLI.map(([k, , w]) => [k, w])));
  const [scelti, setScelti] = useState(() => new Set());
  const [ancora, setAncora] = useState(null);
  const [modoSelezione, setModoSelezione] = useState(false);
  const [preferiti, setPreferiti] = useState([]);
  const [finestra, setFinestra] = useState(null); // { doc, tipo, stato }
  const [statoZip, setStatoZip] = useState(null);
  const [lavoro, setLavoro] = useState(0);
  const [rettangolo, setRettangolo] = useState(null); // selezione a rettangolo
  const [ctrlGiu, setCtrlGiu] = useState(false); // Ctrl durante il trascinamento = copia
  const [dropFile, setDropFile] = useState(null); // file trascinati dal computer: { dest }
  const alberoRef = useRef(null);
  const contenutoRef = useRef(null);
  const timerAvviso = useRef(null);
  const cambiato = useRef(false);
  const ultimoTocco = useRef(0);
  // PR #337 §9: pila di Annulla (Ctrl+Z annulla l'ultima azione, anche dopo che l'avviso è sparito; l'avviso
  // «Annulla» resta 5 s). Le eliminazioni definitive si annullano solo nei 5 s prima di partire.
  const pila = useRef([]);
  const registraAnnulla = (fn, { fino = null } = {}) => {
    const v = { fn, fino, usata: false };
    pila.current = [...pila.current.slice(-19), v];
    return () => { if (v.usata) return; v.usata = true; pila.current = pila.current.filter((x) => x !== v); fn(); };
  };
  const annullaUltimo = () => {
    while (pila.current.length) {
      const v = pila.current.pop();
      if (v.usata || (v.fino && Date.now() > v.fino)) continue;
      v.usata = true; v.fn(); return true;
    }
    return false;
  };

  const disp = disposizione(schermo.l, schermo.a);
  const mobile = tocco() || schermo.l < 600;
  const basso = schermo.a < 520; // telefono in orizzontale: barre compatte
  const colonne = colonneGriglia(disp);
  const cartelle = dati?.cartelle || [];
  const posizioni = dati?.posizioni || [];
  const opz = useMemo(() => ({ cartelle, posizioni }), [cartelle, posizioni]);
  const pallini = useMemo(() => calcolaPallini({ cartelle, posizioni, daGestire, nDaCatalogare, fascicoli }), [cartelle, posizioni, daGestire, nDaCatalogare, fascicoli]);
  const nomi = { cartelle, fascicoli };
  const vista = vistaDi(viste, nodo, mobile ? 'grandi' : 'grandi');
  const { ordine, gruppo, colonne: colonneVisibili } = impostazioniDi(impCartelle, nodo);
  const setOrdine = (f) => setImpCartelle(salvaCartella(nodo, { ordine: typeof f === 'function' ? f(ordine) : f }));
  const setGruppo = (g) => setImpCartelle(salvaCartella(nodo, { gruppo: g }));
  const setColonne = (c) => setImpCartelle(salvaCartella('*', { colonne: c }));

  useEffect(() => {
    const r = () => setSchermo({ l: window.innerWidth, a: window.innerHeight });
    window.addEventListener('resize', r);
    window.addEventListener('orientationchange', r);
    return () => { window.removeEventListener('resize', r); window.removeEventListener('orientationchange', r); };
  }, []);
  useEffect(() => () => { if (cambiato.current) ctx.aggiorna?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // PR #337 §8: i pallini delle cartelle seguono la stessa fonte del dock e del Centro notifiche.
  useEffect(() => ascoltaCentro(() => { const st = statoCentro(); if (st.pronto) setDaGestire(daGestireDa(st)); }), []);

  /* ---------- avvisi ---------- */
  const mostraAvviso = useCallback((testo, { tipo = 'ok', azione = null, durata } = {}) => {
    clearTimeout(timerAvviso.current);
    setAvviso({ testo, tipo, azione });
    timerAvviso.current = setTimeout(() => setAvviso(null), durata ?? (tipo === 'errore' ? 9000 : azione ? DURATA_ANNULLA : 2600));
  }, []);
  useEffect(() => () => clearTimeout(timerAvviso.current), []);
  const metti = (docs) => setCache((c) => { const n = new Map(c); for (const d of docs) n.set(d.id, d); return n; });

  /* ---------- caricamento ---------- */
  useEffect(() => {
    let vivo = true;
    setCaricando(true);
    (async () => {
      try {
        const [c, p, g] = await Promise.all([caricaCartelleMie(archivioDb, { ancheArchiviate: false }), caricaPosizioni(archivioDb), aggiornaCentro(archivioDb).then((st) => daGestireDa(st)).catch(() => new Map())]);
        if (!vivo) return;
        setDati({ cartelle: c, posizioni: p.posizioni, titoli: {} });
        setDaGestire(g);
        contaDaCatalogare(archivioDb, p.fascicoloDi).then((n) => vivo && setNDaCatalogare(n)).catch(() => {});
        caricaPreferiti(archivioDb).then((x) => vivo && setPreferiti(x)).catch(() => {});
        caricaAppPredefinite(archivioDb).then((x) => vivo && setAppPredefinite(x)).catch(() => {});
      } catch (e) {
        if (vivo) { setDati((d) => d || { cartelle: [], posizioni: [], titoli: {} }); mostraAvviso(`Non riesco a leggere le cartelle: ${e.message}`, { tipo: 'errore', azione: { nome: 'Riprova', fai: () => setRinfresca((n) => n + 1) } }); }
      } finally { if (vivo) setCaricando(false); }
    })();
    return () => { vivo = false; };
  }, [rinfresca, mostraAvviso]);

  useEffect(() => {
    if (!dati) return undefined;
    let vivo = true;
    setLista((l) => (l?.nodo === nodo ? l : null));
    (async () => {
      try {
        if (nodo === DA_CATALOGARE) {
          const r = await paginaDaCatalogare(archivioDb, { esclusi: catalogati(posizioni) });
          if (vivo) { metti(r.documenti); setLista({ nodo, documenti: r.documenti.map((d) => d.id), prossimo: r.prossimo, finito: r.finito }); }
        } else if (codiceCategoria(nodo)) {
          const r = await paginaCategoria(archivioDb, codiceCategoria(nodo));
          if (vivo) { metti(r.documenti); setLista({ nodo, documenti: r.documenti.map((d) => d.id), prossimo: r.prossimo, finito: r.finito }); }
        } else if (nodo === ACCESSO_RAPIDO || nodo === PREFERITI || nodo === RECENTI || nodo === HOME) {
          const ids = [...(nodo === RECENTI || nodo === HOME ? recenti.map((r) => r.id) : []), ...(nodo !== RECENTI ? preferiti.filter((p) => p.tipo === 'doc').map((p) => p.id) : [])];
          const docs = ids.length ? await documentiPerId(archivioDb, [...new Set(ids)]) : [];
          if (vivo) metti(docs);
        } else if (nodo === CESTINO) {
          const [tutte, docs] = await Promise.all([caricaCartelleMie(archivioDb, { ancheArchiviate: true }), documentiNelCestino(archivioDb).catch(() => [])]);
          if (vivo) { metti(docs); setCestino({ cartelle: tutte.filter((c) => c.archiviata_il), docs: docs.map((d) => d.id) }); }
        } else if (datiCerca(nodo)) {
          const { testo } = datiCerca(nodo);
          const trovati = (await cercaDocumenti(archivioDb, testo, null, 200)) || [];
          if (vivo) { metti(trovati); setLista({ nodo, documenti: trovati.map((d) => d.id), finito: true }); }
        } else if (nodo !== CATEGORIE) {
          // PR #337 §9: cache delle cartelle visitate (un minuto; Aggiorna / F5 rilegge sempre).
          const v = visitate.current.get(nodo);
          if (v && v.giro === rinfresca && Date.now() - v.t < 60000) return;
          const docs = await documentiCartellaEsplora(archivioDb, nodo);
          if (vivo) { metti(docs); visitate.current.set(nodo, { t: Date.now(), giro: rinfresca }); }
        }
      } catch (e) { if (vivo) mostraAvviso(`Non riesco ad aprire la cartella: ${e.message}`, { tipo: 'errore', azione: { nome: 'Riprova', fai: () => setRinfresca((n) => n + 1) } }); }
    })();
    return () => { vivo = false; };
  }, [nodo, !!dati, rinfresca, [ACCESSO_RAPIDO, PREFERITI, HOME].includes(nodo) ? preferiti : null, nodo === RECENTI || nodo === HOME ? recenti : null]); // eslint-disable-line react-hooks/exhaustive-deps

  const altri = async () => {
    if (!lista || lista.finito) return;
    const r = nodo === DA_CATALOGARE
      ? await paginaDaCatalogare(archivioDb, { esclusi: catalogati(posizioni), da: lista.prossimo })
      : await paginaCategoria(archivioDb, codiceCategoria(nodo), { da: lista.prossimo });
    metti(r.documenti);
    setLista((l) => ({ ...l, documenti: [...l.documenti, ...r.documenti.map((d) => d.id).filter((id) => !l.documenti.includes(id))], prossimo: r.prossimo, finito: r.finito }));
  };

  const pulisci = () => { setMenu(null); setNuova(null); setRinomina(null); setScelti(new Set()); setModoSelezione(false); setCassetto(false); };
  const vai = (n) => {
    pulisci();
    cambiaScheda((x) => vaiInScheda(x, n));
    if (!datiCerca(n)) setTestoCerca('');
    setAperti((a) => new Set([...a, ...antenati(n, nomi)]));
    contenutoRef.current?.scrollTo?.(0, 0);
  };
  useEffect(() => {
    if (!dati || nodoValido(nodo, cartelle)) return;
    setNodo(RADICE);
  }, [dati, cartelle, nodo]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- schede e cronologia ---------- */
  const vaiStoria = (f) => { pulisci(); cambiaScheda(f); };
  const apriScheda = (n = HOME) => { pulisci(); const t = creaScheda(n); setTabs((x) => ({ schede: [...x.schede, t], attiva: t.id })); };
  const scegliScheda = (id) => { if (id === tabs.attiva) return; pulisci(); setTabs((x) => ({ ...x, attiva: id })); };
  const chiudiLaScheda = (id) => { pulisci(); setTabs((x) => chiudiScheda(x.schede, x.attiva, id)); };
  useEffect(() => { const d = datiCerca(nodo); setTestoCerca(d ? d.testo : ''); }, [tabs.attiva]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- ricerca: nella cartella corrente e nelle sottocartelle, per nome e contenuto ---------- */
  const baseRicerca = datiCerca(nodo)?.base ?? (nodo === CATEGORIE || codiceCategoria(nodo) || nodo === CESTINO ? HOME : nodo);
  const cerca = (testo, { subito = true } = {}) => {
    clearTimeout(timerCerca.current);
    const t = String(testo || '').trim();
    const fai2 = () => {
      if (!t) { if (datiCerca(nodo)) vaiStoria((x) => sostituisciInScheda(x, baseRicerca)); return; }
      setFiltri({ tipo: '', data: '', categoria: '' });
      const n = nodoCerca(baseRicerca, t);
      if (datiCerca(nodo)) vaiStoria((x) => sostituisciInScheda(x, n)); else vai(n);
    };
    if (subito) fai2(); else timerCerca.current = setTimeout(fai2, 450);
  };
  useEffect(() => () => clearTimeout(timerCerca.current), []);

  /* ---------- operazioni: Drive prima, interfaccia solo a successo ---------- */
  const fai = useCallback(async (op, messaggio, { annullabile = true } = {}) => {
    if (!op) return null;
    setLavoro((n) => n + 1); inizioDrive();
    const r = await eseguiCompleto(archivioDb, op, { token: await tokenSessione().catch(() => null), api: API, creaCartella });
    setLavoro((n) => n - 1); fineDrive(r.ok ? null : r.errore);
    if (r.op) { setDati((d) => applica(d, r.op)); cambiato.current = true; }
    if (!r.ok) {
      // Riprova solo ciò che non è riuscito.
      const resto = op.tipo === 'sposta' && r.op ? { ...op, mosse: op.mosse.filter((m) => (r.nonRiusciti || []).includes(m.id)) } : op;
      mostraAvviso(`Non riuscito: ${r.errore || 'Drive non ha risposto'}`, { tipo: 'errore', azione: { nome: 'Riprova', fai: () => fai(resto, messaggio, { annullabile }) } });
      return r.op;
    }
    if (messaggio) {
      const annulla = annullabile && inversa(r.op) ? registraAnnulla(() => fai(inversa(r.op), 'Annullato', { annullabile: false })) : null;
      mostraAvviso(messaggio, { azione: annulla ? { nome: 'Annulla', fai: annulla } : null });
    }
    return r.op;
  }, [mostraAvviso]);

  const sposta = (sorgenti, dest) => {
    const op = operazioneSposta(sorgenti, dest, opz);
    if (!op) return;
    const n = sorgenti.length;
    setScelti(new Set()); setModoSelezione(false);
    fai(op, `${n === 1 ? 'Spostato' : `${n} elementi spostati`} in «${nomeNodo(dest, nomi)}»`);
  };
  const aggiungiIn = (sorgenti, dest) => {
    const op = operazioneAggiungi(sorgenti, dest, opz);
    if (!op) { mostraAvviso('È già in quella cartella'); return; }
    setScelti(new Set()); setModoSelezione(false);
    fai(op, `${op.ids.length === 1 ? 'Ora è' : `${op.ids.length} documenti sono`} anche in «${nomeNodo(dest, nomi)}»`);
  };
  const creaNuova = async (padre, nome) => {
    setNuova(null);
    const n = String(nome || '').trim();
    if (!n) return;
    await fai({ tipo: 'crea', nome: n, padre }, `Cartella «${n}» creata`);
  };
  const iniziaNuova = (padre) => {
    setMenu(null);
    if (padre !== nodo) vai(padre);
    setNuova({ padre, nome: nomeNuovaCartella(sottocartelle(cartelle, padre).map((c) => c.nome)) });
  };
  const confermaRinomina = () => {
    const r = rinomina;
    setRinomina(null);
    if (!r) return;
    const nome = r.nome.trim();
    const prima = r.cosa === 'cartella' ? cartelle.find((c) => c.id === r.id)?.nome : titoloDi(r.id);
    if (!nome || nome === prima) return;
    fai({ tipo: 'rinomina', cosa: r.cosa, id: r.id, da: prima, a: nome }, 'Rinominato');
  };

  // Elimina: cartelle archiviate (ripristinabili); documenti nel Cestino di Drive dopo 5 s con Annulla.
  const elimina = (sorgenti) => {
    setFoglio(null); setScelti(new Set()); setModoSelezione(false);
    const cartelleIds = sorgenti.filter((s) => s.tipo === 'cartella' && s.id !== RADICE && !eVirtuale(s.id)).map((s) => s.id);
    const docs = sorgenti.filter((s) => s.tipo === 'doc').map((s) => cache.get(s.id)).filter((d) => d && d.fascicolo !== CLINICO);
    if (cartelleIds.length) fai({ tipo: 'archivia', ids: cartelleIds }, `${cartelleIds.length === 1 ? `«${nomeNodo(cartelleIds[0], nomi)}» archiviata` : `${cartelleIds.length} cartelle archiviate`} (si può ripristinare)`);
    if (!docs.length) return;
    const ids = docs.map((d) => d.id);
    setNascosti((s) => new Set([...s, ...ids]));
    let annullato = false;
    const mostra = () => setNascosti((s) => { const n = new Set(s); ids.forEach((id) => n.delete(id)); return n; });
    const esegui = async () => {
      if (annullato) return;
      inizioDrive();
      try {
        const token = await tokenSessione();
        await eliminaConDrive(docs, { cestina: (x) => cestinaSuDrive({ token, ids: x }), elimina: (x) => eliminaDocumenti(archivioDb, x) });
        fineDrive();
        cambiato.current = true;
        setDati((d) => ({ ...d, posizioni: d.posizioni.filter((p) => !ids.includes(p.doc)) }));
        setLista((l) => (l ? { ...l, documenti: l.documenti.filter((id) => !ids.includes(id)) } : l));
      } catch (e) {
        fineDrive(e.message);
        mostra();
        mostraAvviso(`Non eliminato: ${e.message}`, { tipo: 'errore', azione: { nome: 'Riprova', fai: () => elimina(docs.map((d) => ({ tipo: 'doc', id: d.id }))) } });
      }
    };
    const timer = setTimeout(esegui, DURATA_ANNULLA);
    const annulla = registraAnnulla(() => { annullato = true; clearTimeout(timer); mostra(); mostraAvviso('Annullato'); }, { fino: Date.now() + DURATA_ANNULLA });
    mostraAvviso(`${docs.length === 1 ? `«${titoloDi(docs[0].id)}» eliminato` : `${docs.length} documenti eliminati`}: i file vanno nel Cestino di Drive`, { azione: { nome: 'Annulla', fai: annulla } });
  };

  // PR #337 §5: Elimina (Canc) = Cestino recuperabile. Prima Drive (file nel Cestino di Drive), poi l'etichetta
  // «cestino» in archivio; l'interfaccia cambia solo se entrambe riescono. Annulla (5 s, Ctrl+Z) = Ripristina.
  const cestina = async (sorgenti) => {
    setFoglio(null); setScelti(new Set()); setModoSelezione(false);
    const cartelleIds = sorgenti.filter((x) => x.tipo === 'cartella' && x.id !== RADICE && !eVirtuale(x.id)).map((x) => x.id);
    if (cartelleIds.length) fai({ tipo: 'archivia', ids: cartelleIds }, `${cartelleIds.length === 1 ? `«${nomeNodo(cartelleIds[0], nomi)}» nel Cestino` : `${cartelleIds.length} cartelle nel Cestino`} (si può ripristinare)`);
    const docs = sorgenti.filter((x) => x.tipo === 'doc').map((x) => cache.get(x.id)).filter((d) => d && d.fascicolo !== CLINICO);
    if (!docs.length) return;
    setLavoro((n) => n + 1); inizioDrive();
    try {
      const token = await tokenSessione();
      const conFile = docs.filter((d) => d.drive_file_id && !/rfc822/.test(String(d.mime_type || '')));
      if (conFile.length) await cestinaSuDrive({ token, ids: conFile.map((d) => d.drive_file_id) });
      await segnaCestino(archivioDb, docs, true);
      fineDrive();
      metti(docs.map((d) => ({ ...d, tag: conCestino(d.tag, true) })));
      cambiato.current = true;
      const annulla = registraAnnulla(() => ripristinaDocs(docs, 'Annullato'));
      mostraAvviso(`${docs.length === 1 ? `«${titoloDi(docs[0].id)}»` : `${docs.length} documenti`} nel Cestino`, { azione: { nome: 'Annulla', fai: annulla } });
    } catch (e) {
      fineDrive(e.message);
      mostraAvviso(`Non eliminato: ${e.message}`, { tipo: 'errore', azione: { nome: 'Riprova', fai: () => cestina(sorgenti) } });
    } finally { setLavoro((n) => n - 1); }
  };
  const ripristinaDocs = async (docs, messaggio) => {
    setLavoro((n) => n + 1); inizioDrive();
    try {
      const token = await tokenSessione();
      const conFile = docs.filter((d) => d.drive_file_id && !/rfc822/.test(String(d.mime_type || '')));
      if (conFile.length) await ripristinaFileDrive({ token, ids: conFile.map((d) => d.drive_file_id) });
      await segnaCestino(archivioDb, docs, false);
      fineDrive();
      metti(docs.map((d) => ({ ...d, tag: conCestino(d.tag, false) })));
      setCestino((c) => ({ ...c, docs: c.docs.filter((id) => !docs.some((d) => d.id === id)) }));
      cambiato.current = true;
      mostraAvviso(messaggio);
    } catch (e) {
      fineDrive(e.message);
      mostraAvviso(`Non ripristinato: ${e.message}`, { tipo: 'errore', azione: { nome: 'Riprova', fai: () => ripristinaDocs(docs, messaggio) } });
    } finally { setLavoro((n) => n - 1); }
  };

  // Carica file (Nuovo ▸ Carica file…, trascinamento dal computer, Estrai tutto): uno alla volta nel pannello
  // «Trasferimento file», con Annulla. Il file nasce nella cartella gemella su Drive (o in «Archivio personale»).
  const leggiBase64 = (blob) => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = () => ko(new Error('Lettura del file non riuscita')); r.readAsDataURL(blob); });
  const caricaQui = async (files, dest = eVirtuale(nodo) ? RADICE : nodo, titolo = null) => {
    const lista = [...(files || [])].filter((f) => f && f.size !== undefined);
    if (!lista.length) return;
    const token = await tokenSessione().catch(() => null);
    inizioDrive(); setLavoro((n) => n + 1);
    const r = await eseguiInCoda(titolo || `Caricamento in «${nomeNodo(dest, nomi)}»`, lista, async (f) => {
      const x = await caricaDocumento({ token, dati: await leggiBase64(f), nome: f.name, mime: f.type || 'application/octet-stream', cartella: dest !== RADICE ? dest : null });
      return x.id;
    });
    setLavoro((n) => n - 1); fineDrive(r.errori.length && !r.fatti.length ? r.errori[0] : null);
    // In «Personale» il file va nella radice di Archivio personale (stesso spostamento di Esplora: prima Drive).
    if (dest === RADICE && r.fatti.length) await fai({ tipo: 'sposta', mosse: r.fatti.map((id) => ({ tipo: 'doc', id, da: FUORI, a: RADICE })) }, null);
    cambiato.current = true; setRinfresca((n) => n + 1);
    if (r.errori.length) mostraAvviso(`${r.fatti.length} caricati, ${r.errori.length} non riusciti: ${r.errori[0]}`, { tipo: 'errore', azione: { nome: 'Riprova', fai: () => caricaQui(lista.filter((f) => r.errori.some((e) => e.startsWith(`${f.name}:`))), dest, titolo) } });
    else if (r.annullato) mostraAvviso(`Caricamento annullato: ${r.fatti.length} file già su Drive`);
    else mostraAvviso(`${r.fatti.length === 1 ? '1 file caricato' : `${r.fatti.length} file caricati`} in «${nomeNodo(dest, nomi)}»`);
  };
  const MIME_ESTRATTI = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', txt: 'text/plain', xml: 'application/xml', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  const estrai = async (d, sorg) => {
    const dest = sorg?.da && sorg.da !== FUORI && !eVirtuale(sorg.da) ? sorg.da : RADICE;
    try {
      const f = await fileDi(d);
      const { ZipReader, BlobReader, BlobWriter } = await import('@zip.js/zip.js');
      const lettore = new ZipReader(new BlobReader(f));
      const voci = (await lettore.getEntries()).filter((e) => !e.directory && !/(^|\/)(__MACOSX|\.DS_Store)/.test(e.filename));
      const files = [];
      for (const e of voci) {
        const nome = e.filename.split('/').pop();
        files.push(new File([await e.getData(new BlobWriter())], nome, { type: MIME_ESTRATTI[(nome.split('.').pop() || '').toLowerCase()] || 'application/octet-stream' }));
      }
      await lettore.close();
      if (!files.length) { mostraAvviso('Lo ZIP è vuoto'); return; }
      await caricaQui(files, dest, `Estrai «${titoloDi(d.id)}» in «${nomeNodo(dest, nomi)}»`);
    } catch (e) { mostraAvviso(`Non estratto: ${e.message}`, { tipo: 'errore', azione: { nome: 'Riprova', fai: () => estrai(d, sorg) } }); }
  };
  // Duplica: copia vera di ogni file su Drive (prima Drive, poi l'interfaccia), nella cartella dove sta il file.
  const duplica = async (sorgenti) => {
    const docs = sorgenti.map((x) => ({ x, d: cache.get(x.id) })).filter(({ d }) => d?.drive_file_id && !/rfc822/.test(String(d.mime_type || '')));
    if (!docs.length) { mostraAvviso('Niente da duplicare: questi documenti non hanno un file su Drive'); return; }
    const token = await tokenSessione().catch(() => null);
    setLavoro((n) => n + 1); inizioDrive();
    const r = await eseguiInCoda(`Duplica ${docs.length === 1 ? `«${titoloDi(docs[0].d.id)}»` : `${docs.length} file`}`, docs, async ({ x, d }) => {
      const dove = x.da && x.da !== FUORI && !eVirtuale(x.da) ? x.da : null;
      const c = await duplicaFileDrive({ token, id: d.id, cartella: dove === RADICE ? 'radice' : dove });
      if (dove === RADICE) await aggiungiAScrivania(archivioDb, [c.id]);
      return c;
    }, { nomeDi: ({ d }) => titoloDi(d.id) });
    setLavoro((n) => n - 1); fineDrive(r.errori.length && !r.fatti.length ? r.errori[0] : null);
    if (r.fatti.length) { cambiato.current = true; visitate.current.clear(); setRinfresca((n) => n + 1); }
    if (r.errori.length) mostraAvviso(`Non duplicato: ${r.errori[0]}`, { tipo: 'errore', azione: { nome: 'Riprova', fai: () => duplica(sorgenti) } });
    else mostraAvviso(r.fatti.length === 1 ? `Copia creata: «${r.fatti[0].titolo}»` : `${r.fatti.length} copie create`);
  };

  // Nuovo ▸ Documento Google / Foglio Google: creato su Drive nella cartella, poi aperto in una nuova scheda.
  const creaGoogle = async (tipo) => {
    const dest = eVirtuale(nodo) ? RADICE : nodo;
    const finestraNuova = window.open('', '_blank');
    setLavoro((n) => n + 1); inizioDrive();
    try {
      const r = await creaFileDrive({ token: await tokenSessione(), tipo, nome: tipo === 'foglio' ? 'Nuovo foglio' : 'Nuovo documento', cartella: dest });
      if (dest === RADICE) await aggiungiAScrivania(archivioDb, [r.id]);
      fineDrive();
      if (finestraNuova) finestraNuova.location.href = r.url; else window.open(r.url, '_blank', 'noopener');
      cambiato.current = true; setRinfresca((n) => n + 1);
      mostraAvviso(`${tipo === 'foglio' ? 'Foglio' : 'Documento'} Google creato in «${nomeNodo(dest, nomi)}»`);
    } catch (e) {
      finestraNuova?.close(); fineDrive(e.message);
      mostraAvviso(`Non creato: ${e.message}`, { tipo: 'errore', azione: { nome: 'Riprova', fai: () => creaGoogle(tipo) } });
    } finally { setLavoro((n) => n - 1); }
  };

  /* ---------- elementi mostrati ---------- */
  const titoloDi = (id) => dati?.titoli?.[id] ?? titoloDoc(cache.get(id));
  const docMostrati = (() => {
    if (!dati) return [];
    let ids;
    if (nodo === DA_CATALOGARE) { const dentro = catalogati(posizioni); ids = (lista?.nodo === nodo ? lista.documenti : []).filter((id) => !dentro.has(id)); }
    else if (codiceCategoria(nodo)) ids = lista?.nodo === nodo ? lista.documenti : [];
    else if (nodo === CATEGORIE) ids = [];
    else if (nodo === ACCESSO_RAPIDO) ids = [];
    else if (nodo === PREFERITI) ids = preferiti.filter((p) => p.tipo === 'doc').map((p) => p.id);
    else if (nodo === RECENTI || nodo === HOME) ids = recenti.map((r) => r.id);
    else if (nodo === CESTINO) ids = cestino.docs;
    else if (datiCerca(nodo)) ids = lista?.nodo === nodo ? lista.documenti : [];
    else ids = documentiNelNodo(posizioni, nodo);
    const docs = ids.filter((id) => cache.has(id) && !nascosti.has(id)).map((id) => cache.get(id)).filter((d) => nodo === CESTINO || !nelCestino(d));
    if (datiCerca(nodo)) return filtraRisultati(docs, { ...filtri, dentro: documentiNelSottoalbero(datiCerca(nodo).base, opz) });
    return docs;
  })();
  const preferitiMostrati = nodo === HOME ? preferiti.filter((p) => p.tipo === 'doc').map((p) => cache.get(p.id)).filter((d) => d && !nascosti.has(d.id)) : [];
  const fissate = () => {
    const l = preferiti.filter((p) => p.tipo === 'cartella').map((p) => (p.id === RADICE ? { id: RADICE, nome: 'Personale', collegamento: true } : cartelle.find((c) => c.id === p.id && !c.archiviata_il) && { ...cartelle.find((c) => c.id === p.id), collegamento: true })).filter(Boolean);
    return l;
  };
  const cartelleMostrate = nodo === CATEGORIE
    ? categorieVisibili(fascicoli).map((f) => ({ id: nodoCategoria(f.codice), nome: f.nome, virtuale: true }))
    : nodo === ACCESSO_RAPIDO ? fissate()
      : nodo === HOME ? (fissate().length ? fissate() : [{ id: RADICE, nome: 'Personale', collegamento: true }, ...sottocartelle(cartelle, RADICE).slice(0, 7).map((c) => ({ ...c, collegamento: true }))])
        : nodo === CESTINO ? cestino.cartelle.map((c) => ({ ...c, nelCestino: true, virtuale: true }))
          : datiCerca(nodo) ? cartelleTrovate(cartelleNelSottoalbero(datiCerca(nodo).base, cartelle), datiCerca(nodo).testo)
            : eVirtuale(nodo) ? [] : sottocartelle(cartelle, nodo);
  const righe = useMemo(() => ordinaRighe(righeDettagli(cartelleMostrate, docMostrati, dati?.titoli || {}, fascicoli), ordine), [cartelleMostrate, docMostrati, dati, ordine, fascicoli]);
  const gruppi = useMemo(() => raggruppa(righe, gruppo), [righe, gruppo]);
  // PR #337 §9: sopra i 200 elementi (senza gruppi) si disegnano solo le righe visibili.
  const virtuale = !gruppo && nodo !== HOME && righe.length > SOGLIA_VIRTUALE;
  const [scorri, setScorri] = useState({ top: 0, h: 800 });
  const [misure, setMisure] = useState(null); // { colonne, altezza, inizio }
  useEffect(() => {
    const el = contenutoRef.current;
    if (!el || !virtuale) return undefined;
    let raf = 0;
    const su = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setScorri({ top: el.scrollTop, h: el.clientHeight })); };
    su();
    el.addEventListener('scroll', su, { passive: true }); window.addEventListener('resize', su);
    return () => { cancelAnimationFrame(raf); el.removeEventListener('scroll', su); window.removeEventListener('resize', su); };
  }, [virtuale, vista, nodo]);
  useLayoutEffect(() => {
    if (!virtuale) { setMisure(null); return; }
    const c = contenutoRef.current;
    const contenitore = c?.querySelector('.esp-griglia, .esp-elenco, .esp-dettagli');
    const primo = contenitore?.querySelector('[data-chiave]');
    if (!contenitore || !primo) return;
    const riga = primo.closest('.esp-tessera, .esp-largo, .esp-riga, .esp-dettagli-riga') || primo;
    const gap = parseFloat(getComputedStyle(contenitore).rowGap) || 0;
    const colonne = contenitore.classList.contains('esp-griglia') ? getComputedStyle(contenitore).gridTemplateColumns.split(' ').length : 1;
    const testa = contenitore.querySelector('.esp-dettagli-testa')?.offsetHeight || 0;
    const nuove = { colonne, altezza: riga.getBoundingClientRect().height + gap, inizio: contenitore.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop + testa };
    setMisure((m) => (m && m.colonne === nuove.colonne && Math.abs(m.altezza - nuove.altezza) < 0.5 && Math.abs(m.inizio - nuove.inizio) < 1 ? m : nuove));
  });
  const finestraV = virtuale && misure ? finestraVirtuale({ n: righe.length, colonne: misure.colonne, altezza: misure.altezza, scrollTop: scorri.top, viewport: scorri.h, inizio: misure.inizio }) : null;
  const pezzo = (lista) => (finestraV ? lista.slice(finestraV.da, finestraV.a) : virtuale ? lista.slice(0, 60) : lista);
  const spazio = (px, chiave, griglia = false) => (finestraV && px > 0 ? <div key={chiave} aria-hidden="true" className="esp-spazio" style={{ height: px, ...(griglia ? { gridColumn: '1 / -1' } : {}) }} /> : null); // eslint-disable-line react-hooks/exhaustive-deps
  const elementi = nodo === HOME
    ? [...cartelleMostrate.map((c) => chiaveDi('cartella', c.id)), ...preferitiMostrati.map((d) => chiaveDi('doc', d.id)), ...docMostrati.map((d) => chiaveDi('doc', d.id))]
    : gruppi.flatMap((g) => g.righe).map((r) => chiaveDi(r.cosa, r.id));
  const nElementi = nodo === DA_CATALOGARE ? nDaCatalogare : cartelleMostrate.length + docMostrati.length + preferitiMostrati.length;
  const nDaGestireQui = nodo === DA_CATALOGARE ? [...daGestire.keys()].filter((id) => !catalogati(posizioni).has(id)).length : (pallini.get(nodo) || 0);

  // Sorgente per menu, trascinamento e azioni: { tipo, id, da, clinico }.
  const sorgenteDi = (k) => {
    const [tipo, ...r] = k.split(':'); const id = r.join(':');
    if (tipo === 'cartella') return { tipo, id, da: padreDi(cartelle, id) };
    const altrove = [ACCESSO_RAPIDO, HOME, PREFERITI, RECENTI].includes(nodo) || !!datiCerca(nodo);
    return { tipo: 'doc', id, da: altrove ? (documentiNelNodo(posizioni, RADICE).includes(id) ? RADICE : posizioni.find((p) => p.doc === id)?.nodo || DA_CATALOGARE) : nodo, clinico: cache.get(id)?.fascicolo === CLINICO };
  };
  // Documenti (non clinici, con il file su Drive) di una selezione: quelli che un'altra finestra può ricevere.
  const documentiDa = (src) => src.filter((x) => x.tipo === 'doc').map((x) => cache.get(x.id)).filter((d) => d?.drive_file_id && d.fascicolo !== CLINICO).map((d) => ({ ...d, titolo: titoloDi(d.id) }));
  const sorgentiPer = (k) => (scelti.has(k) && scelti.size > 1 ? [...scelti].map(sorgenteDi) : [sorgenteDi(k)]);

  /* ---------- apertura ---------- */
  const apriElemento = (k) => {
    const s = sorgenteDi(k);
    if (s.tipo === 'cartella') { if (nodo !== CESTINO) vai(s.id); return; }
    const d = cache.get(s.id);
    if (!d) return;
    setRecenti(ricordaRecente(d.id));
    // App predefinita per l'estensione (Impostazioni › App predefinite), altrimenti la regola automatica.
    const come = comeAprireCon(d, appPredefinite);
    if (come.modo === 'anteprima') setFinestra((f) => ({ doc: d, tipo: come.tipo, stato: f?.stato && f.stato !== 'ridotta' ? f.stato : 'normale', elenco: docMostrati }));
    else if (come.modo === 'link') window.open(come.url, '_blank', 'noopener');
    else if (come.modo === 'scarica') scarica(d);
    else if (come.modo === 'browser') nuovaScheda(d);
    else if (come.modo === 'altra') altraApp(d);
    else apri({ tipo: 'documento', id: d.id });
  };
  const fileDi = async (d) => comeFile(await preparaFile(d.drive_file_id, await tokenSessione()));
  const scarica = async (d) => { try { scaricaDocumento(await fileDi(d)); } catch (e) { mostraAvviso(`Non scaricato: ${e.message}`, { tipo: 'errore', azione: { nome: 'Riprova', fai: () => scarica(d) } }); } };
  const nuovaScheda = async (d) => {
    const w = window.open('', '_blank');
    try { const f = await fileDi(d); const u = URL.createObjectURL(f); if (w) w.location.href = u; else scaricaDocumento(f); }
    catch (e) { w?.close(); mostraAvviso(`Non aperto: ${e.message}`, { tipo: 'errore' }); }
  };
  const altraApp = async (d) => {
    try {
      const amb = ambienteApertura();
      const f = await preparaFile(d.drive_file_id, await tokenSessione());
      if (amb === 'capacitor') {
        const { Filesystem, FileOpener } = window.Capacitor.Plugins;
        const scritto = await Filesystem.writeFile({ path: f.nome || 'documento', data: f.dati, directory: 'CACHE' });
        await FileOpener.open({ filePath: scritto.uri, contentType: f.mime });
      } else if (amb === 'condividi') {
        const r = await condividi({ titolo: titoloDi(d.id), file: comeFile(f) });
        if (r === 'non_disponibile') scaricaDocumento(comeFile(f));
      } else scaricaDocumento(comeFile(f));
    } catch (e) { if (e?.name !== 'AbortError') mostraAvviso(`Non aperto: ${e.message}`, { tipo: 'errore' }); }
  };
  const condividiSistema = async (d) => {
    try {
      const file = d.drive_file_id ? await fileDi(d).catch(() => null) : null;
      const r = await condividi({ titolo: titoloDi(d.id), link: linkDrive(d), file });
      if (r === 'copiato') mostraAvviso('Link copiato');
    } catch (e) { if (e?.name !== 'AbortError') mostraAvviso(`Non condiviso: ${e.message}`, { tipo: 'errore' }); }
  };
  const copiaLink = async (d) => {
    try { await navigator.clipboard.writeText(linkDrive(d)); mostraAvviso('Link di Drive copiato'); }
    catch { mostraAvviso(linkDrive(d), { durata: 8000 }); }
  };

  /* ---------- selezione ---------- */
  const selezionaClic = (k, e = {}) => {
    const r = seleziona(scelti, k, elementi, { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey, ancora, casella: e.casella });
    setScelti(r.scelti); setAncora(r.ancora);
    if (e.casella && !r.scelti.size) setModoSelezione(false);
  };
  const tuttoSelezionato = () => { setScelti(new Set(elementi)); setAncora(elementi[0] || null); };

  /* ---------- trascinamento ---------- */
  const destDi = (b) => (b?.tipo === 'cartella' ? (b.id ?? RADICE) : null);
  // Trascinato su un'icona della barra: il file si apre con quell'app (Esplora = anteprima, Assistente, Agenda).
  const apriConApp = (app, sorgenti) => {
    const d = cache.get(sorgenti[0]?.id);
    if (!d) return;
    if (app === 'esplora') { apriElemento(chiaveDi('doc', d.id)); return; }
    window.dispatchEvent(new CustomEvent('poliedra:apri-con', { detail: { app, documento: { ...d, titolo: titoloDi(d.id) }, link: linkDrive(d) } }));
  };
  const { presa, gestori, eraTrascinamento } = useTrascina({
    attesa: PRESSIONE_MS, vibrazione: 10,
    valido: (s, b) => {
      if (b?.tipo === 'app') { const src = sorgentiPer(s.chiave); return src.length === 1 && src[0].tipo === 'doc' && accettaFile(b.id); }
      if (b?.tipo === 'finestra') return documentiDa(sorgentiPer(s.chiave)).length > 0; // PERSONAL-FINESTRE
      if (b?.tipo === 'scheda') return true; // passandoci sopra la scheda si attiva; lasciando lì si sposta nella sua cartella
      const d = destDi(b); return !!d && destinazioneValida(sorgentiPer(s.chiave), d, opz);
    },
    onLascia: (s, b) => {
      const src = sorgentiPer(s.chiave);
      if (b.tipo === 'app') { apriConApp(b.id, src); return; }
      if (b.tipo === 'finestra') { const docs = documentiDa(src); consegnaA(b.id, docs); mostraAvviso(docs.length === 1 ? 'Documento lasciato nella finestra' : `${docs.length} documenti lasciati nella finestra`); return; }
      const dest = b.tipo === 'scheda' ? nodoScheda(tabs.schede.find((t) => t.id === b.id)) : destDi(b);
      if (!dest || eVirtuale(dest)) return;
      // Ctrl premuto = copia (il documento compare anche lì, decisione del PO); altrimenti sposta.
      if (ctrlRef.current && src.every((x) => x.tipo === 'doc')) aggiungiIn(src, dest);
      else if (destinazioneValida(src, dest, opz)) sposta(src, dest);
    },
    onFermo: (s, punto) => {
      if (Date.now() - ultimoTocco.current > 1500) return; // pressione lunga col mouse: niente
      // Mobile: pressione prolungata = entra in selezione con l'elemento e apre il menu dal basso.
      const nuovi = new Set(modoSelezione ? scelti : []); nuovi.add(s.chiave);
      setScelti(nuovi); setAncora(s.chiave); setModoSelezione(true);
      apriMenu(s.tipo === 'cartella' ? 'cartella' : 'file', nuovi.size > 1 ? [...nuovi].map(sorgenteDi) : [sorgenteDi(s.chiave)], punto.x, punto.y);
    },
    scorrevoli: () => [alberoRef.current, contenutoRef.current],
  });
  const sopra = presa?.bersaglio?.chiave;
  // Ctrl durante il trascinamento: l'operazione diventa una copia.
  const ctrlRef = useRef(false);
  useEffect(() => {
    if (!presa) { ctrlRef.current = false; setCtrlGiu(false); return undefined; }
    const k = (e) => { ctrlRef.current = e.ctrlKey || e.metaKey; setCtrlGiu(ctrlRef.current); };
    const m = (e) => { if ((e.ctrlKey || e.metaKey) !== ctrlRef.current) k(e); };
    window.addEventListener('keydown', k); window.addEventListener('keyup', k); document.addEventListener('mousemove', m);
    return () => { window.removeEventListener('keydown', k); window.removeEventListener('keyup', k); document.removeEventListener('mousemove', m); };
  }, [!!presa]); // eslint-disable-line react-hooks/exhaustive-deps
  // Passando sopra una scheda durante il trascinamento la scheda si attiva (dopo 600 ms), come in Windows.
  useEffect(() => {
    if (!sopra?.startsWith('scheda:')) return undefined;
    const id = sopra.slice(7);
    if (id === tabs.attiva) return undefined;
    const t = setTimeout(() => setTabs((x) => ({ ...x, attiva: id })), 600);
    return () => clearTimeout(t);
  }, [sopra, tabs.attiva]);
  // L'icona della barra sotto il puntatore si accende (la barra è fuori da Esplora: classe sul nodo).
  useEffect(() => {
    document.body.classList.toggle('pb-trascina', !!presa);
    const el = sopra?.startsWith('app:') || sopra?.startsWith('finestra:') ? document.querySelector(`[data-bersaglio="${sopra}"]`) : null;
    el?.classList.add('pb-sopra');
    return () => { el?.classList.remove('pb-sopra'); };
  }, [!!presa, sopra]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => document.body.classList.remove('pb-trascina'), []);
  // Mobile: trascinando verso il bordo sinistro si apre il pannello di navigazione (le cartelle diventano bersagli).
  const vicinoBordo = !!presa && mobile && presa.x <= 24;
  useEffect(() => {
    if (!vicinoBordo || cassetto) return undefined;
    const t = setTimeout(() => setCassetto(true), 450);
    return () => clearTimeout(t);
  }, [vicinoBordo, cassetto]);
  useEffect(() => { if (!presa && mobile) setCassetto(false); }, [!!presa]); // eslint-disable-line react-hooks/exhaustive-deps

  // Gestori comuni di un elemento (albero, griglia, elenco, dettagli).
  const gestoriElemento = (k, { trascinabile = true, soloApri = false } = {}) => {
    const s = sorgenteDi(k);
    const g = trascinabile ? gestori({ tipo: s.tipo, id: s.id, chiave: k }) : {};
    let timer = null; let p = null;
    return {
      ...g,
      onTouchStart: (e) => {
        ultimoTocco.current = Date.now();
        if (trascinabile) { g.onTouchStart(e); return; }
        const t = e.touches[0]; p = { x: t.clientX, y: t.clientY };
        clearTimeout(timer);
        timer = setTimeout(() => { navigator.vibrate?.(10); apriMenu(s.tipo === 'cartella' ? 'cartella' : 'file', [s], p.x, p.y); }, PRESSIONE_MS);
      },
      onTouchMove: (e) => { if (trascinabile) { g.onTouchMove(e); return; } const t = e.touches[0]; if (p && Math.hypot(t.clientX - p.x, t.clientY - p.y) > 10) clearTimeout(timer); },
      onTouchEnd: (e) => { if (trascinabile) g.onTouchEnd(e); else clearTimeout(timer); },
      onClick: (e) => {
        if (eraTrascinamento()) return;
        const daTocco = Date.now() - ultimoTocco.current < 800;
        if (daTocco || soloApri) {
          if (modoSelezione && !soloApri) selezionaClic(k, { casella: true }); else apriElemento(k);
          return;
        }
        selezionaClic(k, e);
      },
      onDoubleClick: () => { if (Date.now() - ultimoTocco.current > 800) apriElemento(k); },
      onAuxClick: (e) => { if (e.button === 1 && s.tipo === 'cartella' && nodo !== CESTINO) { e.preventDefault(); apriScheda(s.id); } },
      onContextMenu: (e) => {
        e.preventDefault(); e.stopPropagation();
        if (Date.now() - ultimoTocco.current < 1500) return; // sul tocco ci pensa la pressione prolungata
        let sel = scelti;
        if (!scelti.has(k)) { sel = new Set([k]); setScelti(sel); setAncora(k); }
        apriMenu(s.tipo === 'cartella' ? 'cartella' : 'file', [...sel].map(sorgenteDi), e.clientX, e.clientY);
      },
      onKeyDown: (e) => { if (e.key === 'Enter' && !e.altKey) { e.preventDefault(); apriElemento(k); } },
    };
  };

  /* ---------- menu ---------- */
  function apriMenu(cosa, sorgenti, x, y) {
    const una = sorgenti[0];
    const d = una?.tipo === 'doc' ? cache.get(una.id) : null;
    if (d?.drive_file_id && sorgenti.length === 1) tokenSessione().then((t) => preparaFile(d.drive_file_id, t)).catch(() => {}); // pronto per Condividi su iOS
    setMenu({ cosa, sorgenti, x, y, titolo: sorgenti.length > 1 ? `${sorgenti.length} selezionati` : una ? (una.tipo === 'cartella' ? nomeNodo(una.id, nomi) : titoloDi(una.id)) : null });
  }
  const vuoto = useRef({ t: null, p: null });
  const rettangoloFatto = useRef(false);
  const fuoco = useRef(null); // elemento col fuoco della tastiera
  const gestoriVuoto = {
    onTouchStart: (e) => {
      ultimoTocco.current = Date.now();
      if (e.target.closest('[data-elemento]')) return;
      const x = e.touches[0];
      vuoto.current.p = { x: x.clientX, y: x.clientY };
      clearTimeout(vuoto.current.t);
      vuoto.current.t = setTimeout(() => { navigator.vibrate?.(10); apriMenu('vuoto', [], vuoto.current.p.x, vuoto.current.p.y); }, PRESSIONE_MS);
    },
    onTouchMove: (e) => { const x = e.touches[0]; const p = vuoto.current.p; if (p && Math.hypot(x.clientX - p.x, x.clientY - p.y) > 10) clearTimeout(vuoto.current.t); },
    onTouchEnd: () => clearTimeout(vuoto.current.t),
    onClick: (e) => {
      if (rettangoloFatto.current) { rettangoloFatto.current = false; return; }
      if (!e.target.closest('[data-elemento]') && Date.now() - ultimoTocco.current > 800) setScelti(new Set());
    },
    // PR #337 §6: selezione a rettangolo trascinando nello spazio vuoto (mouse); Ctrl aggiunge alla selezione.
    onMouseDown: (e) => {
      if (e.button !== 0 || e.target.closest('[data-elemento], input, button, select, .esp-filtri') || Date.now() - ultimoTocco.current < 1500) return;
      const area = contenutoRef.current;
      const base = e.ctrlKey || e.metaKey ? new Set(scelti) : new Set();
      const x0 = e.clientX; const y0 = e.clientY;
      let attivo = false;
      const muovi = (ev) => {
        if (!attivo && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
        attivo = true;
        const r = { left: Math.min(x0, ev.clientX), top: Math.min(y0, ev.clientY), right: Math.max(x0, ev.clientX), bottom: Math.max(y0, ev.clientY) };
        setRettangolo(r);
        const dentro = new Set(base);
        area.querySelectorAll('[data-chiave]').forEach((el) => {
          const b = el.getBoundingClientRect();
          if (b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top) dentro.add(el.dataset.chiave);
        });
        setScelti(dentro);
        // vicino ai bordi il contenuto scorre
        const a = area.getBoundingClientRect();
        if (ev.clientY > a.bottom - 24) area.scrollBy(0, 16); else if (ev.clientY < a.top + 24) area.scrollBy(0, -16);
      };
      const fine = () => {
        document.removeEventListener('mousemove', muovi); document.removeEventListener('mouseup', fine);
        if (attivo) { rettangoloFatto.current = true; setTimeout(() => { rettangoloFatto.current = false; }, 50); }
        setRettangolo(null);
      };
      document.addEventListener('mousemove', muovi); document.addEventListener('mouseup', fine);
    },
    onContextMenu: (e) => {
      if (e.target.closest('[data-elemento]')) return;
      e.preventDefault();
      if (Date.now() - ultimoTocco.current < 1500) return;
      apriMenu('vuoto', [], e.clientX, e.clientY);
    },
  };
  const strutturaMenu = () => {
    if (!menu) return null;
    const segno = (si, nome) => `${si ? '✓ ' : ''}${nome}`;
    const sep = { separatore: true };
    if (menu.cosa === 'visualizza') return { rapide: [], voci: [
      ...VISTE_ESPLORA.map(([k, n]) => ({ id: `vista:${k}`, nome: segno(vista === k, n), attiva: true })),
      sep,
      { id: 'riquadro:anteprima', nome: segno(riquadro === 'anteprima', 'Riquadro di anteprima'), tasto: 'Alt+P', attiva: true },
      { id: 'riquadro:dettagli', nome: segno(riquadro === 'dettagli', 'Riquadro dei dettagli'), tasto: 'Alt+Maiusc+P', attiva: true },
      { id: 'pannello', nome: segno(mobile ? cassetto : !pannello.chiuso, 'Pannello di navigazione'), attiva: true },
    ] };
    if (menu.cosa === 'ordina') return { rapide: [], voci: [
      ...[['nome', 'Nome'], ['data', 'Data modifica'], ['tipo', 'Tipo'], ['dimensione', 'Dimensione'], ['categoria', 'Categoria']].map(([k, n]) => ({ id: `ordina:${k}`, nome: segno(ordine.chiave === k, n), attiva: true })),
      sep,
      { id: 'verso:su', nome: segno(ordine.verso === 'su', 'Crescente'), attiva: true },
      { id: 'verso:giu', nome: segno(ordine.verso === 'giu', 'Decrescente'), attiva: true },
      sep,
      { id: 'raggruppa', nome: 'Raggruppa per', attiva: true, sotto: GRUPPI.map(([k, n]) => ({ id: `gruppo:${k || 'nessuno'}`, nome: segno(gruppo === k, n), attiva: true })) },
    ] };
    if (menu.cosa === 'colonne') return { rapide: [], voci: [
      ...COLONNE_DETTAGLI.map(([k, n]) => ({ id: `colonna:${k}`, nome: segno(colonneVisibili.includes(k), n), attiva: k !== 'nome' })),
      sep,
      { id: 'colonne:tutte', nome: 'Mostra tutte le colonne', attiva: true },
    ] };
    if (menu.cosa === 'nuovo') return { rapide: [], voci: [
      { id: 'nuova', nome: 'Cartella', tasto: 'Ctrl+Maiusc+N', attiva: !eVirtuale(nodo) },
      { id: 'nuovo:doc', nome: 'Documento Google', attiva: !eVirtuale(nodo) },
      { id: 'nuovo:foglio', nome: 'Foglio Google', attiva: !eVirtuale(nodo) },
      sep,
      { id: 'carica', nome: 'Carica file…', attiva: true },
    ] };
    if (menu.cosa === 'altro') return { rapide: [], voci: [
      { id: 'seleziona-tutto', nome: 'Seleziona tutto', tasto: 'Ctrl+A', attiva: true },
      { id: 'deseleziona', nome: 'Deseleziona tutto', attiva: scelti.size > 0 },
      { id: 'inverti', nome: 'Inverti selezione', attiva: true },
      sep,
      { id: 'scheda-nuova', nome: 'Apri in una nuova scheda', tasto: 'Ctrl+T', attiva: true },
      { id: 'copia-percorso', nome: 'Copia percorso', attiva: true },
      { id: 'proprieta-cartella', nome: 'Proprietà della cartella', attiva: !eVirtuale(nodo) && nodo !== RADICE },
    ] };
    const una = menu.sorgenti[0];
    const d = una?.tipo === 'doc' ? cache.get(una.id) : null;
    return menuContestuale(menu.cosa, {
      nodo: menu.cosa === 'vuoto' ? nodo : una?.id, appunti, opz, selezione: menu.sorgenti, preferiti,
      ambiente: ambienteApertura(), convertibile: !!(d && linkDocs(d)), conFile: !!d?.drive_file_id,
      vista, ordine, gruppo, zip: !!d && eZip(d), cestino: nodo === CESTINO && menu.cosa !== 'vuoto',
      altrove: [HOME, PREFERITI, RECENTI, ACCESSO_RAPIDO].includes(nodo) || !!datiCerca(nodo),
    });
  };

  const azione = (id, sorgenti) => {
    const una = sorgenti[0];
    const d = una?.tipo === 'doc' ? cache.get(una.id) : null;
    const nomeDi = (s) => (s.tipo === 'cartella' ? nomeNodo(s.id, nomi) : titoloDi(s.id));
    const nomeSel = sorgenti.length === 1 ? nomeDi(una) : `${sorgenti.length} elementi`;
    switch (id) {
      case 'ripristina': {
        const c = sorgenti.filter((x) => x.tipo === 'cartella').map((x) => x.id);
        const ds = sorgenti.filter((x) => x.tipo === 'doc').map((x) => cache.get(x.id)).filter(Boolean);
        if (c.length) fai({ tipo: 'ripristina', ids: c }, c.length === 1 ? 'Cartella ripristinata' : `${c.length} cartelle ripristinate`).then(() => setRinfresca((n) => n + 1));
        if (ds.length) ripristinaDocs(ds, ds.length === 1 ? 'Ripristinato' : `${ds.length} documenti ripristinati`);
        break;
      }
      case 'deseleziona': setScelti(new Set()); break;
      case 'inverti': setScelti(new Set(elementi.filter((k) => !scelti.has(k)))); break;
      case 'scheda-nuova': apriScheda(una?.tipo === 'cartella' ? una.id : nodo); break;
      case 'copia-percorso': {
        const t = (una?.tipo === 'doc' ? [...percorsoNodo(una.da, nomi).map((p) => p.nome), titoloDi(una.id)] : percorsoNodo(una?.id || nodo, nomi).map((p) => p.nome)).join(' › ');
        navigator.clipboard?.writeText(t).then(() => mostraAvviso(`Percorso copiato: ${t}`), () => mostraAvviso(t, { durata: 8000 }));
        break;
      }
      case 'proprieta-cartella': setFoglio({ tipo: 'proprieta', sorgente: { tipo: 'cartella', id: nodo } }); break;
      case 'pannello': if (mobile) setCassetto((c) => !c); else setPannello((p) => salvaPannello({ ...p, chiuso: !p.chiuso })); break;
      case 'nuova': iniziaNuova(una && una.tipo === 'cartella' ? una.id : nodo); break;
      case 'incolla': { const op = incolla(appunti, nodo, opz); if (op) { const tagliati = appunti.modo !== 'copia'; if (tagliati) setAppunti(null); if (op.tipo === 'aggiungi') fai(op, `Incollato in «${nomeNodo(nodo, nomi)}»`); else fai(op, `Spostato in «${nomeNodo(nodo, nomi)}»`); } break; }
      case 'incolla-qui': { const op = incolla(appunti, una.id, opz); if (op) { if (appunti.modo !== 'copia') setAppunti(null); fai(op, `Incollato in «${nomeNodo(una.id, nomi)}»`); } break; }
      case 'aggiorna': setRinfresca((n) => n + 1); break;
      case 'seleziona-tutto': tuttoSelezionato(); break;
      case 'apri': apriElemento(chiaveDi(una.tipo, una.id)); break;
      case 'taglia': setAppunti(taglia(sorgenti, nomeSel)); mostraAvviso(`«${nomeSel}» tagliato: Incolla nella cartella di arrivo (Ctrl+V)`); break;
      case 'copia': { const a = copia(sorgenti, nomeSel); if (a) { setAppunti(a); mostraAvviso(`«${nomeSel}» copiato: Incolla per metterlo anche in un'altra cartella`); } break; }
      // Duplica (decisione del PO del 2026-11-22) = vera copia del file su Drive nella stessa cartella.
      // Copia in… = il documento compare anche nell'altra cartella, stesso file su Drive.
      case 'duplica': duplica(sorgenti.filter((x) => x.tipo === 'doc')); break;
      case 'copia-in': setFoglio({ tipo: 'duplica', sorgenti }); break;
      case 'con:predefinita': if (d) setFoglio({ tipo: 'app', doc: d }); break;
      case 'mostra-cartella': {
        const dove = una.tipo === 'cartella' ? padreDi(cartelle, una.id) : una.da;
        const k = chiaveDi(una.tipo === 'cartella' ? 'cartella' : 'doc', una.id);
        vai(dove || RADICE); setScelti(new Set([k])); setAncora(k);
        break;
      }
      case 'estrai': if (d) estrai(d, una); break;
      case 'nuovo:doc': case 'nuovo:foglio': creaGoogle(id === 'nuovo:foglio' ? 'foglio' : 'doc'); break;
      case 'carica': inputCarica.current?.click(); break;
      case 'elimina-definitivo': setFoglio({ tipo: 'elimina', sorgenti: sorgenti.filter((x) => x.tipo === 'doc') }); break;
      case 'sposta': setFoglio({ tipo: 'sposta', sorgenti }); break;
      case 'rinomina': if (una.tipo === 'cartella') { setAperti((a) => new Set([...a, ...antenati(una.id, nomi)])); setRinomina({ cosa: 'cartella', id: una.id, nome: nomeNodo(una.id, nomi) }); } else setRinomina({ cosa: 'doc', id: una.id, nome: titoloDi(una.id) }); break;
      case 'preferito': { const nuovi = cambiaPreferito(preferiti, una.tipo === 'cartella' ? 'cartella' : 'doc', una.id); setPreferiti(nuovi); salvaPreferiti(archivioDb, nuovi).then(() => mostraAvviso(una.tipo === 'cartella' ? (nuovi.length > preferiti.length ? 'Aggiunta ad Accesso rapido' : 'Tolta da Accesso rapido') : (nuovi.length > preferiti.length ? 'Aggiunto ai Preferiti' : 'Tolto dai Preferiti'))).catch((e) => { setPreferiti(preferiti); mostraAvviso(`Non salvato: ${e.message}`, { tipo: 'errore' }); }); break; }
      case 'zip': setStatoZip(null); setFoglio({ tipo: 'zip', cartelleScelte: sorgenti.filter((s) => s.tipo === 'cartella').map((s) => s.id), documentiScelti: sorgenti.filter((s) => s.tipo === 'doc').map((s) => cache.get(s.id)).filter(Boolean), nome: nomeSel }); break;
      case 'scarica': case 'con:scarica': if (d) scarica(d); break;
      case 'proprieta': setFoglio({ tipo: 'proprieta', sorgente: una }); break;
      case 'elimina': cestina(sorgenti); break;
      case 'con:anteprima': if (d) { const c = comeAprire(d); if (c.modo === 'anteprima') setFinestra({ doc: d, tipo: c.tipo, stato: 'normale' }); else apri({ tipo: 'documento', id: d.id }); } break;
      case 'con:drive': if (d) window.open(linkDrive(d), '_blank', 'noopener'); break;
      case 'con:docs': if (d && linkDocs(d)) window.open(linkDocs(d), '_blank', 'noopener'); break;
      case 'con:scheda': if (d) nuovaScheda(d); break;
      case 'con:altra': if (d) altraApp(d); break;
      case 'condividi-sistema': case 'cond:sistema': if (d) condividiSistema(d); break;
      case 'cond:link': if (d) copiaLink(d); break;
      case 'cond:email': if (d) window.location.href = linkEmail(titoloDi(d.id), linkDrive(d)); break;
      case 'cond:whatsapp': if (d) window.open(linkWhatsApp(titoloDi(d.id), linkDrive(d)), '_blank', 'noopener'); break;
      case 'cond:accesso': if (d) setFoglio({ tipo: 'accesso', doc: d }); break;
      default:
        if (id.startsWith('vista:')) { const v = id.slice(6); setViste(salvaVista(nodo, v)); }
        else if (id.startsWith('riquadro:')) { const r = id.slice(9); setRiquadro((x) => (x === r ? null : r)); }
        else if (id.startsWith('ordina:')) setOrdine((o) => ({ ...o, chiave: id.slice(7) }));
        else if (id.startsWith('verso:')) setOrdine((o) => ({ ...o, verso: id.slice(6) }));
        else if (id.startsWith('gruppo:')) setGruppo(id === 'gruppo:nessuno' ? '' : id.slice(7));
        else if (id.startsWith('colonna:')) setColonne(cambiaColonna(colonneVisibili, id.slice(8)));
        else if (id === 'colonne:tutte') setColonne(COLONNE_DETTAGLI.map(([k]) => k));
    }
  };
  const sceltaMenu = (id) => { const m = menu; setMenu(null); if (m) azione(id, m.sorgenti); };

  // Riquadro destro: scadenze collegate al file selezionato.
  const docRiquadro = riquadro && scelti.size ? (() => { const k = ancora && scelti.has(ancora) ? ancora : [...scelti][0]; return k?.startsWith('doc:') ? k.slice(4) : null; })() : null;
  useEffect(() => {
    if (!docRiquadro) { setScadenzeSel(null); return undefined; }
    let vivo = true;
    setScadenzeSel(null);
    scadenzeDelDocumento(archivioDb, docRiquadro).then((l) => vivo && setScadenzeSel(l || [])).catch(() => vivo && setScadenzeSel([]));
    return () => { vivo = false; };
  }, [docRiquadro]);

  /* ---------- tastiera (desktop) ---------- */
  useEffect(() => {
    const tasto = (e) => {
      if (menu || foglio || finestra?.stato === 'normale' || finestra?.stato === 'ingrandita') return;
      const ctrl = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      // Navigazione e finestra (valgono anche fuori dagli elementi).
      if (ctrl && (k === 'f' || k === 'e')) { e.preventDefault(); campoCerca.current?.focus(); campoCerca.current?.select(); return; }
      if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (ctrl && k === 't') { e.preventDefault(); apriScheda(HOME); return; }
      if (ctrl && k === 'w') { e.preventDefault(); chiudiLaScheda(tabs.attiva); return; }
      if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); vaiStoria(indietroScheda); return; }
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); vaiStoria(avantiScheda); return; }
      if (e.altKey && k === 'p') { e.preventDefault(); const r = e.shiftKey ? 'dettagli' : 'anteprima'; setRiquadro((x) => (x === r ? null : r)); return; }
      const sel = [...scelti].map(sorgenteDi);
      if (ctrl && k === 'z') { e.preventDefault(); if (!annullaUltimo()) mostraAvviso('Niente da annullare'); return; }
      if (ctrl && k === 'a') { e.preventDefault(); tuttoSelezionato(); return; }
      if (ctrl && e.shiftKey && k === 'n') { e.preventDefault(); if (!eVirtuale(nodo)) iniziaNuova(nodo); return; }
      if (ctrl && k === 'v') { if (appunti) { e.preventDefault(); azione('incolla', []); } return; }
      if (e.key === 'F5') { e.preventDefault(); setRinfresca((n) => n + 1); return; }
      if (e.key === 'Escape') { setScelti(new Set()); setModoSelezione(false); return; }
      if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); if (padreDi(cartelle, nodo)) vai(padreDi(cartelle, nodo)); return; }
      if (e.key === 'Backspace' && padreDi(cartelle, nodo)) { e.preventDefault(); vai(padreDi(cartelle, nodo)); return; }
      // Frecce: si sposta la selezione (Maiusc estende); Shift+F10 o tasto Menu = menu contestuale.
      if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp'].includes(e.key) && !e.altKey
        && !e.target.closest?.('.esp-albero, .esp-cassetto, [role="tablist"], [role="menu"], .pb-barra, .pb-start, .pn-centro')) {
        if (!elementi.length) return;
        e.preventDefault();
        const griglia = contenutoRef.current?.querySelector('.esp-griglia');
        const col = vista === 'dettagli' || vista === 'elenco' || !griglia ? 1 : getComputedStyle(griglia).gridTemplateColumns.split(' ').length;
        const da = elementi.indexOf(fuoco.current && elementi.includes(fuoco.current) ? fuoco.current : ancora);
        const i = indiceConTasto(da, e.key, { n: elementi.length, colonne: col });
        const k = elementi[i];
        if (!k) return;
        if (e.shiftKey && ancora) { const r = seleziona(scelti, k, elementi, { shift: true, ancora }); setScelti(r.scelti); }
        else if (!ctrl) { setScelti(new Set([k])); setAncora(k); }
        fuoco.current = k;
        const el = contenutoRef.current?.querySelector(`[data-chiave="${CSS.escape(k)}"]`);
        el?.focus({ preventScroll: true }); el?.scrollIntoView({ block: 'nearest' });
        return;
      }
      if ((e.key === 'F10' && e.shiftKey) || e.key === 'ContextMenu') {
        e.preventDefault();
        const k = fuoco.current && scelti.has(fuoco.current) ? fuoco.current : [...scelti][0];
        const el = k && contenutoRef.current?.querySelector(`[data-chiave="${CSS.escape(k)}"]`);
        const r = (el || contenutoRef.current).getBoundingClientRect();
        if (!sel.length) apriMenu('vuoto', [], r.left + 24, r.top + 24);
        else apriMenu(sel[0].tipo === 'cartella' ? 'cartella' : 'file', sel, r.left + Math.min(r.width / 2, 120), r.top + Math.min(r.height / 2, 40));
        return;
      }
      if (!sel.length) return;
      const una = sel[0];
      const tutteMie = sel.every((s) => s.tipo === 'doc' || (s.id !== RADICE && !eVirtuale(s.id)));
      if (ctrl && k === 'x' && tutteMie) { e.preventDefault(); azione('taglia', sel); }
      else if (ctrl && k === 'c') { e.preventDefault(); azione('copia', sel); }
      else if (ctrl && k === 'd' && sel.every((s) => s.tipo === 'doc')) { e.preventDefault(); azione('duplica', sel); }
      else if (e.key === 'F2' && sel.length === 1 && (una.tipo === 'doc' || (una.id !== RADICE && !eVirtuale(una.id)))) { e.preventDefault(); azione('rinomina', sel); }
      else if (e.key === 'Delete' && e.shiftKey && sel.some((s) => s.tipo === 'doc') && !sel.some((s) => s.clinico)) { e.preventDefault(); azione('elimina-definitivo', sel); }
      else if (e.key === 'Delete' && nodo === CESTINO) { e.preventDefault(); azione('elimina-definitivo', sel); }
      else if (e.key === 'Delete' && tutteMie && !sel.some((s) => s.clinico)) { e.preventDefault(); azione('elimina', sel); }
      else if (e.key === 'Enter' && e.altKey && sel.length === 1) { e.preventDefault(); azione('proprieta', sel); }
      else if (e.key === 'Enter' && sel.length === 1) { e.preventDefault(); apriElemento(chiaveDi(una.tipo, una.id)); }
    };
    window.addEventListener('keydown', tasto);
    return () => window.removeEventListener('keydown', tasto);
  });

  /* ---------- divisorio e colonne ---------- */
  const trascina = (e, muovi) => {
    e.preventDefault(); e.stopPropagation();
    const fine = () => { window.removeEventListener('pointermove', muovi); window.removeEventListener('pointerup', fine); window.removeEventListener('pointercancel', fine); };
    window.addEventListener('pointermove', muovi);
    window.addEventListener('pointerup', fine);
    window.addEventListener('pointercancel', fine);
  };
  const trascinaDivisorio = (e) => { const y0 = e.clientY; const h0 = altezzaAlbero(altezza, schermo.a); trascina(e, (ev) => setAltezza(altezzaAlbero(h0 + (ev.clientY - y0), schermo.a))); };
  const ridimensiona = (k) => (e) => { const x0 = e.clientX; const w0 = larghezze[k]; trascina(e, (ev) => setLarghezze((l) => ({ ...l, [k]: Math.max(64, Math.round(w0 + ev.clientX - x0)) }))); };
  // Ctrl+rotella cambia la dimensione delle icone (listener non passivo per fermare lo zoom del browser).
  useEffect(() => {
    const el = contenutoRef.current;
    if (!el) return undefined;
    const rotella = (e) => { if (!e.ctrlKey) return; e.preventDefault(); const v = vistaConRotella(vista, e.deltaY); if (v !== vista) setViste(salvaVista(nodo, v)); };
    el.addEventListener('wheel', rotella, { passive: false });
    return () => el.removeEventListener('wheel', rotella);
  });

  /* ---------- albero ---------- */
  const apriChiudi = (id) => setAperti((a) => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const rigaAlbero = ({ id, nome, livello, figli, trascinabile = false, bersaglio = false, icona = null }) => {
    const aperto = aperti.has(id);
    const chiave = bersaglio ? `cartella:${id}` : undefined;
    const k = chiaveDi('cartella', id);
    const g = gestoriElemento(k, { trascinabile, soloApri: true });
    const inRinomina = rinomina?.cosa === 'cartella' && rinomina.id === id;
    return (
      <li key={id} role="treeitem" aria-expanded={figli ? aperto : undefined} aria-selected={nodo === id}>
        <div className={`esp-albero-riga${nodo === id ? ' attiva' : ''}${chiave && sopra === chiave ? ' sopra' : ''}${presa?.sorgente?.id === id ? ' presa' : ''}`} style={{ paddingLeft: 6 + livello * 14 }}>
          <button type="button" className="esp-albero-freccia" onClick={() => apriChiudi(id)} aria-label={aperto ? `Chiudi ${nome}` : `Apri ${nome}`} tabIndex={figli ? 0 : -1} style={{ visibility: figli ? 'visible' : 'hidden' }}><Freccia aperta={aperto} /></button>
          {inRinomina ? campoRinomina() : (
            <button type="button" className="esp-albero-nome" data-elemento data-bersaglio={chiave} {...g}>
              {icona || <IconaCartellaW11 size={18} />}<span>{nome}</span><Pallino n={pallini.get(id)} piccolo />
            </button>
          )}
        </div>
        {figli && aperto && <ul role="group">{figli}</ul>}
      </li>
    );
  };
  const ramo = (padre, livello) => sottocartelle(cartelle, padre).map((c) => rigaAlbero({ id: c.id, nome: c.nome, livello, figli: sottocartelle(cartelle, c.id).length ? ramo(c.id, livello + 1) : null, trascinabile: true, bersaglio: true }));
  const prefCartelle = preferiti.filter((p) => p.tipo === 'cartella');
  // Albero da tastiera: ↑/↓ tra le voci visibili, → apre, ← chiude o sale al padre, Home/Fine.
  const tastieraAlbero = (e) => {
    const voci = [...e.currentTarget.querySelectorAll('.esp-albero-nome')];
    const i = voci.indexOf(document.activeElement);
    if (i < 0) return;
    const li = voci[i].closest('[role="treeitem"]');
    const vai2 = (j) => { e.preventDefault(); voci[Math.max(0, Math.min(voci.length - 1, j))]?.focus(); };
    if (e.key === 'ArrowDown') vai2(i + 1);
    else if (e.key === 'ArrowUp') vai2(i - 1);
    else if (e.key === 'Home') vai2(0);
    else if (e.key === 'End') vai2(voci.length - 1);
    else if (e.key === 'ArrowRight' && li?.getAttribute('aria-expanded') === 'false') { e.preventDefault(); li.querySelector('.esp-albero-freccia')?.click(); }
    else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (li?.getAttribute('aria-expanded') === 'true') li.querySelector('.esp-albero-freccia')?.click();
      else li?.parentElement?.closest('[role="treeitem"]')?.querySelector('.esp-albero-nome')?.focus();
    }
  };
  const IcoNav = ({ d, colore = 'currentColor' }) => <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path d={d} fill="none" stroke={colore} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  const albero = (
    <ul className="esp-albero-lista" role="tree" aria-label="Pannello di navigazione" onKeyDown={tastieraAlbero}>
      {rigaAlbero({ id: HOME, nome: 'Home', livello: 0, figli: null, icona: <IcoNav d="M2.5 7.5 8 3l5.5 4.5M4 6.5V13h3V9.5h2V13h3V6.5" colore="#0F6CBD" /> })}
      {rigaAlbero({ id: ACCESSO_RAPIDO, nome: 'Accesso rapido', livello: 0, icona: <IcoStella />,
        figli: prefCartelle.length ? prefCartelle.map((p) => rigaAlbero({ id: `${p.id}`, nome: p.id === RADICE ? 'Personale' : nomeNodo(p.id, nomi), livello: 1, figli: null, bersaglio: p.id === RADICE || !!cartelle.find((c) => c.id === p.id) })).filter(Boolean) : null })}
      {rigaAlbero({ id: PREFERITI, nome: 'Preferiti', livello: 0, figli: null, icona: <IcoNav d="M8 13.5S2.5 10.3 2.5 6.4A2.9 2.9 0 0 1 8 5a2.9 2.9 0 0 1 5.5 1.4C13.5 10.3 8 13.5 8 13.5Z" colore="#C42B1C" /> })}
      {rigaAlbero({ id: RECENTI, nome: 'Recenti', livello: 0, figli: null, icona: <IcoNav d="M8 2.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11ZM8 5v3.2l2.2 1.4" colore="#0F6CBD" /> })}
      <li role="none" className="esp-albero-sep" aria-hidden="true" />
      {rigaAlbero({ id: RADICE, nome: 'Personale', livello: 0, figli: sottocartelle(cartelle, RADICE).length ? ramo(RADICE, 1) : null, bersaglio: true })}
      {rigaAlbero({ id: DA_CATALOGARE, nome: 'Da catalogare', livello: 0, figli: null })}
      {rigaAlbero({ id: CATEGORIE, nome: 'Per categoria', livello: 0, figli: categorieVisibili(fascicoli).map((f) => rigaAlbero({ id: nodoCategoria(f.codice), nome: f.nome, livello: 1, figli: null })) })}
      <li role="none" className="esp-albero-sep" aria-hidden="true" />
      {rigaAlbero({ id: CESTINO, nome: 'Cestino', livello: 0, figli: null, icona: <IcoNav d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9" /> })}
    </ul>
  );

  /* ---------- contenuto: elementi nelle quattro viste ---------- */
  function campoRinomina() {
    return <input className="esp-campo" autoFocus value={rinomina.nome} onFocus={(e) => e.target.select()} onChange={(e) => setRinomina({ ...rinomina, nome: e.target.value })} onBlur={confermaRinomina} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') confermaRinomina(); if (e.key === 'Escape') setRinomina(null); }} aria-label="Nuovo nome" />;
  }
  const statoElemento = (cosa, voce) => {
    const cartella = cosa === 'cartella';
    const id = voce.id;
    const k = chiaveDi(cosa, id);
    const mia = cartella && !voce.virtuale && id !== ACCESSO_RAPIDO;
    const chiave = mia ? `cartella:${id}` : undefined;
    return {
      k, id, cartella, chiave,
      nome: cartella ? voce.nome : titoloDi(id),
      etichetta: segnaRicerca(cartella ? voce.nome : titoloDi(id)),
      n: cartella ? pallini.get(id) : (daGestire.has(id) ? 1 : 0),
      scelto: scelti.has(k),
      inRinomina: !!rinomina && rinomina.id === id && rinomina.cosa === (cartella ? 'cartella' : 'doc'),
      classi: `${chiave && sopra === chiave ? ' sopra' : ''}${presa?.sorgente?.id === id ? ' presa' : ''}${appunti?.modo !== 'copia' && appunti?.sorgenti?.some((s) => s.id === id) ? ' tagliata' : ''}${scelti.has(k) ? ' scelta' : ''}`,
      g: gestoriElemento(k, { trascinabile: !voce.virtuale && !voce.collegamento }),
    };
  };
  // Nei risultati di ricerca le parole trovate sono evidenziate.
  const testoTrovato = datiCerca(nodo)?.testo;
  function segnaRicerca(nome) {
    if (!testoTrovato) return nome;
    return evidenzia(nome, testoTrovato).map((p, i) => (p.m ? <mark key={i} className="esp-trovato">{p.t}</mark> : <span key={i}>{p.t}</span>));
  }
  const doveSta = (d) => { const x = sorgenteDi(chiaveDi('doc', d.id)); return nomeNodo(x.da, nomi); };
  const casella = (st) => (modoSelezione ? <span className={`esp-casella${st.scelto ? ' attiva' : ''}`} aria-hidden="true">{st.scelto ? '✓' : ''}</span> : null);
  const iconaDi = (cosa, voce, size, conAnteprima = false) => (cosa === 'cartella' ? <IconaCartellaW11 size={size} />
    : conAnteprima && conMiniatura(voce) ? <Miniatura doc={voce} size={size} /> : <IconaFileW11 tipo={tipoFile(voce)} size={Math.round(size * 0.93)} />);
  const DIM_ICONA = { grandi: 56, medie: 36, piccole: 16, riquadri: 44 };
  const tessera = (cosa, voce, grande) => {
    if (vista === 'riquadri' || vista === 'piccole') return tesseraLarga(cosa, voce);
    const st = statoElemento(cosa, voce);
    return (
      <div key={st.k} className={`esp-tessera${st.classi}`} role="listitem">
        <button type="button" className="esp-tessera-bottone" data-elemento data-bersaglio={st.chiave} data-chiave={st.k} title={st.nome} aria-label={st.cartella ? `Cartella ${st.nome}` : st.nome} aria-pressed={st.scelto} {...st.g}>
          {casella(st)}
          <span className="esp-tessera-icona">
            {iconaDi(cosa, voce, grande ? 56 : 36, true)}
            {st.cartella ? <Pallino n={st.n} /> : (st.n ? <span className="esp-pallino esp-pallino-punto" aria-label="Da gestire">!</span> : null)}
          </span>
          {!st.inRinomina && <span className="esp-tessera-nome">{st.etichetta}</span>}
        </button>
        {st.inRinomina && campoRinomina()}
      </div>
    );
  };
  // Riquadri (icona + nome + tipo + dimensione) e Icone piccole (icona 16 px + nome, su più colonne).
  const tesseraLarga = (cosa, voce) => {
    const st = statoElemento(cosa, voce);
    const riquadri = vista === 'riquadri';
    return (
      <div key={st.k} className={`esp-largo esp-largo-${vista}${st.classi}`} role="listitem">
        <button type="button" className="esp-largo-bottone" data-elemento data-bersaglio={st.chiave} data-chiave={st.k} title={st.nome} aria-label={st.cartella ? `Cartella ${st.nome}` : st.nome} aria-pressed={st.scelto} {...st.g}>
          {casella(st)}
          <span className="esp-largo-icona">{iconaDi(cosa, voce, DIM_ICONA[vista], riquadri)}</span>
          {st.inRinomina ? <span className="esp-largo-testo" /> : (
            <span className="esp-largo-testo"><strong>{st.etichetta}</strong>{riquadri && <small>{st.cartella ? 'Cartella di file' : [tipoLeggibile(voce), dimensioneLeggibile(voce.dimensione_byte)].filter(Boolean).join(' · ')}</small>}</span>
          )}
          {st.cartella ? <Pallino n={st.n} piccolo /> : (st.n ? <span className="esp-pallino piccolo">!</span> : null)}
        </button>
        {st.inRinomina && campoRinomina()}
      </div>
    );
  };
  const rigaElenco = (cosa, voce) => {
    const st = statoElemento(cosa, voce);
    const sotto = cosa === 'cartella' ? (voce.nelCestino ? 'Cartella eliminata' : voce.virtuale ? 'Categoria' : 'Cartella')
      : testoTrovato ? [nelNome(titoloDi(voce.id), testoTrovato) ? null : 'Trovato nel contenuto', `in ${doveSta(voce)}`].filter(Boolean).join(' · ')
        : [dataLeggibile(voce.creato_il).slice(0, 10), dimensioneLeggibile(voce.dimensione_byte)].filter(Boolean).join(' · ');
    return (
      <div key={st.k} className={`esp-riga${st.classi}`} role="listitem">
        <button type="button" className="esp-riga-bottone" data-elemento data-bersaglio={st.chiave} data-chiave={st.k} aria-label={st.cartella ? `Cartella ${st.nome}` : st.nome} aria-pressed={st.scelto} {...st.g}>
          {casella(st)}
          <span className="esp-riga-icona">{iconaDi(cosa, voce, 24)}</span>
          {st.inRinomina ? <span className="esp-riga-testo" /> : <span className="esp-riga-testo"><strong>{st.etichetta}</strong><small>{sotto}</small></span>}
          {st.cartella ? <Pallino n={st.n} piccolo /> : (st.n ? <span className="esp-pallino piccolo">!</span> : null)}
        </button>
        {st.inRinomina && campoRinomina()}
      </div>
    );
  };
  const nuovaInline = (classe) => (nuova && nuova.padre === nodo ? (
    <div className={classe} role="listitem">
      <span className="esp-tessera-icona"><IconaCartellaW11 size={vista === 'grandi' ? 56 : vista === 'medie' ? 36 : 24} /></span>
      <input className="esp-campo" autoFocus value={nuova.nome} onFocus={(e) => e.target.select()} onChange={(e) => setNuova({ ...nuova, nome: e.target.value })}
        onBlur={() => creaNuova(nuova.padre, nuova.nome)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setNuova(null); }} aria-label="Nome della nuova cartella" />
    </div>
  ) : null);
  const dettagli = () => {
    // Colonne visibili (clic destro sull'intestazione per sceglierle); su mobile Nome e Dimensione.
    const cols = COLONNE_DETTAGLI.filter(([k]) => (mobile ? k === 'nome' || k === 'dimensione' : colonneVisibili.includes(k)));
    const modello = cols.map(([k]) => (k === 'nome' ? `minmax(${Math.min(larghezze.nome, 160)}px, ${larghezze.nome}fr)` : `${larghezze[k]}px`)).join(' ');
    const cella = (r, k) => (k === 'data' ? dataLeggibile(r.data) : k === 'tipo' ? r.tipo : k === 'dimensione' ? dimensioneLeggibile(r.dimensione) : k === 'categoria' ? r.categoria : '');
    return (
      <div className="esp-dettagli" role="grid" aria-label="Dettagli" aria-rowcount={righe.length + 1} aria-multiselectable="true" style={{ '--esp-colonne-dettagli': mobile ? 'minmax(0,1fr) 92px' : modello }}>
        <div className="esp-dettagli-testa" role="row" onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setMenu({ cosa: 'colonne', sorgenti: [], x: e.clientX, y: e.clientY, titolo: 'Colonne' }); }}>
          {cols.map(([k, nome]) => (
            <div key={k} role="columnheader" aria-sort={ordine.chiave === k ? (ordine.verso === 'su' ? 'ascending' : 'descending') : 'none'} className="esp-dettagli-col">
              <button type="button" onClick={() => setOrdine((o) => ordinaSuColonna(o, k))}>{nome}{ordine.chiave === k && <span aria-hidden="true">{ordine.verso === 'su' ? ' ▲' : ' ▼'}</span>}</button>
              {!mobile && <span className="esp-ridimensiona" onPointerDown={ridimensiona(k)} aria-hidden="true" />}
            </div>
          ))}
        </div>
        {nuova && nuova.padre === nodo && <div className="esp-dettagli-riga esp-dettagli-nuova" role="row">{nuovaInline('esp-dettagli-cella-nuova')}</div>}
        {spazio(finestraV?.sopra, 'su')}
        {gruppi.map((g) => [
          g.titolo ? <div key={`g:${g.titolo}`} role="row" className="esp-gruppo-riga"><div role="gridcell" className="esp-gruppo-titolo">{g.titolo} <span>({g.righe.length})</span></div></div> : null,
          ...pezzo(g.righe).map((r) => {
            const st = statoElemento(r.cosa, r.voce);
            return (
              <div key={st.k} role="row" className={`esp-dettagli-riga${st.classi}`} data-elemento data-bersaglio={st.chiave} data-chiave={st.k} tabIndex={0} aria-selected={st.scelto} aria-label={st.cartella ? `Cartella ${st.nome}` : st.nome} {...st.g}>
                {cols.map(([k]) => (k === 'nome'
                  ? <div key={k} role="gridcell" className="esp-dettagli-nome">{casella(st)}<span className="esp-riga-icona">{iconaDi(r.cosa, r.voce, 20)}</span>{st.inRinomina ? campoRinomina() : <span className="esp-dettagli-testo">{st.etichetta}</span>}{st.cartella ? <Pallino n={st.n} piccolo /> : null}</div>
                  : <div key={k} role="gridcell" className={k === 'dimensione' ? 'esp-num' : undefined}>{cella(r, k)}</div>))}
              </div>
            );
          }),
        ])}
        {spazio(finestraV?.sotto, 'giu')}
      </div>
    );
  };

  if (!dati) return <div className="esp esp-carico"><span className="pp-rotella" /> Apro Esplora file…</div>;

  const briciole = percorsoNodo(nodo, nomi);
  const su = padreDi(cartelle, nodo);
  const puoNuova = !eVirtuale(nodo);
  const verbo = ctrlGiu && sorgentiPer(presa?.sorgente?.chiave || '').every((x) => x.tipo === 'doc') ? 'Copia in' : 'Sposta in';
  const tracciaSopra = presa ? (presa.bersaglio?.tipo === 'app' ? APP_PER_FILE[presa.bersaglio.id]
    : presa.bersaglio?.tipo === 'scheda' ? `${verbo} «${nomeNodo(nodoScheda(tabs.schede.find((t) => t.id === presa.bersaglio.id)), nomi)}»`
      : presa.bersaglio ? `${verbo} «${nomeNodo(destDi(presa.bersaglio), nomi)}»` : (presa.sorgente.tipo === 'cartella' ? nomeNodo(presa.sorgente.id, nomi) : titoloDi(presa.sorgente.id))) : null;
  const struttura = strutturaMenu();
  const cercando = datiCerca(nodo);
  const vuota = !caricando && !cartelleMostrate.length && !docMostrati.length && !preferitiMostrati.length && !nuova;
  const scelteSorgenti = [...scelti].map(sorgenteDi);
  const byteScelti = scelteSorgenti.reduce((t, x) => t + (x.tipo === 'doc' ? Number(cache.get(x.id)?.dimensione_byte) || 0 : 0), 0);
  const selRiquadro = (() => {
    const k = ancora && scelti.has(ancora) ? ancora : [...scelti][0];
    if (!k) return null;
    const x = sorgenteDi(k);
    return x.tipo === 'cartella' ? { cosa: 'cartella', voce: cartelle.find((c) => c.id === x.id) || { id: x.id, nome: nomeNodo(x.id, nomi) }, x } : cache.get(x.id) ? { cosa: 'file', voce: cache.get(x.id), x } : null;
  })();
  const dove = nomeNodo(baseRicerca, nomi);
  const campo = <CampoCerca inputRef={campoCerca} valore={testoCerca} mobile={mobile} dove={dove} onCambia={(t) => { setTestoCerca(t); cerca(t, { subito: false }); }} onCerca={(t) => cerca(t)} />;
  const selezioneMia = scelteSorgenti.length > 0 && scelteSorgenti.every((x) => x.tipo === 'doc' || (x.id !== RADICE && !eVirtuale(x.id)));
  const comandi = [
    { id: 'nuovo', nome: 'Nuovo', icona: 'nuova', testo: true, menu: 'nuovo' },
    '|',
    { id: 'taglia', nome: 'Taglia', titolo: 'Taglia (Ctrl+X)', disattivo: !selezioneMia, fai: () => azione('taglia', scelteSorgenti) },
    { id: 'copia', nome: 'Copia', titolo: 'Copia (Ctrl+C)', disattivo: !scelteSorgenti.some((x) => x.tipo === 'doc'), fai: () => azione('copia', scelteSorgenti) },
    { id: 'incolla', nome: 'Incolla', titolo: 'Incolla (Ctrl+V)', disattivo: !incolla(appunti, nodo, opz), fai: () => azione('incolla', []) },
    { id: 'rinomina', nome: 'Rinomina', titolo: 'Rinomina (F2)', disattivo: scelteSorgenti.length !== 1 || !selezioneMia, fai: () => azione('rinomina', scelteSorgenti) },
    { id: 'condividi', nome: 'Condividi', icona: 'condividi-sistema', disattivo: scelteSorgenti.length !== 1 || scelteSorgenti[0].tipo !== 'doc', fai: () => azione('cond:sistema', scelteSorgenti) },
    { id: 'elimina', nome: 'Elimina', titolo: 'Elimina (Canc)', disattivo: !selezioneMia || scelteSorgenti.some((x) => x.clinico), fai: () => azione('elimina', scelteSorgenti) },
    '|',
    { id: 'ordina', nome: 'Ordina', testo: true, menu: 'ordina' },
    { id: 'vista', nome: 'Visualizza', testo: true, menu: 'visualizza' },
    '|',
    { id: 'altro', nome: 'Altre azioni', menu: 'altro' },
  ];
  const ridimensionaPannello = (e) => { const x0 = e.clientX; const w0 = pannello.larghezza; trascina(e, (ev) => setPannello((p) => ({ ...p, larghezza: larghezzaPannello(w0 + ev.clientX - x0) }))); const su2 = () => { setPannello((p) => salvaPannello(p)); window.removeEventListener('pointerup', su2); }; window.addEventListener('pointerup', su2); };
  const swipe = { inizio: null };
  const sezioneElementi = (titolo, cartelleB, docsB, chiave) => (cartelleB.length || docsB.length ? (
    <div key={chiave} className="esp-blocco">
      {titolo && <h3 className="esp-blocco-titolo">{titolo}</h3>}
      {vista === 'elenco' ? (
        <div className="esp-elenco" role="list">{cartelleB.map((c) => rigaElenco('cartella', c))}{docsB.map((d) => rigaElenco('file', d))}</div>
      ) : (
        <div className={`esp-griglia esp-griglia-${vista === 'dettagli' ? 'medie' : vista}`} role="list">{cartelleB.map((c) => tessera('cartella', c, vista === 'grandi'))}{docsB.map((d) => tessera('file', d, vista === 'grandi'))}</div>
      )}
    </div>
  ) : null);

  return (
    <div ref={radiceRef} className={`esp esp-${disp}${presa ? ' trascinando' : ''}${mobile ? ' esp-mobile' : ''}${lavoro ? ' lavoro' : ''}${riquadro && !mobile ? ' con-riquadro' : ''}${basso ? ' esp-basso' : ''}`} style={{ '--esp-colonne': colonne }}
      onTouchStart={(e) => { const t = e.touches[0]; swipe.inizio = { x: t.clientX, y: t.clientY }; e.currentTarget.dataset.swx = t.clientX; e.currentTarget.dataset.swy = t.clientY; }}
      onTouchEnd={(e) => { const t = e.changedTouches[0]; const d = e.currentTarget.dataset; if (mobile && !presa && swipeApre({ x: Number(d.swx), y: Number(d.swy) }, { x: t.clientX, y: t.clientY })) setCassetto(true); }}
      // PR #337 §6: file trascinati dal computer dentro la finestra = caricamento su Drive (nella cartella sotto il puntatore).
      onDragOver={(e) => {
        if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
        e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
        const b = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-bersaglio^="cartella:"]');
        const dest = b ? (b.dataset.bersaglio.slice(9) || RADICE) : (eVirtuale(nodo) ? RADICE : nodo);
        setDropFile((x) => (x?.dest === dest ? x : { dest }));
      }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropFile(null); }}
      onDrop={(e) => {
        if (!e.dataTransfer?.files?.length) return;
        e.preventDefault();
        const dest = dropFile?.dest || (eVirtuale(nodo) ? RADICE : nodo);
        setDropFile(null);
        caricaQui([...e.dataTransfer.files], dest === 'radice' ? RADICE : dest);
      }}>
      <TitoloSchede schede={tabs.schede} attiva={tabs.attiva} mobile={mobile} sopra={sopra} lavoro={lavoro}
        nomeDi={(t) => nomeNodo(nodoScheda(t), nomi)} onScegli={scegliScheda} onNuova={() => apriScheda(HOME)} onChiudi={chiudiLaScheda}
        onSposta={(id, a) => setTabs((x) => ({ ...x, schede: spostaScheda(x.schede, id, a) }))} />
      <BarraIndirizzi briciole={briciole} nomi={nomi} cartelle={cartelle} nodo={nodo} sopra={sopra} mobile={mobile} cerca={!mobile || basso ? campo : null}
        puo={{ indietro: puoIndietro(scheda), avanti: puoAvanti(scheda), su }}
        onVai={vai} onIndietro={() => vaiStoria(indietroScheda)} onAvanti={() => vaiStoria(avantiScheda)} onSu={() => su && vai(su)} onAggiorna={() => setRinfresca((n) => n + 1)}
        onApriPannello={() => setCassetto(true)}
        onPercorso={(t) => { const n = nodoDaTesto(t, cartelle); if (!n) { mostraAvviso(`Percorso non trovato: ${t}`, { tipo: 'errore' }); return false; } vai(n); return true; }} />
      {mobile && !basso && <div className="esp-cerca-riga">{campo}</div>}
      <BarraComandi comandi={mobile ? comandi.filter((c) => c === '|' || ['nuovo', 'ordina', 'vista', 'altro'].includes(c.id) || (c.id === 'incolla' && appunti)).filter((c, i, l) => !(c === '|' && (i === 0 || l[i - 1] === '|'))) : comandi} mobile={mobile} onMenu={(cosa, x, y) => setMenu({ cosa, sorgenti: cosa === 'altro' ? scelteSorgenti : [], x, y, titolo: { nuovo: 'Nuovo', ordina: 'Ordina per', visualizza: 'Visualizza', altro: 'Altre azioni' }[cosa] })} />
      <div className="esp-corpo">
        {!mobile && !pannello.chiuso && (
          <>
            <aside className="esp-albero" ref={alberoRef} aria-label="Pannello di navigazione" style={{ width: pannello.larghezza }}>{albero}</aside>
            <div className="esp-maniglia-pannello" role="separator" aria-orientation="vertical" aria-label="Larghezza del pannello di navigazione" aria-valuenow={pannello.larghezza} aria-valuemin={160} aria-valuemax={420} tabIndex={0}
              onPointerDown={ridimensionaPannello} onDoubleClick={() => setPannello((p) => salvaPannello({ ...p, chiuso: true }))}
              onKeyDown={(e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setPannello((p) => salvaPannello({ ...p, larghezza: larghezzaPannello(p.larghezza + (e.key === 'ArrowLeft' ? -16 : 16)) })); } }} />
          </>
        )}
        {mobile && cassetto && (
          <div className="esp-velo esp-velo-cassetto" onClick={() => setCassetto(false)}>
            <aside className="esp-cassetto" ref={alberoRef} aria-label="Pannello di navigazione" onClick={(e) => e.stopPropagation()}>
              <div className="esp-cassetto-testa"><strong>Esplora file</strong><button type="button" className="esp-cmd" onClick={() => setCassetto(false)} aria-label="Chiudi il pannello">✕</button></div>
              {albero}
            </aside>
          </div>
        )}
        <section className={`esp-contenuto esp-vista-${vista}`} ref={contenutoRef} aria-label={nomeNodo(nodo, nomi)} {...gestoriVuoto}>
          {mobile && !basso && <header className="esp-intestazione"><strong>{nomeNodo(nodo, nomi)}</strong><span>{nElementi} {nElementi === 1 ? 'elemento' : 'elementi'}</span></header>}
          {cercando && <FiltriRicerca filtri={filtri} fascicoli={fascicoli} onFiltri={setFiltri} n={cartelleMostrate.length + docMostrati.length} testo={cercando.testo} base={nomeNodo(cercando.base, nomi)} />}
          {(nodo === DA_CATALOGARE || codiceCategoria(nodo)) && <p className="esp-nota">Sola lettura: trascina i file in una tua cartella.</p>}
          {nodo === CESTINO && <p className="esp-nota">Le cartelle eliminate restano qui: tasto destro (o tieni premuto) → Ripristina.</p>}
          {nodo === HOME ? (
            <div className="esp-home">
              {sezioneElementi('Accesso rapido', cartelleMostrate, [], 'rapido')}
              {sezioneElementi('Preferiti', [], preferitiMostrati, 'preferiti')}
              {sezioneElementi('Recenti', [], docMostrati, 'recenti')}
            </div>
          ) : vista === 'dettagli' ? dettagli() : gruppi.map((g, gi) => (
            <div key={`g:${g.titolo}`} className="esp-blocco">
              {g.titolo && <h3 className="esp-blocco-titolo">{g.titolo} <span>({g.righe.length})</span></h3>}
              {vista === 'elenco' ? (
                <div className="esp-elenco" role="list" aria-multiselectable="true">{gi === 0 && nuovaInline('esp-riga esp-riga-nuova')}{spazio(finestraV?.sopra, 'su')}{pezzo(g.righe).map((r) => rigaElenco(r.cosa, r.voce))}{spazio(finestraV?.sotto, 'giu')}</div>
              ) : (
                <div className={`esp-griglia esp-griglia-${vista}`} role="list" aria-multiselectable="true">{gi === 0 && nuovaInline('esp-tessera esp-tessera-nuova')}{spazio(finestraV?.sopra, 'su', true)}{pezzo(g.righe).map((r) => tessera(r.cosa, r.voce, vista === 'grandi'))}{spazio(finestraV?.sotto, 'giu', true)}</div>
              )}
            </div>
          ))}
          {vuota && <p className="esp-vuota">{cercando ? 'Nessun risultato. Prova con altre parole o togli i filtri.' : nodo === ACCESSO_RAPIDO ? 'Niente in Accesso rapido: dal menu di una cartella scegli «Aggiungi ad Accesso rapido».' : nodo === PREFERITI ? 'Nessun preferito: dal menu di un file scegli «Aggiungi ai Preferiti».' : nodo === RECENTI ? 'Nessun file aperto di recente.' : nodo === CESTINO ? 'Il Cestino è vuoto.' : eVirtuale(nodo) ? 'Niente qui.' : 'Cartella vuota. Tieni premuto (o tasto destro) per creare una nuova cartella.'}</p>}
          {lista?.nodo === nodo && !lista.finito && <button type="button" className="esp-altri" onClick={altri}>Mostra altri</button>}
        </section>
        {riquadro && !mobile && (
          <Riquadro modo={riquadro} voce={selRiquadro?.voce} cosa={selRiquadro?.cosa} titolo={selRiquadro ? (selRiquadro.cosa === 'cartella' ? selRiquadro.voce.nome : titoloDi(selRiquadro.voce.id)) : ''}
            categoria={fascicoli.find((f) => f.codice === selRiquadro?.voce?.fascicolo)?.nome} scadenze={scadenzeSel}
            percorso={selRiquadro ? percorsoNodo(selRiquadro.cosa === 'cartella' ? selRiquadro.voce.id : selRiquadro.x.da, nomi).map((p) => p.nome).join(' › ') : ''}
            onModo={setRiquadro} onChiudi={() => setRiquadro(null)} onApri={() => selRiquadro && apriElemento(chiaveDi(selRiquadro.cosa === 'cartella' ? 'cartella' : 'doc', selRiquadro.voce.id))} />
        )}
      </div>
      {riquadro && mobile && selRiquadro && (
        <Riquadro mobile modo={riquadro} voce={selRiquadro.voce} cosa={selRiquadro.cosa} titolo={selRiquadro.cosa === 'cartella' ? selRiquadro.voce.nome : titoloDi(selRiquadro.voce.id)}
          categoria={fascicoli.find((f) => f.codice === selRiquadro.voce.fascicolo)?.nome} scadenze={scadenzeSel}
          percorso={percorsoNodo(selRiquadro.cosa === 'cartella' ? selRiquadro.voce.id : selRiquadro.x.da, nomi).map((p) => p.nome).join(' › ')}
          onModo={setRiquadro} onChiudi={() => setRiquadro(null)} onApri={() => apriElemento(chiaveDi(selRiquadro.cosa === 'cartella' ? 'cartella' : 'doc', selRiquadro.voce.id))} />
      )}
      <BarraStato testo={testoStato(nElementi, nDaGestireQui)} selezione={[testoSelezione(scelti.size, byteScelti), appunti ? `${appunti.modo === 'copia' ? 'copiato' : 'tagliato'}: ${appunti.nome}` : ''].filter(Boolean).join(' · ')}
        vista={vista} onVista={(v) => setViste(salvaVista(nodo, v))} />

      {mobile && modoSelezione && (
        <div className="esp-barra-selezione" role="toolbar" aria-label="Elementi selezionati">
          <strong>{scelti.size} {scelti.size === 1 ? 'selezionato' : 'selezionati'}</strong>
          <button type="button" onClick={() => setFoglio({ tipo: 'sposta', sorgenti: scelteSorgenti })} disabled={!scelti.size}><IcoMenu id="sposta" size={18} /><span>Sposta</span></button>
          <button type="button" onClick={() => azione('elimina', scelteSorgenti)} disabled={!scelti.size || scelteSorgenti.some((s) => s.clinico)}><IcoMenu id="elimina" size={18} /><span>Elimina</span></button>
          <button type="button" onClick={() => scelti.size && apriMenu(scelteSorgenti[0].tipo === 'cartella' ? 'cartella' : 'file', scelteSorgenti, 0, 0)} disabled={!scelti.size} aria-label="Altre azioni"><span aria-hidden="true">⋯</span><span>Altro</span></button>
          <button type="button" onClick={() => { setScelti(new Set()); setModoSelezione(false); }}><span>Fine</span></button>
        </div>
      )}

      {presa && (
        <div className={`esp-fantasma${presa.bersaglio ? ' valido' : ''}${ctrlGiu ? ' copia' : ''}`} style={{ left: presa.x - origine().x, top: presa.y - origine().y }} aria-hidden="true">
          {scelti.size > 1 && scelti.has(presa.sorgente.chiave) && <span className="esp-fantasma-numero">{scelti.size}</span>}
          {ctrlGiu && <span className="esp-fantasma-piu">+</span>}{tracciaSopra}
        </div>
      )}
      {rettangolo && <div className="esp-rettangolo" style={{ left: rettangolo.left, top: rettangolo.top, width: rettangolo.right - rettangolo.left, height: rettangolo.bottom - rettangolo.top }} aria-hidden="true" />}
      {dropFile && <div className="esp-drop-file" aria-hidden="true"><strong>Carica su Drive in «{nomeNodo(dropFile.dest, nomi)}»</strong></div>}

      {menu && struttura && <MenuContestuale menu={{ ...menu, x: menu.x - origine().x, y: menu.y - origine().y }} struttura={struttura} mobile={mobile} schermo={origine().l ? { l: origine().l, a: origine().a } : schermo} onScegli={sceltaMenu} onChiudi={() => setMenu(null)} />}
      {scegliPer && (
        <div className="esp-scegli" role="region" aria-label={`Scegli per ${perNome}`}>
          <span>{documentiDa(scelteSorgenti).length ? `${documentiDa(scelteSorgenti).length} da aggiungere a ${perNome}` : `Seleziona i documenti per ${perNome}, oppure trascinali nella sua finestra`}</span>
          <button type="button" className="esp-scegli-annulla" onClick={() => chiudi?.()}>Annulla</button>
          <button type="button" className="esp-scegli-ok" disabled={!documentiDa(scelteSorgenti).length} onClick={() => { consegnaA(scegliPer, documentiDa(scelteSorgenti)); chiudi?.(); }}>Aggiungi</button>
        </div>
      )}

      {(foglio?.tipo === 'sposta' || foglio?.tipo === 'duplica') && (
        <FoglioSpostaIn disp={disp} titolo={foglio.tipo === 'duplica' ? 'Copia in…' : 'Sposta in…'}
          voci={foglio.tipo === 'duplica'
            ? vociSpostaIn([], opz).map((v) => ({ ...v, attuale: false, vietata: !operazioneAggiungi(foglio.sorgenti, v.id, opz) }))
            : vociSpostaIn(foglio.sorgenti, opz)}
          onChiudi={() => setFoglio(null)}
          onScegli={(dest) => { const f = foglio; setFoglio(null); if (f.tipo === 'duplica') aggiungiIn(f.sorgenti, dest); else sposta(f.sorgenti, dest); }} />
      )}
      {foglio?.tipo === 'elimina' && (
        <div className="esp-velo" onClick={() => setFoglio(null)}>
          <div className={`esp-dialogo esp-dialogo-${disp}`} role="alertdialog" aria-label="Elimina" onClick={(e) => e.stopPropagation()}>
            <h2>{foglio.sorgenti.length === 1 ? `Eliminare definitivamente «${titoloDi(foglio.sorgenti[0].id)}»?` : `Eliminare definitivamente ${foglio.sorgenti.length} documenti?`}</h2>
            <p>I documenti escono dall’archivio di Poliedra e non si ripristinano più da qui. I file restano nel Cestino di Google Drive per 30 giorni (Poliedra non li cancella mai da Drive). Per 5 secondi puoi annullare.</p>
            <div className="esp-dialogo-azioni">
              <button type="button" className="esp-bottone" onClick={() => setFoglio(null)}>Annulla</button>
              <button type="button" className="esp-bottone esp-bottone-rosso" autoFocus onClick={() => { const x = foglio.sorgenti; elimina(x); setCestino((c) => ({ ...c, docs: c.docs.filter((id) => !x.some((y) => y.id === id)) })); }}>Elimina definitivamente</button>
            </div>
          </div>
        </div>
      )}
      {foglio?.tipo === 'proprieta' && (
        <DialogoProprieta cosa={foglio.sorgente.tipo === 'cartella' ? 'cartella' : 'file'}
          voce={foglio.sorgente.tipo === 'cartella' ? cartelle.find((c) => c.id === foglio.sorgente.id) || { id: foglio.sorgente.id, nome: nomeNodo(foglio.sorgente.id, nomi) } : { ...cache.get(foglio.sorgente.id), titolo: titoloDi(foglio.sorgente.id) }}
          percorsoApp={foglio.sorgente.tipo === 'cartella' ? percorsoNodo(foglio.sorgente.id, nomi).map((p) => p.nome).join(' › ') : percorsoNodo(foglio.sorgente.da === DA_CATALOGARE || eVirtuale(foglio.sorgente.da) ? foglio.sorgente.da : foglio.sorgente.da, nomi).map((p) => p.nome).join(' › ')}
          onChiudi={() => setFoglio(null)} />
      )}
      {foglio?.tipo === 'accesso' && <DialogoAccesso doc={foglio.doc} titolo={titoloDi(foglio.doc.id)} onChiudi={() => setFoglio(null)} />}
      {foglio?.tipo === 'zip' && (
        <FoglioInvia nomeIniziale={foglio.nome} nCartelle={foglio.cartelleScelte.length} nDocumenti={foglio.documentiScelti.length} stato={statoZip} mostra={(t) => mostraAvviso(t)}
          onChiudi={() => setFoglio(null)}
          onPrepara={async ({ formato, nome, password, protezione }) => {
            setStatoZip({ fase: 'lavoro', fatti: 0, totale: 0 });
            try {
              const { voci, esclusi, cartelleVuote } = await preparaVoci(archivioDb, { cartelle, cartelleScelte: foglio.cartelleScelte, documentiScelti: foglio.documentiScelti });
              if (!voci.length) { setStatoZip({ fase: 'errore', messaggio: esclusi.length ? `Nessun file da comprimere (${esclusi.join(', ')}).` : 'Nessun documento.' }); return; }
              if (voci.length > MAX_FILE_ZIP) { setStatoZip({ fase: 'errore', messaggio: `Sono ${voci.length} file: al massimo ${MAX_FILE_ZIP} alla volta.` }); return; }
              const token = await tokenSessione();
              const { file, errori } = await scaricaFile(voci, (d) => preparaFile(d.drive_file_id, token).then(comeFile), (fatti, totale) => setStatoZip({ fase: 'lavoro', fatti, totale }));
              const files = formato === 'zip' ? [await creaZip({ nome, file, cartelleVuote, password, protezione })] : file.map((f) => f.file);
              setStatoZip({ fase: 'pronto', files, password: !!password, esclusi: [...esclusi, ...errori.map((e) => `${e} (non scaricato)`)] });
            } catch (e) { setStatoZip({ fase: 'errore', messaggio: e.message || String(e) }); }
          }} />
      )}
      {finestra && (
        <FinestraAnteprima doc={finestra.doc} tipo={finestra.tipo} titolo={titoloDi(finestra.doc.id)} stato={finestra.stato} elenco={finestra.elenco || []}
          onCambia={(d) => { const c = comeAprire(d); if (c.modo === 'anteprima') setFinestra((f) => ({ ...f, doc: d, tipo: c.tipo })); }}
          onStato={(s) => setFinestra((f) => ({ ...f, stato: s }))} onChiudi={() => setFinestra(null)}
          onApriScheda={() => { const id = finestra.doc.id; setFinestra(null); apri({ tipo: 'documento', id }); }} />
      )}
      <input ref={inputCarica} type="file" multiple hidden onChange={(e) => { const f = [...e.target.files]; e.target.value = ''; caricaQui(f); }} />
      {foglio?.tipo === 'app' && (
        <Finestra titolo={`Scegli app predefinita · .${(foglio.doc.nome_file_originale || '').split('.').pop() || 'file'}`} icona={<IconaFileW11 tipo={tipoFile(foglio.doc)} size={16} />} onChiudi={() => setFoglio(null)} classe="esp-finestra-piccola">
          <p className="esp-nota">Con cosa aprire questo tipo di file in Esplora (vale per tutti i dispositivi).</p>
          <SceltaAppPredefinite solo={estensioneDi(foglio.doc) || 'file'} onFatto={(m) => { setAppPredefinite(m); mostraAvviso('App predefinita salvata'); }} />
        </Finestra>
      )}
      <Avviso avviso={avviso} onChiudi={() => setAvviso(null)} />
    </div>
  );
}
