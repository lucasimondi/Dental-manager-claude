// PO 2026-11-09: opzione «Nascondi domenica» nella vista Settimana, ricordata su questo dispositivo.
// null = nessuna scelta (Studio segue i giorni di chiusura configurati, Personal mostra la domenica).
const CHIAVE = 'agenda_nascondi_domenica';

export function leggiDomenicaNascosta(storage = globalThis.localStorage) {
  try {
    const v = storage?.getItem(CHIAVE);
    return v === '1' ? true : v === '0' ? false : null;
  } catch { return null; }
}

export function salvaDomenicaNascosta(valore, storage = globalThis.localStorage) {
  try { storage?.setItem(CHIAVE, valore ? '1' : '0'); } catch { /* facoltativo: resta la scelta della sessione */ }
}

// Applica la scelta ai giorni nascosti (0 = domenica). Le domeniche con appuntamenti o impegni
// ricompaiono comunque, perché i chiamanti passano il risultato a keepOccupiedWeekends.
export function applicaDomenica(hidden, scelta) {
  if (scelta === true) return [...new Set([...hidden, 0])];
  if (scelta === false) return hidden.filter(d => Number(d) !== 0);
  return hidden;
}
