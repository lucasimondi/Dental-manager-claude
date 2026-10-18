// POL-VITA-004 — Agenda di Poliedron Personal = agenda dello studio (decisione PO 2026-10-15:
// "l'agenda deve essere la stessa di studio, la modifichiamo in entrambi i software").
// Secondo client, separato da quello dell'archivio: accesso con l'account dello studio, sessione
// salvata con una chiave propria e rinnovata da sola. Tocca SOLO le tabelle dell'agenda:
// appointments (lettura e scrittura, POL-VITA-013: "da agenda personale io posso agire anche su
// agenda studio"), patients (solo id, nome e cognome, lettura), app_types (lettura) e
// impegni_personali (lettura e scrittura: gli eventi senza paziente), studio_info
// (sola lettura di agenda_settings). POL-VITA-021: anche payments e pagamenti_esterni (scrittura
// degli incassi di studio e di collaborazione registrati da Conti) e collaborazioni (lettura). La RLS dello studio
// (studio_id del token) limita ogni lettura e scrittura allo studio dell'utente.
import { createClient } from '@supabase/supabase-js';
import { rigaImpegno, rigaAppuntamento } from './agenda.js';

export { rigaImpegno, rigaAppuntamento };

const STUDIO_URL = 'https://idklxdqebfceplrualgh.supabase.co';
const STUDIO_KEY = 'sb_publishable_7M4i2tZLVEcGrglOmPdgZA_T7flmU4T';

export const studioDb = createClient(STUDIO_URL, STUDIO_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'poliedron-personal-studio-auth', detectSessionInUrl: false },
});

const esito = ({ data, error }) => {
  if (error) throw new Error(error.message || 'Errore agenda dello studio');
  return data;
};

export async function sessioneStudio() {
  const { data } = await studioDb.auth.getSession();
  return data.session || null;
}

// Fail closed: senza studio nel token non si legge né si scrive nulla.
export function studioDellaSessione(sessione) {
  const id = sessione?.user?.app_metadata?.studio_id;
  if (!id) throw new Error('Account dello studio senza studio associato.');
  return id;
}

export async function entraStudio(email, password) {
  const { data, error } = await studioDb.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(/invalid/i.test(error.message) ? 'Email o password dello studio non corretti.' : error.message);
  studioDellaSessione(data.session);
  return data.session;
}

export const esciStudio = () => studioDb.auth.signOut();

export async function appuntamentiTra(da, a) {
  const app = esito(await studioDb.from('appointments')
    .select('id, data, ora, durata, tipo, colore, note, stato, paziente_id')
    .gte('data', da).lte('data', a).order('data').order('ora'));
  const ids = [...new Set(app.map((x) => x.paziente_id).filter(Boolean))];
  const pazienti = ids.length ? esito(await studioDb.from('patients').select('id, nome, cognome').in('id', ids)) : [];
  const nome = new Map(pazienti.map((p) => [p.id, [p.nome, p.cognome].filter(Boolean).join(' ')]));
  const cognome = new Map(pazienti.map((p) => [p.id, p.cognome || p.nome || null]));
  return app.filter((x) => x.stato !== 'annullato').map((x) => ({ ...x, paziente: nome.get(x.paziente_id) || null, cognome: cognome.get(x.paziente_id) || null }));
}

// Appuntamenti dei pazienti: stesse colonne dello studio, user_id e studio_id della sessione.
// appointments.id è GENERATED ALWAYS AS IDENTITY: lo assegna il database, mai il client.
// Il trigger dello studio controlla la coerenza.
export async function cercaPazienti(testo) {
  const t = String(testo || '').replace(/[,()*%\\]/g, ' ').trim();
  if (t.length < 2) return [];
  const parole = t.split(/\s+/).slice(0, 3);
  let q = studioDb.from('patients').select('id, nome, cognome');
  for (const p of parole) q = q.or(`nome.ilike.*${p}*,cognome.ilike.*${p}*`);
  return esito(await q.order('cognome').limit(20));
}

export async function salvaAppuntamento(a) {
  const riga = rigaAppuntamento(a);
  if (a.id) return esito(await studioDb.from('appointments').update(riga).eq('id', a.id).select('id').single());
  const sessione = await sessioneStudio();
  return esito(await studioDb.from('appointments')
    .insert({ ...riga, studio_id: studioDellaSessione(sessione), user_id: sessione.user.id })
    .select('id').single());
}

export async function eliminaAppuntamento(id) {
  return esito(await studioDb.from('appointments').delete().eq('id', id).select('id'));
}

export async function tipiAppuntamento() {
  return esito(await studioDb.from('app_types').select('nome, colore'));
}

const CAMPI_IMPEGNO = 'id, titolo, tipo, etichetta, colore, data_inizio, data_fine, tutto_il_giorno, ora_inizio, ora_fine, note, recurrence_id, visibile_studio';

export async function impegniTra(da, a) {
  return esito(await studioDb.from('impegni_personali').select(CAMPI_IMPEGNO)
    .lte('data_inizio', a).gte('data_fine', da).order('data_inizio')).map((e) => ({ ...e, tipo: e.etichetta || e.tipo }));
}

export async function salvaImpegno(evento) {
  const sessione = await sessioneStudio();
  const riga = { ...rigaImpegno(evento), updated_at: new Date().toISOString() };
  if (evento.id) {
    return esito(await studioDb.from('impegni_personali').update(riga).eq('id', evento.id).select(CAMPI_IMPEGNO).single());
  }
  // The existing Studio table requires a client-generated bigint (same convention as Studio uid).
  return esito(await studioDb.from('impegni_personali')
    .insert({ ...riga, id: Date.now() + Math.floor(Math.random() * 99999), studio_id: studioDellaSessione(sessione), user_id: sessione.user.id }).select(CAMPI_IMPEGNO).single());
}

// Inserimento atomico delle occorrenze di una ripetizione: una sola richiesta evita
// serie salvate a metà se una delle righe non è valida. Nessuna modifica a schema o RLS.
export async function salvaImpegni(eventi) {
  if (!Array.isArray(eventi) || eventi.length === 0) return [];
  const sessione = await sessioneStudio();
  const studioId = studioDellaSessione(sessione);
  const usati = new Set();
  const rows = eventi.map((evento) => {
    let id;
    do { id = Date.now() + Math.floor(Math.random() * 99999); } while (usati.has(id));
    usati.add(id);
    return {
      ...rigaImpegno(evento),
      id,
      studio_id: studioId,
      user_id: sessione.user.id,
      updated_at: new Date().toISOString(),
    };
  });
  return esito(await studioDb.from('impegni_personali').insert(rows).select(CAMPI_IMPEGNO));
}

export async function impegniDellaSerie(recurrenceId) {
  if (!recurrenceId) return [];
  return esito(await studioDb.from('impegni_personali').select(CAMPI_IMPEGNO).eq('recurrence_id', recurrenceId).order('data_inizio'));
}

// Aggiorna più occorrenze di una serie (una richiesta per evento: le date possono spostarsi).
export async function aggiornaImpegni(eventi) {
  const fatti = [];
  for (const evento of eventi) {
    const riga = { ...rigaImpegno(evento), updated_at: new Date().toISOString() };
    fatti.push(esito(await studioDb.from('impegni_personali').update(riga).eq('id', evento.id).select(CAMPI_IMPEGNO).single()));
  }
  return fatti;
}

export async function eliminaImpegni(ids) {
  if (!ids.length) return [];
  return esito(await studioDb.from('impegni_personali').delete().in('id', ids).select('id'));
}

export async function eliminaImpegno(id) {
  return esito(await studioDb.from('impegni_personali').delete().eq('id', id).select('id'));
}

// Same authoritative settings as Studio; no writes and no tenant fallback.
export async function impostazioniAgenda() {
  const sessione = await sessioneStudio();
  const studioId = studioDellaSessione(sessione);
  const riga = esito(await studioDb.from('studio_info').select('agenda_settings').eq('studio_id', studioId).maybeSingle());
  return riga?.agenda_settings || {};
}

/* ---------- POL-VITA-021: incassi registrati anche nello studio ---------- */
// id di pagamenti_esterni: lo assegna il client come fa il gestionale (Date.now()); payments.id
// è un'identity del database.
export async function collaborazioniStudio() {
  return esito(await studioDb.from('collaborazioni').select('id, nome').order('nome'));
}

export async function registraIncassoStudio({ tabella, riga }) {
  const sessione = await sessioneStudio();
  if (!sessione) throw new Error('Per registrare l\'incasso nello studio collega prima l\'agenda (scheda Agenda).');
  const studio = studioDellaSessione(sessione);
  if (tabella === 'payments') {
    return esito(await studioDb.from('payments').insert({ ...riga, studio_id: studio, user_id: sessione.user.id }).select('id').single()).id;
  }
  if (tabella === 'pagamenti_esterni') {
    return esito(await studioDb.from('pagamenti_esterni').insert({ ...riga, id: Date.now(), studio_id: studio }).select('id').single()).id;
  }
  throw new Error('Tabella dello studio non ammessa');
}

// Modifica del movimento già registrato: nello studio cambiano solo data, importo e nota.
export async function aggiornaIncassoStudio(tabella, id, { data, importo, note }) {
  if (!['payments', 'pagamenti_esterni'].includes(tabella)) throw new Error('Tabella dello studio non ammessa');
  const nota = String(note || '').trim() || null;
  const riga = tabella === 'payments' ? { data, importo, nota } : { data, importo, note: nota };
  return esito(await studioDb.from(tabella).update(riga).eq('id', id).select('id'));
}

export async function eliminaIncassoStudio(tabella, id) {
  if (!['payments', 'pagamenti_esterni'].includes(tabella)) throw new Error('Tabella dello studio non ammessa');
  return esito(await studioDb.from(tabella).delete().eq('id', id).select('id'));
}
