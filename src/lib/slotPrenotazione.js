// Calcolo degli slot orari liberi per la prenotazione online diretta.
// Dato un tipo di appuntamento (con la sua durata, i giorni e la fascia
// oraria abilitati) e l'elenco degli slot già occupati, genera la lista
// di orari realmente prenotabili in un intervallo di date.

const minutiDaOra = (ora) => {
  const [h, m] = (ora || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const oraDaMinuti = (min) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/**
 * Genera gli slot per un singolo giorno, dato il tipo (con durata/fascia
 * oraria propria) e gli intervalli già occupati in quel giorno.
 * occupati: array di { ora, durata } — durata in minuti.
 */
export function slotLiberiGiorno(tipo, occupatiDelGiorno) {
  const durata = tipo.durata || 30;
  const inizioMin = minutiDaOra(tipo.online_ora_inizio || '09:00');
  const fineMin = minutiDaOra(tipo.online_ora_fine || '18:00');
  if (fineMin <= inizioMin || durata <= 0) return [];

  // Intervalli occupati come [inizio, fine) in minuti, per un controllo
  // di sovrapposizione semplice O(n) per slot.
  const occupati = (occupatiDelGiorno || []).map(o => {
    const ini = minutiDaOra(o.ora);
    return [ini, ini + (o.durata || 30)];
  });

  const slot = [];
  for (let t = inizioMin; t + durata <= fineMin; t += durata) {
    const finoASlot = t + durata;
    const sovrapposto = occupati.some(([oIni, oFine]) => t < oFine && finoASlot > oIni);
    if (!sovrapposto) slot.push(oraDaMinuti(t));
  }
  return slot;
}

/**
 * Genera gli slot liberi per un tipo di appuntamento su un range di
 * giorni (a partire da domani, escludendo i giorni non abilitati per
 * quel tipo). occupatiPerData: { 'YYYY-MM-DD': [{ora, durata}, ...] }.
 * Ritorna { 'YYYY-MM-DD': ['09:00', '09:30', ...] }, solo per i giorni
 * che hanno almeno uno slot libero.
 */
export function slotLiberiRange(tipo, dataInizio, giorniAvanti, occupatiPerData) {
  const risultato = {};
  const giorniAbilitati = new Set(tipo.online_giorni || [1, 2, 3, 4, 5]);
  for (let i = 0; i < giorniAvanti; i++) {
    const d = new Date(dataInizio);
    d.setDate(d.getDate() + i);
    if (!giorniAbilitati.has(d.getDay())) continue;
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const slot = slotLiberiGiorno(tipo, occupatiPerData[iso]);
    if (slot.length > 0) risultato[iso] = slot;
  }
  return risultato;
}
