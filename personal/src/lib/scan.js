// SCAN-HOME (PO 2026-11-10: "Prendi lo strumento Scan di Poliedra e creami una scorciatoia da mettere
// su home che possa scansionare documenti e allegare foto, che sia anche un gestore PDF semplice con
// possibilità di firma su schermo").
// «Scan» è la stessa app Personal aperta su /poliedron/scan/ (o /scan/ sul dominio personale): ha un
// proprio manifest (nome e icona) e si installa sulla Home come app a sé. Si apre direttamente sullo
// strumento «Scansiona o allega»; «PDF e firma» apre il gestore PDF (firma con il dito sullo schermo).
// Stesso accesso di Personal (la sessione è condivisa sullo stesso indirizzo).
export const SCAN_MANIFEST = '/scan.webmanifest';
export const SCAN_TITOLO = 'Poliedron Scan';

export function eScan(path = globalThis.location?.pathname || '') {
  return /^\/(poliedron\/)?scan(\/|$)/.test(path);
}

// Indirizzo di Scan visto dall'app Personal (stesso dominio, stessa base).
export function indirizzoScan(location = globalThis.location) {
  const personale = location?.hostname === 'personal.poliedrasoft.it';
  return personale ? '/scan/' : '/poliedron/scan/';
}

// Da Scan verso Personal (es. dopo l'archiviazione: «Apri in Personal»).
export function indirizzoPersonal(sezione = null, location = globalThis.location) {
  const base = location?.hostname === 'personal.poliedrasoft.it' ? '/personal/' : '/poliedron/personal/';
  return sezione ? `${base}?${new URLSearchParams({ sezione })}` : base;
}

// ?strumento=pdf (scorciatoia «PDF e firma» del manifest) apre subito il gestore PDF. Letto una volta.
export function strumentoDaIndirizzo(win = globalThis) {
  const url = new URL(win.location.href), s = url.searchParams.get('strumento');
  if (!s) return null;
  url.searchParams.delete('strumento'); win.history.replaceState(null, '', url);
  return s === 'pdf' ? 'pdf' : null;
}

// Nome, icona e manifest di Scan sulla pagina (Android legge il manifest, iOS titolo e icona).
export function identitaScan(doc = globalThis.document, location = globalThis.location) {
  const manifest = location?.hostname === 'personal.poliedrasoft.it' ? '/scan-dominio.webmanifest' : SCAN_MANIFEST;
  const imposta = (sel, attr, valore) => { const el = doc.querySelector(sel); if (el) el.setAttribute(attr, valore); };
  imposta('link[rel="manifest"]', 'href', manifest);
  imposta('link[rel="apple-touch-icon"]', 'href', '/scan-180.png');
  imposta('link[rel="icon"]', 'href', '/scan-192.png');
  imposta('meta[name="apple-mobile-web-app-title"]', 'content', 'Scan');
  doc.title = SCAN_TITOLO;
}
