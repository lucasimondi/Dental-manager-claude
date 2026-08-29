/* POL-FIN-002 — client for the canonical per-plan receivable balance.
   The formula (saldo_piano/eseguito_non_pagato/acconto, FIFO-by-plan-date
   payment allocation) lives ONLY in the get_saldo_piano/get_saldi_aperti_studio
   Postgres functions (supabase/migrations/20260829180000_...). Components
   must call these, never recompute the balance client-side. */

import { supabase } from '../supabase.js';

const ZERO_SALDO = { totale_piano: 0, totale_eseguito: 0, totale_pagato: 0, saldo_piano: 0, eseguito_non_pagato: 0, acconto: 0 };

export { aggregateSaldi } from './incassiMath.js';

export async function fetchSaldoPiano(pianoId) {
  if (pianoId === undefined || pianoId === null) return null;
  const { data, error } = await supabase.rpc('get_saldo_piano', { p_piano_id: pianoId });
  if (error) { console.error('fetchSaldoPiano', pianoId, error); return null; }
  return data?.[0] || { ...ZERO_SALDO };
}

/** Fetches get_saldo_piano for each plan id (deduplicated) in parallel and
 *  returns a { [pianoId]: row } map. A plan the RPC couldn't resolve is
 *  omitted from the map rather than defaulted to zero, so callers can tell
 *  "still loading / failed" apart from "genuinely zero balance". */
export async function fetchSaldiPiani(pianoIds) {
  const unique = [...new Set((pianoIds || []).filter((id) => id !== undefined && id !== null))];
  const results = await Promise.all(unique.map((id) => fetchSaldoPiano(id)));
  const map = {};
  unique.forEach((id, i) => { if (results[i]) map[id] = results[i]; });
  return map;
}

export async function fetchSaldiApertiStudio(studioId) {
  if (!studioId) return [];
  const { data, error } = await supabase.rpc('get_saldi_aperti_studio', { p_studio_id: studioId });
  if (error) { console.error('fetchSaldiApertiStudio', error); throw error; }
  return data || [];
}
