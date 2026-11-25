import { differito } from '../../Differito.jsx';
import { iconaTratto } from '../../cose/IconeCose.jsx';

// APP-AUTO-CASA-SALUTE (PO 2026-11-25): «Auto e motori», app di Personal e app a sé sulla Home (/poliedron/auto/).
// Veicoli con foto, assicurazione, bollo, revisione, tagliandi e officina (lib/mieCose.js, tabella mie_cose).
const AppCose = differito(() => import('../../cose/AppCose.jsx'), 'AppCose');
export const auto = {
  id: 'auto', nome: 'Auto e motori', Icona: iconaTratto('auto'), Vista: ({ ctx }) => <AppCose ambito="auto" ctx={ctx} />,
  pagine: {
    auto: { titolo: 'Auto e motori', render: (p, { ctx }) => <AppCose ambito="auto" ctx={ctx} /> },
  },
};
