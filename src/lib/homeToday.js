/* HOME-AGENDA-CENTRIC — "Oggi": la giornata dello studio come centro della
   Home. Solo presentazione: legge gli appuntamenti già caricati in App.jsx
   (stessi campi usati da Agenda: data, ora, durata, stato, pazienteId,
   poltronaId) e le poltrone già lette da Agenda, senza query o scritture
   nuove. Nessun dato finanziario. */

import { layoutAppointments } from '../../shared/agenda/geometry.js';

export const HOME_TODAY_DEFAULT_RANGE = Object.freeze({ start: 8 * 60, end: 19 * 60 });

/* Widget che la Home agenda-centrica non mostra più: l'agenda del giorno è
   ora la griglia centrale, le azioni rapide sono sostituite dalla barra
   Poliedron nell'header e i numeri del controllo di gestione restano nella
   loro sezione (decisione Product Owner, 2026-11-06). Il layout salvato
   non viene modificato: questi id vengono solo esclusi dalla resa e dal
   catalogo di "Personalizza Home", quindi tornano visibili se si ripristina
   la Home precedente. */
export const HOME_TODAY_REPLACED_WIDGET_IDS = Object.freeze(['agenda', 'quick_actions']);

export function isHomeTodayWidget(entry) {
  if (!entry) return false;
  if (HOME_TODAY_REPLACED_WIDGET_IDS.includes(entry.id)) return false;
  if (entry.permission === 'management_control') return false;
  return true;
}

export const toMinutes = (hhmm) => {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || '').trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

export const fromMinutes = (min) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const patientName = (patient) => [patient?.nome, patient?.cognome].filter(Boolean).join(' ').trim();

/**
 * buildHomeToday({ appointments, patients, today, nowMinutes, poltrone })
 * -> { items, columns, range, current, next, remaining, total }
 *
 * - `items`: appuntamenti di oggi non annullati, ordinati, con nome
 *   paziente, minuti di inizio/fine e stato temporale (past|now|future).
 * - `columns`: una colonna per poltrona solo se esistono poltrone attive
 *   e almeno un appuntamento è assegnato a una di esse; altrimenti una
 *   sola colonna "Agenda". Gli appuntamenti senza poltrona finiscono in
 *   una colonna "Senza poltrona" solo quando servono.
 * - `range`: finestra oraria visibile, di ore intere, che contiene sempre
 *   tutti gli appuntamenti del giorno (default 08–19).
 * - `current`/`next`: il paziente in poltrona adesso e il prossimo.
 */
export function buildHomeToday({ appointments = [], patients = [], today, nowMinutes = 0, poltrone = [] } = {}) {
  const byId = new Map((patients || []).map((p) => [String(p.id), p]));
  const items = (appointments || [])
    .filter((a) => a && a.data === today && a.stato !== 'annullato' && toMinutes(a.ora) != null)
    .map((a) => {
      const start = toMinutes(a.ora);
      const end = start + Math.max(Number(a.durata) || 0, 5);
      const patient = byId.get(String(a.pazienteId)) || null;
      const when = end <= nowMinutes ? 'past' : start <= nowMinutes ? 'now' : 'future';
      return { a, start, end, patient, name: patientName(patient) || 'Paziente', when };
    })
    .sort((x, y) => x.start - y.start || x.end - y.end);

  const chairList = (poltrone || []).filter((p) => p && p.id != null);
  const chairIds = new Set(chairList.map((p) => String(p.id)));
  const usesChairs = chairList.length > 0 && items.some((it) => it.a.poltronaId != null && chairIds.has(String(it.a.poltronaId)));
  let columns;
  if (usesChairs) {
    columns = chairList.map((p) => ({ id: String(p.id), label: p.nome || 'Poltrona', items: items.filter((it) => String(it.a.poltronaId) === String(p.id)) }));
    const unassigned = items.filter((it) => it.a.poltronaId == null || !chairIds.has(String(it.a.poltronaId)));
    if (unassigned.length) columns.push({ id: 'none', label: 'Senza poltrona', items: unassigned });
  } else {
    columns = [{ id: 'all', label: 'Agenda', items }];
  }
  columns = columns.map((col) => {
    const packed = layoutAppointments(col.items.map((it) => it.a));
    const byAppointment = new Map(packed.map((p) => [p.a, p]));
    return { ...col, items: col.items.map((it) => ({ ...it, col: byAppointment.get(it.a)?.col || 0, totalCols: byAppointment.get(it.a)?.totalCols || 1 })) };
  });

  let start = HOME_TODAY_DEFAULT_RANGE.start;
  let end = HOME_TODAY_DEFAULT_RANGE.end;
  if (items.length) {
    start = Math.min(start, Math.floor(items[0].start / 60) * 60);
    end = Math.max(end, Math.ceil(Math.max(...items.map((it) => it.end)) / 60) * 60);
  }

  const current = items.find((it) => it.when === 'now') || null;
  const next = items.find((it) => it.start > nowMinutes && it !== current) || null;
  const remaining = items.filter((it) => it.when !== 'past').length;
  return { items, columns, range: { start, end }, current, next, remaining, total: items.length };
}
