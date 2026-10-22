import { normalizza } from './ricercaPazienti.js';
// Repeated seed/import rows must not repeat the same visit tag in the UI.
export function uniqueAppointmentTypes(types = []) {
  const seen = new Set();
  return types.filter(type => {
    const key = normalizza(type?.nome).replace(/\s+/g, ' ');
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  });
}
