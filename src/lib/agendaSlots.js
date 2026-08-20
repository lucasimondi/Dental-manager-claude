/* POL-UX-001 — real free-slot computation for the Quick Booking modal.
   Derives candidate slots strictly from the same authoritative agenda data
   Agenda.jsx already reads (appointments, impegni, agenda_settings) — no
   invented availability. A slot is free when it does not overlap an
   existing appointment for the same operatore (or any appointment, if no
   operatore is selected/multi_operatore is off) and does not overlap a
   studio-wide impegno block for that day. */

const toMin = (hhmm) => {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const toHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

const rangesOverlap = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

/**
 * @param {object} p
 * @param {string} p.data - YYYY-MM-DD
 * @param {number} p.durata - minutes requested
 * @param {string|null} p.operatoreId - restrict to this operatore's real availability, if provided
 * @param {Array} p.appointments - real appointment records ({data, ora, durata, operatoreId, stato})
 * @param {Array} p.impegni - real impegni records ({dataInizio, dataFine, tuttoIlGiorno, oraInizio, oraFine})
 * @param {object} p.agendaSettings - {oraInizio, oraFine, slotMin} from studio's real agenda_settings
 * @returns {Array<{ora: string}>} candidate free start times, in order
 */
export function computeFreeSlots({ data, durata, operatoreId, appointments = [], impegni = [], agendaSettings = {} }) {
  const oraInizio = Number(agendaSettings.oraInizio ?? 8);
  const oraFine = Number(agendaSettings.oraFine ?? 20);
  const slotMin = Number(agendaSettings.slotMin ?? 30);
  const durataMin = Math.max(Number(durata) || slotMin, slotMin);

  const dayAppointments = appointments.filter((a) => a.data === data && a.stato !== 'annullato'
    && (!operatoreId || String(a.operatoreId || '') === String(operatoreId)));
  const dayImpegni = impegni.filter((imp) => data >= imp.dataInizio && data <= imp.dataFine);
  const fullDayBlocked = dayImpegni.some((imp) => imp.tuttoIlGiorno);
  if (fullDayBlocked) return [];

  const busyRanges = [
    ...dayAppointments.map((a) => { const start = toMin(a.ora); return [start, start + (Number(a.durata) || slotMin)]; }),
    ...dayImpegni.filter((imp) => !imp.tuttoIlGiorno && imp.oraInizio).map((imp) => [toMin(imp.oraInizio), toMin(imp.oraFine || imp.oraInizio)]),
  ];

  const dayStart = oraInizio * 60;
  const dayEnd = oraFine * 60;
  const now = new Date();
  const isToday = data === now.toISOString().slice(0, 10);
  const nowMin = isToday ? now.getHours() * 60 + now.getMinutes() : -1;

  const slots = [];
  for (let start = dayStart; start + durataMin <= dayEnd; start += slotMin) {
    if (isToday && start < nowMin) continue;
    const end = start + durataMin;
    const conflict = busyRanges.some(([bStart, bEnd]) => rangesOverlap(start, end, bStart, bEnd));
    if (!conflict) slots.push({ ora: toHHMM(start) });
  }
  return slots;
}
