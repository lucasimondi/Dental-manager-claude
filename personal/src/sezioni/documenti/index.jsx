import { differito } from '../../Differito.jsx';
// Sezione Documenti: archivio, cartelle, ricerca, schede dei documenti, pratiche, caricamento.
const RevisioneArchivio = differito(() => import('./Revisione.jsx'), 'RevisioneArchivio');
import { IconaDocumenti } from '../../Icone.jsx';
const PaginaScansione = differito(() => import('../../Aggiungi.jsx'), 'PaginaScansione');
const VistaDocumenti = differito(() => import('./Documenti.jsx'), 'VistaDocumenti');
const PaginaRicerca = differito(() => import('./Ricerca.jsx'), 'PaginaRicerca');
const PaginaDocumento = differito(() => import('./Documento.jsx'), 'PaginaDocumento');
const PaginaPratica = differito(() => import('./Pratica.jsx'), 'PaginaPratica');
const PaginaCarica = differito(() => import('./Carica.jsx'), 'PaginaCarica');
const PaginaCartella = differito(() => import('./Cartelle.jsx'), 'PaginaCartella');
const PaginaSuggerimenti = differito(() => import('./Cartelle.jsx'), 'PaginaSuggerimenti');
import { archivioDb } from '../../lib/supabasePersonal.js';
import { documentiSenzaCartella } from '../../lib/cartelle.js';
import { CAMPI_DOC } from '../../lib/archivio.js';

const caricaSenzaCartella = () => documentiSenzaCartella(archivioDb, CAMPI_DOC);

export const documenti = {
  id: 'documenti', nome: 'Documenti', Icona: IconaDocumenti, Vista: VistaDocumenti,
  pagine: {
    revisione: { titolo: 'Da valutare', render: (p, { ctx }) => <RevisioneArchivio ctx={ctx} /> },
    documento: { titolo: 'Documento', render: (p, { ctx, chiudi }) => <PaginaDocumento id={p.id} ctx={ctx} chiudi={chiudi} /> },
    cartella: { titolo: 'Cartella', render: (p, { ctx, chiudi, sostituisci }) => <PaginaCartella key={p.ente} ente={p.ente} ctx={ctx} chiudi={chiudi} sostituisci={sostituisci} /> },
    'suggerimenti-cartelle': { titolo: 'Cartelle da unire', render: (p, { ctx }) => <PaginaSuggerimenti ctx={ctx} /> },
    'senza-cartella': { render: (p, { ctx }) => <PaginaRicerca carica={caricaSenzaCartella} ctx={ctx} /> },
    pratica: { titolo: 'Pratica', render: (p, { ctx }) => <PaginaPratica p={p.p} ctx={ctx} /> },
    elenco: { render: (p, { ctx }) => <PaginaRicerca carica={p.carica} ctx={ctx} /> },
    ricerca: { render: (p, { ctx }) => <PaginaRicerca filtri={p.filtri} sezione={p.sezione} ctx={ctx} /> },
    carica: { titolo: 'Archivia un documento', modulo: true, render: (p, { ctx, sostituisci }) => <PaginaCarica opzioni={p.opzioni || {}} file={p.file} ctx={ctx} sostituisci={sostituisci} /> },
    scansione: { titolo: 'Scansiona', modulo: true, render: (p, { ctx, sostituisci }) => <PaginaScansione ctx={ctx} sostituisci={sostituisci} /> },
  },
};
