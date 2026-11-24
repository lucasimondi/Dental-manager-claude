// PERSONAL-FINESTRE: i fogli a tutto schermo (gestore PDF, fotocamera, documento intero, scelte) si
// aprono dentro la finestra che li ha chiamati, non sopra tutto il desktop: la barra resta visibile e
// la finestra si può ridurre o chiudere. Fuori da una finestra (app Scan da sola) restano su <body>.
import { createContext, useContext, useEffect, useRef } from 'react';

export const FinestraCtx = createContext(null); // { chiave, corpo: Element | null }
export const usePortale = () => useContext(FinestraCtx)?.corpo || (typeof document !== 'undefined' ? document.body : null);
export const useInFinestra = () => Boolean(useContext(FinestraCtx));
export const useChiaveFinestra = () => useContext(FinestraCtx)?.chiave ?? null;
// Coordinate dello schermo → coordinate dentro la finestra (gli elementi `position: fixed` dentro una
// finestra sono relativi al suo corpo, che ha una trasformazione).
export function nellaFinestra(el, x, y) {
  const corpo = el?.closest?.('.pf-corpo');
  if (!corpo) return { x, y };
  const r = corpo.getBoundingClientRect();
  return { x: x - r.left, y: y - r.top };
}

// PERSONAL-FINESTRE: documenti dell'archivio consegnati a una finestra (trascinati da Esplora sulla
// finestra, oppure scelti in Esplora aperto «per» quella finestra). La finestra li riceve come File
// (scaricati dal Drive dell'utente con la sessione esistente; i clinici non arrivano mai qui).
export const EVENTO_DOCUMENTI = 'poliedra:documenti-in-finestra';
export const consegnaDocumenti = (finestra, documenti) => window.dispatchEvent(new CustomEvent(EVENTO_DOCUMENTI, { detail: { finestra: String(finestra), documenti } }));
export function useDocumentiInFinestra(onDocumenti, attivo = true) {
  const fin = useContext(FinestraCtx);
  const rif = useRef(onDocumenti); rif.current = onDocumenti;
  useEffect(() => {
    if (!fin || !attivo) return undefined;
    const ricevi = (e) => { if (e.detail?.finestra === String(fin.chiave) && e.detail.documenti?.length) rif.current(e.detail.documenti); };
    window.addEventListener(EVENTO_DOCUMENTI, ricevi);
    return () => window.removeEventListener(EVENTO_DOCUMENTI, ricevi);
  }, [fin?.chiave, attivo]); // eslint-disable-line react-hooks/exhaustive-deps
  return fin?.chiave ?? null;
}
