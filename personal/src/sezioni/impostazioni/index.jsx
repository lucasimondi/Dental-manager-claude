import { differito } from '../../Differito.jsx';
// Impostazioni: si aprono dall'icona in alto a destra, non dal dock.
import { IconaImpostazioni } from '../../Icone.jsx';
const PaginaImpostazioni = differito(() => import('./Impostazioni.jsx'), 'PaginaImpostazioni');
const PaginaSezione = differito(() => import('./Impostazioni.jsx'), 'PaginaSezione');

export const impostazioni = {
  id: 'impostazioni', nome: 'Impostazioni', Icona: IconaImpostazioni,
  pagine: {
    impostazioni: { titolo: 'Impostazioni', modulo: true, render: (p, { ctx, email }) => <PaginaImpostazioni ctx={ctx} email={email} /> },
    sezione: { titolo: 'Sezione', modulo: true, render: (p, { ctx, chiudi }) => <PaginaSezione id={p.id} ctx={ctx} chiudi={chiudi} /> },
  },
};
