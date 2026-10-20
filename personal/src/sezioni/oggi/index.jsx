import { differito } from '../../Differito.jsx';
// Sezione Oggi: il cruscotto della mattina.
import { IconaOggi } from '../../Icone.jsx';
const VistaOggi = differito(() => import('./Oggi.jsx'), 'VistaOggi');

export const oggi = { id: 'oggi', nome: 'Oggi', Icona: IconaOggi, Vista: VistaOggi, pagine: {} };
