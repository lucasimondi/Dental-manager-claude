// APP-AUTO-CASA-SALUTE (PO 2026-11-25: "che sia app a parte"): Auto, Casa e Salute si installano sulla Home del
// telefono come app a sé, come Scan (lib/scan.js). Sono la stessa app Personal aperta su /poliedron/auto/ (o /auto/
// sul dominio personale), /casa/, /salute/: manifest, nome e icona propri, stesso accesso di Personal.
export const APP_COSE = {
  auto: { titolo: 'Poliedron Auto', breve: 'Auto', colore: '#B4561A' },
  casa: { titolo: 'Poliedron Casa', breve: 'Casa', colore: '#1F56B8' },
  salute: { titolo: 'Poliedron Salute', breve: 'Salute', colore: '#A3194B' },
};
const PERCORSO = /^\/(poliedron\/)?(auto|casa|salute)(\/|$)/;

export function appCosaDaIndirizzo(path = globalThis.location?.pathname || '') {
  return path.match(PERCORSO)?.[2] || null;
}
const personale = (location) => location?.hostname === 'personal.poliedrasoft.it';
export const indirizzoAppCosa = (id, location = globalThis.location) => (personale(location) ? `/${id}/` : `/poliedron/${id}/`);
export const manifestAppCosa = (id, location = globalThis.location) => (personale(location) ? `/${id}-dominio.webmanifest` : `/${id}.webmanifest`);

// Nome, icona e manifest dell'app sulla pagina (Android legge il manifest, iOS titolo e icona).
export function identitaAppCosa(id, doc = globalThis.document, location = globalThis.location) {
  const app = APP_COSE[id]; if (!app) return;
  const imposta = (sel, attr, valore) => { const el = doc.querySelector(sel); if (el) el.setAttribute(attr, valore); };
  imposta('link[rel="manifest"]', 'href', manifestAppCosa(id, location));
  imposta('link[rel="apple-touch-icon"]', 'href', `/${id}-180.png`);
  imposta('link[rel="icon"]', 'href', `/${id}-192.png`);
  imposta('meta[name="apple-mobile-web-app-title"]', 'content', app.breve);
  doc.querySelectorAll('meta[name="theme-color"]').forEach((m) => { if (!m.media || m.media.includes('light')) m.setAttribute('content', app.colore); });
  doc.title = app.titolo;
}
