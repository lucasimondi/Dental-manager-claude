// Synthetic-only fixture (RUBRICA): the Rubrica app with a fake local session, Supabase answered by the test. No real data.
import { ARCHIVIO_STORAGE_KEY } from '../../personal/src/lib/archivioConfig.js';
const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const exp = Math.floor(Date.now() / 1000) + 86400;
const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u-test', exp, aud: 'authenticated', email: 'prova@example.com' })}.firma`;
localStorage.setItem(ARCHIVIO_STORAGE_KEY, JSON.stringify({ access_token: token, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user: { id: 'u-test', aud: 'authenticated', email: 'prova@example.com' } }));
await import('../../personal/src/personal.css');
const React = (await import('react')).default;
const { createRoot } = await import('react-dom/client');
const { AppRubrica } = await import('../../personal/src/rubrica/AppRubrica.jsx');
const { AppSola } = await import('../../personal/src/cose/AppSola.jsx');
const q = new URLSearchParams(location.search);
window.rbTest = { toast: [] };
const ctx = { esegui: async (fn) => fn(), mostra: (t) => window.rbTest.toast.push(t), versione: 0 };
createRoot(document.getElementById('root')).render(q.get('sola')
  ? <AppSola id="rubrica" />
  : <div className="pp-app"><main className="pp-pagina"><AppRubrica ctx={ctx} /></main></div>);
