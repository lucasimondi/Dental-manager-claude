/* POL-UI-024 — Product Owner: "In Dashboard crea widget che dica la
   salute dei dati gestionale (deve avere una percentuale) e questo viene
   controllato da poliedron che scannerizza tutti i dati mancanti dei
   pazienti: anagrafica numero telefono indirizzo codice fiscale mail,
   inoltre se hanno un piano cura, se sono iniziati i piani e pagamenti,
   se hanno anamnesi e un doc privacy, se vengono compilati bene i dati
   prestazioni incassi se hanno fatto impianti bisogna aver compilato il
   modulo impianti con passaporto imolantare ... Se le spese sono
   aggiornate, i registri pagamenti anche, se ci sono problemi ad
   incassare in tempo se carichiamo i dati bollette corretti [...]
   spese condominiali se assicurazione annuale".

   Pure, I/O-free selector: given data Dashboard.jsx already holds (plus
   two small additions — documenti_medici and implants, see handoffs.md
   for why those weren't already there), produces ONE data-health score
   (0-100) plus a per-check breakdown, each check carrying enough to
   render both a summary count and (for per-patient checks) the list of
   patients failing it — same "one signal, one clickable target" shape
   dataHealthActivities.js already established, reused here rather than
   re-deriving what counts as "anamnesi mancante"/"piano non iniziato"/
   "piano non deciso" a second time.

   SCOPE NOTE (disclosed simplification, not a bug): per-patient checks
   only consider "pazienti attivi" (almeno un piano) — same precedent as
   dataHealthActivities.js's own scanner entries, to avoid diluting the
   score with the studio's entire historical patient list. The "Impianti"
   check only applies to patients who actually have an implant on file
   (patients with zero implants are excluded from that check's own
   denominator, not counted as passing or failing it).

   TWO CHECKS THE PRODUCT OWNER ASKED FOR ARE DELIBERATELY NOT HERE YET
   (see handoffs.md "consigli" for the proposal):
   - "panoramica caricata" per chi ha impianti — richiede poter etichettare
     un documento come tipo "panoramica" in fase di caricamento (oggi
     ArchivioDocs non lo distingue da un esame generico).
   - "bollette caricate corrette e non a caso" — un controllo di qualità/
     anomalia sull'importo (fuori range storico ecc.), non solo presenza/
     recency come gli altri controlli spese qui sotto. */

import { ACTIVITY_KIND, patientDisplayName } from './dataHealthActivities.js';

export const DATA_HEALTH_SCORE_CHECK = Object.freeze({
  ANAGRAFICA: 'anagrafica',
  ANAMNESI: 'anamnesi',
  PRIVACY: 'privacy',
  PIANO_INIZIATO: 'piano_iniziato',
  PIANO_DECISO: 'piano_deciso',
  PAGAMENTI: 'pagamenti',
  IMPIANTI: 'impianti',
  SPESE_AGGIORNATE: 'spese_aggiornate',
  BOLLETTE: 'bollette',
  CONDOMINIO: 'condominio',
  ASSICURAZIONE: 'assicurazione',
});

export const DATA_HEALTH_SCORE_CHECK_LABEL = Object.freeze({
  [DATA_HEALTH_SCORE_CHECK.ANAGRAFICA]: 'Anagrafica completa (telefono, indirizzo, CF, email)',
  [DATA_HEALTH_SCORE_CHECK.ANAMNESI]: 'Anamnesi compilata',
  [DATA_HEALTH_SCORE_CHECK.PRIVACY]: 'Documento privacy/consenso caricato',
  [DATA_HEALTH_SCORE_CHECK.PIANO_INIZIATO]: 'Piano di cura iniziato',
  [DATA_HEALTH_SCORE_CHECK.PIANO_DECISO]: 'Piano di cura accettato o rifiutato',
  [DATA_HEALTH_SCORE_CHECK.PAGAMENTI]: 'Pagamenti in regola (nessuna scadenza scaduta)',
  [DATA_HEALTH_SCORE_CHECK.IMPIANTI]: 'Passaporto implantare compilato (marca, modello, lotto)',
  [DATA_HEALTH_SCORE_CHECK.SPESE_AGGIORNATE]: 'Spese registrate di recente',
  [DATA_HEALTH_SCORE_CHECK.BOLLETTE]: 'Bollette (utenze) aggiornate',
  [DATA_HEALTH_SCORE_CHECK.CONDOMINIO]: 'Spese condominiali aggiornate',
  [DATA_HEALTH_SCORE_CHECK.ASSICURAZIONE]: 'Assicurazione annuale aggiornata',
});

// Documenti considerati validi per il controllo privacy: 'consenso' è la
// categoria già in uso in ArchivioDocs; 'privacy' è un tipo che non esiste
// ancora in nessuna UI di caricamento (proposta Fase 2, vedi sopra) ma è
// già riconosciuto qui per non dover toccare questo file quando verrà
// aggiunto.
const PRIVACY_DOCUMENT_TYPES = new Set(['consenso', 'privacy']);

const daysSince = (isoDate, todayIso) => Math.round(
  (new Date(`${todayIso}T12:00:00`).getTime() - new Date(`${isoDate}T12:00:00`).getTime()) / 86400000,
);

const speseUpdatedWithin = (spese, categoria, maxDays, todayIso) => (spese || []).some((s) => {
  if (categoria && s.categoria !== categoria) return false;
  if (!s.data) return false;
  const delta = daysSince(s.data, todayIso);
  return delta >= 0 && delta <= maxDays;
});

const makeGroup = () => ({ passed: [], missing: [] });

/** One data-health score, 0-100, plus a per-check breakdown. `documents`
 *  is documenti_medici rows shaped { paziente_id, tipo } (raw DB column
 *  names — that table isn't part of the app's camelCase DB layer).
 *  `financialDataAvailable` gates the four spese-based checks: `spese` is
 *  only ever populated for users with the management_control permission
 *  (see useControlloDati.js), so for everyone else those checks are
 *  excluded from the average rather than counted as failing. */
export function computeDataHealthScore({
  patients = [], plans = [], dataHealthFindings = [], scadenzeScadute = [],
  documents = [], implants = [], spese = [], today, financialDataAvailable = true,
}) {
  const activePatientIds = new Set((plans || []).map((p) => p?.pazienteId).filter((id) => id != null));
  const activePatients = (patients || []).filter((p) => activePatientIds.has(p.id));

  const kindPatientIds = (kind) => new Set(dataHealthFindings.filter((e) => e.kind === kind).map((e) => e.pazienteId));
  const anamnesiMancanteIds = kindPatientIds(ACTIVITY_KIND.ANAMNESI_MANCANTE);
  const pianoNonIniziatoIds = kindPatientIds(ACTIVITY_KIND.PLAN_NEVER_STARTED);
  const pianoNonDecisoIds = kindPatientIds(ACTIVITY_KIND.PLAN_AWAITING_ACCEPTANCE_DECISION);
  const scadutoIds = new Set((scadenzeScadute || []).map((s) => s.paz?.id).filter((id) => id != null));
  const privacyIds = new Set((documents || []).filter((d) => PRIVACY_DOCUMENT_TYPES.has(d.tipo)).map((d) => d.paziente_id));

  const implantsByPatient = new Map();
  for (const implant of implants || []) {
    if (implant?.pazienteId == null) continue;
    const list = implantsByPatient.get(implant.pazienteId) || [];
    list.push(implant);
    implantsByPatient.set(implant.pazienteId, list);
  }

  const groups = {
    [DATA_HEALTH_SCORE_CHECK.ANAGRAFICA]: makeGroup(),
    [DATA_HEALTH_SCORE_CHECK.ANAMNESI]: makeGroup(),
    [DATA_HEALTH_SCORE_CHECK.PRIVACY]: makeGroup(),
    [DATA_HEALTH_SCORE_CHECK.PIANO_INIZIATO]: makeGroup(),
    [DATA_HEALTH_SCORE_CHECK.PIANO_DECISO]: makeGroup(),
    [DATA_HEALTH_SCORE_CHECK.PAGAMENTI]: makeGroup(),
    [DATA_HEALTH_SCORE_CHECK.IMPIANTI]: makeGroup(),
  };

  for (const patient of activePatients) {
    const anagraficaOk = Boolean(patient.telefono && patient.indirizzo && patient.cf && patient.email);
    (anagraficaOk ? groups[DATA_HEALTH_SCORE_CHECK.ANAGRAFICA].passed : groups[DATA_HEALTH_SCORE_CHECK.ANAGRAFICA].missing).push(patient);
    (anamnesiMancanteIds.has(patient.id) ? groups[DATA_HEALTH_SCORE_CHECK.ANAMNESI].missing : groups[DATA_HEALTH_SCORE_CHECK.ANAMNESI].passed).push(patient);
    (privacyIds.has(patient.id) ? groups[DATA_HEALTH_SCORE_CHECK.PRIVACY].passed : groups[DATA_HEALTH_SCORE_CHECK.PRIVACY].missing).push(patient);
    (pianoNonIniziatoIds.has(patient.id) ? groups[DATA_HEALTH_SCORE_CHECK.PIANO_INIZIATO].missing : groups[DATA_HEALTH_SCORE_CHECK.PIANO_INIZIATO].passed).push(patient);
    (pianoNonDecisoIds.has(patient.id) ? groups[DATA_HEALTH_SCORE_CHECK.PIANO_DECISO].missing : groups[DATA_HEALTH_SCORE_CHECK.PIANO_DECISO].passed).push(patient);
    (scadutoIds.has(patient.id) ? groups[DATA_HEALTH_SCORE_CHECK.PAGAMENTI].missing : groups[DATA_HEALTH_SCORE_CHECK.PAGAMENTI].passed).push(patient);

    const patientImplants = implantsByPatient.get(patient.id) || [];
    if (patientImplants.length > 0) {
      const complete = patientImplants.every((implant) => implant.marca && implant.modello && implant.lotto);
      (complete ? groups[DATA_HEALTH_SCORE_CHECK.IMPIANTI].passed : groups[DATA_HEALTH_SCORE_CHECK.IMPIANTI].missing).push(patient);
    }
  }

  const checks = Object.entries(groups).map(([id, { passed, missing }]) => {
    const total = passed.length + missing.length;
    return {
      id,
      label: DATA_HEALTH_SCORE_CHECK_LABEL[id],
      scope: 'patient',
      applicable: total > 0,
      passedCount: passed.length,
      totalCount: total,
      passRate: total > 0 ? passed.length / total : null,
      missingPatients: missing.map((p) => ({ pazienteId: p.id, patientName: patientDisplayName(p) })),
    };
  });

  if (financialDataAvailable) {
    const studioChecks = [
      [DATA_HEALTH_SCORE_CHECK.SPESE_AGGIORNATE, speseUpdatedWithin(spese, null, 60, today)],
      [DATA_HEALTH_SCORE_CHECK.BOLLETTE, speseUpdatedWithin(spese, 'Utenze', 120, today)],
      [DATA_HEALTH_SCORE_CHECK.CONDOMINIO, speseUpdatedWithin(spese, 'Condominio', 366, today)],
      [DATA_HEALTH_SCORE_CHECK.ASSICURAZIONE, speseUpdatedWithin(spese, 'Assicurazioni', 366, today)],
    ];
    for (const [id, ok] of studioChecks) {
      checks.push({
        id,
        label: DATA_HEALTH_SCORE_CHECK_LABEL[id],
        scope: 'studio',
        applicable: true,
        passedCount: ok ? 1 : 0,
        totalCount: 1,
        passRate: ok ? 1 : 0,
        missingPatients: [],
      });
    }
  }

  const applicableChecks = checks.filter((c) => c.applicable);
  const percentage = applicableChecks.length > 0
    ? Math.round((applicableChecks.reduce((sum, c) => sum + c.passRate, 0) / applicableChecks.length) * 100)
    : null;

  return { percentage, checks };
}
