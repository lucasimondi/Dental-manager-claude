// POL-AI-011: "Come risponde Poliedron" — readable summary of
// poliedron_statistiche_v1 (how many answers the Core closed without the model,
// and what still goes to the model). Pure functions, tested in
// tests/poliedronEventi.test.mjs.

const INTENTI = {
  AGENDA_READ: 'Leggere l\'agenda',
  AGENDA_AVAILABILITY: 'Orari liberi',
  PATIENT_SEARCH: 'Cercare un paziente',
  RECALLS_READ: 'Leggere i richiami',
  KPI_READ: 'Leggere i numeri dello studio',
  APPOINTMENT_CREATE: 'Fissare un appuntamento',
  APPOINTMENT_MOVE: 'Spostare un appuntamento',
  APPOINTMENT_DELETE: 'Annullare un appuntamento',
  APPOINTMENT_UPDATE: 'Durata/tipo/stato di un appuntamento',
  AGENDA_BLOCK: 'Bloccare l\'agenda / ferie',
  PATIENT_NOTE: 'Nota in scheda',
  PATIENT_CONTACT: 'Telefono / email',
  PATIENT_CREATE: 'Nuovo paziente',
  RECALL_CREATE: 'Creare un richiamo',
  PAYMENT_CREATE: 'Registrare un pagamento',
};

const AZIONI = {
  cerca_pazienti: 'Cercare un paziente',
  appuntamenti: 'Leggere l\'agenda',
  disponibilita_agenda: 'Orari liberi',
  scheda_paziente: 'Scheda paziente',
  storico_paziente: 'Storico paziente',
  situazione_economica: 'Situazione economica',
  kpi_controllo_gestione: 'KPI',
  andamento_kpi: 'Andamento KPI',
  richiami: 'Leggere i richiami',
  catalogo_prestazioni: 'Listino',
  crea_appuntamento: 'Fissare un appuntamento',
  modifica_appuntamento: 'Modificare un appuntamento',
  elimina_appuntamento: 'Annullare un appuntamento',
  crea_paziente: 'Nuovo paziente',
  modifica_paziente: 'Aggiornare la scheda',
  aggiungi_nota_paziente: 'Nota in scheda',
  crea_richiamo: 'Creare un richiamo',
  crea_promemoria: 'Creare un\'attività',
  crea_impegno_personale: 'Bloccare l\'agenda',
  registra_pagamento_paziente: 'Registrare un pagamento',
  crea_piano_cura: 'Creare un piano di cura',
  imposta_stato_piano: 'Accettare/rifiutare un piano',
  segna_prestazione_eseguita: 'Prestazione eseguita',
  aggiungi_prestazione_piano: 'Aggiungere una prestazione',
  prepara_ricetta: 'Preparare una ricetta',
  ricorda: 'Ricordare qualcosa',
  dimentica: 'Dimenticare qualcosa',
  consulta_specialisti: 'Consultare il team',
  azione_personalizzata: 'Azione personalizzata dello studio',
  non_consentito: 'Strumento non disponibile',
  altro: 'Altro',
};

export const etichettaIntento = (intento) => INTENTI[intento] || intento;
export const etichettaAzione = (azione) => AZIONI[azione] || azione;

const pct = (n, totale) => (totale ? Math.round((100 * n) / totale) : 0);

/** Summary for the dashboard, or null when there are no answers in the period yet. */
export function riepilogoStatistiche(stats) {
  const totale = Number(stats?.totale) || 0;
  if (!totale) return null;
  const p = stats.percorsi || {};
  const core = Number(p.core) || 0;
  const modello = Number(p.modello) || 0;
  const essenziale = Number(p.essenziale) || 0;
  const conferme = Number(p.conferma) || 0;
  // Confirmations are the second half of an earlier answer: the share is on the requests.
  const richieste = core + modello + essenziale;
  const lista = (rows, label) => (Array.isArray(rows) ? rows : []).map((r) => ({ etichetta: label(r.intento ?? r.azione), n: Number(r.n) || 0 }));
  return {
    giorni: Number(stats.giorni) || 30,
    richieste,
    conferme,
    core: { n: core, pct: pct(core, richieste) },
    modello: { n: modello, pct: pct(modello, richieste) },
    essenziale: { n: essenziale, pct: pct(essenziale, richieste) },
    eseguite: Number(stats.esiti?.eseguito) || 0,
    intentiCore: lista(stats.intenti_core, etichettaIntento),
    azioniModello: lista(stats.azioni_modello, etichettaAzione),
    passateAlModello: lista(stats.intenti_passati_al_modello, etichettaIntento),
    modelloSenzaAzioni: Number(stats.modello_senza_azioni) || 0,
  };
}
