// POL-WA-003d — server-side half of Meta Embedded Signup / Coexistence.
// Never expose META_APP_SECRET in the browser. The caller must be an authenticated
// Poliedra user; Supabase RLS remains authoritative for whatsapp_config writes.
const GRAPH_VERSION = 'v26.0';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://idklxdqebfceplrualgh.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const json = (res, status, body) => res.status(status).json(body);

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return json(res, 401, { error: 'Sessione richiesta' });
  const { studio_id, code, waba_id, phone_number_id } = req.body || {};
  if (!studio_id || !code) return json(res, 400, { error: 'Dati Embedded Signup incompleti' });
  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET || !SUPABASE_ANON_KEY) {
    return json(res, 503, { error: 'Configurazione server Meta non completata' });
  }

  try {
    const tokenUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
    tokenUrl.searchParams.set('client_id', process.env.META_APP_ID);
    tokenUrl.searchParams.set('client_secret', process.env.META_APP_SECRET);
    tokenUrl.searchParams.set('code', code);
    const tokenRes = await fetch(tokenUrl);
    const tokenBody = await tokenRes.json();
    if (!tokenRes.ok || !tokenBody.access_token) {
      return json(res, 400, { error: 'Meta non ha completato lo scambio del codice' });
    }

    // If the session event did not contain the IDs, discover WABAs owned by the
    // authorized business. We deliberately fail closed rather than attaching a
    // guessed number to the wrong studio.
    let wabaId = waba_id || '';
    let phoneId = phone_number_id || '';
    if (wabaId && !phoneId) {
      const phonesRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(wabaId)}/phone_numbers?fields=id,display_phone_number,verified_name`, {
        headers: { authorization: `Bearer ${tokenBody.access_token}` },
      });
      const phones = await phonesRes.json();
      if (phonesRes.ok && phones?.data?.length === 1) phoneId = phones.data[0].id;
    }
    if (!wabaId || !phoneId) {
      return json(res, 409, { error: 'Meta ha autorizzato il collegamento ma non ha restituito WABA/Phone Number ID. Riapri il collegamento e completa tutti i passaggi.' });
    }

    const config = { studio_id, waba_id: wabaId, phone_number_id: phoneId, attivo: true };
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      authorization: auth,
      'content-type': 'application/json',
      prefer: 'return=representation,resolution=merge-duplicates',
    };
    const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_config?on_conflict=studio_id`, {
      method: 'POST', headers, body: JSON.stringify(config),
    });
    const rows = await dbRes.json().catch(() => []);
    if (!dbRes.ok) return json(res, dbRes.status, { error: 'Poliedra non ha potuto salvare il collegamento' });

    return json(res, 200, { ok: true, config: Array.isArray(rows) ? rows[0] : rows });
  } catch {
    return json(res, 500, { error: 'Errore durante il collegamento WhatsApp' });
  }
}
