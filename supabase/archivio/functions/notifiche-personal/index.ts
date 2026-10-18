// POL-VITA-018 — notifiche sul telefono (web push) per Poliedron Personal, progetto archivio-documenti.
// - GET: chiave pubblica VAPID per iscrivere il telefono (le chiavi le crea questa funzione la prima
//   volta e le tiene in push_chiavi, tabella senza accesso dall'app; nessuno le vede o le copia).
// - POST {azione:'prova'}: notifica di prova, solo per Luca (token di sessione con email confermata).
// - POST {azione:'invia'} (chiamata dallo script ogni giorno): promemoria di oggi e scaduti da 3 giorni,
//   una sola notifica al giorno per promemoria, mai quelli dei documenti clinici. Ripetere la chiamata
//   non manda doppioni, quindi può restare pubblica.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const PROPRIETARIO = 'luca.simondi@gmail.com';
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

type Chiavi = { pubblica: string; privata: string };
async function chiavi(): Promise<Chiavi> {
  const { data } = await db.from('push_chiavi').select('pubblica, privata').eq('id', 1).maybeSingle();
  if (data) return data as Chiavi;
  const k = webpush.generateVAPIDKeys();
  const { error } = await db.from('push_chiavi').insert({ id: 1, pubblica: k.publicKey, privata: k.privateKey });
  if (error) { // creata nel frattempo da un'altra chiamata
    const r = await db.from('push_chiavi').select('pubblica, privata').eq('id', 1).single();
    return r.data as Chiavi;
  }
  return { pubblica: k.publicKey, privata: k.privateKey };
}

async function eProprietario(req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const { data } = await db.auth.getUser(token);
  const u = data?.user;
  return !!u && String(u.email || '').toLowerCase() === PROPRIETARIO && !!u.email_confirmed_at;
}

const oggiRoma = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());

type Iscrizione = { id: string; endpoint: string; chiavi: { p256dh: string; auth: string } };
async function invia(iscrizioni: Iscrizione[], messaggio: Record<string, string>, k: Chiavi) {
  webpush.setVapidDetails(`mailto:${PROPRIETARIO}`, k.pubblica, k.privata);
  let inviate = 0;
  for (const s of iscrizioni) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.chiavi }, JSON.stringify(messaggio), { TTL: 86400 });
      inviate++;
      await db.from('push_iscrizioni').update({ ultimo_invio: new Date().toISOString() }).eq('id', s.id);
    } catch (e) {
      const code = (e as { statusCode?: number })?.statusCode;
      // Iscrizione scaduta (telefono cambiato, app tolta): si spegne, non si cancella.
      if (code === 404 || code === 410) await db.from('push_iscrizioni').update({ attiva: false }).eq('id', s.id);
    }
  }
  return inviate;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const k = await chiavi();
    if (req.method === 'GET') return json({ ok: true, chiave: k.pubblica });
    const corpo = await req.json().catch(() => ({}));
    const { data: tutte } = await db.from('push_iscrizioni').select('id, endpoint, chiavi').eq('attiva', true);
    const iscrizioni = (tutte || []) as Iscrizione[];

    if (corpo.azione === 'prova') {
      if (!(await eProprietario(req))) return json({ ok: false, errore: 'Accesso non autorizzato' }, 401);
      const scelte = iscrizioni.filter((s) => !corpo.endpoint || s.endpoint === corpo.endpoint);
      const inviate = await invia(scelte, { titolo: 'Poliedron', testo: 'Le notifiche funzionano: qui arriveranno i promemoria.', url: '/personal/' }, k);
      return json({ ok: true, inviate });
    }

    const oggi = oggiRoma();
    const da = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
    const { data: scad } = await db.from('scadenze')
      .select('id, data, descrizione, importo, cartella, documento:documenti(fascicolo)')
      .eq('completata', false).eq('storica', false).gte('data', da).lte('data', oggi).order('data');
    const { data: fatte } = await db.from('push_inviate').select('scadenza_id').eq('giorno', oggi);
    const gia = new Set((fatte || []).map((r: { scadenza_id: string }) => r.scadenza_id));
    // deno-lint-ignore no-explicit-any
    const daInviare = (scad || []).filter((s: any) => s.documento?.fascicolo !== 'clinico_pazienti' && !gia.has(s.id));
    if (!daInviare.length || !iscrizioni.length) return json({ ok: true, inviate: 0, promemoria: daInviare.length });
    // deno-lint-ignore no-explicit-any
    const righe = daInviare.slice(0, 4).map((s: any) => `${s.data < oggi ? 'Scaduto: ' : ''}${s.descrizione}${s.cartella ? ` (${s.cartella})` : ''}`);
    if (daInviare.length > 4) righe.push(`…e altri ${daInviare.length - 4}`);
    const inviate = await invia(iscrizioni, {
      titolo: daInviare.length === 1 ? 'Promemoria di oggi' : `${daInviare.length} promemoria`, testo: righe.join('\n'), url: '/personal/',
    }, k);
    // deno-lint-ignore no-explicit-any
    if (inviate) await db.from('push_inviate').upsert(daInviare.map((s: any) => ({ scadenza_id: s.id, giorno: oggi })), { onConflict: 'scadenza_id,giorno', ignoreDuplicates: true });
    return json({ ok: true, inviate, promemoria: daInviare.length });
  } catch (e) {
    return json({ ok: false, errore: String((e as Error)?.message || e).slice(0, 200) }, 500);
  }
});
