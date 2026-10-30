import { useEffect, useState } from 'react';
import { archivioDb } from './lib/supabasePersonal.js';
import { Accesso } from './Accesso.jsx';

export default function OAuthConsent({sessione}) {
  const [details,setDetails]=useState(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const id=new URLSearchParams(window.location.search).get('authorization_id');
  useEffect(()=>{
    if(!sessione||!id)return;
    let active=true;
    archivioDb.auth.oauth.getAuthorizationDetails(id).then(({data,error})=>{
      if(!active)return;
      if(error){setError(error.message);return;}
      if(!data){setError('Richiesta non valida');return;}
      if(!('authorization_id' in data)){window.location.assign(data.redirect_url);return;}
      setDetails(data);
    });
    return()=>{active=false};
  },[sessione,id]);
  async function decide(approve){
    setBusy(true);
    const {data,error}=await (approve?archivioDb.auth.oauth.approveAuthorization(id):archivioDb.auth.oauth.denyAuthorization(id));
    if(error||!data?.redirect_url){setError(error?.message||'Autorizzazione non riuscita');setBusy(false);return;}
    window.location.assign(data.redirect_url);
  }
  if(!id)return <main><p>Richiesta di autorizzazione mancante.</p></main>;
  if(!sessione)return <Accesso />;
  return <main style={{maxWidth:500,margin:'40px auto',padding:24}}>
    <h1>Collega ChatGPT a Poliedron</h1>
    {error?<p role="alert">{error}</p>:details?<section>
      <p><strong>{details.client?.name||'Applicazione esterna'}</strong> richiede accesso al tuo account Poliedron.</p>
      <p>Destinazione: {details.redirect_uri}</p>
      <p>Permessi richiesti: {details.scope||'nessuno specificato'}</p>
      <p>Il connettore esclude i documenti clinici dei pazienti.</p>
      <button disabled={busy} onClick={()=>decide(true)}>Autorizza</button>{' '}
      <button disabled={busy} onClick={()=>decide(false)}>Rifiuta</button>
    </section>:<p>Verifica della richiesta…</p>}
  </main>;
}

