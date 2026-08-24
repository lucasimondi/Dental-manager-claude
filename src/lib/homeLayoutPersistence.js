import { createDefaultHomeLayout, migrateSavedHomeLayout, serializeHomeLayout } from './homeWidgetRegistry.js';
import { resolveDashboardLayout } from './homeDashboardModel.js';

const requireIdentity = (studioId, userId) => {
  if (!studioId || !userId) throw new Error('Identità studio/utente non disponibile');
};

/* POL-UI-015 bugfix round 3: the read-back below compares the RAW jsonb the
   database really holds against the raw payload we sent. It deliberately
   does NOT compare normalized forms: `normalizeHomeLayout` appends any
   registry id missing from a layout, so two different stored records (a
   complete one and a truncated one) normalize to the same result — a
   normalized comparison would silently accept a partial write. */
const rawLayoutFingerprint = (layout) => JSON.stringify(Array.isArray(layout) ? layout : []);

const readUserHomeLayoutRow = async (client, studioId, userId) => {
  const { data, error } = await client.from('user_home_layouts')
    .select('layout')
    .eq('studio_id', studioId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

const readStudioHomeLayoutRow = async (client, studioId) => {
  const { data, error } = await client.from('studio_home_layouts')
    .select('layout')
    .eq('studio_id', studioId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export async function loadUserHomeLayout(client, studioId, userId) {
  requireIdentity(studioId, userId);
  const data = await readUserHomeLayoutRow(client, studioId, userId);
  // POL-UI-015 round 3: `migrateSavedHomeLayout` (not plain
  // `normalizeHomeLayout`) — a pre-POL-UX-001 saved layout carries an
  // explicit stale `richiami: visible:false` that no registry default or
  // role preset can override. See homeWidgetRegistry.js for the proof.
  return data ? migrateSavedHomeLayout(data.layout) : null;
}

export async function loadStudioHomeLayout(client, studioId) {
  if (!studioId) throw new Error('Identità studio non disponibile');
  const data = await readStudioHomeLayoutRow(client, studioId);
  return data ? migrateSavedHomeLayout(data.layout) : null;
}

export const resolveHomeLayout = resolveDashboardLayout;

export async function loadResolvedHomeLayout(client, studioId, userId, roleLayout = null) {
  requireIdentity(studioId, userId);
  const [userLayout, studioLayout] = await Promise.all([
    loadUserHomeLayout(client, studioId, userId),
    loadStudioHomeLayout(client, studioId),
  ]);
  const resolved = resolveHomeLayout({ userLayout, studioLayout, roleLayout });
  return {
    ...resolved,
    inheritedLayout: studioLayout || roleLayout || createDefaultHomeLayout(),
    inheritedSource: studioLayout ? 'studio' : roleLayout ? 'role' : 'platform',
  };
}

/* POL-UI-015 bugfix round 3 — "Personalizza Home non salva realmente la
   configurazione". This function used to return `payload.layout`, i.e.
   the caller's OWN optimistic payload, as soon as the upsert reported no
   error. Nothing ever confirmed that a row was really written, so the
   Dashboard could commit state, close the modal and show a success for a
   write that never landed. Verified against the production project (read
   only): the single `user_home_layouts` row is still stamped
   2026-08-19T19:23Z while the account tested preview #51 on 2026-08-24,
   and the Supabase edge logs for the whole test window contain 132 GET
   requests against `user_home_layouts` and ZERO POST/PATCH/DELETE — so
   the persisted state and the UI's claimed state genuinely diverged.

   The contract is now: UPSERT -> check the upsert response -> READ BACK
   the (studio_id,user_id) record through the normal SELECT path (which
   also exercises the SELECT RLS policy) -> require it to exist AND to
   match what we intended to persist -> return the layout the DATABASE
   holds. Any failure at any of those steps throws, so a false success is
   impossible by construction. The database side was audited and found
   correct and untouched: PK (studio_id,user_id) matches
   `onConflict:'studio_id,user_id'`, RLS is enabled with own-row
   SELECT/INSERT/UPDATE/DELETE policies for `authenticated` gated on an
   active `studio_users` membership, no triggers, jsonb array + 32KB size
   CHECKs. No schema, RLS or migration change was needed or made. */
export async function saveUserHomeLayout(client, studioId, userId, layout) {
  requireIdentity(studioId, userId);
  const payload = {
    studio_id: studioId,
    user_id: userId,
    layout: serializeHomeLayout(layout),
    schema_version: 1,
    updated_at: new Date().toISOString(),
  };
  const { error } = await client.from('user_home_layouts').upsert(payload, { onConflict: 'studio_id,user_id' });
  if (error) throw error;

  const row = await readUserHomeLayoutRow(client, studioId, userId);
  if (!row) {
    throw new Error('Salvataggio non confermato dal database: nessun layout Home persistito per questo utente.');
  }
  if (rawLayoutFingerprint(row.layout) !== rawLayoutFingerprint(payload.layout)) {
    throw new Error('Salvataggio non confermato dal database: il layout Home persistito non corrisponde a quello inviato.');
  }
  return migrateSavedHomeLayout(row.layout);
}

export async function deleteUserHomeLayout(client, studioId, userId) {
  requireIdentity(studioId, userId);
  const { error } = await client.from('user_home_layouts')
    .delete()
    .eq('studio_id', studioId)
    .eq('user_id', userId);
  if (error) throw error;
  // POL-UI-015 round 3: same no-false-success contract as the save path —
  // "Ripristina" must only be reported to the user once the row is really
  // gone from the database.
  const persisted = await loadUserHomeLayout(client, studioId, userId);
  if (persisted) {
    throw new Error('Ripristino non confermato dal database: la personalizzazione Home risulta ancora presente.');
  }
}

export async function saveStudioHomeLayout(client, studioId, userId, layout) {
  requireIdentity(studioId, userId);
  const payload = {
    studio_id: studioId,
    layout: serializeHomeLayout(layout),
    schema_version: 1,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };
  const { error } = await client.from('studio_home_layouts').upsert(payload, { onConflict: 'studio_id' });
  if (error) throw error;

  // POL-UI-015 round 3: verified read-back, same contract as saveUserHomeLayout.
  const row = await readStudioHomeLayoutRow(client, studioId);
  if (!row) {
    throw new Error('Salvataggio non confermato dal database: nessun default Home persistito per questo studio.');
  }
  if (rawLayoutFingerprint(row.layout) !== rawLayoutFingerprint(payload.layout)) {
    throw new Error('Salvataggio non confermato dal database: il default Home persistito non corrisponde a quello inviato.');
  }
  return migrateSavedHomeLayout(row.layout);
}
