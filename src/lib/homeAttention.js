/* POL-UI-017 R2 §2 — "Richiede attenzione", the Home's priority area.

   PURE PRESENTATION SELECTOR. This module owns NO data source, NO query,
   NO clinical rule and NO financial formula. It receives values the Home
   already holds (the `richiami` prop App.jsx passes to Dashboard, the
   appointments already filtered for today, and counters the Dashboard has
   long computed for its existing widgets) and only decides WHICH of them
   deserve a first-level slot on a phone, in which order, with which
   wording. Removing this module would change what the user sees, never
   what the app knows.

   Deliberate non-goals (POL-UI-017 R2 §2):
   - never invent an alert for data that does not already exist;
   - never add a second source of truth for richiami/scadenze/appuntamenti
     — every item points back at the page that already owns that data;
   - never grow into an empty "you have nothing" box: an empty result is
     rendered by the caller as one compact positive line.

   Every gate is fail-closed: a caller that cannot read a family of data
   (e.g. no `finance.management.read` capability, so `scadenzeScadute` is
   not computed at all) simply passes 0 and the corresponding item never
   appears. */

/* Items beyond this are dropped rather than turning the priority area
   back into the long scrolling list this round exists to remove. */
export const HOME_ATTENTION_MAX_ITEMS = 4;

export const HOME_ATTENTION_EMPTY_LABEL = 'Tutto sotto controllo';

const plural = (n, one, many) => (n === 1 ? one : many);

const isOpenRichiamo = (r) => Boolean(r) && r.stato === 'da_fare';

/* `nowTime` is an 'HH:MM' string, the same shape Dashboard already
   compares appointment times against (`a.ora < new Date().toTimeString()
   .slice(0, 5)`), so "imminent" here means exactly what the Agenda widget
   already means by "not yet passed". */
export const findNextAppointmentToday = (todayAppointments = [], nowTime = '00:00') => {
  const list = Array.isArray(todayAppointments) ? todayAppointments.filter(Boolean) : [];
  return list.find((a) => String(a.ora || '') >= String(nowTime)) || null;
};

export const buildHomeAttentionItems = ({
  today = '',
  nowTime = '00:00',
  richiami = [],
  todayAppointments = [],
  overduePlanDeadlines = 0,
  overdueReminders = 0,
  unreadAdvice = 0,
  patientNameOfAppointment = () => '',
} = {}) => {
  const items = [];
  const open = (Array.isArray(richiami) ? richiami : []).filter(isOpenRichiamo);
  const overdueRichiami = open.filter((r) => String(r.dataScadenza || '') < today).length;
  const todayRichiami = open.filter((r) => String(r.dataScadenza || '') === today).length;

  if (overdueRichiami > 0) {
    items.push({
      id: 'richiami_scaduti',
      tone: 'danger',
      icon: 'bell',
      count: overdueRichiami,
      label: `${overdueRichiami} ${plural(overdueRichiami, 'richiamo scaduto', 'richiami scaduti')}`,
      detail: 'Da gestire in Richiami',
      action: 'richiami',
    });
  }

  if (overduePlanDeadlines > 0) {
    items.push({
      id: 'scadenze_scadute',
      tone: 'danger',
      icon: 'cal',
      count: overduePlanDeadlines,
      label: `${overduePlanDeadlines} ${plural(overduePlanDeadlines, 'scadenza pagamento scaduta', 'scadenze pagamento scadute')}`,
      detail: 'Apri il dettaglio scadenze',
      action: 'scadenze',
    });
  }

  if (overdueReminders > 0) {
    items.push({
      id: 'promemoria_scaduti',
      tone: 'danger',
      icon: 'pin',
      count: overdueReminders,
      label: `${overdueReminders} ${plural(overdueReminders, 'promemoria paziente scaduto', 'promemoria paziente scaduti')}`,
      detail: 'Nelle attività della Home',
      action: 'todo',
    });
  }

  if (todayRichiami > 0) {
    items.push({
      id: 'richiami_oggi',
      tone: 'warn',
      icon: 'bell',
      count: todayRichiami,
      label: `${todayRichiami} ${plural(todayRichiami, 'richiamo in scadenza oggi', 'richiami in scadenza oggi')}`,
      detail: 'Da gestire in Richiami',
      action: 'richiami',
    });
  }

  const next = findNextAppointmentToday(todayAppointments, nowTime);
  if (next) {
    const name = String(patientNameOfAppointment(next) || '').trim();
    items.push({
      id: 'prossimo_appuntamento',
      tone: 'info',
      icon: 'clk',
      count: null,
      label: `Prossimo appuntamento ${next.ora}`,
      detail: name || next.tipo || 'Apri agenda',
      action: 'agenda',
    });
  }

  if (unreadAdvice > 0) {
    items.push({
      id: 'consigli_poliedron',
      tone: 'info',
      icon: 'compass',
      count: unreadAdvice,
      label: `${unreadAdvice} ${plural(unreadAdvice, 'consiglio Poliedron da leggere', 'consigli Poliedron da leggere')}`,
      detail: 'Nel widget Consigli Poliedron',
      action: 'consigli',
    });
  }

  return items.slice(0, HOME_ATTENTION_MAX_ITEMS);
};
