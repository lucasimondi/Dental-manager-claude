const STATUS_OPTIONS = [
  { value: 'confirmed', label: 'Confermato' },
  { value: 'pending', label: 'Da confermare' },
  { value: 'waiting', label: 'In attesa' },
  { value: 'completed', label: 'Completato' },
  { value: 'cancelled', label: 'Cancellato' },
  { value: 'no-show', label: 'No-show' },
];

const atLocalTime = (baseDate, dayOffset, hour, minute = 0) => {
  const value = new Date(baseDate);
  value.setHours(hour, minute, 0, 0);
  value.setDate(value.getDate() + dayOffset);
  return value.toISOString();
};

const event = (baseDate, {
  id, dayOffset, hour, minute = 0, duration, patientName, treatment, status, practitioner,
}) => ({
  id,
  title: patientName,
  start: atLocalTime(baseDate, dayOffset, hour, minute),
  end: atLocalTime(baseDate, dayOffset, hour, minute + duration),
  extendedProps: { patientName, treatment, status, practitioner },
});

export const createDemoAgendaEvents = (baseDate = new Date()) => [
  event(baseDate, {
    id: 'demo-yesterday-completed', dayOffset: -1, hour: 9, duration: 60,
    patientName: 'DEMO · Giulia Ferri', treatment: 'Valutazione fisioterapica',
    status: 'completed', practitioner: 'Dott.ssa Demo',
  }),
  event(baseDate, {
    id: 'demo-yesterday-no-show', dayOffset: -1, hour: 11, minute: 30, duration: 30,
    patientName: 'DEMO · Paolo Greco', treatment: 'Igiene dentale',
    status: 'no-show', practitioner: 'Dott. Demo',
  }),
  event(baseDate, {
    id: 'demo-today-short', dayOffset: 0, hour: 8, minute: 45, duration: 15,
    patientName: 'DEMO · Anna Riva', treatment: 'Controllo',
    status: 'confirmed', practitioner: 'Dott.ssa Demo',
  }),
  event(baseDate, {
    id: 'demo-today-confirmed', dayOffset: 0, hour: 9, minute: 30, duration: 60,
    patientName: 'DEMO · Mario Rossi', treatment: 'Implantologia',
    status: 'confirmed', practitioner: 'Dott. Demo',
  }),
  event(baseDate, {
    id: 'demo-today-overlap-a', dayOffset: 0, hour: 11, duration: 30,
    patientName: 'DEMO · Laura Bianchi', treatment: 'Igiene',
    status: 'pending', practitioner: 'Dott.ssa Demo',
  }),
  event(baseDate, {
    id: 'demo-today-overlap-b', dayOffset: 0, hour: 11, duration: 60,
    patientName: 'DEMO · Elisa Neri', treatment: 'Seduta fisioterapica',
    status: 'waiting', practitioner: 'Dott. Demo',
  }),
  event(baseDate, {
    id: 'demo-today-overlap-c', dayOffset: 0, hour: 11, minute: 15, duration: 30,
    patientName: 'DEMO · Luca Conti', treatment: 'Prima visita',
    status: 'confirmed', practitioner: 'Dott.ssa Demo',
  }),
  event(baseDate, {
    id: 'demo-today-long', dayOffset: 0, hour: 14, duration: 120,
    patientName: 'DEMO · Sara Moretti', treatment: 'Riabilitazione completa',
    status: 'waiting', practitioner: 'Dott.ssa Demo',
  }),
  event(baseDate, {
    id: 'demo-tomorrow-pending', dayOffset: 1, hour: 10, duration: 30,
    patientName: 'DEMO · Davide Sala', treatment: 'Visita di controllo',
    status: 'pending', practitioner: 'Dott. Demo',
  }),
  event(baseDate, {
    id: 'demo-tomorrow-cancelled', dayOffset: 1, hour: 12, duration: 60,
    patientName: 'DEMO · Marta Galli', treatment: 'Terapia manuale',
    status: 'cancelled', practitioner: 'Dott.ssa Demo',
  }),
];

export const agendaStatusOptions = STATUS_OPTIONS;

export const agendaStatusLabel = (status) => (
  STATUS_OPTIONS.find((option) => option.value === status)?.label || status
);

export const toLocalDateValue = (value) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const toLocalTimeValue = (value) => {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

export const combineLocalDateTime = (date, time) => new Date(`${date}T${time}:00`).toISOString();

