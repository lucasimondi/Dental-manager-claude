/* POL-AI-001 §6-7, §24 — federated, deterministic, live search. No
   generative AI is used here — this runs on every keystroke, so it must
   stay cheap and predictable. Reuses cercaPazienti (the exact patient
   fuzzy-match already shared by Pazienti/Agenda/Piani/ArchivioDocs/
   Pagamenti) instead of a second patient-matching algorithm.

   Sources wired in Phase 1 (§6): patients, navigation sections, actions.
   Sources documented as future adapters, per §6's explicit instruction not
   to invent endpoints/tables that don't exist yet as a queryable list in
   this client:
   - appointments (agenda entries) — no client-side searchable index of
     individual appointments exists yet outside a selected day/week/patient
   - documents (archivio) — ArchivioDocs.jsx loads per-patient, not a global
     searchable document index
   - invoices/fatture — no fatture entity exists in this app yet (only
     canonical financial *aggregates*, not individual invoice records)
   - settings — Impostazioni has no internal search index of its own fields
   Each of these becomes a real adapter once/if the underlying list is
   actually loaded somewhere reachable by Poliedron's context, without
   inventing data. */

import { cercaPazienti, normalizza } from '../ricercaPazienti.js';
import { findAction } from './actionRegistry.js';
import { resolveCommandAliasSuggestions } from './commandAliases.js';

export const RESULT_GROUP = Object.freeze({
  PATIENTS: 'PAZIENTI',
  SECTIONS: 'SEZIONI',
  ACTIONS: 'AZIONI',
});

const matchesNav = (item, qNorm) => {
  if (normalizza(item.label).includes(qNorm)) return true;
  return item.aliases.some((a) => normalizza(a).includes(qNorm));
};

/**
 * federatedSearch(query, sources, opts) -> { groups: [{ group, items }], hasResults }
 * `sources`: { patients, navigationIndex, actions } — already permission-
 * filtered by the caller (poliedraCore), so this module never needs to
 * know about RBAC itself.
 * `opts.limit` caps items per group (default 5) so the panel stays fast
 * and scannable rather than dumping the whole dataset on a one-letter query.
 */
export function federatedSearch(query, sources = {}, opts = {}) {
  const limit = opts.limit ?? 5;
  const q = (query || '').trim();
  const qNorm = normalizza(q);
  const groups = [];

  if (q && sources.patients?.length) {
    const patients = cercaPazienti(sources.patients, q).slice(0, limit);
    if (patients.length) groups.push({ group: RESULT_GROUP.PATIENTS, items: patients.map((p) => ({ kind: 'patient', id: p.id, label: `${p.nome} ${p.cognome}`, data: p })) });
  }

  if (q && sources.navigationIndex?.length) {
    const semantic = resolveCommandAliasSuggestions(q, sources.navigationIndex);
    const seen = new Set(semantic.map((item) => item.id));
    const matched = sources.navigationIndex
      .filter((n) => matchesNav(n, qNorm))
      .map((n) => ({ kind: 'section', id: n.id, label: n.label, icon: n.icon, data: n }))
      .filter((item) => !seen.has(item.id));
    const sections = [...semantic, ...matched].slice(0, limit);
    if (sections.length) groups.push({ group: RESULT_GROUP.SECTIONS, items: sections });
  }

  if (q && sources.actions?.length) {
    const actions = sources.actions
      .filter((a) => normalizza(a.label).includes(qNorm) || normalizza(a.description || '').includes(qNorm))
      .slice(0, limit);
    if (actions.length) groups.push({ group: RESULT_GROUP.ACTIONS, items: actions.map((a) => ({ kind: 'action', id: a.id, label: a.label, data: a })) });
  }

  return { groups, hasResults: groups.some((g) => g.items.length > 0) };
}

/* §26 — empty-query state: recent (caller-supplied, not tracked here) +
   a small set of frequent actions + "open current context". Kept separate
   from federatedSearch so an empty query never runs the search algorithm
   at all. */
export function suggestedIdle({ recentActionIds = [], actions = [], navigationIndex = [], context } = {}) {
  const byId = new Map(actions.map((a) => [a.id, a]));
  const recent = recentActionIds.map((id) => byId.get(id)).filter(Boolean);
  const preferredActions = context?.page === 'paz'
    ? ['prescription.create', 'appointment.create', 'payment.create', 'quote.create']
    : ['appointment.create', 'patient.create', 'prescription.create', 'payment.create', 'expense.create', 'document.create'];
  const fallback = preferredActions.map((id) => byId.get(id)).filter(Boolean);
  const actionItems = (recent.length ? recent : fallback).slice(0, 6)
    .map((a) => ({ kind: 'action', id: a.id, label: a.label, description: a.description, data: a }));
  const preferredSections = ['set', 'controllo', 'spese', 'agenda', 'paz', 'paga', 'archivio', 'piani', 'richiami'];
  const sectionById = new Map(navigationIndex.map((item) => [item.id, item]));
  const sectionItems = preferredSections.map((id) => sectionById.get(id)).filter(Boolean).slice(0, 8)
    .map((section) => ({ kind: 'section', id: section.id, label: section.label, icon: section.icon, data: section }));
  return [
    ...(sectionItems.length ? [{ group: 'APRI UNA SEZIONE', items: sectionItems }] : []),
    ...(actionItems.length ? [{ group: 'AZIONI E WORKFLOW', items: actionItems }] : []),
  ];
}

export { findAction };
