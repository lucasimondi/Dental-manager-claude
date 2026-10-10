// Poliedron Core — executes the commands parsed by poliedron-actions.js
// without the model, through the same domain modules as the tools
// (preparePazienti / preparePagamenti / prepareAgenda): same validation, same
// RLS client, same activity log. Policy as everywhere: clear → executed;
// possible duplicate or "medio" autonomy → signed summary to confirm;
// ambiguous → one question; nothing invented.
import { preparePazienti, executePazienti } from './pazienti.js';
import { preparePagamenti, executePagamenti } from './pagamenti.js';
import { classifyAction, DECISION } from './confidence.js';
import { appointmentsForChange } from './agenda.js';
import { resolveDay, hasDay } from './poliedron-agenda.js';

/** Tool permission each Core action needs (same names the model path uses). */
export const CORE_ACTION_TOOLS = Object.freeze({
  APPOINTMENT_UPDATE: 'modifica_appuntamento',
  AGENDA_BLOCK: 'crea_impegno_personale',
  PATIENT_NOTE: 'aggiungi_nota_paziente',
  PATIENT_CONTACT: 'modifica_paziente',
  PATIENT_CREATE: 'crea_paziente',
  RECALL_CREATE: 'crea_richiamo',
  PAYMENT_CREATE: 'registra_pagamento_paziente',
});

const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
function addMonths(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1, 12));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}
const plusMinutes = (hhmm, n) => { const t = Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5)) + n; return t >= 1440 ? null : `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
const toMin = (t) => Number(String(t).slice(0, 2)) * 60 + Number(String(t).slice(3, 5));
const who = (a) => [a.patients?.nome, a.patients?.cognome].filter(Boolean).join(' ') || 'paziente';

/**
 * The one appointment a command is about: by patient and/or slot, or the
 * single one in the signed conversation context. Returns { appt } or { reply }.
 */
export async function resolveAppointment(entities, env, { useContext = false } = {}) {
  const { supabase, studioId, reply, findPatient, fmtDay, dayIso, observed } = env;
  let rows;
  let label = '';
  try {
    if (useContext) {
      const ids = env.context.appointment_ids || [];
      if (ids.length > 1) return { reply: reply({ text: 'A quale appuntamento ti riferisci? Dimmi giorno e ora.' }) };
      if (!ids.length) return { escalate: true };
      rows = await appointmentsForChange(supabase, studioId, { id: ids[0] });
      if (!rows.length) return { reply: reply({ text: 'Non trovo più quell’appuntamento in agenda (forse è già stato annullato o è passato).' }) };
    } else {
      const from = entities.from || {};
      const fromDate = hasDay(from) ? dayIso(from) : null;
      if (hasDay(from) && !fromDate) return { reply: reply({ text: 'Quel giorno non esiste o non corrisponde al giorno della settimana: dimmi la data esatta.' }) };
      let patient = null;
      if (entities.patient_query) {
        const found = await findPatient(entities.patient_query);
        if (found.reply) return { reply: found.reply };
        patient = found.patient;
      }
      rows = await appointmentsForChange(supabase, studioId, { pazienteId: patient?.id ?? null, data: fromDate, ora: from.time ?? null });
      label = `${patient ? ` di ${patient.nome} ${patient.cognome}` : ''}${fromDate ? ` ${fmtDay(fromDate)}` : ' da oggi in poi'}${from.time ? ` alle ${from.time}` : ''}`;
    }
  } catch (error) {
    return { reply: reply({ text: error.message, uncertain: true }) };
  }
  if (!rows.length) return { reply: reply({ text: `Non trovo appuntamenti${label}.` }) };
  const line = (a) => `${fmtDay(a.data)} alle ${String(a.ora).slice(0, 5)} — ${who(a)} (${a.tipo})`;
  if (rows.length > 1) {
    return { reply: reply({ text: `Ho trovato ${rows.length} appuntamenti${label}:\n${rows.slice(0, 6).map(line).join('\n')}${rows.length > 6 ? '\n…' : ''}\nQuale intendi? Dimmi giorno e ora.`, data: { risultati: rows.slice(0, 6) }, ...await env.contextFor(rows.length <= 3 ? rows.map((a) => a.id) : []) }) };
  }
  observed.appointments.add(rows[0].id);
  return { appt: rows[0], line };
}

/** Patient-record and payment writes: prepared by the domain module, then executed or confirmed. */
async function domainWrite(kind, name, prepared, env) {
  const { reply } = env;
  const proposal = { id: crypto.randomUUID(), userId: env.userId, studioId: env.studioId, name, [kind]: prepared, expiresAt: Date.now() + 10 * 60 * 1000 };
  const needsConfirm = env.confirmEach || prepared.avviso || (kind === 'pagamenti' && classifyAction({ prepared }).decision !== DECISION.HIGH);
  if (needsConfirm) {
    const token = await env.sign(proposal);
    return reply({ text: prepared.avviso ? `${prepared.avviso} Confermi comunque?` : 'Controlla il riepilogo prima di confermare.', needsConfirmation: { token, summary: prepared.summary, expiresAt: proposal.expiresAt } });
  }
  let done;
  try {
    done = kind === 'pagamenti' ? await executePagamenti(env.supabase, proposal) : await executePazienti(env.supabase, proposal);
  } catch (error) {
    return reply({ text: `Non eseguito: ${error.message}`, changed: kind === 'pagamenti' ? ['payments'] : ['patients', 'richiami', 'impegni_personali'], uncertain: true });
  }
  await env.log(proposal, done);
  return reply(done);
}

async function prepare(fn, env) {
  try {
    return { prepared: await fn() };
  } catch (error) {
    return { reply: env.reply({ text: error.message, uncertain: true }) };
  }
}

async function agendaHours(env) {
  const { data } = await env.supabase.from('studio_info').select('agenda_settings').eq('studio_id', env.studioId).maybeSingle();
  const s = data?.agenda_settings || {};
  const pad = (h) => `${String(Math.trunc(h)).padStart(2, '0')}:00`;
  return { open: pad(Number(s.oraInizio ?? 8)), close: pad(Math.min(Number(s.oraFine ?? 20), 23)) };
}

/** Executes a Core action; returns a Response, or null to let the model path decide. */
export async function runCoreAction(parsed, env) {
  const e = parsed.entities;
  const { reply, fmtDay } = env;
  // A name the search does not find may be a phrasing the parser misread: the model path looks again.
  const findPatient = async (query) => {
    const found = await env.findPatient(query);
    return found.notFound ? { escalate: true } : found;
  };

  if (parsed.intent === 'APPOINTMENT_UPDATE') {
    const target = await resolveAppointment(e, env, { useContext: e.use_context });
    if (target.escalate) return null;
    if (target.reply) return target.reply;
    const { appt } = target;
    const changes = Object.fromEntries(Object.entries(e.changes).filter(([k, v]) => String(appt[k] ?? '') !== String(v)));
    if (!Object.keys(changes).length) return reply({ text: `Nessuna modifica: l’appuntamento è già così (${target.line(appt)}).` });
    return env.agendaWrite('modifica_appuntamento', { appuntamento_id: appt.id, ...changes }, appt.data);
  }

  if (parsed.intent === 'PAYMENT_CREATE') {
    const { patient, reply: r, escalate } = await findPatient(e.patient_query);
    if (escalate) return null;
    if (r) return r;
    const input = { paziente_id: patient.id, importo: e.importo, metodo: e.metodo || 'Contanti', ...(e.ieri ? { data: addDays(env.today, -1) } : {}) };
    try {
      const prepared = await preparePagamenti(env.supabase, 'registra_pagamento_paziente', input, env.studioId, env.observed);
      if (!e.metodo) prepared.summary += '\n(Metodo non indicato: registrato come Contanti.)';
      return domainWrite('pagamenti', 'registra_pagamento_paziente', prepared, env);
    } catch (error) {
      const plans = error.message.match(/Piani: (.*)\.$/);
      return reply({ text: plans ? `${patient.nome} ${patient.cognome} ha più piani di cura aperti: ${plans[1].replace(/ \(piano_id \d+(, del [^)]*)?\)/g, '')}. A quale collego il pagamento?` : error.message, uncertain: true });
    }
  }

  if (parsed.intent === 'PATIENT_CREATE') {
    const { prepared, reply: r } = await prepare(() => preparePazienti(env.supabase, 'crea_paziente', { nome: e.nome, cognome: e.cognome, ...(e.telefono ? { telefono: e.telefono } : {}), ...(e.email ? { email: e.email } : {}) }, env.studioId, env.observed), env);
    return r || domainWrite('pazienti', 'crea_paziente', prepared, env);
  }

  if (['PATIENT_NOTE', 'PATIENT_CONTACT', 'RECALL_CREATE'].includes(parsed.intent)) {
    const { patient, reply: r, escalate } = await findPatient(e.patient_query);
    if (escalate) return null;
    if (r) return r;
    let name, input;
    if (parsed.intent === 'PATIENT_NOTE') { name = 'aggiungi_nota_paziente'; input = { paziente_id: patient.id, testo: e.testo }; }
    else if (parsed.intent === 'PATIENT_CONTACT') { name = 'modifica_paziente'; input = { paziente_id: patient.id, [e.field]: e.value }; }
    else {
      const due = e.due.months != null ? addMonths(env.today, e.due.months)
        : e.due.days != null ? addDays(env.today, e.due.days)
        : e.due.month != null ? resolveDay({ day_of_month: 1, month: e.due.month }, env.today) : env.dayIso(e.due.day);
      if (!due) return reply({ text: 'Quel giorno non esiste: dimmi la data esatta del richiamo.' });
      name = 'crea_richiamo';
      input = { paziente_id: patient.id, categoria: e.categoria, ...(e.motivo ? { motivo: e.motivo } : {}), data_scadenza: due };
    }
    const { prepared, reply: r2 } = await prepare(() => preparePazienti(env.supabase, name, input, env.studioId, env.observed), env);
    return r2 || domainWrite('pazienti', name, prepared, env);
  }

  if (parsed.intent === 'AGENDA_BLOCK') {
    const from = env.dayIso(e.from), to = env.dayIso(e.to);
    if (!from || !to) return reply({ text: 'Quel giorno non esiste o non corrisponde al giorno della settimana: dimmi la data esatta.' });
    if (to < from) return reply({ text: 'La data di fine viene prima di quella di inizio: dimmi le date esatte.' });
    let start = e.ora_inizio || null, end = e.ora_fine || null;
    if (e.durata && start) end = plusMinutes(start, e.durata);
    if (e.parte) {
      const hours = await agendaHours(env);
      [start, end] = e.parte === 'mattina' ? [hours.open, '13:00'] : ['14:00', hours.close];
    }
    const allDay = !start;
    const input = { titolo: e.titolo, tipo: e.tipo, data_inizio: from, data_fine: to, tutto_il_giorno: allDay, ...(allDay ? {} : { ora_inizio: start, ora_fine: end }) };
    const { prepared, reply: r } = await prepare(() => preparePazienti(env.supabase, 'crea_impegno_personale', input, env.studioId, env.observed), env);
    if (r) return r;
    // Appointments already in the blocked time are not moved: say so and ask.
    const { data: rows, error } = await env.supabase.from('appointments').select('id, data, ora, durata, tipo, stato, patients(nome, cognome)')
      .eq('studio_id', env.studioId).gte('data', from).lte('data', to);
    if (error) return reply({ text: 'Non riesco a controllare gli appuntamenti di quel periodo: non ho bloccato nulla.', uncertain: true });
    const clash = (rows || []).filter((a) => a.stato !== 'annullato'
      && (allDay || (toMin(a.ora) < toMin(end) && toMin(start) < toMin(a.ora) + (a.durata || 30))));
    if (clash.length) {
      const list = clash.slice(0, 5).map((a) => `${fmtDay(a.data)} alle ${String(a.ora).slice(0, 5)} ${who(a)}`).join('; ');
      prepared.avviso = `Attenzione: in quel periodo ci sono ${clash.length} appuntament${clash.length === 1 ? 'o' : 'i'} (${list}${clash.length > 5 ? '…' : ''}) che restano in agenda.`;
      prepared.summary += `\n${prepared.avviso}`;
    }
    return domainWrite('pazienti', 'crea_impegno_personale', prepared, env);
  }
  return null;
}
