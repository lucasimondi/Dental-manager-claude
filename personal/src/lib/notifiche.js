// POL-VITA-018 — notifiche sul telefono (web push) per i promemoria di Poliedron Personal.
// Su iPhone funzionano solo con l'app aggiunta alla schermata Home (iOS 16.4 o successivo) e dopo
// il permesso dato con un tocco. L'iscrizione del telefono va nel database dell'archivio (solo il
// proprietario); l'invio lo fa la funzione Supabase `notifiche-personal` chiamata dallo script.
export const URL_NOTIFICHE = 'https://tkcwvjzjkfhcuebrjvsp.supabase.co/functions/v1/notifiche-personal';
const SW = '/personal/sw-notifiche.js';
const AMBITO = '/personal/';

const esito = ({ data, error }) => {
  if (error) throw new Error(error.message || 'Errore archivio');
  return data;
};

export function supporto(g = globalThis) {
  const nav = g.navigator;
  const ios = /iPad|iPhone|iPod/.test(nav?.userAgent || '');
  const installata = !!(nav?.standalone || g.matchMedia?.('(display-mode: standalone)')?.matches);
  const api = !!(nav?.serviceWorker && 'PushManager' in g && 'Notification' in g);
  if (api) return { ok: true, ios, installata };
  if (ios && !installata) return { ok: false, ios, installata, motivo: 'installa' };
  return { ok: false, ios, installata, motivo: 'browser' };
}

// Chiave pubblica VAPID (base64url) → byte per pushManager.subscribe.
export function chiaveInByte(b64) {
  const s = String(b64).replace(/-/g, '+').replace(/_/g, '/');
  const pieno = s + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(pieno);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function registrazione(nav = globalThis.navigator) {
  return (await nav.serviceWorker.getRegistration(AMBITO)) || nav.serviceWorker.register(SW, { scope: AMBITO });
}

export async function statoNotifiche(g = globalThis) {
  const s = supporto(g);
  if (!s.ok) return { ...s, attive: false };
  const reg = await g.navigator.serviceWorker.getRegistration(AMBITO);
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return { ...s, permesso: g.Notification.permission, attive: !!sub && g.Notification.permission === 'granted', endpoint: sub?.endpoint || null };
}

// Va chiamata dal tocco su "Attiva" (iOS chiede il permesso solo così).
export async function attivaNotifiche(db, { g = globalThis, fetchImpl = fetch } = {}) {
  const permesso = await g.Notification.requestPermission();
  if (permesso !== 'granted') throw new Error('Permesso negato: puoi riattivarlo in Impostazioni del telefono › Notifiche › Personal.');
  const reg = await registrazione(g.navigator);
  const r = await (await fetchImpl(URL_NOTIFICHE)).json();
  if (!r?.chiave) throw new Error('Servizio notifiche non raggiungibile, riprova tra poco.');
  const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chiaveInByte(r.chiave) });
  const j = sub.toJSON();
  esito(await db.from('push_iscrizioni').upsert({
    endpoint: j.endpoint, chiavi: j.keys, dispositivo: String(g.navigator.userAgent || '').slice(0, 160), attiva: true,
  }, { onConflict: 'endpoint' }).select('id'));
  return j.endpoint;
}

export async function disattivaNotifiche(db, g = globalThis) {
  const reg = await g.navigator.serviceWorker.getRegistration(AMBITO);
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (!sub) return;
  esito(await db.from('push_iscrizioni').update({ attiva: false }).eq('endpoint', sub.endpoint).select('id'));
  await sub.unsubscribe();
}

export async function provaNotifica({ token, endpoint }, fetchImpl = fetch) {
  if (!token) throw new Error('Sessione scaduta: esci e rientra.');
  const res = await fetchImpl(URL_NOTIFICHE, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ azione: 'prova', endpoint }),
  });
  const r = await res.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.errore || 'Prova non riuscita.');
  if (!r.inviate) throw new Error('Nessun telefono iscritto: tocca prima "Attiva".');
  return r.inviate;
}
