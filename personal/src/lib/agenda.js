// POL-VITA-004 — calcoli dell'agenda di Personal (puri, testabili): date, griglia del mese,
// elementi di un giorno (appuntamenti, eventi, scadenze) e colonne per gli orari sovrapposti.
const due = (n) => String(n).padStart(2, '0');
export const isoData = (d) => `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;
export const daIso = (s) => { const [a, m, g] = s.split('-').map(Number); return new Date(a, m - 1, g, 12); };
export const piuGiorni = (s, n) => { const d = daIso(s); d.setDate(d.getDate() + n); return isoData(d); };
export const oggi = () => isoData(new Date());

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
export const coloreEvento = (ev, etichette) => ev.colore || etichette.find((e) => e.id === ev.tipo || e.nome === ev.tipo)?.colore || '#64748b';
export const nomeEtichetta = (tipo, etichette) => etichette.find((e) => e.id === tipo || e.nome === tipo)?.nome || tipo || 'Personale';

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
