// SCAN-INDIETRO (PO 2026-11-24: «da quelle finestre che si aprono si deve poter tornare indietro»).
// Le finestre a tutto schermo (fotocamera, ritaglio, scelta da Poliedron) rispondono al gesto/tasto
// Indietro del telefono invece di far uscire dall'app: ognuna aggiunge un passo alla cronologia e
// solo l'ultima aperta lo riceve. onIndietro() restituisce true se la finestra resta aperta (es. è
// tornata alla cartella sopra): allora il passo viene rimesso.
import { useEffect, useRef } from 'react';

const pila = [];
let daIgnorare = 0;
let ascolta = false;
function alPop() {
  if (daIgnorare > 0) { daIgnorare -= 1; return; }
  const cima = pila[pila.length - 1]; if (!cima) return;
  // Tolto un passo di qualcun altro sopra il nostro (es. lo Start della barra): il nostro è ancora lì.
  if (history.state?.poliedraIndietro === cima.id) return;
  pila.pop(); cima.chiusa = true;
  if (cima.gestisci()) { cima.chiusa = false; pila.push(cima); history.pushState({ ...(history.state || {}), poliedraIndietro: cima.id }, ''); }
}

export function apriPasso(id, gestisci) {
  if (typeof window === 'undefined' || !window.history?.pushState) return () => {};
  if (!ascolta) { addEventListener('popstate', alPop); ascolta = true; }
  const voce = { id, gestisci, chiusa: false };
  pila.push(voce);
  history.pushState({ ...(history.state || {}), poliedraIndietro: id }, '');
  // Chiusa dall'interfaccia (✕, Fine…): si toglie il passo dalla cronologia senza richiamarla.
  return () => {
    if (voce.chiusa) return;
    voce.chiusa = true;
    const i = pila.indexOf(voce); if (i >= 0) pila.splice(i, 1);
    daIgnorare += 1; history.back();
  };
}

// onIndietro: () => boolean | void — chiude la finestra (o torna su di un livello e restituisce true
// per restare aperta). Si attiva quando `attivo` è vero.
export function useIndietro(attivo, onIndietro) {
  const rif = useRef(onIndietro); rif.current = onIndietro;
  useEffect(() => {
    if (!attivo) return undefined;
    return apriPasso(`${Date.now()}-${Math.random()}`, () => Boolean(rif.current?.()));
  }, [attivo]);
}
