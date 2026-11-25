import { differito } from '../../Differito.jsx';
import { iconaTratto } from '../../cose/IconeCose.jsx';

// APP-AUTO-CASA-SALUTE (PO 2026-11-25): «Salute», app di Personal e app a sé sulla Home (/poliedron/salute/).
// Persone con medico, tessera sanitaria, allergie, terapie, controlli periodici e visite (lib/mieCose.js).
// I referti restano in «La mia salute ed esami» (pagina `salute` di Documenti), aperta dal tasto «Referti ed esami».
const AppCose = differito(() => import('../../cose/AppCose.jsx'), 'AppCose');
export const salute = {
  id: 'salute', nome: 'Salute', Icona: iconaTratto('salute'), Vista: ({ ctx }) => <AppCose ambito="salute" ctx={ctx} />,
  pagine: {
    saluteApp: { titolo: 'Salute', render: (p, { ctx }) => <AppCose ambito="salute" ctx={ctx} /> },
  },
};
