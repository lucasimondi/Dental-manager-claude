// Synthetic-only fixture (CONCORDATO): the section (Beni / Divisione con Anna) or a division proposal page, fake
// local session, Supabase answered by the test. No real data.
import { ARCHIVIO_STORAGE_KEY } from '../../personal/src/lib/archivioConfig.js';
const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const exp = Math.floor(Date.now() / 1000) + 86400;
const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u-test', exp, aud: 'authenticated', email: 'prova@example.com' })}.firma`;
localStorage.setItem(ARCHIVIO_STORAGE_KEY, JSON.stringify({ access_token: token, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user: { id: 'u-test', aud: 'authenticated', email: 'prova@example.com' } }));
await import('../../personal/src/personal.css');
const React = (await import('react')).default;
const { createRoot } = await import('react-dom/client');
const { Concordato } = await import('../../personal/src/sezioni/concordato/Concordato.jsx');
const { PropostaDivisione } = await import('../../personal/src/sezioni/concordato/Divisione.jsx');
window.ccTest = { aperto: [], toast: [] };
const ctx = { esegui: async (fn) => fn(), aggiorna() {}, mostra: (t) => window.ccTest.toast.push(t), apri: (p) => window.ccTest.aperto.push(p), versione: 0 };
const q = new URLSearchParams(location.search);
createRoot(document.getElementById('root')).render(<div className="pp-app"><main className="pp-pagina">{q.get('vista') === 'proposta'
  ? <PropostaDivisione id="s1" ctx={ctx} chiudi={() => {}} />
  : <Concordato ctx={ctx} iniziale={q.get('scheda') || 'beni'} />}</main></div>);
