// POL-WORK-001 — Contratto puro per attività esterne in Poliedron Personal.
// Nessuna esecuzione Work o browser implicita: lo stato deriva solo da eventi verificati.
export const STATI_ATTIVITA = Object.freeze(['in_attesa', 'in_corso', 'richiede_conferma', 'completata', 'errore']);
export const ORIGINI_ATTIVITA = Object.freeze(['api', 'work_manuale', 'browser_agent']);
const TRANSIZIONI = Object.freeze({
  in_attesa: ['in_corso', 'errore'],
  in_corso: ['richiede_conferma', 'completata', 'errore'],
  richiede_conferma: ['in_corso', 'errore'],
  errore: ['in_attesa'],
  completata: [],
});
const azioniSensibili = new Set(['pagamento', 'invio', 'cancellazione', 'modifica_sensibile']);
export function richiedeConferma(azione) {
  return azioniSensibili.has(azione);
}
export function creaAttivita({ id, titolo, origine = 'work_manuale', data = new Date().toISOString() }) {
  if (typeof id !== 'string' || !id.trim() || typeof titolo !== 'string' || !titolo.trim()) throw new Error('Identificativo e titolo obbligatori');
  if (!ORIGINI_ATTIVITA.includes(origine)) throw new Error('Origine non supportata');
  return { id, titolo: titolo.trim(), origine, stato: 'in_attesa', creataIl: data, aggiornataIl: data, eventi: [], allegati: [], risultato: null };
}
export function registraEvento(attivita, evento) {
  if (!attivita || !STATI_ATTIVITA.includes(attivita.stato)) throw new Error('Attività non valida');
  const { stato, descrizione, data = new Date().toISOString(), prova = null, allegati = [] } = evento || {};
  if (!TRANSIZIONI[attivita.stato].includes(stato)) throw new Error('Transizione non consentita');
  if (typeof descrizione !== 'string' || !descrizione.trim()) throw new Error('Descrizione obbligatoria');
  if (stato === 'completata' && (typeof prova !== 'string' || !prova.trim())) throw new Error('Prova di completamento obbligatoria');
  if (!Array.isArray(allegati) || allegati.some(a => !a || typeof a.nome !== 'string' || typeof a.riferimento !== 'string')) throw new Error('Allegati non validi');
  const nuovoEvento = { stato, descrizione: descrizione.trim(), data, prova: prova || null };
  return {
    ...attivita, stato, aggiornataIl: data,
    eventi: [...attivita.eventi, nuovoEvento],
    allegati: [...attivita.allegati, ...allegati],
    risultato: stato === 'completata' ? { descrizione: descrizione.trim(), prova } : attivita.risultato,
  };
}
export function aggiornamentoPersonal(attivita) {
  if (!attivita?.eventi?.length) return null;
  const ultimo = attivita.eventi.at(-1);
  return { attivitaId: attivita.id, titolo: attivita.titolo, stato: attivita.stato, messaggio: ultimo.descrizione, data: ultimo.data, verificato: attivita.stato === 'completata' };
}
