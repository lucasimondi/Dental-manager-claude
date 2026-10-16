import { createClient } from '@supabase/supabase-js';

// Progetto Supabase separato `archivio-documenti` — mai il progetto dello studio.
// Chiave pubblicabile: i dati sono protetti dalla RLS (solo il proprietario con email confermata).
// Flusso implicito: il link per impostare la password funziona anche se aperto in Safari
// mentre la richiesta è partita dall'app sulla Home (che su iOS ha una memoria separata).
export const ARCHIVIO_URL = 'https://tkcwvjzjkfhcuebrjvsp.supabase.co';
const ARCHIVIO_KEY = 'sb_publishable_oJeCgTR2TiLKJmC9L_kiFA_mL4hb48f';

export const archivioDb = createClient(ARCHIVIO_URL, ARCHIVIO_KEY, {
  auth: { persistSession: true, storageKey: 'poliedron-personal-auth', detectSessionInUrl: true, flowType: 'implicit' },
});
