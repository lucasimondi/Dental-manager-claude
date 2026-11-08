import { createClient } from '@supabase/supabase-js';

// Progetto Supabase separato `archivio-documenti` — mai il progetto dello studio.
// Chiave pubblicabile: i dati sono protetti dalla RLS (solo il proprietario con email confermata).
// Flusso implicito: il link per impostare la password funziona anche se aperto in Safari
// mentre la richiesta è partita dall'app sulla Home (che su iOS ha una memoria separata).
import { ARCHIVIO_URL, ARCHIVIO_KEY, ARCHIVIO_STORAGE_KEY } from './archivioConfig.js';

export { ARCHIVIO_URL };
export const archivioDb = createClient(ARCHIVIO_URL, ARCHIVIO_KEY, {
  auth: { persistSession: true, storageKey: ARCHIVIO_STORAGE_KEY, detectSessionInUrl: true, flowType: 'implicit' },
});
