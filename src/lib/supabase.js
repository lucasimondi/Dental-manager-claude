import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://idklxdqebfceplrualgh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7M4i2tZLVEcGrglOmPdgZA_T7flmU4T';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/* ── MAPPATURA CHIAVI LOCALI -> TABELLE SUPABASE ── */
const TABLE_MAP = {
  dm_p: 'patients',
  dm_pl: 'plans',
  dm_py: 'payments',
  dm_a: 'appointments',
  dm_pr: 'pricelist',
  dm_tp: 'templates',
  dm_at: 'app_types',
  dm_im: 'implants',
  dm_ip: 'impegni_personali',
  dm_ri: 'richiami',
};

/* ── CAMPI UI TEMPORANEI DA NON SALVARE SU DB ── */
const UI_ONLY_FIELDS = new Set(['_presetScadenza']);

/* ── CONVERSIONE CAMPI: app (camelCase) <-> db (snake_case) ── */
const FIELD_MAP = {
  patients: {
    dataNascita: 'data_nascita',
  },
  plans: {
    pazienteId: 'paziente_id',
    scontoTipo: 'sconto_tipo',
    scadenzaPagamento: 'scadenza_pagamento',
  },
  payments: {
    pazienteId: 'paziente_id',
  },
  appointments: {
    pazienteId: 'paziente_id',
    operatoreId: 'operatore_id',
    poltronaId: 'poltrona_id',
    googleEventId: 'google_event_id',
    googleCalendarSyncedAt: 'google_calendar_synced_at',
  },
  implants: {
    pazienteId: 'paziente_id',
    planId: 'plan_id',
    dataInserimento: 'data_inserimento',
    dataCorona: 'data_corona',
    noteCorona: 'note_corona',
  },
  impegni_personali: {
    dataInizio: 'data_inizio',
    dataFine: 'data_fine',
    tuttoIlGiorno: 'tutto_il_giorno',
    oraInizio: 'ora_inizio',
    oraFine: 'ora_fine',
  },
  richiami: {
    pazienteId: 'paziente_id',
    dataScadenza: 'data_scadenza',
    chiaveBot: 'chiave_bot',
  },
  pricelist: {
    richiamoMesi: 'richiamo_mesi',
  },
};

const toDb = (table, obj) => {
  const map = FIELD_MAP[table] || {};
  const out = {};
  Object.keys(obj).forEach((k) => {
    if (k === 'id') return;
    if (UI_ONLY_FIELDS.has(k)) return;
    const dbKey = map[k] || k;
    let val = obj[k];
    if (val === '') val = null;
    out[dbKey] = val;
  });
  return out;
};

const fromDb = (table, row) => {
  const map = FIELD_MAP[table] || {};
  const rev = {};
  Object.entries(map).forEach(([app, db]) => { rev[db] = app; });
  const out = { id: row.id };
  Object.keys(row).forEach((k) => {
    if (k === 'id' || k === 'user_id' || k === 'created_at') return;
    const appKey = rev[k] || k;
    out[appKey] = row[k];
  });
  return out;
};

/* ── DB: interfaccia unificata di accesso dati ── */
// Tabelle che hanno studio_id
const STUDIO_TABLES = new Set(['patients','plans','payments','appointments','implants','pricelist','templates','app_types','impegni_personali','richiami']);

// Recupera studio_id dalla sessione corrente
const getStudioId = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null; // nessuna sessione = nessun accesso
  return session?.user?.app_metadata?.studio_id || '00000000-0000-0000-0000-000000000001';
};

export const DB = {
  async getAll(key) {
    const table = TABLE_MAP[key];
    if (!table) return null;
    let q = supabase.from(table).select('*').order('id', { ascending: true });
    if (STUDIO_TABLES.has(table)) {
      const studioId = await getStudioId();
      if (!studioId) return []; // no session = no data
      q = q.eq('studio_id', studioId);
    }
    const { data, error } = await q;
    if (error) { console.error('DB.getAll', table, error); return []; }
    return (data || []).map((r) => fromDb(table, r));
  },

  async insert(key, obj) {
    const table = TABLE_MAP[key];
    const { data: { user } } = await supabase.auth.getUser();
    let payload = { ...toDb(table, obj), user_id: user.id };
    if (STUDIO_TABLES.has(table)) {
      const studioId = await getStudioId();
      payload.studio_id = studioId;
    }
    const { data, error } = await supabase.from(table).insert(payload).select().single();
    if (error) { console.error('DB.insert', table, error); throw error; }
    return fromDb(table, data);
  },

  async update(key, id, obj) {
    const table = TABLE_MAP[key];
    const payload = toDb(table, obj);
    const { error } = await supabase.from(table).update(payload).eq('id', id);
    if (error) { console.error('DB.update', table, error); throw error; }
  },

  async remove(key, id) {
    const table = TABLE_MAP[key];
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) { console.error('DB.remove', table, error); throw error; }
  },

  async getStudioInfo() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase.from('studio_info').select('*').eq('user_id', user.id).maybeSingle();
    if (error) { console.error('DB.getStudioInfo', error); return null; }
    if (!data) return null;
    const { user_id, updated_at, ...rest } = data;
    return rest;
  },

  async setStudioInfo(obj) {
    const { data: { user } } = await supabase.auth.getUser();
    const payload = { ...obj, user_id: user.id, updated_at: new Date().toISOString() };
    const { error } = await supabase.from('studio_info').upsert(payload, { onConflict: 'user_id' });
    if (error) { console.error('DB.setStudioInfo', error); throw error; }
  },
};
