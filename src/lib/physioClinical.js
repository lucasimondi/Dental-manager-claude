import { supabase } from './supabase.js';

const fail = (message, error) => {
  const detail = error?.message ? `: ${error.message}` : '';
  throw new Error(`${message}${detail}`);
};

export async function currentClinicalUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) fail('Sessione clinica non disponibile', error);
  return data.user.id;
}

export async function loadPhysioEpisodes(studioId, patientId) {
  const { data, error } = await supabase.from('physio_episodes_v1').select('*')
    .eq('studio_id', studioId).eq('patient_id', patientId)
    .order('started_on', { ascending: false });
  if (error) fail('Impossibile caricare gli episodi', error);
  return data || [];
}

export async function loadPhysioEpisode(studioId, episodeId) {
  const queries = [
    supabase.from('physio_anamneses_v1').select('*').eq('studio_id', studioId).eq('episode_id', episodeId).maybeSingle(),
    supabase.from('physio_body_maps_v1').select('*').eq('studio_id', studioId).eq('episode_id', episodeId).order('recorded_at', { ascending: false }),
    supabase.from('physio_problems_v1').select('*').eq('studio_id', studioId).eq('episode_id', episodeId).order('detected_on'),
    supabase.from('physio_goals_v1').select('*').eq('studio_id', studioId).eq('episode_id', episodeId).order('created_at'),
    supabase.from('physio_plan_versions_v1').select('*').eq('studio_id', studioId).eq('episode_id', episodeId).order('version_number', { ascending: false }),
    supabase.from('physio_clinical_notes_v1').select('*').eq('studio_id', studioId).eq('episode_id', episodeId).order('occurred_at', { ascending: false }),
    supabase.from('physio_outcomes_v1').select('*').eq('studio_id', studioId).eq('episode_id', episodeId).order('recorded_at', { ascending: false }),
  ];
  const results = await Promise.all(queries);
  const rejected = results.find((result) => result.error);
  if (rejected) fail('Impossibile caricare la cartella clinica', rejected.error);
  return {
    anamnesis: results[0].data,
    bodyMaps: results[1].data || [],
    problems: results[2].data || [],
    goals: results[3].data || [],
    plans: results[4].data || [],
    notes: results[5].data || [],
    outcomes: results[6].data || [],
  };
}

export async function createPhysioEpisode(studioId, patientId, input) {
  const userId = await currentClinicalUserId();
  const { data, error } = await supabase.from('physio_episodes_v1').insert({
    studio_id: studioId, patient_id: patientId, created_by: userId,
    title: input.title.trim(), primary_problem: input.primaryProblem?.trim() || null,
    body_region: input.bodyRegion?.trim() || null, status: 'active',
    responsible_user_id: userId,
  }).select('*').single();
  if (error) fail('Impossibile creare l’episodio', error);
  return data;
}

export async function savePhysioAnamnesis(studioId, episodeId, values) {
  const userId = await currentClinicalUserId();
  const payload = { ...values, studio_id: studioId, episode_id: episodeId, created_by: userId, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from('physio_anamneses_v1').upsert(payload, { onConflict: 'studio_id,episode_id' }).select('*').single();
  if (error) fail('Impossibile salvare l’anamnesi', error);
  return data;
}

export async function saveBodyMap(studioId, episodeId, view, markers, note) {
  const userId = await currentClinicalUserId();
  const { data, error } = await supabase.from('physio_body_maps_v1').insert({
    studio_id: studioId, episode_id: episodeId, created_by: userId,
    view, markers, drawing: [], note: note?.trim() || null,
  }).select('*').single();
  if (error) fail('Impossibile salvare la body map', error);
  return data;
}

export async function saveClinicalNote(studioId, episodeId, values, noteId = null) {
  const userId = await currentClinicalUserId();
  const payload = {
    studio_id: studioId, episode_id: episodeId, created_by: userId,
    note_type: values.note_type || 'session', status: 'draft',
    pre_pain: values.pre_pain === '' ? null : Number(values.pre_pain),
    trend: values.trend || null, subjective_update: values.subjective_update || null,
    interventions: values.interventions || null, exercises: values.exercises || null,
    response: values.response || null,
    post_pain: values.post_pain === '' ? null : Number(values.post_pain),
    home_instructions: values.home_instructions || null, next_step: values.next_step || null,
    adverse_events: values.adverse_events || null, free_note: values.free_note || null,
    copied_from_id: values.copied_from_id || null,
  };
  const query = noteId
    ? supabase.from('physio_clinical_notes_v1').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', noteId).eq('status', 'draft')
    : supabase.from('physio_clinical_notes_v1').insert(payload);
  const { data, error } = await query.select('*').single();
  if (error) fail('Impossibile salvare la bozza', error);
  return data;
}

export async function finalizeClinicalNote(studioId, noteId) {
  const userId = await currentClinicalUserId();
  const { data, error } = await supabase.from('physio_clinical_notes_v1').update({
    status: 'finalized', finalized_by: userId, finalized_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('studio_id', studioId).eq('id', noteId).eq('status', 'draft').select('*').single();
  if (error) fail('Impossibile firmare la nota', error);
  return data;
}

export async function amendClinicalNote(studioId, episodeId, original, freeNote) {
  const userId = await currentClinicalUserId();
  const { data, error } = await supabase.from('physio_clinical_notes_v1').insert({
    studio_id: studioId, episode_id: episodeId, created_by: userId,
    note_type: original.note_type, status: 'amendment', amends_note_id: original.id,
    free_note: freeNote.trim(), structured_data: { correction_only: true },
  }).select('*').single();
  if (error) fail('Impossibile registrare la correzione', error);
  return data;
}

export function draftFromPrevious(note) {
  return {
    note_type: 'session', pre_pain: '', trend: '', subjective_update: '',
    interventions: note?.interventions || '', exercises: note?.exercises || '',
    response: '', post_pain: '', home_instructions: note?.home_instructions || '',
    next_step: note?.next_step || '', adverse_events: '', free_note: '', copied_from_id: note?.id || null,
  };
}
