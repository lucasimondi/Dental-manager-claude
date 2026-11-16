import { differito } from '../../Differito.jsx';
// DA-FARE (2026-11-16): promemoria d'azione con Gestita, Rimuovi, Dimmi cosa fare, Rispondi all'email.
import { IconaPerTe } from '../../Icone.jsx';
const VistaDaFare = differito(() => import('./DaFare.jsx'), 'VistaDaFare');

export const dafare = { id: 'dafare', nome: 'Da fare', Icona: IconaPerTe, Vista: VistaDaFare, pagine: {}, senzaPiu: true };
