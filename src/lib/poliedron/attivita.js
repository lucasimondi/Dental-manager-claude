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
  ripristino: 'Ripristino',
};

export const etichettaAttivita = (azione) => ETICHETTE[azione] || 'Azione';
// The stored summary starts with the chat's "Fatto." and repeats the label on its
// first line: show only the details below the label.
export const dettaglioAttivita = (riepilogo) => String(riepilogo || '').replace(/^Fatto\.\s*/, '').split('\n').slice(1).join('\n');

// Actions the database can undo (poliedron_ripristina_v1). A new patient is not:
// other records may already depend on it.
const RIPRISTINABILI = new Set(['crea_appuntamento', 'modifica_appuntamento', 'elimina_appuntamento', 'modifica_paziente',
  'aggiungi_nota_paziente', 'crea_richiamo', 'crea_promemoria', 'crea_impegno_personale']);

// Ids already undone, from the 'ripristino' rows pointing back at them.
export const idsRipristinati = (rows) => new Set((rows || []).map((r) => r.ripristino_di).filter(Boolean));

export const puoRipristinare = (row, ripristinati) => RIPRISTINABILI.has(row?.azione) && !ripristinati.has(row.id);

// Tables to refresh after an undo: an agenda undo can also open/close a recall.
export const tabelleDopoRipristino = (tabella) => (tabella === 'appointments' ? ['appointments', 'richiami'] : tabella ? [tabella] : []);
