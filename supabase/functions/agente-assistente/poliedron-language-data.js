export const LANGUAGE_SCHOOL_VERSION='2.0.0';
// Curated, de-identified Italian operational language. Never raw patient/clinical training data.
export const ITALIAN_OPERATIONAL_EXAMPLES=Object.freeze([
{intent:'AGENDA_READ',utterances:['fammi vedere gli appuntamenti di domani','che agenda ho domani','cosa ho in agenda domani','mostrami le visite di domani','che pazienti vedo domani','domani chi viene','agenda di domani','impegni di domani']},
{intent:'PATIENT_SEARCH',utterances:['cerca paziente Mario Rossi','trova Mario Rossi','apri la scheda di Mario Rossi','fammi vedere Mario Rossi','cercami Mario Rossi','vai sulla scheda di Mario Rossi','aprimi Mario Rossi']},
{intent:'RECALLS_READ',utterances:['fammi vedere i richiami','chi devo richiamare','controlli periodici da fissare','quali richiami ho','chi devo ricontattare','richiami da fare','pazienti da richiamare']},
{intent:'KPI_READ',utterances:['come sta andando lo studio','fammi vedere il fatturato','quanto abbiamo incassato','situazione economica dello studio','come siamo messi questo mese','quanto stiamo producendo','fammi vedere i numeri dello studio']},
{intent:'APPOINTMENT_CREATE',utterances:['fissa un appuntamento per Mario Rossi domani alle 15 per igiene','metti Mario Rossi domani alle 15 per igiene','prenota Mario Rossi domani ore 15 per una pulizia','Mario Rossi domani alle tre deve fare igiene','mettimi Mario Rossi domani alle 15 per igiene','blocca Mario Rossi domani alle 15 per igiene','segna Mario Rossi domani alle 15 per igiene','Mario Rossi igiene domani alle 15']}
]);
export const ITALIAN_DOMAIN_SYNONYMS=Object.freeze({appointment:['appuntamento','visita','prenotazione'],create:['crea','fissa','prenota','metti','inserisci','aggiungi'],hygiene:['igiene','pulizia','igiene orale','seduta di igiene'],search:['cerca','trova','apri','fammi vedere','mostrami']});
