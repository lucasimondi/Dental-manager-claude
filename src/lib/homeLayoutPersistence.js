import { createDefaultHomeLayout, normalizeHomeLayout, serializeHomeLayout } from './homeWidgetRegistry.js';

const requireIdentity = (studioId, userId) => {
  if (!studioId || !userId) throw new Error('Identità studio/utente non disponibile');
};

export async function loadUserHomeLayout(client, studioId, userId) {
  requireIdentity(studioId, userId);
  const { data, error } = await client.from('user_home_layouts')
    .select('layout')
    .eq('studio_id', studioId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? normalizeHomeLayout(data.layout) : null;
}

export async function loadStudioHomeLayout(client, studioId) {
  if (!studioId) throw new Error('Identità studio non disponibile');
  const { data, error } = await client.from('studio_home_layouts')
    .select('layout')
    .eq('studio_id', studioId)
    .maybeSingle();
  if (error) throw error;
  return data ? normalizeHomeLayout(data.layout) : null;
}

export const resolveHomeLayout = ({ userLayout, studioLayout }) => {
  if (userLayout) return { layout: normalizeHomeLayout(userLayout), source: 'user' };
  if (studioLayout) return { layout: normalizeHomeLayout(studioLayout), source: 'studio' };
  return { layout: createDefaultHomeLayout(), source: 'platform' };
};

export async function loadResolvedHomeLayout(client, studioId, userId) {
  requireIdentity(studioId, userId);
  const [userLayout, studioLayout] = await Promise.all([
    loadUserHomeLayout(client, studioId, userId),
    loadStudioHomeLayout(client, studioId),
  ]);
  const resolved = resolveHomeLayout({ userLayout, studioLayout });
  return {
    ...resolved,
    inheritedLayout: studioLayout || createDefaultHomeLayout(),
    inheritedSource: studioLayout ? 'studio' : 'platform',
  };
}

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
  return payload.layout;
}

export async function deleteUserHomeLayout(client, studioId, userId) {
  requireIdentity(studioId, userId);
  const { error } = await client.from('user_home_layouts')
    .delete()
    .eq('studio_id', studioId)
    .eq('user_id', userId);
  if (error) throw error;
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
  return payload.layout;
}
