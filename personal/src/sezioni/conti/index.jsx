import { differito } from '../../Differito.jsx';
// Sezione Conti: saldo, spese e incassi, pagamenti da fare e scadenze fisse.
import { IconaEuro } from '../../Icone.jsx';
const VistaConti = differito(() => import('./Conti.jsx'), 'VistaConti');
const PaginaMovimento = differito(() => import('./Conti.jsx'), 'PaginaMovimento');
const PaginaNuovaScadenza = differito(() => import('./Conti.jsx'), 'PaginaNuovaScadenza');
const RiquadroSaldo = differito(() => import('./Conti.jsx'), 'RiquadroSaldo');
const PaginaPagamento = differito(() => import('./Pagamento.jsx'), 'PaginaPagamento');

export { RiquadroSaldo };

export const conti = {
  id: 'conti', nome: 'Conti', Icona: IconaEuro, Vista: VistaConti,
  pagine: {
    pagamento: { titolo: 'Pagamento', render: (p, { ctx, chiudi }) => <PaginaPagamento s={p.s} ctx={ctx} chiudi={chiudi} /> },
    movimento: {
      titolo: (p) => (p.m?.id ? 'Movimento' : p.m?.tipo === 'entrata' ? 'Nuovo incasso' : 'Nuova spesa'), modulo: true,
      render: (p, { ctx, chiudi }) => <PaginaMovimento m={p.m || {}} ctx={ctx} chiudi={chiudi} />,
    },
    scadenza: { titolo: 'Pagamento da fare', modulo: true, render: (p, { ctx, chiudi }) => <PaginaNuovaScadenza ctx={ctx} chiudi={chiudi} /> },
  },
};
