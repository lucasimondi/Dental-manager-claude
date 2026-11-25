import { differito } from '../../Differito.jsx';
import { iconaTratto } from '../../cose/IconeCose.jsx';

// APP-AUTO-CASA-SALUTE (PO 2026-11-25): «Casa», app di Personal e app a sé sulla Home (/poliedron/casa/).
// Immobili con foto, utenze, catasto, assicurazione, manutenzioni e contatti (lib/mieCose.js, tabella mie_cose).
const AppCose = differito(() => import('../../cose/AppCose.jsx'), 'AppCose');
export const casa = {
  id: 'casa', nome: 'Casa', Icona: iconaTratto('casa'), Vista: ({ ctx }) => <AppCose ambito="casa" ctx={ctx} />,
  pagine: {
    casa: { titolo: 'Casa', render: (p, { ctx }) => <AppCose ambito="casa" ctx={ctx} /> },
  },
};
