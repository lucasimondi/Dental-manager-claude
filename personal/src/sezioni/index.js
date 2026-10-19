// POL-VITA-017 — Personal a sezioni. Ogni sezione vive nella sua cartella con un index.jsx che
// dichiara cosa porta all'app: la vista del dock (Vista), le pagine che apre (pagine: tipo →
// titolo, modulo, render) e, se serve, azioni e classi per testata e contenuto. L'app (App.jsx)
// è solo la cornice: accesso, testata, dock, pagine sovrapposte, tasto +.
// Regola: una sezione usa la parte comune (lib/, ui.jsx, Icone.jsx, Miniatura.jsx, Pagina.jsx) e
// le altre sezioni solo attraverso il loro index.jsx.
import { oggi } from './oggi/index.jsx';
import { documenti } from './documenti/index.jsx';
import { agenda } from './agenda/index.jsx';
import { conti } from './conti/index.jsx';
import { personali } from './personali/index.jsx';
import { foto } from './foto/index.jsx';
import { poliedron } from './poliedron/index.jsx';
import { impostazioni } from './impostazioni/index.jsx';

export const SEZIONI = [oggi, documenti, agenda, conti, personali, foto, poliedron, impostazioni];
// Il dock, nell'ordine; Poliedron ha il suo tasto in fondo.
export const DOCK = [oggi, documenti, agenda, foto, conti, personali];
export const VISTE = [...DOCK, poliedron];

export const sezione = (id) => VISTE.find((s) => s.id === id);

const PAGINE = Object.fromEntries(SEZIONI.flatMap((s) => Object.entries(s.pagine)));
export const pagina = (tipo) => PAGINE[tipo];
export const titoloPagina = (p) => {
  const t = PAGINE[p.tipo]?.titolo;
  return p.titolo || (typeof t === 'function' ? t(p) : t);
};
// Pagine con un modulo o con la propria barra in basso: niente tasto di chiusura in basso.
export const eModulo = (tipo) => Boolean(PAGINE[tipo]?.modulo);
