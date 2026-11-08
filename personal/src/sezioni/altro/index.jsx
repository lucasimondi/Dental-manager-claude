import { IconaAltro } from '../../Icone.jsx';
import AltroPage from '../../../../shared/altro/AltroPage.jsx';
import { sectionDestination } from '../../../../shared/agenda/navigation.js';

// APP-UNICA (PO 2026-11-08): la stessa pagina «Altro» di Studio. Vita = le sezioni di Personal,
// Lavoro = le sezioni dello studio (si aprono direttamente nella parte Studio).
const VITA = [['oggi', 'Oggi', 'oggi', '#E0A526'], ['conti', 'Conti', 'conti', '#34845A'], ['personali', 'Personali', 'personali', '#8460CC'], ['legal', 'Pratiche', 'pratiche', '#5E7F1F'],
  ['foto', 'Foto', 'foto', '#C23D78'], ['diario', 'Diario', 'diario', '#9B3D96'], ['didattica', 'Biblioteca', 'biblioteca', '#E3772A'], ['password', 'Password', 'password', '#4E52C4'], ['pdf', 'PDF', 'pdf', '#B23A3A']];
const LAVORO = [['paz', 'Pazienti', 'pazienti', '#1F5F7A'], ['paga', 'Incassi', 'incassi', '#22714A'], ['piani', 'Piani', 'piani', '#2D6BC4'], ['preventivi', 'Preventivi', 'preventivi', '#4E52C4'],
  ['richiami', 'Richiami', 'richiami', '#D1453B'], ['spese', 'Spese', 'spese', '#A8323E'], ['controllo', 'Controllo', 'controllo', '#1F5F7A'], ['listino', 'Listino', 'listino', '#5D6979']];

export function VistaAltro({ ctx }) {
  const gruppi = [
    { nome: 'Vita · Personale', voci: VITA.map(([id, nome, icona, colore]) => ({ id, nome, icona, colore, fai: () => (id === 'pdf' ? ctx.apri({ tipo: 'pdf' }) : ctx.vai(id)) })) },
    { nome: 'Lavoro · Studio', voci: LAVORO.map(([id, nome, icona, colore]) => ({ id: `studio-${id}`, nome, icona, colore, href: sectionDestination('studio', id) })) },
  ];
  return <AltroPage gruppi={gruppi} piede={[{ id: 'impostazioni', nome: 'Impostazioni e account', icona: 'impostazioni', fai: () => ctx.apri({ tipo: 'impostazioni' }) }]} />;
}
export const altro = { id: 'altro', nome: 'Altro', Icona: IconaAltro, Vista: VistaAltro, pagine: {}, senzaPiu: true, senzaTitolo: true };
