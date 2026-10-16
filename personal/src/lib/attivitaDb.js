// POL-WORK-001 — Personal-only persistence, guarded by owner RLS.
export async function elencoAttivita(db) {
  const { data, error } = await db.from('attivita_esterne').select('id,titolo,origine,stato,prova,risultato,created_at,updated_at').order('updated_at', { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return data || [];
}
export async function nuovaAttivita(db, titolo) {
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError || !auth?.user?.id) throw new Error('Sessione non valida');
  const { data, error } = await db.from('attivita_esterne').insert({ user_id: auth.user.id, titolo: titolo.trim(), origine: 'work_manuale' }).select().single();
  if (error) throw new Error(error.message);
  return data;
}
export async function cambiaStatoAttivita(db, attivita, stato, prova = null) {
  const permessi = { in_attesa: ['in_corso', 'errore'], in_corso: ['completata', 'richiede_conferma', 'errore'], richiede_conferma: ['in_corso', 'errore'], errore: ['in_attesa'], completata: [] };
  if (!permessi[attivita.stato]?.includes(stato)) throw new Error('Transizione non consentita');
  if (stato === 'completata' && !prova?.trim()) throw new Error('Prova di completamento obbligatoria');
  const { data, error } = await db.from('attivita_esterne').update({ stato, prova: stato === 'completata' ? prova.trim() : attivita.prova, updated_at: new Date().toISOString() }).eq('id', attivita.id).eq('stato', attivita.stato).select().single();
  if (error) throw new Error(error.message);
  return data;
}
