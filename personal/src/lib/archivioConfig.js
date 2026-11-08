// Progetto Supabase separato `archivio-documenti` — mai il progetto dello studio.
// Solo configurazione pubblica (chiave pubblicabile, dati protetti dalla RLS): nessun client creato qui,
// così l'agenda unica di Studio può leggere le scadenze personali senza effetti al caricamento.
export const ARCHIVIO_URL = 'https://tkcwvjzjkfhcuebrjvsp.supabase.co';
export const ARCHIVIO_KEY = 'sb_publishable_oJeCgTR2TiLKJmC9L_kiFA_mL4hb48f';
// La stessa chiave di sessione di Personal: nello stesso indirizzo l'accesso all'archivio si fa una volta sola.
export const ARCHIVIO_STORAGE_KEY = 'poliedron-personal-auth';
