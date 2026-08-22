/* POL-AI-002A §18-22 — deterministic prefix/command navigation.
   `commandAliases` are SEPARATE from the fuzzy/partial search aliases in
   navigationIndex.js (§21: partial search must keep working — typing
   "ross" must still show Mario Rossi/Anna Rossi in PAZIENTI, never be
   swallowed by a command match). A commandAlias only fires on an EXACT,
   trimmed, case-insensitive match of the WHOLE query — never a prefix or
   fuzzy match — so there is no ambiguity engine to get wrong (§22): each
   key in this table maps to exactly one destination by construction, and
   a dev-time uniqueness check below catches an accidental duplicate key
   before it can silently shadow another entry.

   §19's exact ambiguity ("ric" for Ricette vs "Richiami" also starting
   with "ric") is resolved the same way the task itself specifies: "ric"/
   "rice" belong only to Ricette, "rich"/"richi" only to Richiami — never
   a shared/overlapping short form.

   Every target below was verified against the real NAV array in
   src/lib/utils.js before being registered — see the header comment on
   each block. "Ricette" and "Fatture" are NOT standalone pages in this
   app (verified: ArchivioDocs.jsx loads all documents across
   `documenti_fiscali`/`documenti_medici` and filters them client-side via
   its own `filtroTipo` state, whose values include 'ricetta'/'fattura' —
   there is no dedicated route). Their commands therefore open the real
   `archivio` route with that filter pre-applied (see poliedraCore.js's
   direct-navigation handling and the `initialFiltroTipo` prop threaded
   through App.jsx → ArchivioDocs.jsx) instead of inventing a route. */

// [aliases[], navId, filtroTipo?] — filtroTipo only for the two entries
// that land pre-filtered inside the real `archivio` page.
const COMMAND_GROUPS = [
  [['paz', 'paziente', 'pazienti'], 'paz'],
  [['pre', 'prev', 'preventivo', 'preventivi'], 'piani'],
  [['pag', 'paga', 'pagamento', 'pagamenti'], 'paga'],
  [['age', 'agenda'], 'agenda'],
  [['spe', 'spesa', 'spese'], 'spese'],
  [['rich', 'richi', 'richiamo', 'richiami'], 'richiami'],
  [['doc', 'documento', 'documenti'], 'archivio', 'tutti'],
  [['ric', 'rice', 'ricetta', 'ricette'], 'archivio', 'ricetta'],
  [['fat', 'fatt', 'fattura', 'fatture'], 'archivio', 'fattura'],
];

const entries = [];
for (const [aliases, navId, filtroTipo] of COMMAND_GROUPS) {
  for (const alias of aliases) {
    entries.push([alias, Object.freeze({ navId, filtroTipo: filtroTipo || null })]);
  }
}

// Dev-time integrity check: a duplicate key here would silently shadow an
// earlier entry in the Object.fromEntries below — surfacing it loudly
// (rather than trusting object-literal "last write wins") is what keeps
// §22's "never ambiguous" guarantee actually true as this table grows.
const seen = new Set();
for (const [alias] of entries) {
  if (seen.has(alias)) throw new Error(`poliedron commandAliases: duplicate alias "${alias}"`);
  seen.add(alias);
}

export const COMMAND_ALIASES = Object.freeze(Object.fromEntries(entries));

/**
 * resolveCommandAlias(query) -> { navId, filtroTipo } | null
 * EXACT match only (trimmed, lowercased) — never a prefix/fuzzy match, so
 * a normal search query like "ross" or "pagamento di mario" never
 * triggers a direct navigation (§21).
 */
export function resolveCommandAlias(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return null;
  return COMMAND_ALIASES[q] || null;
}
