// AGENDA-UNICA (PO 2026-11-08: "le scadenze dell'archivio personale compaiono nell'agenda").
// Sul telefono l'agenda di Studio è l'unica agenda: qui legge le scadenze personali (bollette,
// pagamenti, documenti in scadenza) dall'archivio personale, che è un progetto Supabase separato.
// - Nessun nuovo accesso: usa la sessione dell'archivio già salvata da Personal nello stesso indirizzo.
//   Senza sessione non legge nulla (l'archivio si collega una volta aprendo Personal).
// - Client proprio senza lettura dell'indirizzo (detectSessionInUrl: false), così i link di accesso
//   o di recupero password dello studio non vengono mai presi dall'archivio.
// - Sola lettura; nessun contenuto clinico (le scadenze escludono i documenti clinici dei pazienti).
let client = null;
// Esportato per ACQUISISCI-UNICO: lo stesso client (stessa sessione già salvata da Personal) serve ad archiviare nel personale.
export async function archivio() {
  if (client) return client;
  const [{ createClient }, cfg] = await Promise.all([import('@supabase/supabase-js'), import('../../personal/src/lib/archivioConfig.js')]);
  client = createClient(cfg.ARCHIVIO_URL, cfg.ARCHIVIO_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: cfg.ARCHIVIO_STORAGE_KEY, detectSessionInUrl: false },
  });
  return client;
}

/** { collegato, scadenze } — scadenze: { id, data, descrizione, importo, completata }. Mai un errore verso l'agenda. */
export async function leggiScadenzePersonali() {
  try {
    const db = await archivio();
    const { data } = await db.auth.getSession();
    if (!data?.session) return { collegato: false, scadenze: [] };
    const { scadenzeAgenda } = await import('../../personal/src/lib/archivio.js');
    const righe = await scadenzeAgenda(db);
    return { collegato: true, scadenze: (righe || []).filter((s) => s?.data && !s.completata) };
  } catch {
    return { collegato: false, scadenze: [] };
  }
}

/** Le scadenze di un giorno, già nella forma degli impegni del giorno flottanti. */
export function scadenzeDelGiorno(scadenze, giorno, apri) {
  return scadenze.filter((s) => s.data === giorno).map((s) => ({
    id: `scadenza-${s.id}`,
    title: `€ ${s.descrizione || 'Scadenza'}`,
    color: '#b45309',
    onOpen: () => apri(s),
  }));
}
