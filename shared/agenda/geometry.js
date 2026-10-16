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
