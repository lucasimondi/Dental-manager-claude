// SCAN-APP: dalla griglia della Home di Scan allo strumento (stessa regola nell'app Scan e in Personal).
export function apriStrumentoScan(id, { apri, vai }) {
  if (id === 'scanner' || id === 'unisci') apri({ tipo: 'scanner' });
  else if (id === 'tessera' || id === 'testo') apri({ tipo: id });
  else if (id === 'pdf') apri({ tipo: 'pdf' });
  else if (id === 'firma' || id === 'comprimi' || id === 'pagine') apri({ tipo: 'pdfStrumento', strumento: id });
  else if (id === 'archivio') vai('documenti');
  else if (id === 'personali') vai('personali');
}
// Pagine che appartengono all'app Scan quando è aperta dentro Personal (per l'icona accesa nella barra).
export const PAGINE_APP_SCAN = new Set(['scan', 'scanner', 'tessera', 'testo', 'pdfStrumento']);
