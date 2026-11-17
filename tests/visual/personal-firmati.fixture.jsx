// Synthetic-only fixture (DOCUMENTI-FIRMATI / FIRMA-BIRO): Gestore PDF with a fake local session and the
// app context; Supabase and the Apps Script are answered by the test. No real data, nothing sent.
import { ARCHIVIO_STORAGE_KEY } from '../../personal/src/lib/archivioConfig.js';
const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const exp = Math.floor(Date.now() / 1000) + 86400;
const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u-test', exp, aud: 'authenticated', email: 'prova@example.com' })}.firma`;
localStorage.setItem(ARCHIVIO_STORAGE_KEY, JSON.stringify({ access_token: token, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user: { id: 'u-test', aud: 'authenticated', email: 'prova@example.com' } }));
const React = (await import('react')).default;
const { createRoot } = await import('react-dom/client');
const { GestorePdf } = await import('../../personal/src/pdf/GestorePdf.jsx');
window.firmatiTest = { toast: [], aperto: null };
const ctx = {
  impostazioni: { persone: ['Persona Prova'], categorie: [{ id: 'contratto', nome: 'Contratto' }] },
  fascicoli: [{ codice: 'utenze', nome: 'Utenze' }, { codice: 'legale', nome: 'Legale' }],
  aggiorna() {}, mostra: (t) => window.firmatiTest.toast.push(t),
};
const origine = { id: '00000000-0000-4000-8000-000000000002', titolo: 'Modulo adesione Fornitore Prova', fascicolo: 'utenze', gmail_message_id: '18cprova', email_mittente: 'Fornitore Prova <ufficio@example.invalid>' };
createRoot(document.getElementById('root')).render(<GestorePdf strumento="firma" ctx={ctx} origine={origine} title={origine.titolo} onClose={() => {}} onArchive={() => {}} onApriDocumento={(id) => { window.firmatiTest.aperto = id; }} />);
