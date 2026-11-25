// SCAN-APP (PO 2026-11-24): «Poliedron Scan» come app di Personal (icona nella barra e in Start).
// Solo pagine (nessuna vista): l'app si apre sopra la sezione in cui sei, come Esplora file.
import { differito } from '../../Differito.jsx';
import { IconaScansiona } from '../../Icone.jsx';
const ScanApp = differito(() => import('./ScanApp.jsx'), 'ScanApp');
const PaginaScan = differito(() => import('./PagineScan.jsx'), 'PaginaScan');

const pg = (tipo, titolo) => ({ titolo, modulo: true, render: (p, a) => <PaginaScan tipo={tipo} p={p} a={a} /> });
export const scan = {
  id: 'scan', nome: 'Scan', Icona: IconaScansiona, Vista: () => null,
  pagine: {
    scan: { titolo: 'Poliedron Scan', modulo: true, render: (p, { ctx }) => <ScanApp ctx={ctx} versioneRecenti={ctx.versioneRecenti} /> },
    scanner: pg('scanner', 'Scanner'),
    tessera: pg('tessera', "Carta d'identità"),
    testo: pg('testo', 'Estrai testo'),
    pdfStrumento: pg('pdfStrumento', 'Gestore PDF'),
  },
};
