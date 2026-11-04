import { treatmentsFromPlans, TREATMENT_STATUS } from './patientWorkspaceClinicalFinancial.js';

export const DENTAL_QUADRANTS = [
  { label: 'Q1 · Superiore destro', teeth: [18,17,16,15,14,13,12,11] },
  { label: 'Q2 · Superiore sinistro', teeth: [21,22,23,24,25,26,27,28] },
  { label: 'Q4 · Inferiore destro', teeth: [48,47,46,45,44,43,42,41] },
  { label: 'Q3 · Inferiore sinistro', teeth: [31,32,33,34,35,36,37,38] },
];
const permanent = new Set(DENTAL_QUADRANTS.flatMap(q => q.teeth));
export const dentalEntryTooth = value => permanent.has(Number(value)) ? String(Number(value)) : '';
// Chart multi-selection seed: array or explicit list of permanent FDI numbers.
// Invalid tokens are dropped; anything that is not a string/number/array yields ''.
export function dentalEntryTeeth(value) {
  const tokens = Array.isArray(value) ? value : typeof value === 'number' ? [value] : typeof value === 'string' ? value.split(/[^0-9]+/) : [];
  return [...new Set(tokens.map(dentalEntryTooth).filter(Boolean).map(Number))].sort((a,b)=>a-b).join(', ');
}
export const DENTAL_SELECTION_GROUPS = [
  ...DENTAL_QUADRANTS.map(q => ({ label: q.label.split(' ·')[0], title: q.label, teeth: q.teeth })),
  { label: 'Arcata sup.', title: 'Arcata superiore', teeth: [...DENTAL_QUADRANTS[0].teeth, ...DENTAL_QUADRANTS[1].teeth] },
  { label: 'Arcata inf.', title: 'Arcata inferiore', teeth: [...DENTAL_QUADRANTS[2].teeth, ...DENTAL_QUADRANTS[3].teeth] },
  { label: 'Tutti', title: 'Tutti i denti permanenti', teeth: DENTAL_QUADRANTS.flatMap(q => q.teeth) },
];
// Group toggle: when every tooth of the group is already selected it is removed, otherwise added.
export function toggleDentalGroup(selected, teeth) {
  const current = new Set((Array.isArray(selected) ? selected : []).map(Number));
  const all = teeth.every(t => current.has(t));
  teeth.forEach(t => all ? current.delete(t) : current.add(t));
  return [...current].filter(t => permanent.has(t)).sort((a,b)=>a-b);
}
// Only explicit FDI numbers are indexed. Ranges/free text remain intact in history;
// never infer missing teeth, diagnoses or an execution from a plan's status.
export function dentalTeeth(site) {
  return [...new Set((String(site || '').match(/\b[1-4][1-8]\b/g) || []).map(Number))];
}
export function patientDentalOverview(plans, patientId) {
  const scoped = patientId == null || !String(patientId).trim() ? [] : (Array.isArray(plans) ? plans : []).filter(p => p && String(p.pazienteId ?? p.paziente_id ?? '') === String(patientId));
  const rows = treatmentsFromPlans(scoped.map(p => ({...p,voci:Array.isArray(p.voci) ? p.voci.filter(v=>v && typeof v === 'object') : []})))
    .filter(row => row.status !== TREATMENT_STATUS.CANCELLED)
    .filter(row => row.status === TREATMENT_STATUS.COMPLETED || !['rifiutato','annullato','archiviato'].includes(String(scoped.find(p=>p.id === row.planId)?.stato || '').toLowerCase()))
    .map(row => ({...row,teeth:dentalTeeth(row.site)}));
  const done = rows.filter(r => r.status === TREATMENT_STATUS.COMPLETED).sort((a,b)=>String(b.dataEsec || '').localeCompare(String(a.dataEsec || '')));
  const pending = rows.filter(r => r.status !== TREATMENT_STATUS.COMPLETED);
  const teeth = Object.fromEntries([...permanent].map(tooth => [tooth,{done:done.filter(r=>r.teeth.includes(tooth)).length,pending:pending.filter(r=>r.teeth.includes(tooth)).length}]));
  return {done,pending,teeth};
}
