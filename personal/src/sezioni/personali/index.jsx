import { differito } from '../../Differito.jsx';
// Sezione Personali: i documenti d'identità delle persone di casa (e l'ingresso a «La mia salute ed esami», pagina di Documenti).
import { IconaPortafoglio } from '../../Icone.jsx';
const VistaPersonali = differito(() => import('./Personali.jsx'), 'VistaPersonali');

export const personali = { id: 'personali', nome: 'Personali', Icona: IconaPortafoglio, Vista: VistaPersonali, pagine: {} };

export {ScadenzePersonali} from './ScadenzePersonali.jsx';
