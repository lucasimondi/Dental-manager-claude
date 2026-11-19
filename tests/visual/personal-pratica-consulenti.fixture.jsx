// Synthetic-only fixture (PRATICHE-CONSULENTI): pratica page with Consulenti and Email tabs, fake local session,
// Supabase answered by the test. No real data.
import { ARCHIVIO_STORAGE_KEY } from '../../personal/src/lib/archivioConfig.js';
const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const exp = Math.floor(Date.now() / 1000) + 86400;
const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u-test', exp, aud: 'authenticated', email: 'prova@example.com' })}.firma`;
localStorage.setItem(ARCHIVIO_STORAGE_KEY, JSON.stringify({ access_token: token, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user: { id: 'u-test', aud: 'authenticated', email: 'prova@example.com' } }));
await import('../../personal/src/personal.css');
const React = (await import('react')).default;
const { createRoot } = await import('react-dom/client');
const { PaginaPratica } = await import('../../personal/src/sezioni/documenti/Pratica.jsx');
window.consulentiTest = { aperto: [], toast: [] };
const ctx = { esegui: async (fn) => fn(), aggiorna() {}, mostra: (t) => window.consulentiTest.toast.push(t), apri: (p) => window.consulentiTest.aperto.push(p), versione: 0,
  impostazioni: { persone: [], categorie: [] }, fascicoli: [{ codice: 'legale', nome: 'Legale' }], pagato: async () => {} };
createRoot(document.getElementById('root')).render(<div className="pp-app"><main className="pp-pagina">
  <PaginaPratica p={{ id: 'p-uno', titolo: 'Fornitore Prova – esecuzione immobiliare con un titolo piuttosto lungo', fascicolo: 'legale', stato: 'aperta' }} ctx={ctx} />
</main></div>);
