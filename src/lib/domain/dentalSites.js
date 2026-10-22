// One source row can select several FDI teeth. Each unique tooth produces
// a separate canonical line at the entered unit price, only on explicit save.
export function dentalSites(value) {
  const text = String(value || '').trim();
  if (!text) return [''];
  const tokens = text.split(/[,;\s]+/).filter(Boolean);
  const valid = token => /^(?:[1-4][1-8]|[5-8][1-5])$/.test(token);
  // Preserve existing free-text sites as one site; never infer teeth from prose.
  return tokens.length && tokens.every(valid) ? [...new Set(tokens)] : [text];
}

export const expandDentalRows = (rows = []) => rows.flatMap(row =>
  dentalSites(row.tooth).map(tooth => ({ ...row, tooth })));
