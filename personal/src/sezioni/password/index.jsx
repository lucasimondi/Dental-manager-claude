import { differito } from '../../Differito.jsx';
// Sezione Password: il registro password condiviso con Studio (PASSWORD-PERSONALI, PO 2026-11-08).
import { IconaLucchetto } from '../../Icone.jsx';
const VistaPassword = differito(() => import('./Password.jsx'), 'VistaPassword');

export const password = { id: 'password', nome: 'Password', Icona: IconaLucchetto, Vista: VistaPassword, pagine: {}, senzaPiu: true, senzaTitolo: true };
