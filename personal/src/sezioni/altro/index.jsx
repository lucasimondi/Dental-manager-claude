import { IconaPerTe } from '../../Icone.jsx';
import AltroPage from '../../../../shared/altro/AltroPage.jsx';

// DOCK-PER-TE (PO 2026-11-08): «Per te», la stessa pagina che in Studio. Il lavoro dello studio
// ha la sua voce «Studio» nel dock. L'id resta «altro» per i link già esistenti (?sezione=altro).
const PER_TE = [
  ['conti', 'Spese e pagamenti', 'conti', 'grande', 'Conti, ricevute e cose da pagare'],
  ['personali', 'Documenti personali', 'personali', 'alta', "Carta d'identità, patente, codice fiscale"],
  ['foto', 'Foto', 'foto', 'media'], ['note', 'Note', 'nota', 'media'],
  ['diario', 'Diario', 'diario', 'piccola'], ['legal', 'Pratiche', 'pratiche', 'piccola'], ['didattica', 'Biblioteca', 'biblioteca', 'piccola'],
  ['password', 'Password', 'password', 'pulsante'], ['oggi', 'Oggi', 'oggi', 'pulsante'],
];

export function VistaAltro({ ctx }) {
  const gruppi = [
    { nome: 'Per te', voci: PER_TE.map(([id, nome, icona, taglia, sotto]) => ({ id, nome, icona, taglia, sotto, fai: () => (id === 'personali' ? ctx.vai('documenti', 'personali') : ctx.vai(id)) })) },
  ];
  return <AltroPage titolo="Per te" gruppi={gruppi} piede={[{ id: 'impostazioni', nome: 'Impostazioni e account', icona: 'impostazioni', fai: () => ctx.apri({ tipo: 'impostazioni' }) }]} />;
}
export const altro = { id: 'altro', nome: 'Per te', Icona: IconaPerTe, Vista: VistaAltro, pagine: {}, senzaPiu: true, senzaTitolo: true };
