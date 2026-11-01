import { treatmentsFromPlans, TREATMENT_STATUS } from './patientWorkspaceClinicalFinancial.js';

export const DENTAL_QUADRANTS = [
  { label: 'Q1 · Superiore destro', teeth: [18,17,16,15,14,13,12,11] },
  { label: 'Q2 · Superiore sinistro', teeth: [21,22,23,24,25,26,27,28] },
  { label: 'Q4 · Inferiore destro', teeth: [48,47,46,45,44,43,42,41] },
  { label: 'Q3 · Inferiore sinistro', teeth: [31,32,33,34,35,36,37,38] },
];
const permanent = new Set(DENTAL_QUADRANTS.flatMap(q => q.teeth));
export const dentalEntryTooth = value => permanent.has(Number(value)) ? String(Number(value)) : '';
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
