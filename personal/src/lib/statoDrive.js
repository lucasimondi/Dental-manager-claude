// PR #337 — stato della sincronizzazione con Google Drive, mostrato nell'area di sistema della barra.
// Esplora segnala l'inizio e la fine di ogni operazione su Drive; la barra legge con useSyncExternalStore.
// stato: 'ok' (tutto allineato) · 'sync' (operazioni in corso o file in attesa del giro dello script) · 'errore'.
let corrente = { stato: 'ok', inCorso: 0, inAttesa: 0, errore: null };
const ascoltatori = new Set();
const avvisa = () => ascoltatori.forEach((f) => f());
const ricalcola = (s) => ({ ...s, stato: s.errore ? 'errore' : s.inCorso > 0 || s.inAttesa > 0 ? 'sync' : 'ok' });

export const statoDrive = () => corrente;
export function ascoltaStatoDrive(f) { ascoltatori.add(f); return () => ascoltatori.delete(f); }
export function inizioDrive() { corrente = ricalcola({ ...corrente, inCorso: corrente.inCorso + 1 }); avvisa(); }
export function fineDrive(errore = null) {
  corrente = ricalcola({ ...corrente, inCorso: Math.max(0, corrente.inCorso - 1), errore: errore || null });
  avvisa();
}
export function attesaDrive(n) { corrente = ricalcola({ ...corrente, inAttesa: Math.max(0, Number(n) || 0) }); avvisa(); }
export function testoStatoDrive(s = corrente) {
  if (s.stato === 'errore') return `Drive: ${s.errore || 'errore di sincronizzazione'}`;
  if (s.inCorso > 0) return 'Drive: sincronizzo…';
  if (s.inAttesa > 0) return `Drive: ${s.inAttesa} ${s.inAttesa === 1 ? 'file' : 'file'} al prossimo giro`;
  return 'Drive sincronizzato';
}
