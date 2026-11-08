// APP-UNICA passo 2: un solo accesso. Se nello stesso indirizzo c'è già la sessione di Studio
// (stesso progetto Supabase e stesso utente), Personal la riusa invece di chiedere di nuovo email e
// password. Legge solo il token salvato dal client di Studio su questo stesso dominio.
// Modulo senza dipendenze e senza indirizzi di progetto (quelli restano in lib/studio.js).
export const CHIAVE_SCOLLEGATO = 'poliedron-personal-studio-scollegato';
// Chiave con cui supabase-js salva la sessione: sb-<riferimento del progetto>-auth-token.
export const chiaveSessione = (url) => `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
export function leggiSessioneSalvata(storage, chiave) {
  try {
    const s = JSON.parse(storage?.getItem(chiave) || 'null');
    return s?.access_token && s?.refresh_token ? { access_token: s.access_token, refresh_token: s.refresh_token } : null;
  } catch { return null; }
}
