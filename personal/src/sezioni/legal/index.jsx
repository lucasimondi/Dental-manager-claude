import { IconaPratiche } from '../../Icone.jsx';
import { Legal, ModuloLegal } from './Legal.jsx';
export const legal = {
  id: 'legal', nome: 'Legal', Icona: IconaPratiche, Vista: Legal,
  pagine: {
    legal: { titolo: 'Legal', render: (p, { ctx }) => <Legal ctx={ctx} /> },
    'legal-modifica': { titolo: 'Pratica Legal', modulo: true, render: (p, { ctx, chiudi }) => <ModuloLegal p={p.p} ctx={ctx} chiudi={chiudi} /> },
  },
};
