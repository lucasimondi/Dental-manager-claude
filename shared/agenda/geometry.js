// Original Studio interval packing, kept stable for both adapters.
export const layoutAppointments = (dayApps) => {
  const items = dayApps.map((a) => {
    const [ah, am] = a.ora.split(':').map(Number);
    const start = (ah || 0) * 60 + (am || 0);
    const end = start + Math.max(Number(a.durata) || 0, 1);
    return { a, start, end, col: 0, totalCols: 1 };
  });
  let cluster = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    if (cluster.length === 0) return;
    const colEnds = []; // fine dell'ultimo appuntamento assegnato a ciascuna colonna
    cluster.forEach((item) => {
      let idx = colEnds.findIndex((e) => e <= item.start);
      if (idx === -1) { idx = colEnds.length; colEnds.push(item.end); }
      else colEnds[idx] = item.end;
      item.col = idx;
    });
    cluster.forEach((item) => { item.totalCols = colEnds.length; });
    cluster = [];
  };
  items.forEach((item) => {
    if (item.start >= clusterEnd) { flush(); clusterEnd = item.end; }
    else clusterEnd = Math.max(clusterEnd, item.end);
    cluster.push(item);
  });
  flush();
  return items;
};

export function layoutAgendaDay(appointments, events) {
  const minutes = time => { const [h, m] = String(time || '00:00').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  const items = [...appointments, ...events.map(event => {
    const ora = event.oraInizio ?? event.ora_inizio;
    const end = event.oraFine ?? event.ora_fine ?? ora;
    return { id: 'event-' + event.id, ora, durata: Math.max(15, minutes(end) - minutes(ora)), agendaEvent: event };
  })].sort((a,b) => minutes(a.ora) - minutes(b.ora) || Number(b.durata) - Number(a.durata));
  return layoutAppointments(items);
}
