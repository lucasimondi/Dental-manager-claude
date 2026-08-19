import { normalizeHomeLayout, serializeHomeLayout } from './homeWidgetRegistry.js';

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
  return normalizeHomeLayout(data?.layout);
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
