const INTELLIGENCE_QUERY_PATTERNS = Object.freeze([
  /\b(?:chi|quali pazient\w*|ci sono pazient\w*)\b.*\b(?:deve|devono|dovrebbe|dovrebbero)\s+(?:prendere|prenotare|fissare)\s+(?:(?:un|una)\s+)?(?:nuov\w+\s+)?appuntament\w*/i,
  /\b(?:chi|quali pazient\w*|pazient\w*)\b.*\b(?:devo|dobbiamo|da)\s+(?:contattare|richiamare)\b/i,
  /\b(?:chi|quali)\b.*\b(?:rischiamo di perdere|persi|a rischio|dimenticat)\w*/i,
  /\b(?:cure|terapie|prestazioni|piani?)\b.*\b(?:finire|incomplet|non eseguit|sospes)\w*/i,
  /\b(?:senza|non ha|non hanno)\b.*\b(?:prossim\w* appuntamento|appuntamento futuro)/i,
  /\b(?:schede?|dati|record|cartelle?)\b.*\b(?:incomplet|mancant|qualit[aà])/i,
  /\b(?:studio data health|data health)\b/i,
]);

export function classifyIntelligenceQuery(query) {
  const normalized = String(query || '').trim();
  if (!normalized) return null;
  return INTELLIGENCE_QUERY_PATTERNS.some((pattern) => pattern.test(normalized))
    ? { type: 'INTELLIGENCE_SCAN', confidence: 0.95, entities: { raw: normalized } }
    : null;
}
