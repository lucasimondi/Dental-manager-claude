import { differito } from '../../Differito.jsx';
// Sezione Personali: i documenti d'identità delle persone di casa.
import { IconaPortafoglio } from '../../Icone.jsx';
const VistaPersonali = differito(() => import('./Personali.jsx'), 'VistaPersonali');

export const personali = { id: 'personali', nome: 'Personali', Icona: IconaPortafoglio, Vista: VistaPersonali, pagine: {} };
