/* POL-AI-002A §18-22 / POL-AI-002B suggest-first revision — deterministic
   navigation aliases. Bare aliases feed ranked search suggestions; only
   intentEngine-confirmed navigation phrases may resolve one into a route.
   This keeps useful prefix dictionaries without letting a noun execute.

   Every target below was verified against the real NAV array in
   src/lib/utils.js before being registered — see the header comment on
   each block. "Fatture" is NOT a standalone page in this app (verified:
   ArchivioDocs.jsx loads all documents across
   `documenti_fiscali`/`documenti_medici` and filters them client-side via
   its own `filtroTipo` state, whose values include 'ricetta'/'fattura' —
   there is no dedicated route). Their commands therefore open the real
   `archivio` route with that filter pre-applied (see poliedraCore.js's
   direct-navigation handling and the `initialFiltroTipo` prop threaded
   through App.jsx → ArchivioDocs.jsx) instead of inventing a route. */

// [aliases[], navId, filtroTipo?] — filtroTipo is used for destinations
// that land pre-filtered inside the real `archivio` page.
const COMMAND_GROUPS = [
  [['paz', 'paziente', 'pazienti'], 'paz'],
  [['pre', 'prev', 'preventivo', 'preventivi'], 'piani'],
  [['pag', 'paga', 'pagamento', 'pagamenti'], 'paga'],
  [['age', 'agenda'], 'agenda'],
  [['spe', 'spesa', 'spese'], 'spese'],
  [['rich', 'richi', 'richiamo', 'richiami'], 'richiami'],
  [['doc', 'documento', 'documenti'], 'archivio', 'tutti'],
  [['fat', 'fatt', 'fattura', 'fatture'], 'archivio', 'fattura'],
  [['ric', 'rice', 'ricetta', 'ricette'], 'archivio', 'ricetta'],
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

const FILTER_LABELS = Object.freeze({
  fattura: 'Fatture',
  ricetta: 'Ricette',
});

/**
 * Prefix suggestions stay deterministic and permission-filtered. A short
 * "ric" intentionally matches both Ricette and Richiami rather than guessing.
 */
export function resolveCommandAliasSuggestions(query, navigationIndex = []) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  const permitted = new Map(navigationIndex.map((item) => [item.id, item]));
  const byDestination = new Map();

  for (const [alias, destination] of Object.entries(COMMAND_ALIASES)) {
    if (!alias.startsWith(q)) continue;
    const navigation = permitted.get(destination.navId);
    if (!navigation) continue;
    const key = destination.filtroTipo && destination.filtroTipo !== 'tutti'
      ? `${destination.navId}:${destination.filtroTipo}`
      : destination.navId;
    const score = alias === q ? 1000 : 500 - (alias.length - q.length);
    const existing = byDestination.get(key);
    if (existing && existing.score >= score) continue;
    byDestination.set(key, {
      score,
      item: {
        kind: 'section',
        id: key,
        label: FILTER_LABELS[destination.filtroTipo] || navigation.label,
        icon: navigation.icon,
        data: {
          ...navigation,
          page: destination.navId,
          filtroTipo: destination.filtroTipo,
        },
      },
    });
  }

  return [...byDestination.values()]
    .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label, 'it'))
    .map(({ item }) => item);
}
