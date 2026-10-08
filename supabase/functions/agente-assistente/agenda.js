import { studioToday } from './confirmation.js';
import { computeFreeSlots } from '../_shared/agendaSlots.js';
export const AGENDA_WRITES = new Set(['crea_appuntamento', 'modifica_appuntamento', 'elimina_appuntamento']);
const fields = ['paziente_id', 'data', 'ora', 'durata', 'tipo', 'stato', 'note', 'operatore_id'];
const select = `id, ${fields.join(', ')}`;
const minutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const overlaps = (a, b, c, d) => a < d && c < b;
export async function agendaAvailability(client, input, studioId) {
  const date = input.data || studioToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < studioToday()) throw new Error('Scegli una data odierna o futura');
  const results = await Promise.all([
    client.from('studio_info').select('agenda_settings').eq('studio_id', studioId).maybeSingle(),
    client.from('appointments').select(select).eq('studio_id', studioId).eq('data', date),
    client.from('impegni_personali').select('data_inizio, data_fine, tutto_il_giorno, ora_inizio, ora_fine').eq('studio_id', studioId).lte('data_inizio', date).gte('data_fine', date),
    client.from('operatori').select('id, nome').eq('studio_id', studioId).eq('attivo', true),
  ]);
  if (results.some(r => r.error)) throw new Error('Disponibilità non verificabile');
  const [settings, appointments, activities, operators] = results.map(r => r.data);
  const duration = input.durata ?? 30;
  if (!Number.isInteger(duration) || duration < 1 || duration > 720) throw new Error('Durata non valida');
  if (input.operatore_id && !operators.some(o => o.id === input.operatore_id)) throw new Error('Operatore non disponibile');
  const slots = computeFreeSlots({ data: date, durata: duration, operatoreId: input.operatore_id,
    appointments: appointments.map(a => ({ ...a, operatoreId: a.operatore_id })),
    impegni: activities.map(i => ({ dataInizio: i.data_inizio, dataFine: i.data_fine, tuttoIlGiorno: i.tutto_il_giorno, oraInizio: i.ora_inizio, oraFine: i.ora_fine })),
    agendaSettings: settings?.agenda_settings || {},
  });
  return { data: date, durata: duration, operatori: operators, orari_liberi: slots.map(s => s.ora), nota: 'Disponibilità verificata adesso; ricontrollata al salvataggio.' };
}
export function validateAppointment(row) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.data || '') || new Date(`${row.data}T12:00:00Z`).toISOString().slice(0, 10) !== row.data) throw new Error('Data non valida');
  if (!/^([01]\d|2[0-3]):[0-5]\d(:00)?$/.test(row.ora || '')) throw new Error('Orario non valido');
  if (!Number.isInteger(row.durata) || row.durata < 1 || minutes(row.ora) + row.durata > 1440) throw new Error('Durata non valida');
  if (!['confermato', 'da confermare', 'annullato'].includes(row.stato)) throw new Error('Stato non valido');
  if (!Number.isSafeInteger(row.paziente_id) || !row.tipo?.trim()) throw new Error('Paziente e tipo visita obbligatori');
  if (row.note != null && (typeof row.note !== 'string' || row.note.length > 4000)) throw new Error('Note non valide');
}
/** What overlaps the row: active appointments (same operator or unassigned) and personal commitments. */
export function findConflicts(row, appointments, impegni) {
  if (row.stato === 'annullato') return [];
  const start = minutes(row.ora), end = start + row.durata;
  return [
    ...appointments.filter((a) => String(a.id) !== String(row.id) && a.stato !== 'annullato'
      && (!row.operatore_id || !a.operatore_id || String(a.operatore_id) === String(row.operatore_id))
      && overlaps(start, end, minutes(a.ora), minutes(a.ora) + (a.durata || 30)))
      .map((a) => ({ appointment: a })),
    ...impegni.filter((i) => i.tutto_il_giorno || (i.ora_inizio && i.ora_fine && overlaps(start, end, minutes(i.ora_inizio), minutes(i.ora_fine))))
      .map((i) => ({ impegno: i })),
  ];
}
export function hasConflict(row, appointments, impegni) {
  return findConflicts(row, appointments, impegni).length > 0;
}
/**
 * Who occupies the slot, as read from the agenda now. The model must report
 * this and nothing else: without it, it used to guess a name from the chat.
 */
export function describeConflicts(row, conflicts) {
  return conflicts.map(({ appointment: a, impegno: i }) => {
    if (i) return { tipo: 'impegno', tutto_il_giorno: Boolean(i.tutto_il_giorno), ora_inizio: i.ora_inizio?.slice(0, 5) || null, ora_fine: i.ora_fine?.slice(0, 5) || null };
    const name = [a.patients?.nome, a.patients?.cognome].filter(Boolean).join(' ').trim();
    return {
      tipo: 'appuntamento', appuntamento_id: a.id, paziente_id: a.paziente_id ?? null, paziente: name || null,
      ora: a.ora.slice(0, 5), durata: a.durata || 30, tipo_visita: a.tipo || null, stato: a.stato,
      stesso_paziente: a.paziente_id != null && String(a.paziente_id) === String(row.paziente_id),
    };
  });
}
export function conflictMessage(occupants) {
  const parts = occupants.map((o) => (o.tipo === 'impegno'
    ? (o.tutto_il_giorno ? 'un impegno di tutto il giorno' : `un impegno dalle ${o.ora_inizio} alle ${o.ora_fine}`)
    : `${o.stesso_paziente ? 'un appuntamento dello stesso paziente' : 'l\'appuntamento'}${o.paziente ? ` di ${o.paziente}` : ''} alle ${o.ora} (${[o.tipo_visita, `${o.durata} min`, o.stato].filter(Boolean).join(', ')})`));
  const same = occupants.some((o) => o.stesso_paziente);
  return `Orario occupato: c'è già ${parts.join(' e ')}.${same ? ' Il paziente ha già questo appuntamento: non serve crearne un altro.' : ' Scegli un altro orario.'}`;
}
async function one(query) {
  const { data, error } = await query.single();
  if (error || !data) throw new Error('Dato non disponibile o accesso non consentito. Aggiorna la richiesta.');
  return data;
}
export async function prepareAgenda(client, name, input, studioId, observed) {
  let before = null;
  if (name !== 'crea_appuntamento') {
    if (!observed.appointments.has(input.appuntamento_id)) throw new Error('Cerca prima l’appuntamento e chiedi quale scegliere se ce ne sono più di uno.');
    before = await one(client.from('appointments').select(select).eq('studio_id', studioId).eq('id', input.appuntamento_id));
  } else if (!observed.patients.has(input.paziente_id)) {
    throw new Error('Cerca prima il paziente e chiedi quale scegliere in caso di omonimia.');
  }
  const changes = Object.fromEntries(fields.filter((f) => input[f] !== undefined).map((f) => [f, input[f]]));
  const after = name === 'elimina_appuntamento' ? { ...before, stato: 'annullato' }
    : { durata: 30, stato: 'confermato', note: null, operatore_id: null, ...before, ...changes };
  validateAppointment(after);
  if (after.stato !== 'annullato' && after.data < studioToday()) throw new Error('Scegli una data odierna o futura.');
  const patient = await one(client.from('patients').select('id, nome, cognome').eq('studio_id', studioId).eq('id', after.paziente_id));
  let operator = null;
  if (after.operatore_id) operator = await one(client.from('operatori').select('id, nome').eq('studio_id', studioId).eq('id', after.operatore_id).eq('attivo', true));
  await checkAvailability(client, after, studioId);
  const [label, doneLabel] = name === 'crea_appuntamento' ? ['Crea appuntamento', 'Appuntamento creato']
    : after.stato === 'annullato' ? ['Annulla appuntamento (conserva lo storico)', 'Appuntamento annullato: tolto dall\'agenda (se non viene rifissato lo trovi nei Richiami)']
    : ['Modifica appuntamento', 'Appuntamento modificato'];
  const detail = (r) => `${r.data} alle ${r.ora.slice(0,5)}, ${r.durata} minuti, ${r.tipo}`;
  const body = `Paziente: ${patient.nome} ${patient.cognome}\n${before ? `Prima: ${detail(before)}\n` : ''}Dopo: ${detail(after)}\nStato: ${after.stato}\nOperatore: ${operator?.nome || 'non assegnato'}${after.note ? `\nNote: ${after.note}` : ''}`;
  return { before, after, summary: `${label}\n${body}`, done: `${doneLabel}\n${body}` };
}
export async function checkAvailability(client, row, studioId) {
  if (row.stato === 'annullato') return;
  const [a, i] = await Promise.all([
    client.from('appointments').select(`${select}, patients(nome, cognome)`).eq('studio_id', studioId).eq('data', row.data),
    client.from('impegni_personali').select('tutto_il_giorno, ora_inizio, ora_fine').eq('studio_id', studioId).lte('data_inizio', row.data).gte('data_fine', row.data),
  ]);
  if (a.error || i.error) throw new Error('Impossibile verificare la disponibilità');
  const conflicts = findConflicts(row, a.data || [], i.data || []);
  if (!conflicts.length) return;
  const occupants = describeConflicts(row, conflicts);
  throw Object.assign(new Error(conflictMessage(occupants)), { occupato_da: occupants });
}
/**
 * Active appointments a chat command can refer to ("sposta Mario Rossi a
 * venerdì", "cancella l'appuntamento di domani alle 15", "spostalo"): the given
 * day, or from today on; optionally one appointment, one patient, one start time.
 */
export async function appointmentsForChange(client, studioId, { id = null, pazienteId = null, data = null, ora = null } = {}) {
  let query = client.from('appointments').select(`${select}, patients(nome, cognome)`).eq('studio_id', studioId);
  if (id != null) query = query.eq('id', id);
  query = data ? query.eq('data', data) : query.gte('data', studioToday());
  if (pazienteId != null) query = query.eq('paziente_id', pazienteId);
  const { data: rows, error } = await query.order('data', { ascending: true }).order('ora', { ascending: true }).limit(50);
  if (error) throw new Error('Agenda non leggibile adesso');
  return (rows || []).filter((a) => a.stato !== 'annullato' && (!ora || String(a.ora).slice(0, 5) === ora));
}
export async function executeAgenda(client, proposal) {
  const { data, error } = await client.rpc('poliedron_execute_agenda_v1', {
    p_id: proposal.id, p_studio: proposal.studioId,
    p_before: proposal.agenda.before, p_after: proposal.agenda.after,
  });
  if (error?.code === '23505') throw new Error('Questa conferma è già stata utilizzata');
  if (error) throw new Error(error.message);
  // A cancellation (or a new booking) can open/close a "da rifissare" recall in the database.
  return { text: `Fatto. ${proposal.agenda.done || proposal.agenda.summary}`, changed: ['appointments', 'richiami'], appointmentId: data,
    records: { appointments: [{ ...proposal.agenda.after, id: data }] } };
}
