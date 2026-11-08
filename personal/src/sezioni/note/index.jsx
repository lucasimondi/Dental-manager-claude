import { differito } from '../../Differito.jsx';
// Sezione Note: note veloci condivise con Studio (NOTE-PERSONALI).
import { IconaNote } from '../../Icone.jsx';
const VistaNote = differito(() => import('./Note.jsx'), 'VistaNote');

export const note = { id: 'note', nome: 'Note', Icona: IconaNote, Vista: VistaNote, pagine: {}, senzaPiu: true, senzaTitolo: true };
