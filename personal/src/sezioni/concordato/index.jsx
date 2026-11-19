import { differito } from '../../Differito.jsx';
import { IconaPratiche } from '../../Icone.jsx';

// CONCORDATO (PO 2026-11-20): i beni con le quote (e il loro PDF) e la divisione con Anna, con proposte pronte,
// valori di perizia da compilare e conguaglio calcolato subito.
const Concordato = differito(() => import('./Concordato.jsx'), 'Concordato');
const ModuloBene = differito(() => import('./Concordato.jsx'), 'ModuloBene');
const PropostaDivisione = differito(() => import('./Divisione.jsx'), 'PropostaDivisione');
export const concordato = {
  id: 'concordato', nome: 'Concordato', Icona: IconaPratiche, Vista: Concordato,
  pagine: {
    concordato: { titolo: 'Concordato', render: (p, { ctx }) => <Concordato ctx={ctx} iniziale={p.scheda} /> },
    'concordato-bene': { titolo: (p) => p.bene?.nome || 'Bene', modulo: true, render: (p, { ctx, chiudi }) => <ModuloBene bene={p.bene} ctx={ctx} chiudi={chiudi} /> },
    'divisione-proposta': { titolo: 'Proposta di divisione', modulo: true, render: (p, { ctx, chiudi }) => <PropostaDivisione id={p.id} ctx={ctx} chiudi={chiudi} /> },
  },
};
