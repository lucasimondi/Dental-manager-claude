// DOCUMENTI-FIRMATI: titolo di partenza del documento salvato (modificabile nel foglio).
// Titolo di partenza: quello dell'originale (o il nome del file) con «firmato» se è stato firmato.
export function titoloIniziale({ origine, nomeFile, firmato }) {
  const base = String(origine?.titolo || String(nomeFile || 'Documento').replace(/\.pdf$/i, '').replace(/ - modificato$/i, '').replace(/^Copia di /i, '')).trim() || 'Documento';
  return firmato && !/\bfirmat[oa]\b/i.test(base) ? `${base} firmato` : base;
}
export const conFirmato = (titolo, firmato) => (firmato && titolo && !/\bfirmat[oa]\b/i.test(titolo) ? `${titolo} firmato` : titolo);

