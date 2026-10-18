// Sezione Conti: saldo, spese e incassi, pagamenti da fare e scadenze fisse.
import { IconaEuro } from '../../Icone.jsx';
import { VistaConti, PaginaMovimento, PaginaNuovaScadenza, RiquadroSaldo } from './Conti.jsx';
import { PaginaPagamento } from './Pagamento.jsx';

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
