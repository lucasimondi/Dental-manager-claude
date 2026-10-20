import { differito } from '../../Differito.jsx';
// Sezione Agenda: agenda personale e dello studio (giorno, settimana, mese), eventi e appuntamenti.
import { IconaCalendario } from '../../Icone.jsx';
const VistaAgenda = differito(() => import('./Agenda.jsx'), 'VistaAgenda');
const ElencoGiorno = differito(() => import('./Agenda.jsx'), 'ElencoGiorno');
const PaginaEvento = differito(() => import('./Evento.jsx'), 'PaginaEvento');
const PaginaAppuntamento = differito(() => import('./Appuntamento.jsx'), 'PaginaAppuntamento');

export { ElencoGiorno };

export const agenda = {
  id: 'agenda', nome: 'Agenda', Icona: IconaCalendario, Vista: VistaAgenda,
  // L'agenda ha la sua barra (giorni, vista): niente titolo in testata, contenuto a tutta altezza.
  senzaTitolo: true, classeTestata: 'pp-testata-agenda', classeContenuto: 'pp-contenuto-agenda',
  pagine: {
    evento: { titolo: 'Evento', modulo: true, render: (p, { ctx, chiudi }) => <PaginaEvento evento={p.evento} cosa={p.cosa} ctx={ctx} chiudi={chiudi} /> },
    appuntamento: { titolo: 'Appuntamento', render: (p, { ctx, chiudi }) => <PaginaAppuntamento a={p.a} ctx={ctx} chiudi={chiudi} /> },
  },
};
