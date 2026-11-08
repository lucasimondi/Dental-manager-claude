import { IconaPerTe } from '../../Icone.jsx';
import AltroPage from '../../../../shared/altro/AltroPage.jsx';

// DOCK-PER-TE (PO 2026-11-08): «Per te», la stessa pagina che in Studio. Il lavoro dello studio
// ha la sua voce «Studio» nel dock. L'id resta «altro» per i link già esistenti (?sezione=altro).
const PER_TE = [['conti', 'Spese e pagamenti', 'conti', '#34845A'], ['personali', 'Documenti personali', 'personali', '#8460CC'], ['foto', 'Foto', 'foto', '#C23D78'], ['note', 'Note', 'nota', '#C98A10'],
  ['diario', 'Diario', 'diario', '#9B3D96'], ['legal', 'Pratiche', 'pratiche', '#5E7F1F'], ['didattica', 'Biblioteca', 'biblioteca', '#E3772A'], ['oggi', 'Riepilogo di oggi', 'oggi', '#E0A526'], ['password', 'Password', 'password', '#4E52C4'], ['pdf', 'PDF', 'pdf', '#B23A3A']];

export function VistaAltro({ ctx }) {
  const gruppi = [
    { nome: 'Per te', voci: PER_TE.map(([id, nome, icona, colore]) => ({ id, nome, icona, colore, fai: () => (id === 'pdf' ? ctx.apri({ tipo: 'pdf' }) : ctx.vai(id)) })) },
  ];
  return <AltroPage titolo="Per te" gruppi={gruppi} piede={[{ id: 'impostazioni', nome: 'Impostazioni e account', icona: 'impostazioni', fai: () => ctx.apri({ tipo: 'impostazioni' }) }]} />;
}
export const altro = { id: 'altro', nome: 'Per te', Icona: IconaPerTe, Vista: VistaAltro, pagine: {}, senzaPiu: true, senzaTitolo: true };
