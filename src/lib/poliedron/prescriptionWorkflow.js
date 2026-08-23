import { normalizza } from '../ricercaPazienti.js';
import { hasExplicitOperationalVerb } from './intentEngine.js';

const PRESCRIPTION_PATTERN = /\b(?:ric|rice|ricetta|ricette)\b/i;
const QUESTION_PATTERN = /^(?:come|cosa|cos['’]?e|perch[ée]|quando|dove|quali?|posso|si pu[oò])\b|\?$/i;
const DRUG_CONNECTORS = new Set(['con', 'farmaco', 'farmaci', 'medicinale', 'medicinali']);
const PATIENT_CONTEXT = new Set(['fai', 'fammi', 'crea', 'prepara', 'ricetta', 'per', 'paziente', 'al', 'alla']);
const POSOLOGY_START = new Set([
  'assumere', 'prendere', 'una', 'un', 'mezza', 'mezzo', 'compressa', 'compresse',
  'capsula', 'capsule', 'bustina', 'bustine', 'gocce', 'cp', 'cps', 'due', 'tre',
  'quattro', 'ogni', 'volte', 'die', 'mattina', 'sera', 'dopo', 'prima', 'durante',
  'al', 'allo', 'alla', 'per',
]);
const POSOLOGY_UNITS = new Set(['compressa', 'compresse', 'capsula', 'capsule', 'bustina', 'bustine', 'gocce', 'cp', 'cps', 'volte']);

const tokensWithNormalized = (text) => (text || '')
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .map((token) => ({ raw: token, normalized: normalizza(token).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '') }));

const patientTokens = (patient) => [patient?.nome, patient?.cognome]
  .flatMap((value) => normalizza(value).split(/\s+/))
  .filter((value) => value.length >= 2);

export const isPrescriptionRequest = (query) => {
  const value = (query || '').trim();
  if (!PRESCRIPTION_PATTERN.test(value) || QUESTION_PATTERN.test(value)) return false;
  return hasExplicitOperationalVerb(value);
};

const containsTokenSequence = (tokens, sequence) => {
  if (!sequence.length || sequence.length > tokens.length) return false;
  return tokens.some((_, start) => sequence.every((value, offset) => tokens[start + offset] === value));
};

const patientMatchScore = (patient, normalizedQuery) => {
  const first = normalizza(patient?.nome);
  const last = normalizza(patient?.cognome);
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const forwardTokens = [first, last].filter(Boolean);
  const reverseTokens = [last, first].filter(Boolean);
  if (containsTokenSequence(queryTokens, forwardTokens)) return 300 + forwardTokens.join(' ').length;
  if (containsTokenSequence(queryTokens, reverseTokens)) return 300 + reverseTokens.join(' ').length;
  const surnameIndex = queryTokens.indexOf(last);
  const precedingSurname = surnameIndex > 0 ? queryTokens[surnameIndex - 1] : '';
  const surnameIsStandalone = surnameIndex === 0 || precedingSurname === first || PATIENT_CONTEXT.has(precedingSurname);
  if (last.length >= 3 && surnameIndex >= 0 && surnameIsStandalone) return 180 + last.length;
  if (first.length >= 3 && queryTokens.includes(first)) return 100 + first.length;
  return 0;
};

const extractDrugText = (query, patient) => {
  const tokens = tokensWithNormalized(query);
  const removablePatientTokens = new Set(patientTokens(patient));
  let patientEndIndex = -1;
  if (patient) {
    tokens.forEach(({ normalized }, index) => {
      if (removablePatientTokens.has(normalized)) patientEndIndex = index;
    });
  }
  const connectorIndex = tokens.findIndex(({ normalized }, index) =>
    DRUG_CONNECTORS.has(normalized) && index > patientEndIndex
  );
  const candidate = connectorIndex >= 0
    ? tokens.slice(connectorIndex + 1)
    : patientEndIndex >= 0
      ? tokens.slice(patientEndIndex + 1)
      : [];
  const posologyIndex = candidate.findIndex(({ normalized }, index) =>
    POSOLOGY_START.has(normalized)
    || /^\d+(?:[.,]\d+)?x$/i.test(normalized)
    || (/^\d+(?:[.,]\d+)?$/.test(normalized) && POSOLOGY_UNITS.has(candidate[index + 1]?.normalized))
  );
  const medication = posologyIndex >= 0 ? candidate.slice(0, posologyIndex) : candidate;
  return medication.map(({ raw }) => raw).join(' ').trim();
};

export function resolvePrescriptionRequest(query, patients = []) {
  if (!isPrescriptionRequest(query)) return null;
  const normalizedQuery = normalizza(query);
  const scored = patients
    .map((patient) => ({ patient, score: patientMatchScore(patient, normalizedQuery) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);
  const bestScore = scored[0]?.score || 0;
  const patientCandidates = scored
    .filter(({ score }) => score === bestScore)
    .map(({ patient }) => patient);
  const drugText = extractDrugText(query, patientCandidates[0]);
  const drugNeedsClarification = /\b(?:oppure|o)\b/i.test(drugText);

  return {
    patientCandidates,
    patientOptions: patientCandidates.length ? patientCandidates : patients.slice(0, 8),
    drugText: drugNeedsClarification ? '' : drugText,
    requestedDrugText: drugText,
    drugNeedsClarification,
  };
}
