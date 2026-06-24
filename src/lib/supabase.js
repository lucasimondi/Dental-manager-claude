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
};

/* ── CONVERSIONE CAMPI: app (camelCase) <-> db (snake_case) ── */
const FIELD_MAP = {
  patients: { dataNascita: 'data_nascita' },
  plans: { pazienteId: 'paziente_id', scontoTipo: 'sconto_tipo' },
  payments: { pazienteId: 'paziente_id' },
  appointments: { pazienteId: 'paziente_id' },
  implants: { pazienteId: 'paziente_id', planId: 'plan_id' },
};

const toDb = (table, obj) => {
  // campi temporanei UI da non salvare su Supabase
  const UI_ONLY = new Set(["_presetScadenza"]);
  const map = FIELD_MAP[table] || {};
  const out = {};
  Object.keys(obj).forEach((k) => {
    if (k === "id") return;
    if (UI_ONLY.has(k)) return;
    const dbKey = map[k] || k;
    let val = obj[k];
    // Postgres rifiuta stringhe vuote per colonne date/numeriche: convertiamo '' in null
    if (val === '') val = null;
    out[dbKey] = val;
  });
  return out;
};

const fromDb = (table, row) => {
  const map = FIELD_MAP[table] || {};
  const rev = {};
  Object.entries(map).forEach(([app, db]) => {
    rev[db] = app;
  });
  const out = { id: row.id };
  Object.keys(row).forEach((k) => {
    if (k === 'id' || k === 'user_id' || k === 'created_at') return;
    const appKey = rev[k] || k;
    out[appKey] = row[k];
  });
  return out;
};

/* ── DB: interfaccia unificata di accesso dati ── */
export const DB = {
  async getAll(key) {
    const table = TABLE_MAP[key];
    if (!table) return null;
    const { data, error } = await supabase.from(table).select('*').order('id', { ascending: true });
    if (error) {
      console.error('DB.getAll', table, error);
      return [];
    }
    return (data || []).map((r) => fromDb(table, r));
  },

  async insert(key, obj) {
    const table = TABLE_MAP[key];
    const { data: { user } } = await supabase.auth.getUser();
    const payload = { ...toDb(table, obj), user_id: user.id };
    const { data, error } = await supabase.from(table).insert(payload).select().single();
    if (error) {
      console.error('DB.insert', table, error);
      throw error;
    }
    return fromDb(table, data);
  },

  async update(key, id, obj) {
    const table = TABLE_MAP[key];
    const payload = toDb(table, obj);
    const { error } = await supabase.from(table).update(payload).eq('id', id);
    if (error) {
      console.error('DB.update', table, error);
      throw error;
    }
  },

  async remove(key, id) {
    const table = TABLE_MAP[key];
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
      console.error('DB.remove', table, error);
      throw error;
    }
  },

  async getStudioInfo() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase.from('studio_info').select('*').eq('user_id', user.id).maybeSingle();
    if (error) {
      console.error('DB.getStudioInfo', error);
      return null;
    }
    if (!data) return null;
    const { user_id, updated_at, ...rest } = data;
    return rest;
  },

  async setStudioInfo(obj) {
    const { data: { user } } = await supabase.auth.getUser();
    const payload = { ...obj, user_id: user.id, updated_at: new Date().toISOString() };
    const { error } = await supabase.from('studio_info').upsert(payload, { onConflict: 'user_id' });
    if (error) {
      console.error('DB.setStudioInfo', error);
      throw error;
    }
  },
};
