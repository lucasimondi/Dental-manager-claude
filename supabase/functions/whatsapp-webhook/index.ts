// Supabase Edge Function: whatsapp-webhook
// Assistente WhatsApp dello studio (POL-WA-003a): riceve i messaggi dei pazienti
// (Meta Cloud API, anche in Coexistence con l'app WhatsApp Business dello studio)
// e risponde come un vero assistente: memoria della conversazione, informazioni
// sullo studio, appuntamenti, saldo, richiami, passaggio allo staff.
//
// Non usa la sessione utente (i pazienti non hanno un account): usa sempre
// SUPABASE_SERVICE_ROLE_KEY, che bypassa la RLS — per questo OGNI query qui dentro
// filtra esplicitamente per studio_id, e ogni dato personale è filtrato anche per il
// paziente riconosciuto dal numero (mai per un id scelto dal modello).
//
// Decisioni del Product Owner (2026-10-02):
// - gli appuntamenti l'assistente li PROPONE, lo staff li CONFERMA: le richieste
//   finiscono in richieste_prenotazione (stessa lista "Richieste" dell'Agenda);
// - risponde sempre, ma se lo staff scrive dal telefono (eco Coexistence) si mette in
//   pausa su quella conversazione per PAUSA_STAFF_ORE;
// - tono umano e accogliente.
//
// Percorsi:
// - GET  /whatsapp-webhook             handshake di verifica Meta
// - POST /whatsapp-webhook             messaggi in arrivo da Meta (firma HMAC)
// - POST /whatsapp-webhook/promemoria  job orario di pg_cron (segreto nel Vault) — POL-WA-003b
// - POST /whatsapp-webhook/invia       conferma al paziente dall'app dello staff (login utente) — POL-WA-003b

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeFreeSlots } from "./agendaSlots.js";
import { eseguiPromemoria } from "./promemoria.js";
import {
  RISPOSTA_DI_RIPIEGO,
  STORICO_MAX_GIORNI,
  STORICO_MAX_MESSAGGI,
  costruisciStorico,
  dataOggiStudio,
  descriviData,
  esitoRispostaPromemoria,
  estraiEventi,
  filtraSlotOggi,
  inPausa,
  minutiAdessoStudio,
  normalizzaTelefono,
  pausaFinoA,
  promptDiSistema,
  testoConfermaStaff,
  validaDataDisponibilita,
  validaRichiesta,
} from "./logica.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

// Una sola App Meta per tutta la piattaforma (gestita da Luca): questi 3 valori sono
// UGUALI per tutti gli studi, impostati una volta sola come secret del progetto Supabase.
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
const WHATSAPP_APP_SECRET = Deno.env.get("WHATSAPP_APP_SECRET");
const WHATSAPP_VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN");

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// claude-sonnet-5 ragiona (adaptive thinking) di default: il ragionamento consuma
// max_tokens prima del testo, quindi il limite resta ampio (POL-WA-002). Effort "low":
// risposte da chat, ragionamento minimo.
const MODELLO_AI = "claude-sonnet-5";
const MAX_TOKENS_AI = 4096;
const MAX_GIRI_STRUMENTI = 6;

// ── Utility firma webhook ──────────────────────────────────────────────
// HMAC-SHA256 con SubtleCrypto nativo di Deno, confronto a tempo costante.
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
  if (firmaHex.length !== atteso.length) return false;
  let diff = 0;
  for (let i = 0; i < firmaHex.length; i++) diff |= firmaHex.charCodeAt(i) ^ atteso.charCodeAt(i);
  return diff === 0;
}

// ── Invio messaggio WhatsApp ───────────────────────────────────────────
async function inviaMessaggioTesto(phoneNumberId, telefonoDestinatario, testo) {
  const resp = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
    body: JSON.stringify({ messaging_product: "whatsapp", to: telefonoDestinatario, type: "text", text: { body: testo } }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) console.error("Errore invio WhatsApp:", JSON.stringify(data));
  return data;
}

// Modello approvato da Meta: unico modo per scrivere per primi al paziente (promemoria).
async function inviaTemplate({ phoneNumberId, telefono, template, lingua, parametri }) {
  const resp = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: telefono,
      type: "template",
      template: {
        name: template,
        language: { code: lingua || "it" },
        components: [{ type: "body", parameters: parametri.map((t) => ({ type: "text", text: String(t) })) }],
      },
    }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) console.error("Errore invio modello WhatsApp:", JSON.stringify(data));
  return data;
}

// ── Strumenti dell'assistente ──────────────────────────────────────────
const STRUMENTI = [
  {
    name: "info_studio",
    description: "Indirizzo, telefono, email, orari di apertura dell'agenda e prestazioni prenotabili dello studio.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "prossimi_appuntamenti_paziente",
    description: "Prossimi appuntamenti del paziente che sta scrivendo (con il loro appuntamento_id).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "orari_disponibili",
    description: "Orari liberi reali in agenda per una data. Usalo prima di proporre un orario.",
    input_schema: {
      type: "object",
      properties: {
        data: { type: "string", description: "Data AAAA-MM-GG" },
        durata_minuti: { type: "integer", description: "Durata della visita in minuti, se nota dalla prestazione" },
      },
      required: ["data"],
    },
  },
  {
    name: "proponi_richiesta_appuntamento",
    description: "Gira allo staff una richiesta di nuovo appuntamento, spostamento o disdetta, dopo che la persona ha scelto. Lo staff la conferma; tu non confermi mai.",
    input_schema: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: ["prenota", "sposta", "disdici"] },
        data: { type: "string", description: "Data scelta AAAA-MM-GG (per prenota e sposta)" },
        ora: { type: "string", description: "Ora scelta HH:MM (per prenota e sposta)" },
        appuntamento_id: { type: "integer", description: "Per sposta e disdici: id da prossimi_appuntamenti_paziente" },
        motivo: { type: "string", description: "Motivo della visita o della richiesta, con le parole del paziente" },
        nome: { type: "string", description: "Solo se il paziente non è riconosciuto: nome dichiarato" },
        cognome: { type: "string", description: "Solo se il paziente non è riconosciuto: cognome dichiarato" },
      },
      required: ["tipo"],
    },
  },
  {
    name: "saldo_paziente",
    description: "Importi ancora da pagare del paziente che sta scrivendo, piano per piano, con eventuale scadenza.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "richiami_paziente",
    description: "Richiami in sospeso del paziente (es. igiene, controllo periodico).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "passa_allo_staff",
    description: "Segnala la conversazione allo staff dello studio, che ricontatterà la persona. Per urgenze, richieste che non puoi gestire o se la persona vuole parlare con qualcuno.",
    input_schema: {
      type: "object",
      properties: {
        motivo: { type: "string", description: "Breve sintesi per lo staff" },
        urgente: { type: "boolean" },
      },
      required: ["motivo"],
    },
  },
];

async function eseguiStrumento(nome, input, ctx) {
  const { studioId, paziente, telefono, conversazioneId, oggi } = ctx;
  const serveP = () => ({ errore: "Numero non associato a un paziente in anagrafica: questo dato non è disponibile." });

  switch (nome) {
    case "info_studio": {
      const [{ data: info }, { data: tipi }] = await Promise.all([
        admin.from("studio_info").select("nome, via, addr1, addr2, cap, comune, provincia, tel, email, agenda_settings").eq("studio_id", studioId).maybeSingle(),
        admin.from("app_types").select("nome, durata").eq("studio_id", studioId).order("nome"),
      ]);
      const ag = info?.agenda_settings || {};
      return {
        nome: info?.nome || ctx.nomeStudio,
        indirizzo: [info?.via || info?.addr1, info?.cap, info?.comune, info?.provincia ? `(${info.provincia})` : null].filter(Boolean).join(" ") || info?.addr2 || null,
        telefono: info?.tel || null,
        email: info?.email || null,
        orario_agenda: ag.oraInizio != null && ag.oraFine != null ? `dalle ${ag.oraInizio}:00 alle ${ag.oraFine}:00` : null,
        nota_orari: "L'orario è quello dell'agenda; i giorni di chiusura non sono registrati: in caso di dubbio lo staff conferma.",
        prestazioni: (tipi || []).map((t) => ({ nome: t.nome, durata_minuti: t.durata || null })),
      };
    }

    case "prossimi_appuntamenti_paziente": {
      if (!paziente) return serveP();
      const { data, error } = await admin
        .from("appointments")
        .select("id, data, ora, tipo, durata, stato")
        .eq("studio_id", studioId)
        .eq("paziente_id", paziente.id)
        .gte("data", oggi)
        .or("stato.is.null,stato.neq.annullato")
        .order("data", { ascending: true })
        .order("ora", { ascending: true })
        .limit(5);
      if (error) return { errore: error.message };
      return { appuntamenti: (data || []).map((a) => ({ appuntamento_id: a.id, quando: `${descriviData(a.data)} alle ${a.ora}`, data: a.data, ora: a.ora, tipo: a.tipo, stato: a.stato })) };
    }

    case "orari_disponibili": {
      const erroreData = validaDataDisponibilita(input?.data, oggi);
      if (erroreData) return { errore: erroreData };
      const slots = await slotLiberi(studioId, input.data, input.durata_minuti, oggi);
      return { data: input.data, giorno: descriviData(input.data), orari_liberi: slots.slice(0, 8).map((s) => s.ora), totale_liberi: slots.length };
    }

    case "proponi_richiesta_appuntamento": {
      const verifica = validaRichiesta(input, oggi);
      if (verifica.errore) return { errore: verifica.errore };

      let appuntamento = null;
      if (input.tipo !== "prenota") {
        if (!paziente) return serveP();
        const { data } = await admin.from("appointments").select("id, data, ora, tipo")
          .eq("studio_id", studioId).eq("paziente_id", paziente.id).eq("id", input.appuntamento_id).maybeSingle();
        if (!data) return { errore: "appuntamento non trovato tra quelli del paziente" };
        appuntamento = data;
      }
      if (input.tipo !== "disdici") {
        const liberi = await slotLiberi(studioId, input.data, null, oggi);
        if (!liberi.some((s) => s.ora === input.ora)) {
          return { errore: "quell'orario non è più libero", alternative: liberi.slice(0, 4).map((s) => s.ora) };
        }
      }
      if (!paziente && !(input.nome && input.cognome)) return { errore: "chiedi nome e cognome prima di inviare la richiesta" };

      const etichetta = { prenota: "Nuovo appuntamento", sposta: "Spostamento", disdici: "Disdetta" }[input.tipo];
      const nota = [
        `Richiesta via WhatsApp (assistente): ${etichetta}.`,
        appuntamento ? `Appuntamento attuale: ${descriviData(appuntamento.data)} alle ${appuntamento.ora} (${appuntamento.tipo || "appuntamento"}).` : null,
        input.tipo !== "disdici" ? `Orario scelto dal paziente: ${descriviData(input.data)} alle ${input.ora}.` : null,
      ].filter(Boolean).join(" ");

      const { error } = await admin.from("richieste_prenotazione").insert({
        studio_id: studioId,
        nome: paziente?.nome || input.nome,
        cognome: paziente?.cognome || input.cognome,
        telefono,
        date_preferite: [input.tipo === "disdici" ? appuntamento.data : input.data],
        ora_preferita: input.tipo === "disdici" ? appuntamento.ora : input.ora,
        motivo: input.motivo || null,
        note: nota,
        origine: "whatsapp",
        tipo_richiesta: input.tipo,
        paziente_id: paziente?.id || null,
        appuntamento_id: appuntamento?.id || null,
      });
      if (error) return { errore: error.message };
      return { ok: true, nota: "Richiesta inviata allo staff, che la confermerà su WhatsApp. Non è ancora confermata." };
    }

    case "saldo_paziente": {
      if (!paziente) return serveP();
      const { data, error } = await admin.rpc("whatsapp_saldo_paziente_v1", { p_studio_id: studioId, p_paziente_id: paziente.id });
      if (error) return { errore: "Saldo non disponibile in questo momento: lo staff può verificarlo." };
      const piani = (data || []).map((r) => ({ piano: r.titolo, da_pagare_euro: Number(r.saldo_piano), scadenza: r.scadenza_pagamento ? descriviData(r.scadenza_pagamento) : null }));
      return { piani, totale_da_pagare_euro: piani.reduce((s, p) => s + p.da_pagare_euro, 0) };
    }

    case "richiami_paziente": {
      if (!paziente) return serveP();
      const { data, error } = await admin.from("richiami").select("motivo, categoria, data_scadenza")
        .eq("studio_id", studioId).eq("paziente_id", paziente.id).eq("stato", "da_fare")
        .order("data_scadenza", { ascending: true }).limit(5);
      if (error) return { errore: error.message };
      return { richiami: (data || []).map((r) => ({ motivo: r.motivo || r.categoria, entro: r.data_scadenza ? descriviData(r.data_scadenza) : null })) };
    }

    case "passa_allo_staff": {
      const motivo = String(input?.motivo || "Richiesta da WhatsApp").slice(0, 500);
      const chi = paziente ? `${paziente.nome || ""} ${paziente.cognome || ""}`.trim() : `+${telefono}`;
      await admin.from("whatsapp_conversazioni").update({ serve_staff: true, motivo_staff: motivo }).eq("id", conversazioneId);
      await admin.from("todos").insert({
        testo: `${input?.urgente ? "URGENTE – " : ""}WhatsApp da ${chi}: ${motivo}`,
        fatto: false,
        data: oggi,
        studio_id: studioId,
        paziente_id: paziente?.id || null,
        origine: "whatsapp",
        categoria: "WHATSAPP",
      });
      return { ok: true, nota: "Lo staff è stato avvisato e ricontatterà la persona." };
    }

    default:
      return { errore: "strumento sconosciuto" };
  }
}

// Stessa funzione di calcolo dell'app (src/lib/agendaSlots.js, copiata accanto a
// questo file e tenuta identica da tests/whatsappAssistenteLogica.test.mjs).
async function slotLiberi(studioId, data, durata, oggi) {
  const [{ data: info }, { data: apps }, { data: imps }] = await Promise.all([
    admin.from("studio_info").select("agenda_settings").eq("studio_id", studioId).maybeSingle(),
    admin.from("appointments").select("data, ora, durata, operatore_id, stato").eq("studio_id", studioId).eq("data", data),
    admin.from("impegni_personali").select("data_inizio, data_fine, tutto_il_giorno, ora_inizio, ora_fine").eq("studio_id", studioId).lte("data_inizio", data).gte("data_fine", data),
  ]);
  const ag = info?.agenda_settings || {};
  const slots = computeFreeSlots({
    data,
    durata: durata || ag.durataDefault || null,
    operatoreId: null, // nessun operatore scelto: qualunque appuntamento occupa lo slot (scelta prudente)
    appointments: (apps || []).map((a) => ({ data: a.data, ora: a.ora, durata: a.durata, operatoreId: a.operatore_id, stato: a.stato })),
    impegni: (imps || []).map((i) => ({
      dataInizio: i.data_inizio, dataFine: i.data_fine, tuttoIlGiorno: i.tutto_il_giorno,
      oraInizio: i.ora_inizio ? String(i.ora_inizio).slice(0, 5) : null, oraFine: i.ora_fine ? String(i.ora_fine).slice(0, 5) : null,
    })),
    agendaSettings: ag,
  });
  return filtraSlotOggi(slots, data, oggi, minutiAdessoStudio());
}

// ── Chiamata all'AI con ciclo degli strumenti ──────────────────────────
async function chiamaClaude(system, messages) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODELLO_AI, max_tokens: MAX_TOKENS_AI, output_config: { effort: "low" }, system, messages, tools: STRUMENTI }),
  });
  if (!resp.ok) {
    console.error("Errore Claude:", resp.status, await resp.text());
    return null;
  }
  return await resp.json();
}

async function rispondiConAI(ctx, storico) {
  const system = promptDiSistema({ nomeStudio: ctx.nomeStudio, oggiIso: ctx.oggi, paziente: ctx.paziente });
  const messages = [...storico];
  for (let giro = 0; giro < MAX_GIRI_STRUMENTI; giro++) {
    const data = await chiamaClaude(system, messages);
    if (!data) return null;
    if (data.stop_reason === "refusal") return null;
    const usi = (data.content || []).filter((b) => b.type === "tool_use");
    if (data.stop_reason !== "tool_use" || usi.length === 0) {
      const testo = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      return testo || null;
    }
    messages.push({ role: "assistant", content: data.content });
    const risultati = [];
    for (const uso of usi) {
      let risultato;
      try {
        risultato = await eseguiStrumento(uso.name, uso.input || {}, ctx);
      } catch (e) {
        console.error("Errore strumento", uso.name, String(e));
        risultato = { errore: "dato non disponibile in questo momento" };
      }
      risultati.push({ type: "tool_result", tool_use_id: uso.id, content: JSON.stringify(risultato) });
    }
    messages.push({ role: "user", content: risultati });
  }
  return null;
}

// ── Conversazione e storico ────────────────────────────────────────────
async function conversazionePer(studioId, telefono, pazienteId) {
  const { data } = await admin.from("whatsapp_conversazioni")
    .upsert({ studio_id: studioId, telefono, paziente_id: pazienteId, ultimo_messaggio_il: new Date().toISOString() }, { onConflict: "studio_id,telefono" })
    .select("id, ai_pausa_fino, serve_staff")
    .single();
  return data;
}

async function storicoRecente(studioId, telefono) {
  const da = new Date(Date.now() - STORICO_MAX_GIORNI * 86400000).toISOString();
  const { data } = await admin.from("whatsapp_messages")
    .select("direzione, origine, contenuto, creato_il")
    .eq("studio_id", studioId).eq("telefono", telefono).gte("creato_il", da)
    .order("creato_il", { ascending: false }).limit(STORICO_MAX_MESSAGGI);
  return (data || []).reverse();
}

async function pazientePerTelefono(studioId, telefono) {
  // Confronto tollerante sulle ultime 9 cifre (prefissi +39/0039/spazi incoerenti in
  // anagrafica). Più di un risultato = numero condiviso: nessun dato personale.
  const ultime = telefono.slice(-9);
  const { data } = await admin.from("patients").select("id, nome, cognome").eq("studio_id", studioId).ilike("telefono", `%${ultime}`);
  return data && data.length === 1 ? data[0] : null;
}

async function giaRicevuto(waId) {
  if (!waId) return false;
  const { data } = await admin.from("whatsapp_messages").select("id").eq("wa_message_id", waId).limit(1);
  return !!(data && data.length);
}

// ── Gestione di un evento ──────────────────────────────────────────────
async function gestisciEvento(evento, studioId) {
  if (await giaRicevuto(evento.waId)) return; // Meta ritenta: niente doppie risposte

  const paziente = await pazientePerTelefono(studioId, evento.telefono);
  const conversazione = await conversazionePer(studioId, evento.telefono, paziente?.id || null);

  if (evento.tipo === "eco_staff") {
    await admin.from("whatsapp_messages").insert({
      studio_id: studioId, paziente_id: paziente?.id || null, telefono: evento.telefono,
      direzione: "out", origine: "staff", tipo: "text", contenuto: evento.testo, wa_message_id: evento.waId, stato: "inviato",
    });
    await admin.from("whatsapp_conversazioni").update({ ai_pausa_fino: pausaFinoA() }).eq("id", conversazione.id);
    return;
  }

  const storico = await storicoRecente(studioId, evento.telefono);
  await admin.from("whatsapp_messages").insert({
    studio_id: studioId, paziente_id: paziente?.id || null, telefono: evento.telefono,
    direzione: "in", origine: "paziente", tipo: "text", contenuto: evento.testo, wa_message_id: evento.waId,
  });

  await registraRispostaPromemoria(studioId, evento);

  if (inPausa(conversazione)) return; // sta rispondendo lo staff dal telefono

  const { data: studio } = await admin.from("studios").select("nome").eq("id", studioId).maybeSingle();
  const ctx = {
    studioId, paziente, telefono: evento.telefono, conversazioneId: conversazione.id,
    oggi: dataOggiStudio(), nomeStudio: studio?.nome,
  };

  let risposta = await rispondiConAI(ctx, costruisciStorico(storico, evento.testo));
  if (!risposta) {
    risposta = RISPOSTA_DI_RIPIEGO;
    await eseguiStrumento("passa_allo_staff", { motivo: `L'assistente non è riuscito a rispondere. Ultimo messaggio: "${evento.testo.slice(0, 200)}"` }, ctx);
  }

  const invio = await inviaMessaggioTesto(evento.phoneNumberId, evento.telefono, risposta);
  await admin.from("whatsapp_messages").insert({
    studio_id: studioId, paziente_id: paziente?.id || null, telefono: evento.telefono,
    direzione: "out", origine: "assistente", tipo: "text", contenuto: risposta,
    wa_message_id: invio?.messages?.[0]?.id || null, stato: invio?.messages?.[0]?.id ? "inviato" : "errore",
  });
}

// Risposta del paziente a un promemoria: il pulsante porta l'id del messaggio a cui
// risponde; senza, si usa l'ultimo promemoria (36 ore) ancora senza risposta.
async function registraRispostaPromemoria(studioId, evento) {
  const esito = esitoRispostaPromemoria(evento.testo);
  let promemoria = null;
  if (evento.rispostaA) {
    const { data } = await admin.from("whatsapp_promemoria").select("id, risposta")
      .eq("studio_id", studioId).eq("wa_message_id", evento.rispostaA).maybeSingle();
    promemoria = data;
  }
  if (!promemoria && esito) {
    const da = new Date(Date.now() - 36 * 3600000).toISOString();
    const { data } = await admin.from("whatsapp_promemoria").select("id, risposta")
      .eq("studio_id", studioId).eq("telefono", evento.telefono).eq("stato", "inviato").is("risposta", null)
      .gte("inviato_il", da).order("inviato_il", { ascending: false }).limit(1);
    promemoria = data?.[0] || null;
  }
  if (!promemoria || promemoria.risposta) return;
  await admin.from("whatsapp_promemoria")
    .update({ risposta: esito || "altro", risposto_il: new Date().toISOString() })
    .eq("id", promemoria.id);
}

// ── Job dei promemoria (pg_cron) ───────────────────────────────────────
async function gestisciPromemoria(req) {
  const segreto = req.headers.get("x-cron-secret") || "";
  const { data: valido } = await admin.rpc("whatsapp_cron_segreto_valido", { p_segreto: segreto });
  if (valido !== true) return new Response("Forbidden", { status: 403 });
  const esito = await eseguiPromemoria({ admin, inviaTemplate });
  return Response.json(esito);
}

// ── Conferma dallo staff (app) ─────────────────────────────────────────
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const rispostaJson = (corpo, status = 200) => Response.json(corpo, { status, headers: CORS });
const RE_DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const RE_ORA_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

async function gestisciInvioStaff(req) {
  const authorization = req.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return rispostaJson({ errore: "accesso richiesto" }, 401);
  // Client con il login dell'utente: la RLS di richieste_prenotazione limita la
  // lettura alle richieste del suo studio.
  const utente = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authorization } } });
  const { data: auth } = await utente.auth.getUser();
  if (!auth?.user) return rispostaJson({ errore: "accesso richiesto" }, 401);

  let corpo;
  try {
    corpo = await req.json();
  } catch {
    return rispostaJson({ errore: "richiesta non valida" }, 400);
  }
  const { data: richiesta } = await utente.from("richieste_prenotazione")
    .select("id, studio_id, nome, telefono, origine, tipo_richiesta, date_preferite, ora_preferita")
    .eq("id", corpo?.richiesta_id).maybeSingle();
  if (!richiesta) return rispostaJson({ errore: "richiesta non trovata" }, 404);
  if (richiesta.origine !== "whatsapp") return rispostaJson({ errore: "la richiesta non arriva da WhatsApp" }, 400);

  const tipo = richiesta.tipo_richiesta;
  const data = tipo === "disdici" ? richiesta.date_preferite?.[0] : corpo.data;
  const ora = tipo === "disdici" ? richiesta.ora_preferita : corpo.ora;
  if (!RE_DATA_ISO.test(data || "") || !RE_ORA_HHMM.test(ora || "")) return rispostaJson({ errore: "data o ora non valide" }, 400);

  const { data: config } = await admin.from("whatsapp_config").select("phone_number_id, attivo")
    .eq("studio_id", richiesta.studio_id).maybeSingle();
  const { data: studio } = await admin.from("studios").select("nome, feature_overrides").eq("id", richiesta.studio_id).maybeSingle();
  if (!config?.attivo || studio?.feature_overrides?.whatsapp_automatico !== true) {
    return rispostaJson({ ok: true, inviato: false, errore: "WhatsApp non attivo per lo studio" });
  }
  const telefono = normalizzaTelefono(richiesta.telefono);
  if (!telefono) return rispostaJson({ ok: true, inviato: false, errore: "numero non valido" });

  const testo = testoConfermaStaff({ tipo, nome: richiesta.nome, nomeStudio: studio?.nome, data, ora });
  const invio = await inviaMessaggioTesto(config.phone_number_id, telefono, testo);
  const waId = invio?.messages?.[0]?.id || null;
  await admin.from("whatsapp_messages").insert({
    studio_id: richiesta.studio_id, telefono, direzione: "out", origine: "sistema", tipo: "text",
    contenuto: testo, wa_message_id: waId, stato: waId ? "inviato" : "errore",
  });
  // Fuori dalla finestra di 24 ore dall'ultimo messaggio del paziente Meta rifiuta il testo libero.
  return rispostaJson({ ok: true, inviato: !!waId, errore: waId ? null : "messaggio non consegnato: conferma al paziente per telefono" });
}

// ── Entry point ─────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (url.pathname.endsWith("/promemoria")) {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
    return await gestisciPromemoria(req);
  }
  if (url.pathname.endsWith("/invia")) {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    if (req.method !== "POST") return rispostaJson({ errore: "metodo non consentito" }, 405);
    try {
      return await gestisciInvioStaff(req);
    } catch (e) {
      console.error("Errore invio staff:", String(e));
      return rispostaJson({ errore: "errore interno" }, 500);
    }
  }

  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && token === WHATSAPP_VERIFY_TOKEN) return new Response(challenge, { status: 200 });
    return new Response("Forbidden", { status: 403 });
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const rawBody = await req.text();

  // Firma verificata prima di qualunque lettura del database: la firma è dell'App
  // Meta della piattaforma, unica per tutti gli studi.
  const ok = await firmaValida(rawBody, req.headers.get("x-hub-signature-256"), WHATSAPP_APP_SECRET);
  if (!ok) return new Response("Forbidden", { status: 403 });

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  try {
    for (const evento of estraiEventi(payload)) {
      const { data: config } = await admin.from("whatsapp_config").select("studio_id, attivo")
        .eq("phone_number_id", evento.phoneNumberId).maybeSingle();
      if (!config || !config.attivo) {
        console.error("Numero WhatsApp non configurato o studio disattivato:", evento.phoneNumberId);
        continue;
      }
      // Feature flag lato server: senza modulo attivo l'assistente non risponde,
      // nemmeno aggirando l'interfaccia.
      const { data: studioPiano } = await admin.from("studios").select("feature_overrides").eq("id", config.studio_id).maybeSingle();
      if (studioPiano?.feature_overrides?.whatsapp_automatico !== true) {
        console.error("whatsapp_automatico non attivo per studio:", config.studio_id);
        continue;
      }
      await gestisciEvento(evento, config.studio_id);
    }
  } catch (e) {
    console.error("Errore webhook WhatsApp:", String(e));
  }
  return new Response("OK", { status: 200 }); // sempre 200 verso Meta: altrimenti ritenta
});
