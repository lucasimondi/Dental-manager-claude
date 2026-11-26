import { differito } from '../../Differito.jsx';
import { iconaTratto } from '../../cose/IconeCose.jsx';

// RUBRICA (PO 2026-11-26, mockup approvato «Ok crea»): «ho un problema, chi chiamo?». Professionisti per categoria
// (idraulico, elettricista, stufa e caldaia, cartongessista, gommista…) con note, storico interventi e promemoria
// che si ripetono (cambio gomme, manutenzione stufa). App di Personal e app a sé sulla Home (/poliedron/rubrica/).
const AppRubrica = differito(() => import('../../rubrica/AppRubrica.jsx'), 'AppRubrica');
export const rubrica = {
  id: 'rubrica', nome: 'Rubrica', Icona: iconaTratto('rubrica'), Vista: ({ ctx }) => <AppRubrica ctx={ctx} />,
  pagine: {
    rubrica: { titolo: 'Rubrica', render: (p, { ctx }) => <AppRubrica ctx={ctx} /> },
  },
};
