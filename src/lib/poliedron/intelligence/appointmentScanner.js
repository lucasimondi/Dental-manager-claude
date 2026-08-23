import { patientKey } from './model.js';

const CANCELLED_STATUSES = new Set(['annullato', 'cancellato', 'cancelled']);

const validDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

export const isActiveAppointment = (appointment) => (
  !!appointment
  && validDate(appointment.data)
  && !CANCELLED_STATUSES.has(String(appointment.stato || '').toLowerCase())
);

export function buildAppointmentIndex(appointments, today) {
  const byPatient = new Map();
  for (const appointment of appointments) {
    if (!isActiveAppointment(appointment)) continue;
    const key = patientKey(appointment.pazienteId ?? appointment.patientId ?? appointment.paziente_id);
    if (!key) continue;
    const entry = byPatient.get(key) || { all: [], future: [] };
    entry.all.push(appointment);
    if (appointment.data >= today) entry.future.push(appointment);
    byPatient.set(key, entry);
  }
  for (const entry of byPatient.values()) {
    entry.future.sort((a, b) => a.data.localeCompare(b.data) || String(a.ora || '').localeCompare(String(b.ora || '')));
  }
  return byPatient;
}

export const hasFutureAppointment = (appointmentIndex, patientId) => (
  (appointmentIndex.get(patientKey(patientId))?.future?.length || 0) > 0
);

export function hasAppointmentNear(appointmentIndex, patientId, targetDate, windowDays = 20) {
  if (!validDate(targetDate)) return hasFutureAppointment(appointmentIndex, patientId);
  const target = new Date(`${targetDate}T12:00:00`).getTime();
  return (appointmentIndex.get(patientKey(patientId))?.all || []).some((appointment) => {
    const at = new Date(`${appointment.data}T12:00:00`).getTime();
    return Math.abs(at - target) <= windowDays * 86400000;
  });
}
