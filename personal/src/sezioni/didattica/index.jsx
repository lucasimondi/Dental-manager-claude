import { differito } from '../../Differito.jsx';
const Filosofia = differito(() => import('./Filosofia.jsx'), 'Filosofia');
export function IconaBiblioteca({ size = 22 }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 4h5v16H3zM10 4h5v16h-5zM17 5l3-1 3 15-3 1z" /></svg>; }
export const didattica = { id: 'didattica', nome: 'Biblioteca · Filosofia', Icona: IconaBiblioteca, Vista: Filosofia, pagine: {}, senzaPiu: true, classeContenuto: 'pp-contenuto-filosofia' };
