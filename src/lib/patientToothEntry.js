import { completeTreatmentVoce } from './appointmentEntry.js';
// Pure helpers for multi-tooth entry. A row whose site is ONLY a list of
// permanent FDI numbers can become one canonical row per tooth (same
// procedure and price). Ranges, free text and deciduous sites stay intact:
// teeth are never inferred.
const FDI = /^[1-4][1-8]$/;
export function toothList(site) {
  const text = String(site ?? '').trim();
  if (!text || !/^[0-9\s,;·/]+$/.test(text)) return null;
  const tokens = text.split(/[\s,;·/]+/).filter(Boolean);
  if (!tokens.length || !tokens.every(t => FDI.test(t))) return null;
  return [...new Set(tokens.map(Number))].sort((a,b)=>a-b);
}
export function isMultiToothRow(row) { return (toothList(row?.tooth)?.length || 0) > 1; }
export function expandRowsPerTooth(rows) {
  return (Array.isArray(rows) ? rows : []).flatMap(row => {
    const teeth = toothList(row?.tooth);
    return teeth && teeth.length > 1 ? teeth.map(t => ({ ...row, tooth: String(t) })) : [row];
  });
}
// Read-only summary of what will be saved, grouped by site in FDI order; rows
// without a tooth are grouped under "Generale".
export function rowsByTooth(rows) {
  const groups = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!String(row?.description || '').trim()) continue;
    const key = String(row.tooth || '').trim() || 'Generale';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ description: row.description.trim(), price: row.price });
  }
  const order = key => key === 'Generale' ? Infinity : (toothList(key)?.[0] ?? 1000);
  return [...groups].sort((a,b)=>order(a[0])-order(b[0]) || a[0].localeCompare(b[0])).map(([site,items])=>({site,items}));
}

// "Segna eseguita" from the dental chart. Targets carry planId/itemIndex plus the
// procedure/tooth seen by the user; a stale index (changed plan) is never touched.
// Returns per-item {planId,itemIndex,before,after}; applyVoceChanges writes only
// where the current item still equals `before`, so undo = swapped changes.
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function markRowsDone(plans, targets, date) {
  const changes = [];
  for (const t of Array.isArray(targets) ? targets : []) {
    const plan = (plans || []).find(p => p && String(p.id) === String(t.planId));
    const before = plan?.voci?.[t.itemIndex];
    if (!before || before.eseguita === true || String(before.prestazione || '') !== String(t.prestazione || '') || String(before.dente || '') !== String(t.dente || '')) continue;
    changes.push({ planId: plan.id, itemIndex: t.itemIndex, before, after: completeTreatmentVoce(before, date) });
  }
  return changes;
}
export function applyVoceChanges(plans, changes) {
  if (!changes?.length) return plans;
  return (plans || []).map(plan => {
    const mine = changes.filter(c => String(c.planId) === String(plan?.id));
    if (!mine.length) return plan;
    let touched = false;
    const voci = plan.voci.map((v, i) => { const c = mine.find(x => x.itemIndex === i); if (c && sameJson(v, c.before)) { touched = true; return c.after; } return v; });
    return touched ? { ...plan, voci } : plan;
  });
}
export const undoVoceChanges = (plans, changes) => applyVoceChanges(plans, (changes || []).map(c => ({ ...c, before: c.after, after: c.before })));
