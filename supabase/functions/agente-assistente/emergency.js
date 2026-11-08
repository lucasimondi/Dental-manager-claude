// Poliedron deterministic emergency core: used only when the LLM provider does
// not answer. Read-only by design: a write that the core-first path did not
// already own is never guessed here. Complete direct commands (book, move,
// cancel, notes, recalls, payments…) are executed earlier by the core-first
// path without any LLM, so the answer points the user to that direct form
// instead of only saying "AI unavailable" (PO 2026-11-08).
import { parseDay } from './poliedron-agenda.js';
export const emergencyCoreVersion = '2';

/** Direct commands Poliedron executes without the AI (core-first path). */
export const DIRECT_COMMAND_EXAMPLES = Object.freeze([
  'Fissa Mario Rossi domani alle 15 per igiene',
  'Sposta l’appuntamento di Mario Rossi a venerdì alle 10',
  'Agenda di domani',
  'Ho spazio giovedì?',
  'Cerca paziente Rossi',
  'Richiami',
  'Fatturato del mese',
]);

export function emergencyIntent(text = '') {
  const q = String(text).toLowerCase().trim();
  if (!q) return null;
  const write = /\b(crea|aggiungi|inserisci|fissa|prenota|sposta|cancella|elimina|annulla|modifica|registra|segna|paga|incassa|ricordami)\b/;
  if (write.test(q)) return { kind: 'blocked_write', confidence: 1 };
  if (/\b(richiam\w*|controlli? periodici?)\b/.test(q)) return { kind: 'tool', tool: 'richiami', input: { entro_giorni: 30 }, confidence: .99 };
  if (/\b(incassat\w*|fatturat\w*|ebitda|break[ -]?even|margine\w*|situazione economica|kpi)\b/.test(q)) return { kind: 'tool', tool: 'kpi_controllo_gestione', input: {}, confidence: .98 };
  if (/\b(agenda|appuntament\w*)\b/.test(q)) {
    // Any day the core can read: oggi/domani, weekdays, "il 12", "12/11", "12 novembre".
    const day = parseDay(q);
    if (day) {
      const { confidence, ...entities } = day;
      return { kind: 'tool', tool: 'appuntamenti', input: { day: entities }, confidence: .99 };
    }
    return { kind: 'needs_clarification', message: 'Per quale giorno vuoi vedere gli appuntamenti? Ad esempio «agenda di domani» o «agenda di venerdì».', confidence: .99 };
  }
  const p = q.match(/^(?:cerca|trova|scheda)\s+(?:paziente\s+)?(.{2,80})$/);
  if (p) return { kind: 'tool', tool: 'cerca_pazienti', input: { query: p[1].trim() }, confidence: .97 };
  return null;
}

const examples = (list) => list.map((x) => `«${x}»`).join(', ');

export function emergencyMessage(intent) {
  if (!intent) return `Questa richiesta ha bisogno dell’AI, che adesso non risponde. Senza AI eseguo i comandi diretti, ad esempio: ${examples(DIRECT_COMMAND_EXAMPLES)}.`;
  if (intent.kind === 'blocked_write') return `Non ho riconosciuto il comando con certezza, quindi non ho modificato nulla. Scrivilo in forma diretta, ad esempio: ${examples(DIRECT_COMMAND_EXAMPLES.slice(0, 2))}.`;
  return intent.kind === 'needs_clarification' ? intent.message : null;
}
