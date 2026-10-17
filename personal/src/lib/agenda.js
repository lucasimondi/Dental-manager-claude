// POL-VITA-004 — calcoli dell'agenda di Personal (puri, testabili): date, griglia del mese,
// elementi di un giorno (appuntamenti, eventi, scadenze) e colonne per gli orari sovrapposti.
const due = (n) => String(n).padStart(2, '0');
export const isoData = (d) => `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;
export const daIso = (s) => { const [a, m, g] = s.split('-').map(Number); return new Date(a, m - 1, g, 12); };
export const piuGiorni = (s, n) => { const d = daIso(s); d.setDate(d.getDate() + n); return isoData(d); };
export const oggi = () => isoData(new Date());

// Genera occorrenze usando date locali e un limite esplicito: nessuna conversione UTC
// e nessuna deriva del giorno nei mesi più corti (es. 31 gennaio → 28 febbraio → 31 marzo).
export function generaDateRipetizione(dataInizio, finoAl, frequenza, massimo = 366) {
  if (!dataInizio) return [];
  if (!frequenza || frequenza === 'nessuna') return [dataInizio];
  if (!finoAl || finoAl < dataInizio) return [];
  const passi = { giornaliera: 1, settimanale: 7, quindicinale: 14 };
  if (frequenza !== 'mensile' && !passi[frequenza]) return [];
  const limite = Math.max(1, Math.min(366, Number(massimo) || 366));
  const out = [];
  const giornoAncoraggio = daIso(dataInizio).getDate();
  let indice = 0;
  while (out.length < limite) {
    let data;
    if (frequenza === 'mensile') {
      const d = daIso(dataInizio);
      d.setDate(1);
      d.setMonth(d.getMonth() + indice);
      const ultimoGiorno = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12).getDate();
      d.setDate(Math.min(giornoAncoraggio, ultimoGiorno));
      data = isoData(d);
    } else {
      data = piuGiorni(dataInizio, indice * passi[frequenza]);
    }
    if (data > finoAl) break;
    out.push(data);
    indice += 1;
  }
  return out;
}

export const minuti = (ora) => {
  const [h, m] = String(ora || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
export const ora = (min) => `${due(Math.floor(min / 60) % 24)}:${due(min % 60)}`;

// Settimana da lunedì.
export const inizioSettimana = (s) => { const d = daIso(s); return piuGiorni(s, -((d.getDay() + 6) % 7)); };
export const giorniSettimana = (s) => Array.from({ length: 7 }, (_, i) => piuGiorni(inizioSettimana(s), i));

// Griglia del mese: 6 righe da lunedì, con i giorni fuori mese.
export function grigliaMese(s) {
  const d = daIso(s);
  const primo = isoData(new Date(d.getFullYear(), d.getMonth(), 1, 12));
  const inizio = inizioSettimana(primo);
  return Array.from({ length: 42 }, (_, i) => piuGiorni(inizio, i));
}
export const stessoMese = (a, b) => a.slice(0, 7) === b.slice(0, 7);

export const ETICHETTE_PREDEFINITE = Object.freeze([
  { id: 'personale', nome: 'Personale', colore: '#64748b' },
  { id: 'famiglia', nome: 'Famiglia', colore: '#db2777' },
  { id: 'sport', nome: 'Sport', colore: '#059669' },
  { id: 'viaggio', nome: 'Viaggio', colore: '#0284c7' },
  { id: 'ferie', nome: 'Ferie', colore: '#f59e0b' },
]);
export const COLORE_SCADENZA = '#b45309';

// Colore di un evento: il suo, poi quello dell'etichetta, poi grigio.
export const coloreEvento = (ev, etichette) => ev.colore || etichette.find((e) => e.id === (ev.etichetta || ev.tipo) || e.nome === (ev.etichetta || ev.tipo))?.colore || '#64748b';
export const nomeEtichetta = (tipo, etichette) => etichette.find((e) => e.id === (typeof tipo === 'object' ? (tipo.etichetta || tipo.tipo) : tipo) || e.nome === (typeof tipo === 'object' ? (tipo.etichetta || tipo.tipo) : tipo))?.nome || tipo || 'Personale';

// Tutto ciò che cade in un giorno, già separato fra "in alto" (tutto il giorno, scadenze) e "a orario".
export function elementiDelGiorno(giorno, { appuntamenti = [], impegni = [], scadenze = [] }) {
  const evGiorno = impegni.filter((e) => giorno >= e.data_inizio && giorno <= e.data_fine);
  const aOrario = [
    ...appuntamenti.filter((a) => a.data === giorno && a.ora).map((a) => ({
      tipo: 'appuntamento', id: `a${a.id}`, dato: a, inizio: minuti(a.ora), fine: minuti(a.ora) + (Number(a.durata) || 30),
    })),
    ...evGiorno.filter((e) => !e.tutto_il_giorno && e.ora_inizio).map((e) => {
      const inizio = minuti(e.ora_inizio);
      return { tipo: 'evento', id: `e${e.id}`, dato: e, inizio, fine: Math.max(minuti(e.ora_fine || e.ora_inizio), inizio + 15) };
    }),
  ].sort((x, y) => x.inizio - y.inizio || y.fine - x.fine);
  return {
    scadenze: scadenze.filter((s) => s.data === giorno),
    tuttoIlGiorno: evGiorno.filter((e) => e.tutto_il_giorno || !e.ora_inizio),
    aOrario,
  };
}

// Colonne per gli elementi sovrapposti (come l'agenda dello studio): ogni gruppo che si
// sovrappone si divide la larghezza.
export function colonne(elementi) {
  const out = [];
  let gruppo = [];
  let fineGruppo = -1;
  const chiudi = () => {
    const colFine = [];
    for (const el of gruppo) {
      let c = colFine.findIndex((f) => f <= el.inizio);
      if (c < 0) { c = colFine.length; colFine.push(0); }
      colFine[c] = el.fine;
      el.col = c;
    }
    for (const el of gruppo) out.push({ ...el, colonne: colFine.length });
    gruppo = [];
  };
  for (const el of elementi) {
    if (gruppo.length && el.inizio >= fineGruppo) { chiudi(); fineGruppo = -1; }
    gruppo.push({ ...el });
    fineGruppo = Math.max(fineGruppo, el.fine);
  }
  if (gruppo.length) chiudi();
  return out;
}

// Quanti elementi per giorno (pallini del mese).
export function conteggi(giorni, dati) {
  return Object.fromEntries(giorni.map((g) => {
    const e = elementiDelGiorno(g, dati);
    return [g, { appuntamenti: e.aOrario.filter((x) => x.tipo === 'appuntamento').length, eventi: e.aOrario.filter((x) => x.tipo === 'evento').length + e.tuttoIlGiorno.length, scadenze: e.scadenze.length }];
  }));
}

// Evento (impegno personale, senza paziente): stessa forma che usa l'agenda dello studio.
export function rigaImpegno(evento) {
  const tuttoIlGiorno = !!evento.tutto_il_giorno;
  return {
    titolo: String(evento.titolo || '').trim() || 'Evento',
    tipo: ['personale', 'ferie', 'chiamata', 'altro'].includes(evento.tipo) ? evento.tipo : 'personale',
    etichetta: evento.tipo || evento.etichetta || 'personale',
    colore: evento.colore || null,
    data_inizio: evento.data_inizio,
    data_fine: evento.data_fine && evento.data_fine >= evento.data_inizio ? evento.data_fine : evento.data_inizio,
    tutto_il_giorno: tuttoIlGiorno,
    ora_inizio: tuttoIlGiorno ? null : evento.ora_inizio,
    ora_fine: tuttoIlGiorno ? null : evento.ora_fine,
    note: evento.note || null,
    recurrence_id: evento.recurrence_id ?? evento.recurrenceId ?? null,
  };
}

// POL-VITA-007 — come l'agenda dello studio (src/components/Agenda.jsx).
export const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

// Stesso calcolo dello studio: chi si sovrappone si divide la colonna del giorno.
export function layoutOverlap(voci) {
  const items = voci.map((v) => ({ ...v, col: 0, totalCols: 1 })).sort((x, y) => x.start - y.start || y.end - x.end);
  let cluster = [];
  let fine = -Infinity;
  const chiudi = () => {
    const colEnds = [];
    cluster.forEach((it) => {
      let i = colEnds.findIndex((e) => e <= it.start);
      if (i === -1) { i = colEnds.length; colEnds.push(it.end); } else colEnds[i] = it.end;
      it.col = i;
    });
    cluster.forEach((it) => { it.totalCols = colEnds.length; });
    cluster = [];
  };
  items.forEach((it) => {
    if (it.start >= fine) { chiudi(); fine = it.end; } else fine = Math.max(fine, it.end);
    cluster.push(it);
  });
  chiudi();
  return items;
}

// Etichetta del mese della settimana mostrata (anche a cavallo di due mesi o anni).
export function etichettaMese(lunedi) {
  const a = daIso(lunedi);
  const b = daIso(piuGiorni(lunedi, 6));
  if (a.getMonth() === b.getMonth()) return `${MESI[a.getMonth()]} ${a.getFullYear()}`;
  if (a.getFullYear() === b.getFullYear()) return `${MESI[a.getMonth()].slice(0, 3)} – ${MESI[b.getMonth()].slice(0, 3)} ${a.getFullYear()}`;
  return `${MESI[a.getMonth()].slice(0, 3)} ${a.getFullYear()} – ${MESI[b.getMonth()].slice(0, 3)} ${b.getFullYear()}`;
}


// impegni_personali.recurrence_id è uuid nel database dello studio (id resta bigint).
export function nuovoIdRipetizione() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const b = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
