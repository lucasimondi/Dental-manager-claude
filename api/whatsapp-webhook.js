// api/whatsapp-webhook.js
// Vercel serverless function — passacarte verso la vera Edge Function su Supabase.
// Serve solo per dare a Meta un URL con il dominio del prodotto invece del dominio
// grezzo di Supabase (idklxdqebfceplrualgh.supabase.co) — più presentabile nel
// pannello Business, e non espone il project ref di Supabase pubblicamente.
//
// IMPORTANTE: il corpo va inoltrato byte per byte, senza passare da nessun parser
// JSON — altrimenti la firma HMAC (X-Hub-Signature-256) che Meta calcola sul corpo
// originale non corrisponde più a quella verificata lato Supabase.
//
// ESM (POL-WA-002): package.json ha "type": "module", quindi questo file è un modulo
// ES. La vecchia sintassi CommonJS (module.exports) faceva fallire la funzione a ogni
// richiesta con FUNCTION_INVOCATION_FAILED.

const TARGET = 'https://idklxdqebfceplrualgh.supabase.co/functions/v1/whatsapp-webhook';

export default async function handler(req, res) {
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';

  if (req.method === 'GET') {
    const r = await fetch(TARGET + qs, { method: 'GET' });
    const text = await r.text();
    res.status(r.status).send(text);
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks);

  const r = await fetch(TARGET, {
    method: req.method,
    headers: {
      'content-type': req.headers['content-type'] || 'application/json',
      'x-hub-signature-256': req.headers['x-hub-signature-256'] || '',
    },
    body: rawBody,
  });
  const text = await r.text();
  res.status(r.status).send(text);
}

export const config = { api: { bodyParser: false } };
