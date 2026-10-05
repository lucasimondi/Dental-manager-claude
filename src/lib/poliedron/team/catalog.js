/** Product roles, not capabilities. No entry grants data access or tools.
 * Integration must authorize each consultation through existing server gates.
 */
const role = (id, label, domain, responsibility) => Object.freeze({
  id, label, domain, responsibility, mode: 'advisory',
});
export const TEAM_ASSISTANTS = Object.freeze([
  role('clinic-manager', 'Clinic Manager', 'coordination', 'Coordina obiettivi e integra i contributi degli specialisti.'),
  role('agenda', 'Assistente Agenda', 'operations', 'Analizza disponibilità e organizzazione dello studio.'),
  role('finance', 'Assistente Finanza', 'finance', 'Interpreta esclusivamente metriche finanziarie canoniche.'),
  role('clinical', 'Assistente Clinico', 'clinical', 'Supporta il professionista senza finalizzare atti clinici.'),
  role('documents', 'Assistente Documenti', 'documents', 'Supporta documentazione autorizzata e segnala dati mancanti.'),
  role('marketing', 'Assistente Marketing', 'marketing', 'Fidelizzazione, richiami e campagne nel rispetto di deontologia e consensi.'),
]);
export const getTeamAssistant = (id) => TEAM_ASSISTANTS.find((assistant) => assistant.id === id) || null;
