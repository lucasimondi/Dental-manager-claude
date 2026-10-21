import { computeFreeSlots } from './agendaSlots.js';

// Reuse the existing availability engine, including all records hidden by UI
// filters. Calendar visibility is never availability or authorization.
export function validatePatientAgendaSlot({ appointment, appointments, impegni, agendaSettings, today }) {
  if (!appointment?.pazienteId || !appointment.tipo?.trim()) throw new Error('Seleziona paziente e prestazione.');
  const duration = Number(appointment.durata);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 1440) throw new Error('Inserisci una durata valida.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(appointment.data || '') || appointment.data < today) throw new Error('Scegli una data da oggi in avanti.');
  const slots = computeFreeSlots({ data: appointment.data, durata: duration, operatoreId: appointment.operatoreId, appointments, impegni, agendaSettings });
  if (!slots.some(slot => slot.ora === appointment.ora)) throw new Error('Spazio non disponibile per tutta la durata: scegli un altro orario.');
  // The shared engine checks operators. Also protect a specifically chosen chair.
  const minutes = value => { const [h, m] = value.split(':').map(Number); return h * 60 + m; };
  const start = minutes(appointment.ora);
  if (appointment.poltronaId && appointments.some(row => row.data === appointment.data && row.stato !== 'annullato' && String(row.poltronaId) === String(appointment.poltronaId) && start < minutes(row.ora) + Number(row.durata) && minutes(row.ora) < start + duration)) throw new Error('La postazione è occupata in questo intervallo.');
  return { ...appointment, tipo: appointment.tipo.trim(), durata: duration };
}

export async function persistPatientAgendaBooking({ appointment, db, agendaSettings, today }) {
  // Read again just before writing. DB keeps the existing authenticated tenant
  // mapping/RLS; no optimistic success or second sync-setter insert.
  const [appointments, impegni] = await Promise.all([
    db.getAll('dm_a', { throwOnError: true }),
    db.getAll('dm_ip', { throwOnError: true }),
  ]);
  const validated = validatePatientAgendaSlot({ appointment, appointments, impegni, agendaSettings, today });
  return db.insert('dm_a', validated);
}
