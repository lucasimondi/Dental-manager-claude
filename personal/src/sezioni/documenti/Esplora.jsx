// PERSONAL-ESPLORA-WIN11 fase 1 — Esplora file stile Windows 11 (spec: docs/architecture/personal-esplora-win11.md).
// Orizzontale: albero a sinistra, contenuto di fianco. Verticale: albero in alto (divisorio trascinabile),
// contenuto sotto. Tocco = apri; pressione prolungata = trascina (se muovi il dito) o menu (se lasci);
// mouse: trascinamento immediato e tasto destro. Ogni spostamento/eliminazione ha «Annulla».
// Logica pura in lib/esplora.js; spostamenti con le funzioni di lib/cartelleMie.js (RPC sposta_documenti_mie).
// Fase 2: dopo ogni operazione riuscita, Drive si allinea subito (allineaDrive, in coda); se Drive non
// risponde compare «Su Drive lo sistemo al prossimo giro» e lo script recupera da solo.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { aggiornaDocumento, cestinaSuDrive, eliminaDocumenti } from '../../lib/archivio.js';
import { eliminaConDrive } from '../../lib/eliminazioneSwipe.js';
import {
  caricaCartelleMie, creaCartella, rinominaCartella, spostaCartelle, archiviaCartelle, documentiDellaCartella, documentiScrivania,
  aggiungiDocumenti, togliDocumenti, aggiungiAScrivania, togliDaScrivania, spostaDocumenti,
} from '../../lib/cartelleMie.js';
import {
  RADICE, DA_CATALOGARE, CATEGORIE, CLINICO, nodoCategoria, codiceCategoria, eVirtuale, disposizione, colonneGriglia, altezzaAlbero,
  sottocartelle, padreDi, nomeNodo, percorsoNodo, antenati, categorieVisibili, documentiNelNodo, catalogati, calcolaPallini,
  etichettaPallino, testoStato, destinazioneValida, vociSpostaIn, operazioneSposta, inversa, applica, eseguiOperazione,
  taglia, incolla, nomeNuovaCartella, vociMenu, posizioneMenu, tipoFile, caricaPosizioni, caricaDaGestire, contaDaCatalogare,
  paginaDaCatalogare, paginaCategoria, allineaDrive,
} from '../../lib/esplora.js';
import { titoloDoc, tokenSessione } from '../../ui.jsx';
import { useTrascina } from './Trascina.jsx';
import './esplora.css';

const API = { spostaCartelle, spostaDocumenti, aggiungiDocumenti, togliDocumenti, aggiungiAScrivania, togliDaScrivania, archiviaCartelle, rinominaCartella, aggiornaDocumento };
const DURATA_ANNULLA = 4500;
const PRESSIONE_MS = 450;

/* ---------- icone (dal prototipo) ---------- */
export function IconaCartellaW11({ size = 48 }) {
  return (
    <svg className="esp-svg-cartella" viewBox="0 0 96 80" width={size} height={size * 80 / 96} aria-hidden="true">
      <path d="M6 10a6 6 0 0 1 6-6h22l8 8h42a6 6 0 0 1 6 6v50a6 6 0 0 1-6 6H12a6 6 0 0 1-6-6z" fill="#E0A21B" />
      <rect x="14" y="16" width="68" height="40" rx="3" fill="#fff" />
      <path d="M4 28a6 6 0 0 1 6-6h76a6 6 0 0 1 6 6v40a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6z" fill="#FFC83D" />
    </svg>
  );
}
const COLORI_FILE = { pdf: '#C42B1C', immagine: '#0E700E', office: '#0F6CBD', email: '#5C5C5C', altro: '#8A8A8A' };
const SIGLE_FILE = { pdf: 'PDF', immagine: 'IMG', office: 'DOC', email: 'MAIL', altro: '' };
export function IconaFileW11({ tipo = 'altro', size = 48 }) {
  return (
    <svg className="esp-svg-file" viewBox="0 0 64 80" width={size * 0.8} height={size} aria-hidden="true">
      <path d="M8 2h34l20 20v52a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4z" fill="#fff" stroke="#C8C8C8" strokeWidth="2" />
      <path d="M42 2v16a4 4 0 0 0 4 4h16" fill="#EDEDED" stroke="#C8C8C8" strokeWidth="2" />
      <rect x="4" y="50" width="58" height="16" fill={COLORI_FILE[tipo]} />
      {SIGLE_FILE[tipo] && <text x="33" y="62" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily="Segoe UI, system-ui, sans-serif">{SIGLE_FILE[tipo]}</text>}
    </svg>
  );
}
const Pallino = ({ n, piccolo = false }) => {
  const t = etichettaPallino(n);
  return t ? <span className={`esp-pallino${piccolo ? ' piccolo' : ''}`} aria-label={`${n} da gestire`}>{t}</span> : null;
};
const Freccia = ({ aperta }) => <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" style={{ transform: aperta ? 'rotate(90deg)' : 'none' }}><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const IcoLinea = ({ d }) => <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d={d} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const ICONE_MENU = {
  apri: 'M3 6h5l2 2h7v8H3z', nuova: 'M3 6h5l2 2h7v8H3zM10 10v4M8 12h4', taglia: 'M6 14a2 2 0 1 0 0 .01M14 14a2 2 0 1 0 0 .01M7.5 12.5L15 4M12.5 12.5L5 4',
  sposta: 'M3 10h12M11 6l4 4-4 4', rinomina: 'M4 16h3l9-9-3-3-9 9zM12 5l3 3', elimina: 'M5 6h10M8 6V4h4v2M6 6l1 10h6l1-10',
  incolla: 'M7 4h6v3H7zM5 5H4v12h12V5h-1', aggiorna: 'M15 10a5 5 0 1 1-1.5-3.5M15 4v3h-3',
};

/* ---------- Esplora ---------- */
export function PaginaEsplora({ ctx, iniziale = RADICE }) {
  const { apri, fascicoli = [] } = ctx;
  const [dati, setDati] = useState(null); // { cartelle, posizioni, titoli }
  const [daGestire, setDaGestire] = useState(new Map());
  const [nDaCatalogare, setNDaCatalogare] = useState(0);
  const [nodo, setNodo] = useState(iniziale);
  const [aperti, setAperti] = useState(() => new Set([RADICE]));
  const [cache, setCache] = useState(() => new Map()); // id documento → documento
  const [lista, setLista] = useState(null); // cartelle virtuali: { nodo, documenti, prossimo, finito }
  const [caricando, setCaricando] = useState(false);
  const [menu, setMenu] = useState(null); // { cosa, voce, x, y }
  const [foglio, setFoglio] = useState(null); // { tipo: 'sposta'|'elimina', sorgenti, voce }
  const [avviso, setAvviso] = useState(null); // { testo, annulla }
  const [appunti, setAppunti] = useState(null);
  const [nuova, setNuova] = useState(null); // { padre, nome }
  const [rinomina, setRinomina] = useState(null); // { cosa, id, nome }
  const [nascosti, setNascosti] = useState(() => new Set()); // documenti in eliminazione (Annulla possibile)
  const [rinfresca, setRinfresca] = useState(0);
  const [schermo, setSchermo] = useState(() => ({ l: window.innerWidth, a: window.innerHeight }));
  const [altezza, setAltezza] = useState(300);
  const alberoRef = useRef(null);
  const contenutoRef = useRef(null);
  const timerAvviso = useRef(null);
  const cambiato = useRef(false);
  const ultimoTocco = useRef(0);
  const codaDrive = useRef(Promise.resolve()); // le chiamate a Drive una dopo l'altra (anche con Annulla)

  const disp = disposizione(schermo.l, schermo.a);
  const colonne = colonneGriglia(disp);
  const cartelle = dati?.cartelle || [];
  const posizioni = dati?.posizioni || [];
  const opz = useMemo(() => ({ cartelle, posizioni }), [cartelle, posizioni]);
  const pallini = useMemo(() => calcolaPallini({ cartelle, posizioni, daGestire, nDaCatalogare, fascicoli }), [cartelle, posizioni, daGestire, nDaCatalogare, fascicoli]);
  const nomi = { cartelle, fascicoli };

  useEffect(() => {
    const r = () => setSchermo({ l: window.innerWidth, a: window.innerHeight });
    window.addEventListener('resize', r);
    window.addEventListener('orientationchange', r);
    return () => { window.removeEventListener('resize', r); window.removeEventListener('orientationchange', r); };
  }, []);
  // Chiudendo Esplora le altre viste si aggiornano.
  useEffect(() => () => { if (cambiato.current) ctx.aggiorna?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const mostraAvviso = useCallback((testo, annulla = null) => {
    clearTimeout(timerAvviso.current);
    setAvviso({ testo, annulla });
    timerAvviso.current = setTimeout(() => setAvviso(null), annulla ? DURATA_ANNULLA : 2600);
  }, []);
  useEffect(() => () => clearTimeout(timerAvviso.current), []);

  const metti = (docs) => setCache((c) => { const n = new Map(c); for (const d of docs) n.set(d.id, d); return n; });

  // Albero, posizioni, pallini.
  useEffect(() => {
    let vivo = true;
    setCaricando(true);
    (async () => {
      try {
        const [c, p, g] = await Promise.all([caricaCartelleMie(archivioDb, { ancheArchiviate: false }), caricaPosizioni(archivioDb), caricaDaGestire(archivioDb).catch(() => new Map())]);
        if (!vivo) return;
        setDati({ cartelle: c, posizioni: p.posizioni, titoli: {} });
        setDaGestire(g);
        contaDaCatalogare(archivioDb, p.fascicoloDi).then((n) => vivo && setNDaCatalogare(n)).catch(() => {});
      } catch (e) { if (vivo) { setDati((d) => d || { cartelle: [], posizioni: [], titoli: {} }); mostraAvviso(`Non riesco a leggere le cartelle: ${e.message}`); } }
      finally { if (vivo) setCaricando(false); }
    })();
    return () => { vivo = false; };
  }, [rinfresca, mostraAvviso]);

  // Contenuto del nodo aperto.
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
        } else if (nodo !== CATEGORIE) {
          const docs = nodo === RADICE ? await documentiScrivania(archivioDb) : await documentiDellaCartella(archivioDb, nodo);
          if (vivo) metti(docs);
        }
      } catch (e) { if (vivo) mostraAvviso(`Non riesco ad aprire la cartella: ${e.message}`); }
    })();
    return () => { vivo = false; };
  }, [nodo, !!dati, rinfresca]); // eslint-disable-line react-hooks/exhaustive-deps

  const altri = async () => {
    if (!lista || lista.finito) return;
    const r = nodo === DA_CATALOGARE
      ? await paginaDaCatalogare(archivioDb, { esclusi: catalogati(posizioni), da: lista.prossimo })
      : await paginaCategoria(archivioDb, codiceCategoria(nodo), { da: lista.prossimo });
    metti(r.documenti);
    setLista((l) => ({ ...l, documenti: [...l.documenti, ...r.documenti.map((d) => d.id).filter((id) => !l.documenti.includes(id))], prossimo: r.prossimo, finito: r.finito }));
  };

  const vai = (n) => {
    setMenu(null); setNuova(null); setRinomina(null);
    setNodo(n);
    setAperti((a) => new Set([...a, ...antenati(n, nomi)]));
    contenutoRef.current?.scrollTo?.(0, 0);
  };
  // Se la cartella aperta sparisce (archiviata, annullata la creazione) si torna su.
  useEffect(() => {
    if (!dati || nodo === RADICE || eVirtuale(nodo)) return;
    if (!cartelle.some((c) => c.id === nodo && !c.archiviata_il)) setNodo(RADICE);
  }, [dati, cartelle, nodo]);

  /* ---------- operazioni (ottimistiche, con Annulla) ---------- */
  const fai = useCallback(async (op, messaggio, annullabile = true) => {
    if (!op) return false;
    setDati((d) => applica(d, op));
    try {
      await eseguiOperazione(archivioDb, op, API);
    } catch (e) {
      setDati((d) => applica(d, inversa(op)));
      mostraAvviso(`Non riuscito: ${e.message}`);
      return false;
    }
    cambiato.current = true;
    const annulla = annullabile ? () => fai(inversa(op), 'Annullato', false) : null;
    if (messaggio) mostraAvviso(messaggio, annulla);
    suDrive(op, messaggio, annulla);
    return true;
  }, [mostraAvviso]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drive allineato subito, senza far aspettare il dito; se non riesce lo dice e lo script recupera.
  function suDrive(op, messaggio, annulla) {
    codaDrive.current = codaDrive.current.then(async () => {
      const { problemi } = await allineaDrive(archivioDb, op, { token: await tokenSessione().catch(() => null) });
      if (problemi) mostraAvviso(`${messaggio ? `${messaggio} · ` : ''}Su Drive lo sistemo al prossimo giro`, annulla);
    }).catch(() => {});
  }

  const sposta = (sorgenti, dest) => {
    const op = operazioneSposta(sorgenti, dest, opz);
    if (!op) return;
    const n = sorgenti.length;
    fai(op, `${n === 1 ? 'Spostato' : `${n} elementi spostati`} in «${nomeNodo(dest, nomi)}»`);
  };

  const creaNuova = async (padre, nome) => {
    setNuova(null);
    const n = String(nome || '').trim();
    if (!n) return;
    try {
      const c = await creaCartella(archivioDb, { nome: n, padre_id: padre === RADICE ? null : padre });
      const op = { tipo: 'crea', id: c.id, nome: c.nome, padre };
      setDati((d) => applica(d, op));
      cambiato.current = true;
      const annulla = () => fai(inversa(op), 'Annullato', false);
      mostraAvviso(`Cartella «${c.nome}» creata`, annulla);
      suDrive(op, `Cartella «${c.nome}» creata`, annulla);
    } catch (e) { mostraAvviso(`Cartella non creata: ${e.message}`); }
  };
  const iniziaNuova = (padre) => {
    setMenu(null);
    if (padre !== nodo) vai(padre);
    const esistenti = sottocartelle(cartelle, padre).map((c) => c.nome);
    setNuova({ padre, nome: nomeNuovaCartella(esistenti) });
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

  // Elimina un documento: conferma, poi Annulla per 4,5 s; solo dopo Drive (Cestino) e archivio.
  const eliminaDocumento = (doc) => {
    setFoglio(null);
    setNascosti((s) => new Set([...s, doc.id]));
    let annullato = false;
    const timer = setTimeout(async () => {
      if (annullato) return;
      try {
        const token = await tokenSessione();
        await eliminaConDrive([doc], { cestina: (ids) => cestinaSuDrive({ token, ids }), elimina: (ids) => eliminaDocumenti(archivioDb, ids) });
        cambiato.current = true;
        setDati((d) => ({ ...d, posizioni: d.posizioni.filter((p) => p.doc !== doc.id) }));
        setLista((l) => (l ? { ...l, documenti: l.documenti.filter((id) => id !== doc.id) } : l));
      } catch (e) {
        setNascosti((s) => { const n = new Set(s); n.delete(doc.id); return n; });
        mostraAvviso(`Non eliminato: ${e.message}`);
      }
    }, DURATA_ANNULLA);
    mostraAvviso(`«${titoloDi(doc.id)}» eliminato: il file va nel Cestino di Drive`, () => {
      annullato = true; clearTimeout(timer);
      setNascosti((s) => { const n = new Set(s); n.delete(doc.id); return n; });
      mostraAvviso('Annullato');
    });
  };

  /* ---------- elementi mostrati ---------- */
  const titoloDi = (id) => dati?.titoli?.[id] ?? titoloDoc(cache.get(id));
  const docMostrati = (() => {
    if (!dati) return [];
    let ids;
    if (nodo === DA_CATALOGARE) { const dentro = catalogati(posizioni); ids = (lista?.nodo === nodo ? lista.documenti : []).filter((id) => !dentro.has(id)); }
    else if (codiceCategoria(nodo)) ids = lista?.nodo === nodo ? lista.documenti : [];
    else if (nodo === CATEGORIE) ids = [];
    else ids = documentiNelNodo(posizioni, nodo);
    return ids.filter((id) => cache.has(id) && !nascosti.has(id)).map((id) => cache.get(id));
  })();
  const cartelleMostrate = nodo === CATEGORIE
    ? categorieVisibili(fascicoli).map((f) => ({ id: nodoCategoria(f.codice), nome: f.nome, virtuale: true }))
    : eVirtuale(nodo) ? [] : sottocartelle(cartelle, nodo);
  const nElementi = nodo === DA_CATALOGARE ? nDaCatalogare : cartelleMostrate.length + docMostrati.length;
  const nDaGestireQui = nodo === DA_CATALOGARE
    ? [...daGestire.keys()].filter((id) => !catalogati(posizioni).has(id)).length
    : (pallini.get(nodo) || 0);

  /* ---------- trascinamento ---------- */
  const destDi = (b) => (b?.tipo === 'cartella' ? (b.id ?? RADICE) : null);
  const { presa, gestori, eraTrascinamento } = useTrascina({
    valido: (s, b) => { const d = destDi(b); return !!d && destinazioneValida([s], d, opz); },
    onLascia: (s, b) => sposta([s], destDi(b)),
    onFermo: (s, punto) => apriMenu(s.tipo === 'cartella' ? 'cartella' : 'file', s, punto.x, punto.y),
    scorrevoli: () => [alberoRef.current, contenutoRef.current],
  });
  const sopra = presa?.bersaglio?.chiave;
  // Gestori di un elemento: trascina / menu (tasto destro). Sul tocco il menu lo apre la pressione prolungata.
  const conGestori = (sorgente, cosa) => ({
    ...gestori(sorgente),
    onTouchStart: (e) => { ultimoTocco.current = Date.now(); gestori(sorgente).onTouchStart(e); },
    onContextMenu: (e) => {
      e.preventDefault(); e.stopPropagation();
      if (Date.now() - ultimoTocco.current < 1500) return;
      apriMenu(cosa, sorgente, e.clientX, e.clientY);
    },
  });
  const soloMenu = (sorgente, cosa) => {
    let t = null; let p = null;
    return {
      onTouchStart: (e) => { ultimoTocco.current = Date.now(); const x = e.touches[0]; p = { x: x.clientX, y: x.clientY }; clearTimeout(t); t = setTimeout(() => { navigator.vibrate?.(15); apriMenu(cosa, sorgente, p.x, p.y); }, PRESSIONE_MS); },
      onTouchMove: (e) => { const x = e.touches[0]; if (p && Math.hypot(x.clientX - p.x, x.clientY - p.y) > 10) clearTimeout(t); },
      onTouchEnd: () => clearTimeout(t),
      onContextMenu: (e) => { e.preventDefault(); e.stopPropagation(); if (Date.now() - ultimoTocco.current < 1500) return; apriMenu(cosa, sorgente, e.clientX, e.clientY); },
    };
  };

  /* ---------- menu ---------- */
  // Al rilascio del dito il telefono genera un «click» proprio dove si apre il menu: per un attimo lo ignoriamo.
  function apriMenu(cosa, voce, x, y) { setMenu({ cosa, voce, x, y, aperto: Date.now() }); }
  const appenaAperto = () => !!menu && Date.now() - menu.aperto < 450;
  // Pressione prolungata sullo spazio vuoto: menu con Nuova cartella · Incolla · Aggiorna.
  const vuoto = useRef({ t: null, p: null });
  const gestoriVuoto = {
    onTouchStart: (e) => {
      ultimoTocco.current = Date.now();
      if (e.target.closest('[data-elemento]')) return;
      const x = e.touches[0];
      vuoto.current.p = { x: x.clientX, y: x.clientY };
      clearTimeout(vuoto.current.t);
      vuoto.current.t = setTimeout(() => { navigator.vibrate?.(15); apriMenu('vuoto', null, vuoto.current.p.x, vuoto.current.p.y); }, PRESSIONE_MS);
    },
    onTouchMove: (e) => { const x = e.touches[0]; const p = vuoto.current.p; if (p && Math.hypot(x.clientX - p.x, x.clientY - p.y) > 10) clearTimeout(vuoto.current.t); },
    onTouchEnd: () => clearTimeout(vuoto.current.t),
    onContextMenu: (e) => {
      if (e.target.closest('[data-elemento]')) return;
      e.preventDefault();
      if (Date.now() - ultimoTocco.current < 1500) return;
      apriMenu('vuoto', null, e.clientX, e.clientY);
    },
  };

  const sceltaMenu = (id) => {
    if (appenaAperto()) return;
    const m = menu;
    setMenu(null);
    if (!m) return;
    const v = m.voce;
    if (m.cosa === 'vuoto') {
      if (id === 'nuova') iniziaNuova(nodo);
      if (id === 'incolla') { const op = incolla(appunti, nodo, opz); if (op) { setAppunti(null); fai(op, `Spostato in «${nomeNodo(nodo, nomi)}»`); } }
      if (id === 'aggiorna') setRinfresca((n) => n + 1);
      return;
    }
    if (m.cosa === 'cartella') {
      if (id === 'apri') vai(v.id);
      if (id === 'nuova') iniziaNuova(v.id);
      if (id === 'taglia') { setAppunti(taglia([v], nomeNodo(v.id, nomi))); mostraAvviso(`«${nomeNodo(v.id, nomi)}» tagliata: tieni premuto in una cartella e scegli Incolla`); }
      if (id === 'sposta') setFoglio({ tipo: 'sposta', sorgenti: [v] });
      if (id === 'rinomina') { if (padreDi(cartelle, v.id) !== nodo) setAperti((a) => new Set([...a, ...antenati(v.id, nomi)])); setRinomina({ cosa: 'cartella', id: v.id, nome: nomeNodo(v.id, nomi) }); }
      if (id === 'elimina') {
        const op = { tipo: 'archivia', ids: [v.id] };
        fai(op, `«${nomeNodo(v.id, nomi)}» archiviata (si può ripristinare)`);
      }
      return;
    }
    // file
    const doc = cache.get(v.id);
    if (id === 'apri') apri({ tipo: 'documento', id: v.id });
    if (id === 'taglia') { setAppunti(taglia([v], titoloDi(v.id))); mostraAvviso(`«${titoloDi(v.id)}» tagliato: tieni premuto in una cartella e scegli Incolla`); }
    if (id === 'sposta') setFoglio({ tipo: 'sposta', sorgenti: [v] });
    if (id === 'rinomina') setRinomina({ cosa: 'doc', id: v.id, nome: titoloDi(v.id) });
    if (id === 'elimina' && doc) setFoglio({ tipo: 'elimina', voce: doc });
  };

  const voci = menu ? vociMenu(menu.cosa, {
    nodo: menu.cosa === 'vuoto' ? nodo : menu.voce?.id, appunti, opz,
    clinico: menu.cosa === 'file' && cache.get(menu.voce?.id)?.fascicolo === CLINICO,
  }) : [];
  const posMenu = menu ? posizioneMenu(menu.x, menu.y, 232, voci.length * 44 + 12, schermo.l, schermo.a) : null;

  /* ---------- divisorio (verticale) ---------- */
  const trascinaDivisorio = (e) => {
    e.preventDefault();
    const y0 = e.clientY; const h0 = altezzaAlbero(altezza, schermo.a);
    const muovi = (ev) => setAltezza(altezzaAlbero(h0 + (ev.clientY - y0), schermo.a));
    const fine = () => { window.removeEventListener('pointermove', muovi); window.removeEventListener('pointerup', fine); window.removeEventListener('pointercancel', fine); };
    window.addEventListener('pointermove', muovi);
    window.addEventListener('pointerup', fine);
    window.addEventListener('pointercancel', fine);
  };

  /* ---------- albero ---------- */
  const tocca = (fn) => () => { if (eraTrascinamento()) return; fn(); };
  const apriChiudi = (id) => setAperti((a) => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const rigaAlbero = ({ id, nome, livello, figli, trascinabile = false, bersaglio = false }) => {
    const aperto = aperti.has(id);
    const chiave = bersaglio ? `cartella:${id}` : undefined;
    const sorgente = { tipo: 'cartella', id, da: padreDi(cartelle, id) };
    const g = trascinabile ? conGestori(sorgente, 'cartella') : soloMenu({ tipo: 'cartella', id }, 'cartella');
    const inRinomina = rinomina?.cosa === 'cartella' && rinomina.id === id;
    return (
      <li key={id} role="treeitem" aria-expanded={figli ? aperto : undefined} aria-selected={nodo === id}>
        <div className={`esp-albero-riga${nodo === id ? ' attiva' : ''}${chiave && sopra === chiave ? ' sopra' : ''}${presa?.sorgente?.id === id ? ' presa' : ''}`} style={{ paddingLeft: 6 + livello * 14 }}>
          <button type="button" className="esp-albero-freccia" onClick={() => apriChiudi(id)} aria-label={aperto ? `Chiudi ${nome}` : `Apri ${nome}`} tabIndex={figli ? 0 : -1} style={{ visibility: figli ? 'visible' : 'hidden' }}><Freccia aperta={aperto} /></button>
          {inRinomina
            ? <input className="esp-campo" autoFocus value={rinomina.nome} onFocus={(e) => e.target.select()} onChange={(e) => setRinomina({ ...rinomina, nome: e.target.value })} onBlur={confermaRinomina} onKeyDown={(e) => { if (e.key === 'Enter') confermaRinomina(); if (e.key === 'Escape') setRinomina(null); }} aria-label="Nuovo nome" />
            : (
              <button type="button" className="esp-albero-nome" data-elemento data-bersaglio={chiave} onClick={tocca(() => vai(id))} {...g}>
                <IconaCartellaW11 size={18} /><span>{nome}</span><Pallino n={pallini.get(id)} piccolo />
              </button>
            )}
        </div>
        {figli && aperto && <ul role="group">{figli}</ul>}
      </li>
    );
  };
  const ramo = (padre, livello) => sottocartelle(cartelle, padre).map((c) => {
    const sotto = sottocartelle(cartelle, c.id).length ? ramo(c.id, livello + 1) : null;
    return rigaAlbero({ id: c.id, nome: c.nome, livello, figli: sotto, trascinabile: true, bersaglio: true });
  });
  const albero = (
    <ul className="esp-albero-lista" role="tree" aria-label="Cartelle">
      {rigaAlbero({ id: RADICE, nome: 'Personale', livello: 0, figli: sottocartelle(cartelle, RADICE).length ? ramo(RADICE, 1) : null, bersaglio: true })}
      {rigaAlbero({ id: DA_CATALOGARE, nome: 'Da catalogare', livello: 0, figli: null })}
      {rigaAlbero({ id: CATEGORIE, nome: 'Per categoria', livello: 0, figli: categorieVisibili(fascicoli).map((f) => rigaAlbero({ id: nodoCategoria(f.codice), nome: f.nome, livello: 1, figli: null })) })}
    </ul>
  );

  /* ---------- griglia ---------- */
  const tessera = (cosa, voce) => {
    const cartella = cosa === 'cartella';
    const id = voce.id;
    const mia = cartella && !voce.virtuale;
    const chiave = mia ? `cartella:${id}` : undefined;
    const sorgente = { tipo: cartella ? 'cartella' : 'doc', id, da: nodo };
    const g = cartella && voce.virtuale ? soloMenu({ tipo: 'cartella', id }, 'cartella') : conGestori(sorgente, cartella ? 'cartella' : 'file');
    const inRinomina = rinomina && rinomina.id === id && rinomina.cosa === (cartella ? 'cartella' : 'doc');
    const nome = cartella ? voce.nome : titoloDi(id);
    const n = cartella ? pallini.get(id) : (daGestire.has(id) ? 1 : 0);
    const tagliato = appunti?.sorgenti?.some((s) => s.id === id);
    return (
      <div key={voce.id} className={`esp-tessera${chiave && sopra === chiave ? ' sopra' : ''}${presa?.sorgente?.id === id ? ' presa' : ''}${tagliato ? ' tagliata' : ''}`} role="listitem">
        <button type="button" className="esp-tessera-bottone" data-elemento data-bersaglio={chiave} title={nome}
          aria-label={cartella ? `Cartella ${nome}` : nome}
          onClick={tocca(() => (cartella ? vai(id) : apri({ tipo: 'documento', id })))} {...g}>
          <span className="esp-tessera-icona">
            {cartella ? <IconaCartellaW11 size={56} /> : <IconaFileW11 tipo={tipoFile(voce)} size={52} />}
            {cartella ? <Pallino n={n} /> : (n ? <span className="esp-pallino esp-pallino-punto" aria-label="Da gestire">!</span> : null)}
          </span>
          {!inRinomina && <span className="esp-tessera-nome">{nome}</span>}
        </button>
        {inRinomina && <input className="esp-campo" autoFocus value={rinomina.nome} onFocus={(e) => e.target.select()} onChange={(e) => setRinomina({ ...rinomina, nome: e.target.value })} onBlur={confermaRinomina} onKeyDown={(e) => { if (e.key === 'Enter') confermaRinomina(); if (e.key === 'Escape') setRinomina(null); }} aria-label="Nuovo nome" />}
      </div>
    );
  };

  if (!dati) return <div className="esp esp-carico"><span className="pp-rotella" /> Apro Esplora file…</div>;

  const briciole = percorsoNodo(nodo, nomi);
  const su = padreDi(cartelle, nodo);
  const puoNuova = !eVirtuale(nodo);
  const tracciaSopra = presa ? (presa.bersaglio ? `Sposta in «${nomeNodo(destDi(presa.bersaglio), nomi)}»` : (presa.sorgente.tipo === 'cartella' ? nomeNodo(presa.sorgente.id, nomi) : titoloDi(presa.sorgente.id))) : null;

  return (
    <div className={`esp esp-${disp}${presa ? ' trascinando' : ''}`} style={{ '--esp-colonne': colonne, '--esp-albero-h': `${altezzaAlbero(altezza, schermo.a)}px` }}>
      <div className="esp-titolo"><IconaCartellaW11 size={16} /><span>Esplora file</span></div>
      <div className="esp-comandi" role="toolbar" aria-label="Comandi">
        <button type="button" className="esp-cmd" onClick={() => su && vai(su)} disabled={!su} aria-label="Cartella superiore" title="Cartella superiore"
          data-bersaglio={su && !eVirtuale(su) ? `cartella:${su}` : undefined}>
          <IcoLinea d="M10 15V5M5 10l5-5 5 5" />
        </button>
        <nav className="esp-percorso" aria-label="Percorso">
          {briciole.map((b, i) => (
            <span key={b.id} className="esp-percorso-pezzo">
              {i > 0 && <span className="esp-percorso-sep" aria-hidden="true">›</span>}
              <button type="button" onClick={() => vai(b.id)} aria-current={i === briciole.length - 1 ? 'page' : undefined}
                data-bersaglio={i < briciole.length - 1 && !eVirtuale(b.id) ? `cartella:${b.id}` : undefined}
                className={sopra === `cartella:${b.id}` ? 'sopra' : ''}>{b.nome}</button>
            </span>
          ))}
        </nav>
        <button type="button" className="esp-cmd esp-cmd-testo" onClick={() => iniziaNuova(nodo)} disabled={!puoNuova} aria-label="Nuova cartella" title="Nuova cartella">
          <IcoLinea d={ICONE_MENU.nuova} /><span>Nuova cartella</span>
        </button>
      </div>
      <div className="esp-corpo">
        <aside className="esp-albero" ref={alberoRef} aria-label="Elenco cartelle">{albero}</aside>
        {disp === 'verticale' && <div className="esp-divisorio" role="separator" aria-orientation="horizontal" aria-label="Cambia l’altezza dell’elenco cartelle" onPointerDown={trascinaDivisorio}><span /></div>}
        <section className="esp-contenuto" ref={contenutoRef} aria-label={nomeNodo(nodo, nomi)} {...gestoriVuoto}>
          {disp === 'verticale' && (
            <header className="esp-intestazione"><strong>{nomeNodo(nodo, nomi)}</strong><span>{nElementi} {nElementi === 1 ? 'elemento' : 'elementi'}</span></header>
          )}
          {eVirtuale(nodo) && nodo !== CATEGORIE && <p className="esp-nota">Sola lettura: trascina i file in una tua cartella.</p>}
          <div className="esp-griglia" role="list">
            {nuova && nuova.padre === nodo && (
              <div className="esp-tessera esp-tessera-nuova" role="listitem">
                <span className="esp-tessera-icona"><IconaCartellaW11 size={56} /></span>
                <input className="esp-campo" autoFocus value={nuova.nome} onFocus={(e) => e.target.select()} onChange={(e) => setNuova({ ...nuova, nome: e.target.value })}
                  onBlur={() => creaNuova(nuova.padre, nuova.nome)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setNuova(null); }} aria-label="Nome della nuova cartella" />
              </div>
            )}
            {cartelleMostrate.map((c) => tessera('cartella', c))}
            {docMostrati.map((d) => tessera('file', d))}
          </div>
          {!caricando && !cartelleMostrate.length && !docMostrati.length && !nuova && <p className="esp-vuota">{eVirtuale(nodo) ? 'Niente qui.' : 'Cartella vuota. Tieni premuto per creare una nuova cartella.'}</p>}
          {lista?.nodo === nodo && !lista.finito && <button type="button" className="esp-altri" onClick={altri}>Mostra altri</button>}
        </section>
      </div>
      <footer className="esp-stato">{testoStato(nElementi, nDaGestireQui)}{appunti ? ` · tagliato: ${appunti.nome}` : ''}</footer>

      {presa && <div className={`esp-fantasma${presa.bersaglio ? ' valido' : ''}`} style={{ left: presa.x, top: presa.y }} aria-hidden="true">{tracciaSopra}</div>}

      {menu && (
        <div className="esp-velo-menu" onClick={() => { if (!appenaAperto()) setMenu(null); }} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }}>
          <div className="esp-menu" role="menu" style={posMenu} onClick={(e) => e.stopPropagation()}>
            {voci.map((v) => (
              <button key={v.id} type="button" role="menuitem" className="esp-menu-voce" disabled={!v.attiva} onClick={() => sceltaMenu(v.id)}>
                <IcoLinea d={ICONE_MENU[v.id] || ICONE_MENU.apri} /><span>{v.nome}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {foglio?.tipo === 'sposta' && (
        <FoglioSpostaIn disp={disp} voci={vociSpostaIn(foglio.sorgenti, opz)} onChiudi={() => setFoglio(null)}
          onScegli={(dest) => { const s = foglio.sorgenti; setFoglio(null); sposta(s, dest); }} />
      )}
      {foglio?.tipo === 'elimina' && (
        <div className="esp-velo" onClick={() => setFoglio(null)}>
          <div className={`esp-dialogo esp-dialogo-${disp}`} role="alertdialog" aria-label="Elimina" onClick={(e) => e.stopPropagation()}>
            <h2>Eliminare «{titoloDi(foglio.voce.id)}»?</h2>
            <p>Il documento esce dall’archivio e il file va nel Cestino di Google Drive (si recupera da lì per 30 giorni).</p>
            <div className="esp-dialogo-azioni">
              <button type="button" className="esp-bottone" onClick={() => setFoglio(null)}>Annulla</button>
              <button type="button" className="esp-bottone esp-bottone-rosso" onClick={() => eliminaDocumento(foglio.voce)}>Elimina</button>
            </div>
          </div>
        </div>
      )}

      {avviso && (
        <div className="esp-avviso" role="status">
          <span>{avviso.testo}</span>
          {avviso.annulla && <button type="button" onClick={() => { const a = avviso.annulla; setAvviso(null); a(); }}>Annulla</button>}
        </div>
      )}
    </div>
  );
}

// «Sposta in…»: albero completo, vietate in grigio, quella attuale con «attuale».
// In verticale si apre dal basso, in orizzontale come finestra di dialogo.
function FoglioSpostaIn({ disp, voci, onScegli, onChiudi }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onChiudi(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onChiudi]);
  return (
    <div className="esp-velo" onClick={onChiudi}>
      <div className={`esp-dialogo esp-dialogo-${disp} esp-sposta`} role="dialog" aria-label="Sposta in" onClick={(e) => e.stopPropagation()}>
        <h2>Sposta in…</h2>
        <ul className="esp-sposta-lista">
          {voci.map((v) => (
            <li key={v.id}>
              <button type="button" disabled={v.vietata} onClick={() => onScegli(v.id)} style={{ paddingLeft: 12 + v.livello * 16 }}>
                <IconaCartellaW11 size={18} /><span>{v.nome}</span>{v.attuale && <em>attuale</em>}
              </button>
            </li>
          ))}
        </ul>
        <div className="esp-dialogo-azioni"><button type="button" className="esp-bottone" onClick={onChiudi}>Annulla</button></div>
      </div>
    </div>
  );
}
