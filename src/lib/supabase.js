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
// POL-UI-026: `createdAt` è generato dal DB (default now(), mai scritto
// dall'app) — esposto in lettura da fromDb sotto, ma non deve mai tornare
// indietro in una insert/update.
const UI_ONLY_FIELDS = new Set(['_presetScadenza', '_editId', 'createdAt']);

/* ── CONVERSIONE CAMPI: app (camelCase) <-> db (snake_case) ── */
const FIELD_MAP = {
  patients: {
    dataNascita: 'data_nascita',
    anamnesiCompilataIl: 'anamnesi_compilata_il',
    anamnesiNota: 'anamnesi_nota',
    anamnesiAllarme: 'anamnesi_allarme',
    anamnesiAllarmeDettagli: 'anamnesi_allarme_dettagli',
    createdAt: 'created_at',
  },
  plans: {
    pazienteId: 'paziente_id',
    scontoTipo: 'sconto_tipo',
    scadenzaPagamento: 'scadenza_pagamento',
  },
  payments: {
    pazienteId: 'paziente_id',
    pianoId: 'piano_id',
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
    recurrenceId: 'recurrence_id',
  },
  richiami: {
    pazienteId: 'paziente_id',
    dataScadenza: 'data_scadenza',
    chiaveBot: 'chiave_bot',
  },
  pricelist: {
    richiamoMesi: 'richiamo_mesi',
    durataMinuti: 'durata_minuti',
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
    // POL-UI-026: `created_at` used to be dropped unconditionally here —
    // the only place a patient's real creation date could have come from,
    // which is why "nuovi pazienti" fell back to guessing from `id`
    // (a sequential bigint PK, not a timestamp) and always read zero. Now
    // mapped like any other column (see FIELD_MAP.patients.createdAt).
    if (k === 'id' || k === 'user_id') return;
    const appKey = rev[k] || k;
    out[appKey] = row[k];
  });
  return out;
};

/* ── DB: interfaccia unificata di accesso dati ── */
// Tabelle che hanno studio_id
const STUDIO_TABLES = new Set(['patients','plans','payments','appointments','implants','pricelist','templates','app_types','impegni_personali','richiami']);

// Client-side defense in depth only: RLS remains authoritative. Accept legacy
// PostgreSQL UUIDs too (no version/variant constraint), never invent a tenant.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const getTenantContext = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    const user = data?.session?.user;
    const studioId = user?.app_metadata?.studio_id;
    if (error || !user?.id || typeof studioId !== 'string' || !UUID.test(studioId)) return null;
    return { studioId, userId: user.id };
  } catch {
    return null;
  }
};

const tenantRequired = () => Object.assign(
  new Error('Sessione o studio non disponibile. Accedi nuovamente prima di salvare.'),
  { code: 'TENANT_CONTEXT_REQUIRED' },
);

const requireTenantContext = async () => {
  const context = await getTenantContext();
  if (!context) throw tenantRequired();
  return context;
};

const requireTable = (key) => {
  const table = TABLE_MAP[key];
  if (!table || !STUDIO_TABLES.has(table)) throw new Error('Tabella non supportata');
  return table;
};

// For inserts/upserts, keep the verified author and session in agreement.
const requireTenantAuthor = async () => {
  const context = await requireTenantContext();
  const { data, error } = await supabase.auth.getUser();
  const verifiedStudioId = data?.user?.app_metadata?.studio_id;
  if (error || data?.user?.id !== context.userId
      || typeof verifiedStudioId !== 'string'
      || verifiedStudioId.toLowerCase() !== context.studioId.toLowerCase()) {
    throw tenantRequired();
  }
  return context;
};

export const DB = {
  async getAll(key) {
    const table = TABLE_MAP[key];
    if (!table || !STUDIO_TABLES.has(table)) return null;
    const context = await getTenantContext();
    if (!context) return [];
    const q = supabase.from(table).select('*').order('id', { ascending: true })
      .eq('studio_id', context.studioId);
    const { data, error } = await q;
    if (error) { console.error('DB.getAll', table, error); return []; }
    return (data || []).map((r) => fromDb(table, r));
  },

  // POL-AI-005B: fresh single-row read by id, tenant-scoped defense-in-depth
  // (RLS remains the actual authority) — used for post-write verification
  // and TOCTOU-safe re-checks immediately before a write, without adding a
  // second field-mapping implementation next to toDb/fromDb above.
  async getById(key, id) {
    const table = TABLE_MAP[key];
    if (!table || !STUDIO_TABLES.has(table) || id === undefined || id === null) return null;
    const context = await getTenantContext();
    if (!context) return null;
    const q = supabase.from(table).select('*').eq('id', id)
      .eq('studio_id', context.studioId);
    const { data, error } = await q.maybeSingle();
    if (error) { console.error('DB.getById', table, error); return null; }
    return data ? fromDb(table, data) : null;
  },

  async insert(key, obj) {
    const table = requireTable(key);
    const { studioId, userId } = await requireTenantAuthor();
    const payload = { ...toDb(table, obj), user_id: userId, studio_id: studioId };
    const { data, error } = await supabase.from(table).insert(payload).select().single();
    if (error) { console.error('DB.insert', table, error); throw error; }
    return fromDb(table, data);
  },

  async update(key, id, obj) {
    const table = requireTable(key);
    const { studioId } = await requireTenantContext();
    const payload = toDb(table, obj);
    // Rows returned by fromDb carry studio_id; never allow a tenant transfer.
    delete payload.studio_id;
    const { error } = await supabase.from(table).update(payload).eq('id', id).eq('studio_id', studioId);
    if (error) { console.error('DB.update', table, error); throw error; }
  },

  async remove(key, id) {
    const table = requireTable(key);
    const { studioId } = await requireTenantContext();
    const { error } = await supabase.from(table).delete().eq('id', id).eq('studio_id', studioId);
    if (error) { console.error('DB.remove', table, error); throw error; }
  },

  async getStudioInfo() {
    let context;
    try { context = await requireTenantAuthor(); } catch { return null; }
    const { studioId } = context;
    const { data, error } = await supabase.from('studio_info').select('*').eq('studio_id', studioId).maybeSingle();
    if (error) { console.error('DB.getStudioInfo', error); return null; }
    if (!data) return null;
    const { user_id, updated_at, ...rest } = data;
    return rest;
  },

  // studio_info è condivisa da tutti gli utenti dello stesso studio (chiave studio_id,
  // non user_id): un collaboratore che modifica logo/colori/orari li aggiorna per tutti.
  async setStudioInfo(obj) {
    const { studioId, userId } = await requireTenantAuthor();
    const payload = { ...obj, studio_id: studioId, user_id: userId, updated_at: new Date().toISOString() };
    const { error } = await supabase.from('studio_info').upsert(payload, { onConflict: 'studio_id' });
    if (error) { console.error('DB.setStudioInfo', error); throw error; }
  },
};
