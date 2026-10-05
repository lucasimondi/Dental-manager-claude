// POL-AI-010: labels for the "Attività di Poliedron" log.
const ETICHETTE = {
  crea_appuntamento: 'Appuntamento creato',
  modifica_appuntamento: 'Appuntamento modificato',
  elimina_appuntamento: 'Appuntamento annullato',
  crea_paziente: 'Nuovo paziente',
  modifica_paziente: 'Scheda aggiornata',
  aggiungi_nota_paziente: 'Nota in scheda',
  crea_richiamo: 'Richiamo',
  crea_promemoria: 'Attività',
  crea_impegno_personale: 'Agenda bloccata',
};

export const etichettaAttivita = (azione) => ETICHETTE[azione] || 'Azione';
// The stored summary starts with the chat's "Fatto." and repeats the label on its
// first line: show only the details below the label.
export const dettaglioAttivita = (riepilogo) => String(riepilogo || '').replace(/^Fatto\.\s*/, '').split('\n').slice(1).join('\n');
