// SCAN-APP (PO 2026-11-24: «Poliedron Scan deve essere anche una app, quindi va nel dock di personal»):
// le pagine proprie di Scan, usate sia dall'app Scan installata (/scan/) sia da Personal, dove Scan si
// apre come app dalla barra e da Start. Le altre pagine (archiviazione, gestore PDF) sono di Personal.
import { PaginaScansione } from '../Aggiungi.jsx';
import { PaginaPdf } from '../pdf/PaginaPdf.jsx';
import { CartaIdentita } from './CartaIdentita.jsx';
import { EstraiTesto } from './EstraiTesto.jsx';

export const PAGINE_SCAN = {
  scanner: { titolo: 'Scanner', modulo: true, render: (p, { ctx }) => <PaginaScansione files={p.files} ctx={ctx} sostituisci={ctx.apri} opzioni={{ destinazione: true, fotocamera: Boolean(p.fotocamera) }} /> },
  tessera: { titolo: "Carta d'identità", modulo: true, render: (p, { ctx }) => <CartaIdentita ctx={ctx} sostituisci={ctx.apri} /> },
  testo: { titolo: 'Estrai testo', modulo: true, render: (p, { ctx }) => <EstraiTesto ctx={ctx} /> },
  pdfStrumento: { titolo: 'Gestore PDF', modulo: true, render: (p, { ctx, chiudi, sostituisci }) => <PaginaPdf strumento={p.strumento} file={p.file} ctx={ctx} chiudi={chiudi} sostituisci={sostituisci} /> },
};
