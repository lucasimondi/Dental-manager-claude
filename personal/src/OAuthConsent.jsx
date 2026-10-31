import { useEffect, useRef, useState } from 'react';
import { archivioDb } from './lib/supabasePersonal.js';
import { Accesso } from './Accesso.jsx';
import { authorizationIdFromSearch, consentRedirectUrl } from './lib/oauthConsent.js';
import './oauth-consent.css';

const browserNavigate = (url) => window.location.assign(url);

export default function OAuthConsent({ client = archivioDb, navigate = browserNavigate }) {
  const [session, setSession] = useState(undefined);
  const [details, setDetails] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  let authorizationId, invalid = '';
  try { authorizationId = authorizationIdFromSearch(window.location.search); }
  catch (e) { invalid = e.message; }

  useEffect(() => {
    if (invalid) return;
    let active = true;
    client.auth.getSession().then(({ data, error: authError }) => {
      if (!active) return;
      if (authError) setError('Accesso non verificato. Riavvia il collegamento da ChatGPT.');
      setSession(data?.session || null);
    }).catch(() => active && setError('Accesso non verificato. Riavvia il collegamento da ChatGPT.'));
    const { data } = client.auth.onAuthStateChange((_event, value) => { if (active) setSession(value); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [client, invalid]);

  useEffect(() => {
    setDetails(null);
    if (!session || invalid) return;
    let active = true;
    async function load() {
      if (!client.auth.oauth) throw new Error('OAuth non disponibile. Riavvia il collegamento da ChatGPT.');
      const { data, error: oauthError } = await client.auth.oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (oauthError || !data) throw new Error('Richiesta scaduta o non disponibile. Riavvia il collegamento da ChatGPT.');
      if (data.redirect_url) navigate(consentRedirectUrl(data.redirect_url));
      else if (data.authorization_id === authorizationId && data.client?.name) setDetails(data);
      else throw new Error('Richiesta di collegamento non valida.');
    }
    load().catch(e => active && setError(e.message));
    return () => { active = false; };
  }, [session?.user?.id, client, authorizationId, invalid, navigate]);

  async function decide(approve) {
    if (lock.current || !details || !session) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const action = approve ? 'approveAuthorization' : 'denyAuthorization';
      const { data, error: oauthError } = await client.auth.oauth[action](authorizationId, { skipBrowserRedirect: true });
      if (oauthError || !data?.redirect_url) throw new Error('Esito non verificato. Riavvia il collegamento da ChatGPT prima di riprovare.');
      navigate(consentRedirectUrl(data.redirect_url));
    } catch (e) {
      setError(e.message);
      // A decision may have reached Auth even if its response was lost. Never replay.
      setDetails(null);
    } finally { setBusy(false); }
  }

  if (!invalid && session === null && !error) return <Accesso />;
  return <main className="pp-oauth"><section aria-labelledby="personal-oauth-title">
    <p className="pp-oauth-brand">POLIEDRON PERSONALE</p>
    <h1 id="personal-oauth-title">Collega il tuo archivio personale</h1>
    {(invalid || error) ? <p role="alert">{invalid || error}</p> : !details ? <p role="status">Verifica del collegamento…</p> : <>
      <h2>{details.client.name}</h2>
      <p>Account personale: <strong>{session.user.email}</strong></p>
      <p>Questa applicazione potrà accedere all’archivio con i permessi del tuo account personale, inclusi i documenti privati e le operazioni consentite dalle API. Questo collegamento non autorizza l’accesso allo studio.</p>
      <p>Permessi richiesti: {details.scope || 'Non indicati'}.</p>
      <p>Collega solo applicazioni di cui ti fidi. Puoi revocare l’accesso dalle impostazioni dell’app collegata.</p>
      <div className="pp-oauth-actions">
        <button disabled={busy} onClick={() => decide(false)}>Non collegare</button>
        <button disabled={busy} onClick={() => decide(true)}>{busy ? 'Attendi…' : 'Collega archivio personale'}</button>
      </div>
    </>}
    <a href="/personal/">Torna a Personal</a>
  </section></main>;
}
