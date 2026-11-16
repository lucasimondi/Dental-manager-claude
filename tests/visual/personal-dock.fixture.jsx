// Synthetic-only fixture (DOCK-UGUALE): the whole Personal app with a fake local session; network answered by the test.
import { ARCHIVIO_STORAGE_KEY } from '../../personal/src/lib/archivioConfig.js';
const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const exp = Math.floor(Date.now() / 1000) + 86400;
const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u-test', exp, aud: 'authenticated', email: 'prova@example.com' })}.firma`;
localStorage.setItem(ARCHIVIO_STORAGE_KEY, JSON.stringify({ access_token: token, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user: { id: 'u-test', aud: 'authenticated', email: 'prova@example.com' } }));
localStorage.setItem('poliedron-personal-vista', 'altro');
await import('../../personal/src/main.jsx');
