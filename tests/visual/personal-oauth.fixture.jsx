import React, { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import OAuthConsent from '../../personal/src/OAuthConsent.jsx';

const scenario = new URLSearchParams(location.search).get('case') || 'consent';
history.replaceState({}, '', '/oauth/consent?authorization_id=synthetic');
let decisions = 0;
const client = { auth: {
  getSession: async () => ({ data: { session: { user: { id: 'synthetic', email: 'persona@example.invalid' } } } }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  oauth: {
    getAuthorizationDetails: async () => scenario === 'expired' ? { error: new Error('expired') } : { data: { authorization_id: 'synthetic', client: { name: 'ChatGPT di prova' }, scope: 'openid email' } },
    approveAuthorization: async () => {
      decisions++;
      await new Promise(resolve => setTimeout(resolve, 400));
      return scenario === 'uncertain' ? { error: new Error('lost response') } : { data: { redirect_url: 'https://chatgpt.com/callback?code=synthetic' } };
    },
    denyAuthorization: async () => { decisions++; return { data: { redirect_url: 'https://chatgpt.com/callback?error=access_denied' } }; },
  },
} };
function Fixture() {
  const [result, setResult] = useState('');
  const [navigate] = useState(() => (url) => setResult(`${url.includes('access_denied') ? 'Rifiutato' : 'Autorizzato'} · decisioni ${decisions}`));
  return result ? <p role="status">{result}</p> : <StrictMode><OAuthConsent client={client} navigate={navigate} /></StrictMode>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
