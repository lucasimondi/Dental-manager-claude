// Synthetic-only fixture (LEGAL-SCHEDE): Legal page (deadline table) or a pratica page (card), fake local
// session, Supabase answered by the test. No real data.
import { ARCHIVIO_STORAGE_KEY } from '../../personal/src/lib/archivioConfig.js';
const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const exp = Math.floor(Date.now() / 1000) + 86400;
const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u-test', exp, aud: 'authenticated', email: 'prova@example.com' })}.firma`;
localStorage.setItem(ARCHIVIO_STORAGE_KEY, JSON.stringify({ access_token: token, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user: { id: 'u-test', aud: 'authenticated', email: 'prova@example.com' } }));
await import('../../personal/src/personal.css');
const React = (await import('react')).default;
const { createRoot } = await import('react-dom/client');
const { Legal } = await import('../../personal/src/sezioni/legal/Legal.jsx');
const { PaginaPratica } = await import('../../personal/src/sezioni/documenti/Pratica.jsx');
window.legalTest = { aperto: [], toast: [] };
const ctx = { esegui: async (fn) => fn(), aggiorna() {}, mostra: (t) => window.legalTest.toast.push(t), apri: (p) => window.legalTest.aperto.push(p), versione: 0,
  impostazioni: { persone: [], categorie: [] }, fascicoli: [{ codice: 'legale', nome: 'Legale' }], pagato: async () => {} };
const vista = new URLSearchParams(location.search).get('vista');
createRoot(document.getElementById('root')).render(<div className="pp-app"><main className="pp-pagina">{vista === 'pratica'
  ? <PaginaPratica p={{ id: 'p-uno', titolo: 'Fornitore Prova – opposizione decreto ingiuntivo', fascicolo: 'legale', stato: 'aperta' }} ctx={ctx} />
  : <Legal ctx={ctx} />}</main></div>);
