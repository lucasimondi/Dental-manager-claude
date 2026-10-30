import { differito } from '../../Differito.jsx';
const Diario = differito(() => import('./Diario.jsx'), 'Diario');
export function IconaDiario({ size = 22 }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M5 3h14v18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z M7 3v18 M11 8h5 M11 12h5" /></svg>; }
export const diario = { id: 'diario', nome: 'Diario', Icona: IconaDiario, Vista: Diario, pagine: {}, senzaPiu: true, classeContenuto: 'pp-contenuto-diario' };
