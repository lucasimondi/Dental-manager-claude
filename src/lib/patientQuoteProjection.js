import { entryItems } from './appointmentEntry.js';
import { expandImplantQuotes } from './domain/implantQuote.js';
import { normalizza } from './ricercaPazienti.js';

const normalized = value => normalizza(String(value || '')).replace(/\s+/g, ' ');
// Read-only document projection. Never written back as a clinical plan.
export function patientQuoteProjection(plan, draft, scope = 'all') {
  if (!plan?.id || !Array.isArray(plan.voci)) throw new Error('Piano salvato non disponibile per il preventivo.');
  if (scope === 'all') return { ...plan, voci: plan.voci.map(row => ({ ...row })) };
  if (scope !== 'entered') throw new Error('Seleziona cosa includere nel preventivo.');
  const expanded = draft.implantPreset ? expandImplantQuotes(draft.items, draft.quoteItems) : draft;
  const requested = entryItems([...(expanded.items || []), ...(expanded.quoteItems || [])]);
  const indices = new Set(requested.map(item => plan.voci.findIndex(row => normalized(row.prestazione) === normalized(item.prestazione) && normalized(row.dente) === normalized(item.dente))).filter(index => index >= 0));
  if (!indices.size) throw new Error('Nessuna delle prestazioni inserite è disponibile in questo piano.');
  return { ...plan, titolo: `${plan.titolo || 'Preventivo'} · Estratto prestazioni`, voci: plan.voci.filter((_, index) => indices.has(index)).map(row => ({ ...row })), sconto: 0, scontoTipo: 'pct', sconto_tipo: 'pct' };
}
