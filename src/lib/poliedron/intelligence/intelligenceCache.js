import { INTELLIGENCE_VERSION } from './model.js';

const MAX_ENTRIES = 8;
const DEFAULT_TTL_MS = 5 * 60 * 1000;
const memoryCache = new Map();

const hashText = (text) => {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
};

const relevantShape = ({
  patients = [], plans = [], appointments = [], recalls = [], activities = [],
}) => JSON.stringify({
  patients: patients.map((row) => [row.id, row.studio_id, row.nome, row.cognome, row.updated_at]),
  plans: plans.map((row) => [
    row.id, row.studio_id, row.pazienteId, row.stato, row.data, row.titolo, row.updated_at,
    (row.voci || []).map((voice) => [
      voice.prestazione, voice.eseguita, voice.dataEsec, voice.richiamoData, voice.richiamoTipo,
    ]),
  ]),
  appointments: appointments.map((row) => [row.id, row.studio_id, row.pazienteId, row.data, row.ora, row.tipo, row.stato, row.updated_at]),
  recalls: recalls.map((row) => [row.id, row.studio_id, row.pazienteId, row.categoria, row.motivo, row.dataScadenza, row.stato, row.updated_at]),
  activities: activities.map((row) => [row.id, row.studio_id, row.pazienteId, row.patientId, row.testo, row.titolo, row.note, row.stato, row.fatto, row.updated_at]),
});

export const createIntelligenceFingerprint = (sources) => hashText(relevantShape(sources));

export const createIntelligenceCacheKey = ({ studioId, fingerprint }) => (
  `${studioId}|${INTELLIGENCE_VERSION}|${fingerprint}`
);

export function getCachedIntelligence(key, now = Date.now()) {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    memoryCache.delete(key);
    return null;
  }
  memoryCache.delete(key);
  memoryCache.set(key, entry);
  return entry.value;
}

export function setCachedIntelligence(key, value, { now = Date.now(), ttlMs = DEFAULT_TTL_MS } = {}) {
  memoryCache.set(key, { value, expiresAt: now + ttlMs });
  while (memoryCache.size > MAX_ENTRIES) {
    memoryCache.delete(memoryCache.keys().next().value);
  }
  return value;
}

export const clearIntelligenceCache = () => memoryCache.clear();
