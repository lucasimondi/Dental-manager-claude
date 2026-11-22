import { differito } from '../../Differito.jsx';
// POL-VITA-ORDINA fase 2: «Piano di riordino» — decidere da telefono le proposte di Claude Code.
import { IconaDocumenti } from '../../Icone.jsx';
const VistaRiordino = differito(() => import('./Riordino.jsx'), 'VistaRiordino');

export const riordino = { id: 'riordino', nome: 'Piano di riordino', Icona: IconaDocumenti, Vista: VistaRiordino, pagine: {}, senzaPiu: true };
