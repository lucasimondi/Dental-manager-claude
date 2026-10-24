import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import LoginScreen from './LoginScreen.jsx';
import './ConnectorAccess.css';

export default function ConnectorAccess({ client = supabase }) {
  const [session, setSession] = useState(undefined), [details, setDetails] = useState(null), [requests, setRequests] = useState([]), [grants, setGrants] = useState([]);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [configured, setConfigured] = useState(null);
  const lock = useRef(false);
  const mode = window.location.pathname.split('/')[2] || 'setup';
  const params = new URLSearchParams(window.location.search), id = params.get('id'), authorizationId = params.get('authorization_id');
  useEffect(() => {
    client.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = client.auth.onAuthStateChange((_event, value) => setSession(value));
    return () => data.subscription.unsubscribe();
  }, []);
  const redirect = url => {
    const target = new URL(url); if (target.protocol !== 'https:' || target.username || target.password) throw new Error('Destinazione non valida.');
    window.location.assign(target.href);
  };
  useEffect(() => {
    if (!session) return;
    let active = true;
    setError(''); setDetails(null);
    const load = async () => {
      if (mode === 'consent') {
        if (!authorizationId || !client.auth.oauth) throw new Error('Richiesta di collegamento non valida o configurazione OAuth incompleta.');
        const result = await client.auth.oauth.getAuthorizationDetails(authorizationId);
        if (result.error) throw new Error('Impossibile leggere il collegamento. Riavvia dalla chat.');
        if (!active) return;
        if (result.data?.redirect_url) redirect(result.data.redirect_url); else setDetails(result.data);
      } else if (mode === 'review') {
        if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Riepilogo non valido.');
        const result = await client.from('poliedra_connector_requests').select('id, summary, status, result, expires_at').eq('id', id).single();
        if (result.error || !result.data) throw new Error('Riepilogo scaduto o non disponibile per questo account.');
        if (active) setDetails(result.data);
      } else {
        const [metadata, grantList, pending] = await Promise.all([
          fetch('/.well-known/oauth-protected-resource/api/mcp', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
          client.auth.oauth?.listGrants(),
          client.from('poliedra_connector_requests').select('id, summary, status, expires_at').order('created_at', { ascending: false }).limit(20),
        ]);
        if (!active) return;
        setConfigured(metadata); setGrants(grantList?.data || []); setRequests(pending.data || []);
      }
    };
    load().catch(e => active && setError(e.message));
    return () => { active = false; };
  }, [session?.user?.id, mode, id, authorizationId]);
  async function act(operation) {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { await operation(); } catch (e) { setError(e.message || 'Operazione non confermata. Verifica prima di ripetere.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function decideConsent(approve) {
    await act(async () => {
      const result = approve ? await client.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true }) : await client.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
      if (result.error || !result.data?.redirect_url) throw new Error('Collegamento non completato. Riavvia dalla chat.');
      redirect(result.data.redirect_url);
    });
  }
  async function decideRequest(cancelled) {
    await act(async () => {
      // Consume this UI attempt even if the response is lost. No automatic replay.
      setDetails(current => ({ ...current, status: 'checking' }));
      const { data, error: invokeError } = await client.functions.invoke('agente-assistente', { body: { confirm: { connector_request_id: id, cancelled } } });
      if (invokeError || data?.error || !data?.text) {
        setDetails(current => ({ ...current, status: 'uncertain' }));
        throw new Error('Esito non disponibile. Controlla la scheda paziente prima di ripetere.');
      }
      const status = data.uncertain ? 'uncertain' : cancelled ? 'cancelled' : data.records ? 'done' : 'uncertain';
      setMessage(data.text); setDetails(current => ({ ...current, status }));
    });
  }
  if (session === undefined) return <div className="connector-page" role="status">Caricamento…</div>;
  if (!session) return <LoginScreen onLogin={() => {}} />;
  const expired = details?.expires_at && Date.parse(details.expires_at) <= Date.now();
  return <main className="connector-page"><div className="connector-card">
    <div className="connector-brand">POLIEDRA · ASSISTENTI</div>
    <h1>{mode === 'consent' ? 'Collega il tuo assistente' : mode === 'review' ? 'Controlla e registra' : 'ChatGPT e Gemini'}</h1>
    {error && <p className="connector-error" role="alert">{error}</p>}
    {message && <p className="connector-message" role="status">{message}</p>}
    {mode === 'consent' && details && <>
      <h2>{details.client?.name}</h2><p>Account: {session.user.email}</p>
      <p>Autorizzi questa applicazione ad agire con i diritti del tuo account. I dati accessibili seguono i tuoi permessi dello studio. Il connettore prepara le registrazioni; le confermi qui, dopo averle controllate.</p>
      <p className="connector-muted">Permessi di identità richiesti: {details.scope || 'Non indicati'}. La delega OAuth consente anche l’accesso alle API con i tuoi permessi; revocala quando non serve più.</p>
      <div className="connector-actions"><button disabled={busy} onClick={() => decideConsent(false)}>Non collegare</button><button className="primary" disabled={busy} onClick={() => decideConsent(true)}>Collega account</button></div>
    </>}
    {mode === 'review' && details && <>
      <pre className="connector-summary">{details.summary}</pre>
      {details.status === 'pending' && !expired ? <><p>Controlla paziente, denti, data e valori. Conferma tutte le righe con un solo tocco.</p><div className="connector-actions"><button disabled={busy} onClick={() => decideRequest(true)}>Annulla</button><button className="primary" disabled={busy} onClick={() => decideRequest(false)}>Conferma e registra</button></div></> : <p role="status">{expired && details.status === 'pending' ? 'Richiesta scaduta: preparane una nuova dalla chat.' : details.status === 'done' ? 'Registrazione completata. Puoi tornare alla chat.' : details.status === 'cancelled' ? 'Richiesta annullata.' : 'Esito da verificare nella scheda paziente. Non ripetere automaticamente.'}</p>}
    </>}
    {mode === 'setup' && <>
      <p>Lo stesso collegamento funziona con entrambi gli assistenti. Ognuno usa il proprio accesso revocabile.</p>
      <label>Indirizzo del connettore<input readOnly value={configured?.resource || `${window.location.origin}/api/mcp`} onFocus={event => event.target.select()} /></label>
      {!configured && <p>Attivazione server ancora da completare. Questo indirizzo non indica che il collegamento sia già operativo.</p>}
      <p className="connector-muted">Aggiungi un’app personalizzata nelle impostazioni web dell’assistente, inserisci l’indirizzo e completa l’accesso a Poliedra. Le credenziali OAuth del client vengono configurate dall’amministratore. Google limita attualmente i connettori personalizzati Gemini Apps a USA/inglese; la presenza sul tuo account va verificata.</p>
      <h2>Accessi autorizzati</h2>{!grants.length && <p>Nessun accesso esterno disponibile.</p>}
      {grants.map(grant => <div className="connector-row" key={grant.client.id}><span>{grant.client.name}</span><button disabled={busy} onClick={() => act(async () => { const out = await client.auth.oauth.revokeGrant({ clientId: grant.client.id }); if (out.error) throw new Error('Revoca non confermata.'); setGrants(items => items.filter(x => x.client.id !== grant.client.id)); })}>Revoca accesso</button></div>)}
      <h2>Richieste recenti</h2>{requests.map(request => <a className="connector-request" key={request.id} href={`/connector/review?id=${request.id}`}><strong>{request.summary.split('\n')[0]}</strong><span>{request.status === 'pending' && Date.parse(request.expires_at) <= Date.now() ? 'Scaduta' : request.status}</span></a>)}
    </>}
    <a className="connector-back" href={mode === 'setup' ? '/' : '/connector/setup'}>{mode === 'setup' ? 'Torna al gestionale' : 'Richieste e accessi assistenti'}</a>
  </div></main>;
}
