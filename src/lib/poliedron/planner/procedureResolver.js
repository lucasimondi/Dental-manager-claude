/* POL-AI-005A §11 — deterministic procedure resolution.
   There is NO canonical procedure ID anywhere in this app's real schema
   (see docs/architecture/POL-AI-005A-domain-audit.md,
   MISSING_ABSTRACTIONS #1): `voce.prestazione` is a free-text string,
   loosely matched against `pricelist.nome` by the existing UI
   (Piani.jsx's `selPr`). This resolver formalizes that same relationship
   deterministically instead of inventing a catalog that doesn't exist.
   The model (see modelFallbackContract.js) is never allowed to hand back
   an authoritative procedure id/row — only free text this resolver then
   matches, exactly like a human typing into the existing form. */

import { normalizza } from '../../ricercaPazienti.js';

export const PROCEDURE_RESOLUTION_STATUS = Object.freeze({
  RESOLVED: 'RESOLVED',
  AMBIGUOUS: 'AMBIGUOUS',
  NOT_FOUND: 'NOT_FOUND',
});

// Small, explicit alias table for common Italian singular/plural and
// clinical-shorthand variants of the dental procedures used in the
// documented command families. Deliberately narrow — anything not covered
// here still works via the substring/prefix "strong match" fallback below,
// or falls through to NOT_FOUND (never invented).
const PROCEDURE_ALIASES = Object.freeze({
  otturazioni: 'otturazione',
  devitalizzazioni: 'devitalizzazione',
  'terapia canalare': 'devitalizzazione',
  endodonzia: 'devitalizzazione',
  corone: 'corona',
  'corona in zirconio': 'corona zirconio',
  perni: 'perno in fibra',
  perno: 'perno in fibra',
});

const singularize = (normalized) => {
  if (PROCEDURE_ALIASES[normalized]) return PROCEDURE_ALIASES[normalized];
  if (normalized.endsWith('zioni')) return `${normalized.slice(0, -5)}zione`;
  return normalized;
};

/**
 * resolveProcedure(procedureText, pricelist, { aliases }) ->
 *   { status, candidate, candidates, normalizedText, aliasApplied }
 *
 * `pricelist` is the caller's already tenant-scoped `pricelist` array
 * (`{ nome, prezzo, ... }`). A NOT_FOUND result is not an error — it means
 * the procedure text is preserved as-is (a human can type any procedure
 * name in the real form too) but its price cannot be resolved
 * deterministically (see PRICE_UNRESOLVED in actionPlanner.js).
 */
export function resolveProcedure(procedureText, pricelist = [], { aliases = {} } = {}) {
  const raw = (procedureText || '').trim();
  if (!raw) return { status: PROCEDURE_RESOLUTION_STATUS.NOT_FOUND, candidate: null, candidates: [], normalizedText: '' };

  const mergedAliases = { ...PROCEDURE_ALIASES, ...aliases };
  let normalizedText = normalizza(raw);
  let aliasApplied = false;
  if (mergedAliases[normalizedText]) {
    normalizedText = normalizza(mergedAliases[normalizedText]);
    aliasApplied = true;
  } else {
    const singular = singularize(normalizedText);
    if (singular !== normalizedText) { normalizedText = singular; aliasApplied = true; }
  }

  // 1. exact normalized match
  const exact = pricelist.filter((item) => normalizza(item.nome) === normalizedText);
  if (exact.length === 1) {
    return { status: PROCEDURE_RESOLUTION_STATUS.RESOLVED, candidate: exact[0], candidates: exact, normalizedText, aliasApplied };
  }
  if (exact.length > 1) {
    return { status: PROCEDURE_RESOLUTION_STATUS.AMBIGUOUS, candidate: null, candidates: exact, normalizedText, aliasApplied };
  }

  // 2. strong canonical match: normalized text is a prefix/substring of a
  // pricelist name, or vice versa — mirrors how a human scanning a
  // dropdown would recognize "otturazione" inside "Otturazione composita".
  const strong = pricelist.filter((item) => {
    const name = normalizza(item.nome);
    return name.includes(normalizedText) || normalizedText.includes(name);
  });
  if (strong.length === 1) {
    return { status: PROCEDURE_RESOLUTION_STATUS.RESOLVED, candidate: strong[0], candidates: strong, normalizedText, aliasApplied };
  }
  if (strong.length > 1) {
    return { status: PROCEDURE_RESOLUTION_STATUS.AMBIGUOUS, candidate: null, candidates: strong, normalizedText, aliasApplied };
  }

  // 3. not found in the pricelist — the procedure text is still preserved
  // by the caller (see actionPlanner.js), just without a resolved price.
  return { status: PROCEDURE_RESOLUTION_STATUS.NOT_FOUND, candidate: null, candidates: [], normalizedText, aliasApplied };
}
