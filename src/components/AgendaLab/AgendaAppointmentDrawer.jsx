import React, { useEffect, useState } from 'react';
import { Btn, Fld, Inp, Modal, Sel } from '../ui';
import {
  agendaStatusLabel,
  agendaStatusOptions,
  combineLocalDateTime,
  toLocalDateValue,
  toLocalTimeValue,
} from './demoAgendaData';

const EMPTY_FORM = {
  patientName: '', treatment: '', date: '', startTime: '', endTime: '',
  status: 'confirmed', practitioner: 'Dott.ssa Demo',
};

const formFromEvent = (event) => ({
  patientName: event?.extendedProps?.patientName || event?.title || '',
  treatment: event?.extendedProps?.treatment || '',
  date: toLocalDateValue(event.start),
  startTime: toLocalTimeValue(event.start),
  endTime: toLocalTimeValue(event.end),
  status: event?.extendedProps?.status || 'confirmed',
  practitioner: event?.extendedProps?.practitioner || 'Dott.ssa Demo',
});

export default function AgendaAppointmentDrawer({
  state, onClose, onSave, onEdit,
}) {
  const [form, setForm] = useState(() => (state ? formFromEvent(state.event) : EMPTY_FORM));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!state) return;
    setForm(formFromEvent(state.event));
    setError('');
  }, [state]);

  if (state.mode === 'detail') {
    const event = state.event;
    return (
      <Modal title="Dettaglio appuntamento demo" icon="cal" onClose={onClose}>
        <div className="agenda-drawer__detail">
          <span className={`agenda-drawer__status status-${event.extendedProps.status}`}>
            {agendaStatusLabel(event.extendedProps.status)}
          </span>
          <h2>{event.extendedProps.patientName}</h2>
          <p>{event.extendedProps.treatment}</p>
          <dl>
            <div><dt>Data</dt><dd>{new Intl.DateTimeFormat('it-IT', { dateStyle: 'full' }).format(event.start)}</dd></div>
            <div><dt>Orario</dt><dd>{toLocalTimeValue(event.start)} – {toLocalTimeValue(event.end)}</dd></div>
            <div><dt>Professionista</dt><dd>{event.extendedProps.practitioner}</dd></div>
          </dl>
          <div className="agenda-drawer__actions">
            <Btn ch="Chiudi" v="sec" onClick={onClose} />
            <Btn ch="Modifica" ic="edit" onClick={() => onEdit(event)} />
          </div>
        </div>
      </Modal>
    );
  }

  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const submit = () => {
    const start = combineLocalDateTime(form.date, form.startTime);
    const end = combineLocalDateTime(form.date, form.endTime);
    if (!form.patientName.trim() || !form.treatment.trim()) {
      setError('Inserisci paziente e prestazione.');
      return;
    }
    if (new Date(end) <= new Date(start)) {
      setError("L'orario di fine deve essere successivo all'inizio.");
      return;
    }
    onSave({
      id: state.event.id,
      title: form.patientName.trim(),
      start,
      end,
      extendedProps: {
        patientName: form.patientName.trim(),
        treatment: form.treatment.trim(),
        status: form.status,
        practitioner: form.practitioner,
      },
    });
  };

  return (
    <Modal title={state.mode === 'create' ? 'Nuovo appuntamento demo' : 'Modifica appuntamento demo'} icon="cal" onClose={onClose}>
      <form className="agenda-drawer__form" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <Fld label="Paziente demo">
          <Inp value={form.patientName} onChange={(event) => setField('patientName', event.target.value)} placeholder="DEMO · Nome paziente" autoFocus />
        </Fld>
        <Fld label="Prestazione">
          <Inp value={form.treatment} onChange={(event) => setField('treatment', event.target.value)} placeholder="Prestazione demo" />
        </Fld>
        <Fld label="Data">
          <Inp type="date" value={form.date} onChange={(event) => setField('date', event.target.value)} />
        </Fld>
        <div className="agenda-drawer__time-grid">
          <Fld label="Ora inizio">
            <Inp type="time" step="900" value={form.startTime} onChange={(event) => setField('startTime', event.target.value)} />
          </Fld>
          <Fld label="Ora fine">
            <Inp type="time" step="900" value={form.endTime} onChange={(event) => setField('endTime', event.target.value)} />
          </Fld>
        </div>
        <Fld label="Stato">
          <Sel value={form.status} onChange={(event) => setField('status', event.target.value)}>
            {agendaStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Sel>
        </Fld>
        {error && <p className="agenda-drawer__error" role="alert">{error}</p>}
        <div className="agenda-drawer__actions">
          <Btn ch="Annulla" v="sec" onClick={onClose} />
          <button type="submit" className="agenda-drawer__submit">Salva in locale</button>
        </div>
      </form>
    </Modal>
  );
}
