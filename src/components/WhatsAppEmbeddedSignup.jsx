import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Btn, Crd } from './ui';

const APP_ID = import.meta.env.VITE_META_APP_ID;
const CONFIG_ID = import.meta.env.VITE_META_WHATSAPP_CONFIG_ID;

function loadFacebookSdk() {
  if (window.FB) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.getElementById('facebook-jssdk');
    if (existing) {
      const timer = setInterval(() => {
        if (window.FB) { clearInterval(timer); resolve(); }
      }, 100);
      setTimeout(() => { clearInterval(timer); if (!window.FB) reject(new Error('SDK Meta non disponibile')); }, 10000);
      return;
    }
    window.fbAsyncInit = () => {
      window.FB.init({ appId: APP_ID, autoLogAppEvents: true, xfbml: false, version: 'v26.0' });
      resolve();
    };
    const js = document.createElement('script');
    js.id = 'facebook-jssdk';
    js.src = 'https://connect.facebook.net/it_IT/sdk.js';
    js.async = true;
    js.defer = true;
    js.onerror = () => reject(new Error('Impossibile caricare Meta SDK'));
    document.body.appendChild(js);
  });
}

export default function WhatsAppEmbeddedSignup({ studioId, onConnected }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const signupData = useRef({});

  useEffect(() => {
    const receive = (event) => {
      if (event.origin !== 'https://www.facebook.com' && event.origin !== 'https://web.facebook.com') return;
      let data = event.data;
      try { if (typeof data === 'string') data = JSON.parse(data); } catch { return; }
      if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;
      const payload = data.data || {};
      if (data.event === 'FINISH' || data.event === 'FINISH_ONLY_WABA') {
        signupData.current = {
          waba_id: payload.waba_id || payload.wabaId || '',
          phone_number_id: payload.phone_number_id || payload.phoneNumberId || '',
        };
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);

  const connect = async () => {
    if (!APP_ID || !CONFIG_ID) {
      setMessage('Configurazione Meta Embedded Signup non ancora pubblicata.');
      return;
    }
    setBusy(true); setMessage('');
    try {
      await loadFacebookSdk();
      const response = await new Promise((resolve, reject) => {
        window.FB.login((r) => r?.authResponse?.code ? resolve(r) : reject(new Error('Collegamento annullato o non autorizzato')), {
          config_id: CONFIG_ID,
          response_type: 'code',
          override_default_response_type: true,
          extras: { featureType: 'whatsapp_business_app_onboarding', sessionInfoVersion: '3' },
        });
      });
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sessione Poliedra scaduta');
      const r = await fetch('/api/whatsapp-embedded-signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ studio_id: studioId, code: response.authResponse.code, ...signupData.current }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || 'Collegamento non completato');
      setMessage('Numero collegato mantenendo WhatsApp Business sul telefono ✓');
      onConnected?.(body.config);
    } catch (e) {
      setMessage(e?.message || 'Collegamento non riuscito');
    } finally { setBusy(false); }
  };

  return (
    <Crd style={{ marginBottom: 14, border: '1px solid #25D36655' }}>
      <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4 }}>Collega WhatsApp Business</div>
      <div style={{ fontSize: 11.5, opacity: .72, lineHeight: 1.45, marginBottom: 10 }}>
        Usa il collegamento ufficiale Meta in modalità Coexistence: il numero resta utilizzabile anche nell'app WhatsApp Business.
      </div>
      <Btn ch={busy ? 'Apertura Meta…' : 'Collega WhatsApp Business'} onClick={connect} dis={busy} full />
      {message && <div role="status" style={{ fontSize: 11.5, marginTop: 8, fontWeight: 700 }}>{message}</div>}
    </Crd>
  );
}
