// SCAN-INDIETRO (PO 2026-11-24: «da quelle finestre che si aprono si deve poter tornare indietro»).
// Le finestre a tutto schermo (fotocamera, ritaglio, scelta da Poliedron, finestre del desktop)
// rispondono al gesto/tasto Indietro del telefono invece di far uscire dall'app. Solo l'ultima aperta
// lo riceve. onIndietro() restituisce true se la finestra resta aperta (es. è tornata alla cartella
// sopra, o ci sono altre finestre): allora l'Indietro si «riarma».
// Un solo passo nella cronologia per tutta la pila (non uno per finestra): chiudere le finestre in
// qualsiasi ordine non fa mai uscire dalla pagina (prima un passo di troppo lasciava la pagina bianca).
import { useEffect, useRef } from 'react';

const MARCA = 'poliedraIndietro';
const pila = [];
let daIgnorare = 0;
let ascolta = false;
const nostro = () => Boolean(window.history.state?.[MARCA]);
function arma() { if (!nostro()) history.pushState({ ...(history.state || {}), [MARCA]: true }, ''); }
function alPop() {
  if (daIgnorare > 0) { daIgnorare -= 1; return; }
  // Tolto un passo di qualcun altro sopra il nostro (es. lo Start della barra): il nostro è ancora lì.
  if (nostro()) return;
  const cima = pila.pop(); if (!cima) return;
  cima.chiusa = true;
  if (cima.gestisci()) { cima.chiusa = false; pila.push(cima); }
  if (pila.length) arma();
}

export function apriPasso(gestisci) {
  if (typeof window === 'undefined' || !window.history?.pushState) return () => {};
  if (!ascolta) { addEventListener('popstate', alPop); ascolta = true; }
  const voce = { gestisci, chiusa: false };
  pila.push(voce); arma();
  // Chiusa dall'interfaccia (✕, Fine…): via dalla pila; se era l'ultima si toglie anche il passo.
  return () => {
    if (voce.chiusa) return;
    voce.chiusa = true;
    const i = pila.indexOf(voce); if (i >= 0) pila.splice(i, 1);
    if (!pila.length && nostro()) { daIgnorare += 1; history.back(); }
  };
}

// onIndietro: () => boolean | void — chiude la finestra (o torna su di un livello e restituisce true
// per restare aperta). Si attiva quando `attivo` è vero.
export function useIndietro(attivo, onIndietro) {
  const rif = useRef(onIndietro); rif.current = onIndietro;
  useEffect(() => {
    if (!attivo) return undefined;
    return apriPasso(() => Boolean(rif.current?.()));
  }, [attivo]);
}
