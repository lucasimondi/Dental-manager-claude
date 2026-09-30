// Supabase Edge Function: whatsapp-webhook
// Riceve i messaggi WhatsApp in arrivo (Meta Cloud API) e risponde tramite l'assistente AI.
//
// Non usa la sessione utente (i pazienti non hanno un account DentalManager): usa sempre
// SUPABASE_SERVICE_ROLE_KEY, che bypassa la RLS — per questo OGNI query qui dentro filtra
// esplicitamente per studio_id a mano. Non toccare questa regola quando si estende il file.
//
// Due ruoli distinti nella stessa funzione:
// - GET: handshake di verifica webhook richiesto una tantum da Meta quando si configura
//   l'URL nel pannello Business (risponde con hub.challenge se il token combacia).
// - POST: messaggio vero in arrivo. Verifica la firma HMAC (X-Hub-Signature-256) con
//   l'app_secret dello studio proprietario del numero, poi risponde.
//
// Livello attuale: SOLA LETTURA lato paziente (può solo cercare/leggere, mai scrivere).
// Le azioni di scrittura (spostare/cancellare un appuntamento) sono un incremento successivo,
// con un flusso di conferma dedicato — un paziente non supervisionato che tocca l'agenda
// richiede più cautela di quanta ne serva per lo staff nell'app.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

// Una sola App Meta per tutta la piattaforma (gestita da Luca): questi 3 valori sono
// UGUALI per tutti gli studi, impostati una volta sola come secret del progetto Supabase.
// Ogni studio deve dare solo il proprio phone_number_id — molto meno attrito in fase di
// attivazione rispetto a far configurare una App Meta separata a ciascuno.
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
const WHATSAPP_APP_SECRET = Deno.env.get("WHATSAPP_APP_SECRET");
const WHATSAPP_VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN");

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ── Utility firma webhook ──────────────────────────────────────────────
// HMAC-SHA256 con SubtleCrypto nativo di Deno: niente libreria esterna, e' pochissimo
// codice e non vogliamo una dipendenza in piu' proprio sulla verifica di sicurezza.
async function firmaValida(rawBody, signatureHeader, appSecret) {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const atteso = signatureHeader.slice(7);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const firma = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const firmaHex = Array.from(new Uint8Array(firma)).map((b) => b.toString(16).padStart(2, "0")).join("");
  // confronto a tempo costante, per non aprire un timing side-channel
  if (firmaHex.length !== atteso.length) return false;
  let diff = 0;
  for (let i = 0; i < firmaHex.length; i++) diff |= firmaHex.charCodeAt(i) ^ atteso.charCodeAt(i);
  return diff === 0;
}

// ── Invio messaggio WhatsApp (risposta) ────────────────────────────────
async function inviaMessaggioTesto(phoneNumberId, accessToken, telefonoDestinatario, testo) {
  const resp = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: telefonoDestinatario,
      type: "text",
      text: { body: testo },
    }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    console.error("Errore invio WhatsApp:", JSON.stringify(data));
  }
  return data;
}

// ── Strumenti AI: SOLA LETTURA, sempre scoped esplicitamente a studioId ──
const TOOLS_PAZIENTE = [
  {
    name: "prossimi_appuntamenti_paziente",
    description: "Trova i prossimi appuntamenti futuri del paziente che sta scrivendo.",
    input_schema: { type: "object", properties: {} },
  },
];

async function eseguiToolPaziente(name, studioId, pazienteId) {
  if (name === "prossimi_appuntamenti_paziente") {
    if (!pazienteId) return { risultati: [], nota: "Numero non associato a nessun paziente in anagrafica." };
    const oggi = new Date().toISOString().slice(0, 10);
    const { data, error } = await admin
      .from("appointments")
      .select("data, ora, tipo, stato")
      .eq("studio_id", studioId)
      .eq("paziente_id", pazienteId)
      .gte("data", oggi)
      .order("data", { ascending: true })
      .order("ora", { ascending: true })
      .limit(5);
    if (error) return { error: error.message };
    return { risultati: data };
  }
  return { error: "Tool sconosciuto: " + name };
}

const SYSTEM_PROMPT_PAZIENTE = `Sei l'assistente WhatsApp dello studio "{{NOME_STUDIO}}". Chi ti scrive è un PAZIENTE,
non un membro dello staff — non condividere mai dati di altri pazienti, non dare consigli
clinici/medici, e non inventare informazioni: se non sai qualcosa, dillo e proponi di
contattare direttamente lo studio.

In questa fase puoi SOLO leggere i prossimi appuntamenti del paziente che scrive (tool
prossimi_appuntamenti_paziente) — non puoi ancora creare, spostare o cancellare nulla.
Se il paziente chiede di spostare/cancellare un appuntamento, digli gentilmente che per
ora serve chiamare lo studio direttamente per quello, ma che presto potrà farlo anche qui.

Tono: cordiale, breve, in italiano (o nella lingua in cui ti scrivono).`;

async function rispondiConAI(studioId, nomeStudio, pazienteId, testoMessaggio) {
  const systemPrompt = SYSTEM_PROMPT_PAZIENTE.replace("{{NOME_STUDIO}}", nomeStudio || "il nostro studio");
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: testoMessaggio }],
      tools: TOOLS_PAZIENTE,
    }),
  });
  if (!resp.ok) {
    console.error("Errore Claude:", await resp.text());
    return "Grazie per il messaggio, ti risponderemo al più presto.";
  }
  const data = await resp.json();
  const toolUse = data.content.find((b) => b.type === "tool_use");
  if (toolUse) {
    const result = await eseguiToolPaziente(toolUse.name, studioId, pazienteId);
    const resp2 = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 512,
        system: systemPrompt,
        messages: [
          { role: "user", content: testoMessaggio },
          { role: "assistant", content: data.content },
          { role: "user", content: [{ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) }] },
        ],
        tools: TOOLS_PAZIENTE,
      }),
    });
    const data2 = await resp2.json();
    return data2.content.filter((b) => b.type === "text").map((b) => b.text).join("\n") || "Grazie per il messaggio!";
  }
  return data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n") || "Grazie per il messaggio!";
}

// ── Entry point ─────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const url = new URL(req.url);

  // Handshake di verifica Meta (GET, una tantum, quando si configura il webhook nel pannello)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && token === WHATSAPP_VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  try {
    const change = payload?.entry?.[0]?.changes?.[0]?.value;
    const phoneNumberId = change?.metadata?.phone_number_id;
    const messaggio = change?.messages?.[0];

    // Meta manda anche notifiche di stato (delivered/read) senza messaggi veri: ignoriamo.
    if (!phoneNumberId || !messaggio) {
      return new Response("OK", { status: 200 });
    }

    const { data: config, error: errConfig } = await admin
      .from("whatsapp_config")
      .select("studio_id, attivo")
      .eq("phone_number_id", phoneNumberId)
      .maybeSingle();

    if (errConfig || !config || !config.attivo) {
      console.error("Numero WhatsApp non configurato o studio disattivato:", phoneNumberId);
      return new Response("OK", { status: 200 }); // 200 comunque: Meta ritenta se rispondi errore
    }

    // Controllo del piano/feature flag lato server — non ci si affida solo al fatto che il
    // form in Impostazioni sia nascosto: uno studio senza il modulo attivo non deve poter
    // far rispondere l'AI nemmeno bypassando l'interfaccia.
    const { data: studioPiano } = await admin
      .from("studios")
      .select("piano, feature_overrides")
      .eq("id", config.studio_id)
      .maybeSingle();
    const overrideFlag = studioPiano?.feature_overrides?.whatsapp_automatico;
    const automazioneAttiva = overrideFlag === true; // default sempre off finche' non attivato esplicitamente
    if (!automazioneAttiva) {
      console.error("whatsapp_automatico non attivo per studio:", config.studio_id);
      return new Response("OK", { status: 200 });
    }

    // Verifica firma con l'App Secret condiviso (una sola App Meta per tutta la piattaforma).
    const signatureHeader = req.headers.get("x-hub-signature-256");
    const ok = await firmaValida(rawBody, signatureHeader, WHATSAPP_APP_SECRET);
    if (!ok) {
      console.error("Firma webhook non valida per phone_number_id:", phoneNumberId);
      return new Response("Forbidden", { status: 403 });
    }

    const telefonoMittente = messaggio.from; // formato E.164 senza '+', es. "393331234567"
    const testoMessaggio = messaggio.text?.body || "";
    const studioId = config.studio_id;

    const { data: studio } = await admin.from("studios").select("nome").eq("id", studioId).maybeSingle();

    // Cerca il paziente per telefono (confronto tollerante: ultime 9 cifre, per ignorare
    // differenze di prefisso +39/0039/spazi salvate in modo incoerente in anagrafica)
    const ultimeCifre = telefonoMittente.slice(-9);
    const { data: pazienti } = await admin
      .from("patients")
      .select("id, nome, cognome")
      .eq("studio_id", studioId)
      .ilike("telefono", `%${ultimeCifre}`);
    const paziente = pazienti && pazienti.length === 1 ? pazienti[0] : null;

    await admin.from("whatsapp_messages").insert({
      studio_id: studioId,
      paziente_id: paziente?.id || null,
      telefono: telefonoMittente,
      direzione: "in",
      tipo: "text",
      contenuto: testoMessaggio,
      wa_message_id: messaggio.id,
    });

    const risposta = await rispondiConAI(studioId, studio?.nome, paziente?.id, testoMessaggio);

    const invio = await inviaMessaggioTesto(phoneNumberId, WHATSAPP_ACCESS_TOKEN, telefonoMittente, risposta);

    await admin.from("whatsapp_messages").insert({
      studio_id: studioId,
      paziente_id: paziente?.id || null,
      telefono: telefonoMittente,
      direzione: "out",
      tipo: "text",
      contenuto: risposta,
      wa_message_id: invio?.messages?.[0]?.id || null,
      stato: invio?.messages?.[0]?.id ? "inviato" : "errore",
    });

    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error("Errore webhook WhatsApp:", String(e));
    return new Response("OK", { status: 200 }); // sempre 200 verso Meta anche in errore interno
  }
});
