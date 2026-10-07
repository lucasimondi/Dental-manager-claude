// Poliedron deterministic emergency core. Read-only by design.
export const emergencyCoreVersion = '1';

export function emergencyIntent(text = '') {
  const q = String(text).toLowerCase().trim();
  if (!q) return null;
  const write = /\b(crea|aggiungi|inserisci|fissa|sposta|cancella|elimina|modifica|registra|segna|paga|incassa)\b/;
  if (write.test(q)) return { kind: 'blocked_write', confidence: 1 };
  if (/\b(richiam|controlli? periodici?)\b/.test(q)) return { kind: 'tool', tool: 'richiami', input: { entro_giorni: 30 }, confidence: .99 };
  if (/\b(incassat\w*|fatturat\w*|ebitda|break[ -]?even|margine\w*|situazione economica|kpi)\b/.test(q)) return { kind: 'tool', tool: 'kpi_controllo_gestione', input: {}, confidence: .98 };
  if (/\b(agenda|appuntament)\b/.test(q)) {
    if (/\bdomani\b/.test(q)) return { kind: 'tool', tool: 'appuntamenti', input: { relative_day: 1 }, confidence: .99 };
    if (/\boggi\b/.test(q)) return { kind: 'tool', tool: 'appuntamenti', input: { relative_day: 0 }, confidence: .99 };
    return { kind: 'needs_clarification', message: 'Per quale giorno vuoi vedere gli appuntamenti?', confidence: .99 };
  }
  const p = q.match(/^(?:cerca|trova|scheda)\s+(?:paziente\s+)?(.{2,80})$/);
  if (p) return { kind: 'tool', tool: 'cerca_pazienti', input: { query: p[1].trim() }, confidence: .97 };
  return null;
}

export function emergencyMessage(intent) {
  if (!intent) return 'I servizi AI sono temporaneamente indisponibili. Posso comunque consultare agenda, pazienti, richiami e KPI.';
  if (intent.kind === 'blocked_write') return 'I servizi AI sono temporaneamente indisponibili. Per sicurezza non eseguo modifiche in modalità essenziale, ma posso consultare agenda, pazienti, richiami e KPI.';
  return intent.kind === 'needs_clarification' ? intent.message : null;
}
