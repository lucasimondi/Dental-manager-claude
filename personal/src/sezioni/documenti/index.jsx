import { differito } from '../../Differito.jsx';
// Sezione Documenti: archivio, cartelle, ricerca, schede dei documenti, pratiche, caricamento.
const RevisioneArchivio = differito(() => import('./Revisione.jsx'), 'RevisioneArchivio');
import { IconaDocumenti } from '../../Icone.jsx';
const PaginaScansione = differito(() => import('../../Aggiungi.jsx'), 'PaginaScansione');
const VistaDocumenti = differito(() => import('./Documenti.jsx'), 'VistaDocumenti');
const PaginaRicerca = differito(() => import('./Ricerca.jsx'), 'PaginaRicerca');
const PaginaDocumento = differito(() => import('./Documento.jsx'), 'PaginaDocumento');
const PaginaPratica = differito(() => import('./Pratica.jsx'), 'PaginaPratica');
const PaginaPdf = differito(() => import('../../pdf/PaginaPdf.jsx'), 'PaginaPdf');
const PaginaSalute = differito(() => import('./Salute.jsx'), 'PaginaSalute');
const PaginaModificaImmagine = differito(() => import('./ModificaImmagine.jsx'), 'PaginaModificaImmagine');
const PaginaCarica = differito(() => import('./Carica.jsx'), 'PaginaCarica');
const PaginaCartella = differito(() => import('./Cartelle.jsx'), 'PaginaCartella');
const PaginaSuggerimenti = differito(() => import('./Cartelle.jsx'), 'PaginaSuggerimenti');
const PaginaNuovaCartella = differito(() => import('./Cartelle.jsx'), 'PaginaNuovaCartella');
const PaginaCartellaMia = differito(() => import('./CartelleMie.jsx'), 'PaginaCartellaMia');
const PaginaCosa = differito(() => import('./Cose.jsx'), 'PaginaCosa');
const PaginaFirmati = differito(() => import('./Firmati.jsx'), 'PaginaFirmati');
// PERSONAL-ESPLORA-WIN11: Esplora file stile Windows 11 (albero + contenuto, trascina per spostare).
const PaginaEsplora = differito(() => import('./Esplora.jsx'), 'PaginaEsplora');
// PERSONAL-FINESTRE: lo Scan come finestra del desktop (l'app Scan da sola resta su /scan).
const ScanNelDesktop = differito(() => import('../../scan/Scan.jsx'), 'Scan');
// DOCUMENTI-AZIONI: l'elenco con «•••», selezione, Scarica / invia e Pratica, usato anche da Legal.
export const ElencoSelezionabile = differito(() => import('./Selezione.jsx'), 'ElencoSelezionabile');
// PRATICHE-CARTELLE: le pratiche come cartelle (Legal) e la loro griglia (ricerca della Home).
export const PraticheCartelle = differito(() => import('./PraticheCartelle.jsx'), 'PraticheCartelle');
export const GrigliaPratiche = differito(() => import('./PraticheCartelle.jsx'), 'GrigliaPratiche');
import { archivioDb } from '../../lib/supabasePersonal.js';
import { documentiSenzaCartella } from '../../lib/cartelle.js';
import { CAMPI_DOC } from '../../lib/archivio.js';

const caricaSenzaCartella = () => documentiSenzaCartella(archivioDb, CAMPI_DOC);

export const documenti = {
  id: 'documenti', nome: 'Documenti', Icona: IconaDocumenti, Vista: VistaDocumenti,
  pagine: {
    pdf: { titolo: 'Gestore PDF', modulo: true, render: (p, { ctx, chiudi, sostituisci }) => <PaginaPdf file={p.file} files={p.files} onSave={p.onSave} ctx={ctx} chiudi={chiudi} sostituisci={sostituisci} /> },
    revisione: { titolo: 'Da valutare', render: (p, { ctx }) => <RevisioneArchivio ctx={ctx} /> },
    documento: { titolo: 'Documento', render: (p, { ctx, chiudi }) => <PaginaDocumento id={p.id} ctx={ctx} chiudi={chiudi} /> },
    cartella: { titolo: 'Cartella', render: (p, { ctx, chiudi, sostituisci }) => <PaginaCartella key={p.ente} ente={p.ente} ctx={ctx} chiudi={chiudi} sostituisci={sostituisci} /> },
    'nuova-cartella': { titolo: 'Nuova cartella', render: (p, { ctx, sostituisci }) => <PaginaNuovaCartella ctx={ctx} sostituisci={sostituisci} /> },
    // PERSONAL-FINESTRE: con scegliPer Esplora sceglie documenti per un'altra finestra (es. lo Scan).
    scan: { titolo: 'Scan', modulo: true, render: (p, { ctx, email }) => <ScanNelDesktop email={email} esterno={ctx} /> },
    esplora: { titolo: 'Esplora file', modulo: true, render: (p, { ctx, chiudi }) => <PaginaEsplora ctx={ctx} iniziale={p.nodo} scegliPer={p.scegliPer} perNome={p.perNome} chiudi={chiudi} /> },
    firmati: { titolo: 'Documenti firmati', render: (p, { ctx }) => <PaginaFirmati ctx={ctx} /> },
    cosa: { titolo: 'Le mie cose', render: (p, { ctx }) => <PaginaCosa key={p.id} id={p.id} ctx={ctx} /> },
    'cartella-mia': { titolo: 'Le mie cartelle', render: (p, { ctx }) => <PaginaCartellaMia key={p.id || 'radice'} id={p.id || null} ctx={ctx} /> },
    'suggerimenti-cartelle': { titolo: 'Cartelle da unire', render: (p, { ctx }) => <PaginaSuggerimenti ctx={ctx} /> },
    'senza-cartella': { render: (p, { ctx }) => <PaginaRicerca carica={caricaSenzaCartella} ctx={ctx} /> },
    pratica: { titolo: 'Pratica', render: (p, { ctx }) => <PaginaPratica p={p.p} ctx={ctx} /> },
    elenco: { render: (p, { ctx }) => <PaginaRicerca carica={p.carica} ctx={ctx} /> },
    ricerca: { render: (p, { ctx }) => <PaginaRicerca filtri={p.filtri} sezione={p.sezione} testoIniziale={p.testo} ctx={ctx} /> },
    salute: { titolo: 'La mia salute ed esami', render: (p, { ctx }) => <PaginaSalute ctx={ctx} /> },
    'modifica-immagine': { titolo: 'Ritaglia e converti', modulo: true, render: (p, { ctx, sostituisci }) => <PaginaModificaImmagine id={p.id} pdf={!!p.pdf} ctx={ctx} sostituisci={sostituisci} /> },
    carica: { titolo: 'Archivia un documento', modulo: true, render: (p, { ctx, sostituisci }) => <PaginaCarica opzioni={p.opzioni || {}} file={p.file} ctx={ctx} sostituisci={sostituisci} /> },
    scansione: { titolo: 'Scansiona o allega', modulo: true, render: (p, { ctx, sostituisci }) => <PaginaScansione ctx={ctx} opzioni={p.opzioni} sostituisci={sostituisci} /> },
  },
};
