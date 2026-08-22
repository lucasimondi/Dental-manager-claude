import React, { useCallback, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import { Toast } from '../ui';
import { useTheme } from '../../lib/useTheme';
import AgendaAppointmentDrawer from './AgendaAppointmentDrawer';
import AgendaEventContent from './AgendaEventContent';
import MobileAgendaHeader from './MobileAgendaHeader';
import { createDemoAgendaEvents } from './demoAgendaData';
import '../../styles/designTokens.css';
import '../PremiumVisualSystem.css';
import './agendaLab.css';

const SWIPE_THRESHOLD = 60;

const isSameLocalDay = (left, right) => (
  left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate()
);

const scrollTimeFor = (date) => {
  if (!isSameLocalDay(date, new Date())) return '08:00:00';
  const hour = Math.max(7, new Date().getHours() - 1);
  return `${String(hour).padStart(2, '0')}:00:00`;
};

const calendarEventSnapshot = (event) => ({
  id: event.id,
  title: event.title,
  start: event.start,
  end: event.end,
  extendedProps: { ...event.extendedProps },
});

export default function AgendaLab() {
  const { theme, toggleTheme } = useTheme();
  const calendarRef = useRef(null);
  const touchStart = useRef(null);
  const gestureBlocked = useRef(false);
  const interactionActive = useRef(false);
  const initialDate = useMemo(() => new Date(), []);
  const [events, setEvents] = useState(() => createDemoAgendaEvents(initialDate));
  const [visibleDate, setVisibleDate] = useState(initialDate);
  const [drawer, setDrawer] = useState(null);
  const [toast, setToast] = useState('');

  const calendarApi = () => calendarRef.current?.getApi();
  const goPrevious = () => calendarApi()?.prev();
  const goNext = () => calendarApi()?.next();
  const goToday = () => {
    const api = calendarApi();
    api?.today();
    requestAnimationFrame(() => api?.scrollToTime(scrollTimeFor(new Date())));
  };

  const updateEventDates = useCallback((event, message) => {
    setEvents((current) => current.map((item) => (
      item.id === event.id
        ? { ...item, start: event.start.toISOString(), end: event.end.toISOString() }
        : item
    )));
    navigator.vibrate?.(10);
    setToast(message);
  }, []);

  const saveEvent = (nextEvent) => {
    setEvents((current) => {
      const exists = current.some((event) => event.id === nextEvent.id);
      return exists
        ? current.map((event) => (event.id === nextEvent.id ? nextEvent : event))
        : [...current, nextEvent];
    });
    navigator.vibrate?.(10);
    setDrawer(null);
    setToast(drawer?.mode === 'create' ? 'Appuntamento demo creato in locale' : 'Appuntamento demo aggiornato in locale');
  };

  const openCreate = (start, end) => {
    setDrawer({
      mode: 'create',
      event: {
        id: `demo-local-${Date.now()}`,
        title: '',
        start,
        end,
        extendedProps: { patientName: '', treatment: '', status: 'confirmed', practitioner: 'Dott.ssa Demo' },
      },
    });
  };

  const onTouchStart = (event) => {
    const target = event.target;
    gestureBlocked.current = interactionActive.current || Boolean(target.closest('.fc-event, .fc-event-resizer'));
    if (gestureBlocked.current || event.touches.length !== 1) return;
    touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  };

  const onTouchEnd = (event) => {
    if (!touchStart.current || gestureBlocked.current || interactionActive.current) {
      touchStart.current = null;
      return;
    }
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStart.current.x;
    const deltaY = touch.clientY - touchStart.current.y;
    touchStart.current = null;
    const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY) * 1.4;
    if (!isHorizontal || Math.abs(deltaX) < SWIPE_THRESHOLD) return;
    if (deltaX < 0) goNext();
    else goPrevious();
    navigator.vibrate?.(10);
  };

  return (
    <main className="agenda-lab">
      <MobileAgendaHeader
        date={visibleDate}
        isToday={isSameLocalDay(visibleDate, new Date())}
        onPrevious={goPrevious}
        onNext={goNext}
        onToday={goToday}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <section
        className="agenda-lab__calendar"
        aria-label="Agenda giornaliera demo"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <FullCalendar
          ref={calendarRef}
          plugins={[timeGridPlugin, interactionPlugin]}
          initialView="timeGridDay"
          initialDate={initialDate}
          headerToolbar={false}
          dayHeaders={false}
          allDaySlot={false}
          height="100%"
          expandRows
          nowIndicator
          locale="it"
          slotMinTime="07:00:00"
          slotMaxTime="21:00:00"
          slotDuration="00:15:00"
          slotLabelInterval="01:00"
          scrollTime={scrollTimeFor(initialDate)}
          scrollTimeReset={false}
          slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          events={events}
          editable
          selectable
          selectMirror
          eventStartEditable
          eventDurationEditable
          longPressDelay={350}
          eventLongPressDelay={350}
          selectLongPressDelay={350}
          eventMinHeight={22}
          eventShortHeight={24}
          eventClassNames={({ event }) => [`status-${event.extendedProps.status}`]}
          eventContent={(info) => <AgendaEventContent event={info.event} />}
          eventClick={({ event }) => setDrawer({ mode: 'detail', event: calendarEventSnapshot(event) })}
          eventDrop={({ event }) => updateEventDates(event, 'Appuntamento demo spostato in locale')}
          eventResize={({ event }) => updateEventDates(event, 'Durata demo aggiornata in locale')}
          eventDragStart={() => { interactionActive.current = true; }}
          eventDragStop={() => { interactionActive.current = false; }}
          eventResizeStart={() => { interactionActive.current = true; }}
          eventResizeStop={() => { interactionActive.current = false; }}
          dateClick={({ date }) => {
            const end = new Date(date.getTime() + 30 * 60000);
            openCreate(date, end);
          }}
          select={({ start, end }) => {
            openCreate(start, end);
            calendarApi()?.unselect();
          }}
          datesSet={({ view }) => setVisibleDate(new Date(view.currentStart))}
        />
      </section>
      {drawer && (
        <AgendaAppointmentDrawer
          key={`${drawer.mode}-${drawer.event.id}-${drawer.event.start}`}
          state={drawer}
          onClose={() => setDrawer(null)}
          onEdit={(event) => setDrawer({ mode: 'edit', event })}
          onSave={saveEvent}
        />
      )}
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}
    </main>
  );
}
