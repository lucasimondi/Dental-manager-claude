// Synthetic-only fixture (MIEI-DATI): «I miei dati» with a fake local session, Supabase answered by the test. No real data.
import { ARCHIVIO_STORAGE_KEY } from '../../personal/src/lib/archivioConfig.js';
const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const exp = Math.floor(Date.now() / 1000) + 86400;
const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u-test', exp, aud: 'authenticated', email: 'prova@example.com' })}.firma`;
localStorage.setItem(ARCHIVIO_STORAGE_KEY, JSON.stringify({ access_token: token, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user: { id: 'u-test', aud: 'authenticated', email: 'prova@example.com' } }));
await import('../../personal/src/personal.css');
const React = (await import('react')).default;
const { createRoot } = await import('react-dom/client');
const { MieiDati } = await import('../../personal/src/sezioni/dati/MieiDati.jsx');
window.mdTest = { toast: [] };
const ctx = { esegui: async (fn) => fn(), aggiorna() {}, mostra: (t) => window.mdTest.toast.push(t), apri() {}, versione: 0 };
createRoot(document.getElementById('root')).render(<div className="pp-app"><main className="pp-pagina"><MieiDati ctx={ctx} /></main></div>);
