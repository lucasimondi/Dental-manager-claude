import { altro } from './altro/index.jsx';
export { IconaBiblioteca } from './didattica/index.jsx';
import { didattica } from './didattica/index.jsx';
export { IconaDiario } from './diario/index.jsx';
import { diario } from './diario/index.jsx';
import { legal } from './legal/index.jsx';
import { concordato } from './concordato/index.jsx';
import { dati } from './dati/index.jsx'; // MIEI-DATI
// APP-AUTO-CASA-SALUTE: tre app di Personal (anche a sé sulla Home), stesso componente in ../cose/.
import { auto } from './auto/index.jsx';
import { casa } from './casa/index.jsx';
import { salute } from './salute/index.jsx';
// POL-VITA-017 — Personal a sezioni. Ogni sezione vive nella sua cartella con un index.jsx che
// dichiara cosa porta all'app: la vista del dock (Vista), le pagine che apre (pagine: tipo →
// titolo, modulo, render) e, se serve, azioni e classi per testata e contenuto. L'app (App.jsx)
// è solo la cornice: accesso, testata, dock, pagine sovrapposte, tasto +.
// Regola: una sezione usa la parte comune (lib/, ui.jsx, Icone.jsx, Miniatura.jsx, Pagina.jsx) e
// le altre sezioni solo attraverso il loro index.jsx.
import { oggi } from './oggi/index.jsx';
import { note } from './note/index.jsx';
import { password } from './password/index.jsx';
import { documenti } from './documenti/index.jsx';
import { agenda } from './agenda/index.jsx';
import { conti } from './conti/index.jsx';
import { personali } from './personali/index.jsx';
import { foto } from './foto/index.jsx';
import { poliedron } from './poliedron/index.jsx';
import { impostazioni } from './impostazioni/index.jsx';
import { dafare } from './dafare/index.jsx';
import { riordino } from './riordino/index.jsx';
import { scan } from './scan/index.jsx'; // SCAN-APP: Scan come app di Personal (solo pagine)

export const SEZIONI = [altro, dafare, oggi, note, password, documenti, agenda, conti, personali, foto, legal, concordato, dati, auto, casa, salute, diario, didattica, poliedron, impostazioni, riordino, scan];
// DOCK-PER-TE (PO 2026-11-08): Agenda · Documenti · Poliedron · Studio · Per te.
// App aggiunge Poliedron al centro, Studio (la pagina Studio dell'app) e Per te (sezione «altro»).
export const DOCK = [agenda, documenti];
export const DOCK_DOPO = [];
export const VISTE = [dafare, oggi, agenda, note, password, documenti, poliedron, altro, foto, conti, legal, concordato, dati, auto, casa, salute, personali, diario, didattica, riordino];

export const sezione = (id) => VISTE.find((s) => s.id === id);

const PAGINE = Object.fromEntries(SEZIONI.flatMap((s) => Object.entries(s.pagine)));
export const pagina = (tipo) => PAGINE[tipo];
export const titoloPagina = (p) => {
  const t = PAGINE[p.tipo]?.titolo;
  return p.titolo || (typeof t === 'function' ? t(p) : t);
};
// Pagine con un modulo o con la propria barra in basso: niente tasto di chiusura in basso.
export const eModulo = (tipo) => Boolean(PAGINE[tipo]?.modulo);
