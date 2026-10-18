// Sezione Documenti: archivio, cartelle, ricerca, schede dei documenti, pratiche, caricamento.
import { IconaDocumenti } from '../../Icone.jsx';
import { PaginaScansione } from '../../Aggiungi.jsx';
import { VistaDocumenti, PaginaRicerca } from './Documenti.jsx';
import { PaginaDocumento } from './Documento.jsx';
import { PaginaPratica } from './Pratica.jsx';
import { PaginaCarica } from './Carica.jsx';

export const documenti = {
  id: 'documenti', nome: 'Documenti', Icona: IconaDocumenti, Vista: VistaDocumenti,
  pagine: {
    documento: { titolo: 'Documento', render: (p, { ctx, chiudi }) => <PaginaDocumento id={p.id} ctx={ctx} chiudi={chiudi} /> },
    pratica: { titolo: 'Pratica', render: (p, { ctx }) => <PaginaPratica p={p.p} ctx={ctx} /> },
    elenco: { render: (p, { ctx }) => <PaginaRicerca carica={p.carica} ctx={ctx} /> },
    ricerca: { render: (p, { ctx }) => <PaginaRicerca filtri={p.filtri} sezione={p.sezione} ctx={ctx} /> },
    carica: { titolo: 'Archivia un documento', modulo: true, render: (p, { ctx, sostituisci }) => <PaginaCarica opzioni={p.opzioni || {}} file={p.file} ctx={ctx} sostituisci={sostituisci} /> },
    scansione: { titolo: 'Scansiona', modulo: true, render: (p, { ctx, sostituisci }) => <PaginaScansione ctx={ctx} sostituisci={sostituisci} /> },
  },
};
