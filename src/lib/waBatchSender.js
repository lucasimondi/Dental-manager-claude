// Pianificazione/annullamento dell'invio WhatsApp di massa in Agenda.
// Estratto in un modulo puro (nessuno stato React) così la logica di
// cancellazione — che deve fermare solo gli invii non ancora partiti,
// senza poter richiudere una finestra WhatsApp già aperta — è verificabile
// con test automatici che controllano il tempo, senza dover montare il
// componente React.

// Pianifica un'apertura per ciascun elemento, distanziate di delayMs (i browser
// bloccano più popup aperti nello stesso istante da uno stesso click). Ritorna
// gli id dei timer così l'invio può essere annullato in ogni momento.
export function pianificaInvioWABatch(items, { delayMs = 350, apri, onInviato } = {}) {
  return items.map((item, i) => setTimeout(() => {
    apri(item, i);
    onInviato?.(item, i);
  }, i * delayMs));
}

// Ferma gli invii non ancora partiti. Le finestre WhatsApp già aperte non
// possono essere richiamate: clearTimeout agisce solo su ciò che non è
// ancora scattato.
export function annullaInvioWABatch(timerIds) {
  timerIds.forEach(clearTimeout);
}
