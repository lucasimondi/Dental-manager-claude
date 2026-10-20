import { differito } from '../../Differito.jsx';
import { IconaPratiche } from '../../Icone.jsx';
const Legal = differito(() => import('./Legal.jsx'), 'Legal');
const ModuloLegal = differito(() => import('./Legal.jsx'), 'ModuloLegal');
export const legal = {
  id: 'legal', nome: 'Legal', Icona: IconaPratiche, Vista: Legal,
  pagine: {
    legal: { titolo: 'Legal', render: (p, { ctx }) => <Legal ctx={ctx} /> },
    'legal-modifica': { titolo: 'Pratica Legal', modulo: true, render: (p, { ctx, chiudi }) => <ModuloLegal p={p.p} ctx={ctx} chiudi={chiudi} /> },
  },
};
