import React from 'react';
import {createRoot} from 'react-dom/client';
import ConnectorAccess from '../../src/components/ConnectorAccess.jsx';
const scenario = new URLSearchParams(location.search).get('case') || 'review';
history.replaceState({},'',scenario==='consent'?'/connector/consent?authorization_id=test':scenario==='setup'?'/connector/setup':'/connector/review?id=00000000-0000-4000-8000-000000000021');
window.__connectorCalls=0;
const row={id:'00000000-0000-4000-8000-000000000021',summary:'Registra impianti\nPaziente: Persona di prova\nDente 16 · 10 aprile 2024 · Marca test · Lotto TEST-001\nDente 26 · 10 aprile 2024 · Marca test · Lotto TEST-001\nNuovi: 2. Già presenti: 0.',status:'pending',expires_at:new Date(Date.now()+600000).toISOString()};
const client = {
  auth: {
    getSession: async () => ({ data: { session: { user: { id: 'synthetic', email: 'test@example.invalid' } } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    oauth: {
      getAuthorizationDetails: async () => ({ data: { authorization_id: 'test', client: { id: 'client-test', name: 'ChatGPT di prova' }, scope: 'openid' } }),
      listGrants: async () => ({ data: [{ client: { id: 'client-test', name: 'ChatGPT di prova' } }] }),
      revokeGrant: async () => ({}),
    },
  },
  from: () => ({ select() { return this; }, eq() { return this; }, single: async () => ({ data: row }), order() { return this; }, limit: async () => ({ data: [row] }) }),
  functions: {
    invoke: async (_name, { body }) => {
      window.__connectorCalls++;
      await new Promise(r => setTimeout(r, 150));
      if (scenario === 'uncertain') return { error: { message: 'lost response' } };
      return { data: body.confirm.cancelled ? { text: 'Operazione annullata. Nessuna modifica eseguita.' } : { text: 'Impianti registrati e verificati: denti 16 e 26.', records: { implants: [{ id: 1 }, { id: 2 }] } } };
    },
  },
};
createRoot(document.getElementById('root')).render(<ConnectorAccess client={client}/>);
