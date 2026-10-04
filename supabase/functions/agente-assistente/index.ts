// Supabase Edge Function: agente-assistente
// Assistente interno Poliedra — usa sempre la sessione
// autenticata dell'utente per interrogare il DB, cosi' la RLS filtra
// automaticamente i dati per studio senza bisogno di controlli manuali qui.
// Il system prompt vive in ai_agent_config (tabella, editabile per studio),
// non piu' hardcoded qui: cosi' si aggiorna senza redeploy.
//
// Pannello "Agente AI" (v17): oltre al system_prompt, lo studio puo' gestire
// da UI (senza redeploy) FAQ, documenti di riferimento e AZIONI PERSONALIZZATE.
// Le azioni personalizzate NON eseguono codice arbitrario: ognuna sceglie un
// "tipo_effetto" da un set fisso e sicuro (riusa tabelle/scritture gia'
// esistenti nel gestionale, o un webhook verso un URL che lo studio stesso
// configura) — cosi' il pannello aggiunge conoscenza/azioni senza aprire
// una porta di esecuzione libera. Le azioni gia' scritte nel codice (TOOLS
// sotto) restano invariate: questo meccanismo è solo additivo.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Prezzo standard (non promozionale) di claude-sonnet-5 per token, usato per
// stimare il costo reale di ogni chiamata e loggarlo in ai_agent_usage.
const PREZZO_INPUT_PER_TOKEN = 3 / 1_000_000;
const PREZZO_OUTPUT_PER_TOKEN = 15 / 1_000_000;

const TOOLS = [
  {
    name: "cerca_pazienti",
    description: "Cerca pazienti dello studio per nome, cognome, telefono o contenuto delle note. Puoi cercare per nome e cognome insieme, in qualsiasi ordine (es. 'Mario Rossi' o 'Rossi Mario' trovano lo stesso paziente). Max 15 risultati.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Testo da cercare (nome, cognome, telefono o parola nelle note)" },
      },
      required: ["query"],
    },
  },
  {
    name: "appuntamenti",
    description: "Cerca appuntamenti in un intervallo di date, opzionalmente filtrati per stato o per paziente.",
    input_schema: {
      type: "object",
      properties: {
        da: { type: "string", description: "Data inizio YYYY-MM-DD. Default: oggi." },
        a: { type: "string", description: "Data fine YYYY-MM-DD. Default: uguale a 'da'." },
        stato: { type: "string", description: "confermato | da confermare | annullato" },
        paziente_nome: { type: "string", description: "Filtra per nome/cognome paziente" },
      },
    },
  },
  {
    name: "situazione_economica",
    description: "Incassato in un periodo, preventivi in attesa e preventivi scaduti (non pagati oltre la scadenza).",
    input_schema: {
      type: "object",
      properties: {
        da: { type: "string", description: "Data inizio YYYY-MM-DD. Default: primo giorno del mese corrente." },
        a: { type: "string", description: "Data fine YYYY-MM-DD. Default: oggi." },
      },
    },
  },
  {
    name: "kpi_controllo_gestione",
    description: "Fonte UNICA e ufficiale per ogni domanda economica/finanziaria (identica a quella mostrata in Controllo di Gestione — non calcolare mai questi valori a mano da altri tool). Restituisce per il periodo: incassato, costi_fissi, costi_variabili, costi_variabili_metodo ('percentuale' o 'manuale'), margine_contribuzione (= incassato - costi_variabili), margine_contribuzione_pct, ebitda (= margine_contribuzione - costi_fissi; stesso valore di 'margine', mantenuto per compatibilità), ebitda_pct, break_even (null se non calcolabile col metodo attuale — leggi break_even_nota in quel caso e proponi all'utente di impostare il metodo 'percentuale' in Impostazioni economiche), ticket_medio, n_pazienti_paganti.",
    input_schema: {
      type: "object",
      properties: {
        da: { type: "string", description: "Data inizio YYYY-MM-DD. Default: primo giorno del mese corrente." },
        a: { type: "string", description: "Data fine YYYY-MM-DD. Default: oggi." },
      },
    },
  },
  {
    name: "andamento_kpi",
    description: "Trend mese per mese degli stessi KPI di kpi_controllo_gestione (incassato, costi, margine di contribuzione, EBITDA, ticket medio) per gli ultimi N mesi, mese corrente incluso (parziale, aggiornato a oggi). Usalo SEMPRE insieme a kpi_controllo_gestione per dare un giudizio o un consiglio: un numero isolato non è un'analisi, un trend sì. Non calcolare mai variazioni percentuali a mano: confronta i valori restituiti.",
    input_schema: {
      type: "object",
      properties: {
        mesi: { type: "integer", description: "Quanti mesi indietro includere, mese corrente compreso. Default 6, massimo 24." },
      },
    },
  },
  {
    name: "richiami",
    description: "Richiami/controlli periodici scaduti e quelli previsti nei prossimi N giorni, presi dai piani di cura dei pazienti e dalla sezione Richiami (preventivi/incassi in standby inclusi).",
    input_schema: {
      type: "object",
      properties: {
        entro_giorni: { type: "integer", description: "Giorni in avanti da considerare per i 'prossimi'. Default 30." },
      },
    },
  },
  {
    name: "storico_paziente",
    description: "Storico completo di un paziente: tutti i piani di cura (con voci, prezzi, stato, cosa è stato eseguito e cosa no), tutti i pagamenti, e i richiami collegati. Usalo SEMPRE prima di proporre un upselling, un cross-selling o un piano di pagamento a un paziente: la proposta deve essere motivata da cosa ha già fatto o non ha mai fatto, mai a caso.",
    input_schema: {
      type: "object",
      properties: {
        paziente_id: { type: "integer", description: "ID del paziente (ottenuto da cerca_pazienti)" },
      },
      required: ["paziente_id"],
    },
  },
  {
    name: "catalogo_prestazioni",
    description: "Listino prezzi dello studio, raggruppato per categoria. Usalo per proporre solo prestazioni che lo studio offre davvero, ai prezzi reali — mai inventare nomi o prezzi di prestazioni.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "crea_proposta_commerciale",
    description: "Crea una BOZZA di piano di cura con le voci proposte (upselling/cross-selling), in stato di attesa — NON viene mai inviata o mostrata automaticamente al paziente, è pronta perché lo studio la riveda in Piani di Cura e decida se proporla. RICHIEDE CONFERMA dell'utente. Usa sempre prestazioni e prezzi reali presi da catalogo_prestazioni, e motiva la proposta con quanto emerso da storico_paziente.",
    input_schema: {
      type: "object",
      properties: {
        paziente_id: { type: "integer" },
        titolo: { type: "string", description: "Es. 'Proposta sbiancamento post-igiene'" },
        voci: {
          type: "array",
          description: "Prestazioni proposte, prese da catalogo_prestazioni con prezzo reale.",
          items: {
            type: "object",
            properties: {
              prestazione: { type: "string" },
              prezzo: { type: "number" },
              dente: { type: "string", description: "Opzionale, solo se pertinente" },
            },
            required: ["prestazione", "prezzo"],
          },
        },
        sconto: { type: "number", description: "Sconto opzionale da proporre, es. per favorire l'accettazione" },
        sconto_tipo: { type: "string", enum: ["pct", "valore"], description: "Default 'pct' se sconto è impostato" },
      },
      required: ["paziente_id", "titolo", "voci"],
    },
  },
  {
    name: "crea_promemoria",
    description: "Crea un promemoria/todo per lo studio, visibile in Dashboard.",
    input_schema: {
      type: "object",
      properties: {
        testo: { type: "string", description: "Testo del promemoria" },
        data: { type: "string", description: "Data entro cui farlo, YYYY-MM-DD (opzionale)" },
      },
      required: ["testo"],
    },
  },
  {
    name: "aggiungi_nota_paziente",
    description: "Aggiunge un'annotazione con data alla scheda di un paziente (non sovrascrive le note esistenti, le aggiunge in coda).",
    input_schema: {
      type: "object",
      properties: {
        paziente_id: { type: "integer", description: "ID del paziente (ottenuto da cerca_pazienti)" },
        testo: { type: "string", description: "Testo dell'annotazione" },
      },
      required: ["paziente_id", "testo"],
    },
  },
  {
    name: "crea_appuntamento",
    description: "Crea un nuovo appuntamento per un paziente. Esegue subito, senza chiedere conferma, MA se lo slot è già occupato (da un altro appuntamento o da un impegno personale come ferie/chiamate) non crea nulla e ti segnala il conflitto: spiega la situazione all'utente e chiedi come procedere. Se l'utente conferma esplicitamente di voler sovrapporre comunque, richiama con forza_sovrapposizione=true.",
    input_schema: {
      type: "object",
      properties: {
        paziente_id: { type: "integer" },
        data: { type: "string", description: "YYYY-MM-DD" },
        ora: { type: "string", description: "HH:MM" },
        durata: { type: "integer", description: "Minuti, default 30" },
        tipo: { type: "string", description: "Tipo di visita, es. Igiene, Controllo, Urgenza" },
        note: { type: "string" },
        forza_sovrapposizione: { type: "boolean", description: "true SOLO se l'utente ha già visto il conflitto ed esplicitamente confermato di voler procedere comunque." },
      },
      required: ["paziente_id", "data", "ora", "tipo"],
    },
  },
  {
    name: "crea_impegno_personale",
    description: "Crea un impegno personale in agenda (ferie, chiamata, impegno privato, altro) — NON legato a un paziente. Visibile a tutto lo studio. Esegue subito, senza conferma.",
    input_schema: {
      type: "object",
      properties: {
        titolo: { type: "string", description: "Es. 'Ferie', 'Chiamata commercialista'." },
        tipo: { type: "string", enum: ["personale", "ferie", "chiamata", "altro"], description: "Default 'personale' se non specificato." },
        data_inizio: { type: "string", description: "YYYY-MM-DD" },
        data_fine: { type: "string", description: "YYYY-MM-DD, uguale a data_inizio se un solo giorno." },
        tutto_il_giorno: { type: "boolean", description: "true se non ha un orario specifico (es. ferie). Default true." },
        ora_inizio: { type: "string", description: "HH:MM, solo se tutto_il_giorno è false." },
        ora_fine: { type: "string", description: "HH:MM, solo se tutto_il_giorno è false." },
        note: { type: "string" },
      },
      required: ["titolo", "data_inizio", "data_fine"],
    },
  },
  {
    name: "modifica_appuntamento",
    description: "Modifica un appuntamento esistente (data, ora, durata, tipo, stato, note). Esegue subito, senza chiedere conferma.",
    input_schema: {
      type: "object",
      properties: {
        appuntamento_id: { type: "integer" },
        data: { type: "string" },
        ora: { type: "string" },
        durata: { type: "integer" },
        tipo: { type: "string" },
        stato: { type: "string", description: "confermato | da confermare | annullato" },
        note: { type: "string" },
      },
      required: ["appuntamento_id"],
    },
  },
  {
    name: "elimina_appuntamento",
    description: "Elimina definitivamente un appuntamento. RICHIEDE CONFERMA dell'utente.",
    input_schema: {
      type: "object",
      properties: { appuntamento_id: { type: "integer" } },
      required: ["appuntamento_id"],
    },
  },
  {
    name: "registra_pagamento",
    description: "Registra un pagamento ricevuto da un paziente. RICHIEDE CONFERMA dell'utente.",
    input_schema: {
      type: "object",
      properties: {
        paziente_id: { type: "integer" },
        importo: { type: "number" },
        data: { type: "string", description: "YYYY-MM-DD, default oggi" },
        metodo: { type: "string", description: "contanti | carta | bonifico | POS" },
        nota: { type: "string" },
      },
      required: ["paziente_id", "importo"],
    },
  },
  {
    name: "crea_paziente",
    description: "Crea una nuova anagrafica paziente. RICHIEDE CONFERMA dell'utente.",
    input_schema: {
      type: "object",
      properties: {
        nome: { type: "string" },
        cognome: { type: "string" },
        telefono: { type: "string" },
        email: { type: "string" },
        note: { type: "string" },
      },
      required: ["nome", "cognome"],
    },
  },
  {
    name: "compila_ricetta_medica",
    description: "Genera la ricetta medica per un paziente in formato PDF, con i farmaci dettati esplicitamente dal medico in conversazione. Non dedurre mai farmaco o dosaggio: se manca un dato, chiedilo. Esegue subito, senza chiedere conferma: il PDF viene generato e scaricato automaticamente non appena hai paziente e farmaci chiari.",
    input_schema: {
      type: "object",
      properties: {
        paziente_id: { type: "integer", description: "ID del paziente (ottenuto da cerca_pazienti)." },
        farmaci: {
          type: "array",
          description: "Uno o più farmaci, ognuno dettato esplicitamente dal medico.",
          items: {
            type: "object",
            properties: {
              nome: { type: "string" },
              dosaggio: { type: "string", description: "Es. '500mg'." },
              posologia: { type: "string", description: "Es. '1 compressa ogni 8 ore'." },
              durata: { type: "string", description: "Es. '7 giorni'." },
            },
            required: ["nome", "dosaggio", "posologia"],
          },
        },
        note: { type: "string" },
      },
      required: ["paziente_id", "farmaci"],
    },
  },
];

const TOOLS_CHE_RICHIEDONO_CONFERMA = new Set([
  "elimina_appuntamento",
  "registra_pagamento",
  "crea_paziente",
  "crea_proposta_commerciale",
]);

// ── AZIONI PERSONALIZZATE: schema fisso per gli effetti che riusano scritture
// già esistenti nel gestionale (non richiedono configurazione dei parametri
// da pannello, sono sempre gli stessi). Solo 'webhook' ha parametri liberi,
// definiti dallo studio nel pannello Agente AI.
const SCHEMA_FISSO_AZIONI = {
  crea_richiamo: {
    type: "object",
    properties: {
      paziente_id: { type: "integer", description: "ID del paziente (ottenuto da cerca_pazienti)" },
      categoria: { type: "string", enum: ["clinico", "preventivo", "incasso", "generico"], description: "Default 'generico' se non specificato." },
      motivo: { type: "string", description: "Motivo/descrizione del richiamo mostrato in Richiami" },
      data_scadenza: { type: "string", description: "YYYY-MM-DD, data entro cui richiamare il paziente" },
    },
    required: ["paziente_id", "data_scadenza"],
  },
  crea_promemoria: {
    type: "object",
    properties: {
      testo: { type: "string" },
      data: { type: "string", description: "YYYY-MM-DD, opzionale" },
    },
    required: ["testo"],
  },
  nota_paziente: {
    type: "object",
    properties: {
      paziente_id: { type: "integer" },
      testo: { type: "string" },
    },
    required: ["paziente_id", "testo"],
  },
};

function buildInputSchemaAzione(azione) {
  if (azione.tipo_effetto !== "webhook") {
    return SCHEMA_FISSO_AZIONI[azione.tipo_effetto] || { type: "object", properties: {} };
  }
  const properties = {};
  const required = [];
  for (const p of (azione.parametri || [])) {
    if (!p || !p.nome) continue;
    const tipoJson = p.tipo === "number" ? "number" : p.tipo === "boolean" ? "boolean" : "string";
    properties[p.nome] = { type: tipoJson, ...(p.descrizione ? { description: p.descrizione } : {}) };
    if (p.obbligatorio) required.push(p.nome);
  }
  return { type: "object", properties, ...(required.length ? { required } : {}) };
}

function orarioInMinuti(ora) {
  const [h, m] = (ora || "0:0").split(":").map((x) => parseInt(x, 10) || 0);
  return h * 60 + m;
}

// Esegue un'azione personalizzata definita da pannello (tabella ai_agent_actions).
// Nessun codice arbitrario: solo uno dei 4 "tipo_effetto" fissi qui sotto.
async function eseguiAzionePersonalizzata(supabase, azione, input, studioId) {
  if (azione.tipo_effetto === "crea_richiamo") {
    const { data, error } = await supabase
      .from("richiami")
      .insert({
        paziente_id: input.paziente_id,
        categoria: input.categoria || "generico",
        motivo: input.motivo || azione.descrizione,
        data_scadenza: input.data_scadenza,
        origine: "bot",
        stato: "da_fare",
        studio_id: studioId,
      })
      .select()
      .single();
    if (error) return { error: error.message };
    return { creato: data };
  }

  if (azione.tipo_effetto === "crea_promemoria") {
    const { data, error } = await supabase
      .from("todos")
      .insert({ testo: input.testo, data: input.data || null, studio_id: studioId })
      .select()
      .single();
    if (error) return { error: error.message };
    return { creato: data };
  }

  if (azione.tipo_effetto === "nota_paziente") {
    const { data: paz, error: errGet } = await supabase
      .from("patients")
      .select("annotazioni")
      .eq("id", input.paziente_id)
      .single();
    if (errGet) return { error: errGet.message };
    const nuove = [...(paz.annotazioni || []), { testo: input.testo, data: new Date().toISOString() }];
    const { error: errUpd } = await supabase
      .from("patients")
      .update({ annotazioni: nuove })
      .eq("id", input.paziente_id);
    if (errUpd) return { error: errUpd.message };
    return { ok: true };
  }

  if (azione.tipo_effetto === "webhook") {
    const url = azione.config?.url;
    if (!url) return { error: "Azione senza URL webhook configurato nel pannello." };
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ azione: azione.nome, input, studio_id: studioId }),
      });
      const testoResp = await resp.text();
      return { inviato: true, status: resp.status, risposta: testoResp.slice(0, 500) };
    } catch (e) {
      return { error: "Errore chiamata webhook: " + String(e) };
    }
  }

  return { error: "Tipo di effetto sconosciuto: " + azione.tipo_effetto };
}

async function eseguiTool(supabase, name, input, studioId, userId, azioniPersonalizzate) {
  if (name.startsWith("azione_")) {
    const slug = name.slice("azione_".length);
    const azione = (azioniPersonalizzate || []).find((a) => a.nome === slug);
    if (!azione) return { error: "Azione personalizzata non trovata o disattivata." };
    return await eseguiAzionePersonalizzata(supabase, azione, input, studioId);
  }

  if (name === "cerca_pazienti") {
    const tokens = (input.query || "").trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return { risultati: [] };
    let query = supabase.from("patients").select("id, nome, cognome, telefono, email, note");
    for (const token of tokens) {
      const t = `%${token}%`;
      query = query.or(`nome.ilike.${t},cognome.ilike.${t},telefono.ilike.${t},note.ilike.${t}`);
    }
    const { data, error } = await query.limit(15);
    if (error) return { error: error.message };
    return { risultati: data };
  }

  if (name === "appuntamenti") {
    const oggi = new Date().toISOString().slice(0, 10);
    const da = input.da || oggi;
    const a = input.a || da;
    let query = supabase
      .from("appointments")
      .select("data, ora, durata, tipo, stato, note, patients(nome, cognome, telefono)")
      .gte("data", da)
      .lte("data", a)
      .order("data", { ascending: true })
      .order("ora", { ascending: true });
    if (input.stato) query = query.eq("stato", input.stato);
    const { data, error } = await query;
    if (error) return { error: error.message };
    let risultati = data;
    if (input.paziente_nome) {
      const term = input.paziente_nome.toLowerCase();
      risultati = risultati.filter((r) => {
        const p = r.patients;
        return p && `${p.nome} ${p.cognome}`.toLowerCase().includes(term);
      });
    }
    return {
      risultati: risultati.map((r) => ({
        data: r.data, ora: r.ora, durata: r.durata, tipo: r.tipo, stato: r.stato, note: r.note,
        paziente: r.patients ? `${r.patients.nome} ${r.patients.cognome}` : null,
        telefono: r.patients?.telefono || null,
      })),
    };
  }

  if (name === "situazione_economica") {
    const oggi = new Date().toISOString().slice(0, 10);
    const primoDelMese = oggi.slice(0, 8) + "01";
    const da = input.da || primoDelMese;
    const a = input.a || oggi;

    const { data: pagamenti, error: errP } = await supabase
      .from("payments")
      .select("importo, data, stato")
      .gte("data", da)
      .lte("data", a);
    if (errP) return { error: errP.message };
    const incassato = pagamenti
      .filter((p) => p.stato === "pagato" || !p.stato)
      .reduce((s, p) => s + Number(p.importo || 0), 0);

    const { data: piani, error: errPl } = await supabase
      .from("plans")
      .select("titolo, stato, data, scadenza_pagamento, voci, patients(nome, cognome)");
    if (errPl) return { error: errPl.message };

    const calcTotale = (voci) => (voci || []).reduce((s, v) => s + Number(v.prezzo || 0) * Number(v.qty || 1), 0);
    const inAttesa = piani
      .filter((p) => p.stato === "in attesa" || p.stato === "attivo")
      .map((p) => ({ paziente: p.patients ? `${p.patients.nome} ${p.patients.cognome}` : null, titolo: p.titolo, totale: calcTotale(p.voci), data: p.data }));
    const scaduti = piani
      .filter((p) => p.scadenza_pagamento && p.scadenza_pagamento < oggi && p.stato !== "pagato")
      .map((p) => ({ paziente: p.patients ? `${p.patients.nome} ${p.patients.cognome}` : null, titolo: p.titolo, totale: calcTotale(p.voci), scadenza: p.scadenza_pagamento }));

    return {
      periodo: { da, a },
      incassato: Math.round(incassato * 100) / 100,
      preventivi_in_attesa: inAttesa,
      preventivi_scaduti: scaduti,
    };
  }

  if (name === "kpi_controllo_gestione") {
    const oggi = new Date().toISOString().slice(0, 10);
    const primoDelMese = oggi.slice(0, 8) + "01";
    const da = input.da || primoDelMese;
    const a = input.a || oggi;
    const { data, error } = await supabase.rpc("get_kpi_periodo", {
      p_studio_id: studioId,
      p_data_inizio: da,
      p_data_fine: a,
    });
    if (error) return { error: error.message };
    return data;
  }

  if (name === "andamento_kpi") {
    const nMesi = Math.min(Math.max(parseInt(input.mesi, 10) || 6, 1), 24);
    const oggi = new Date();
    const mesi = [];
    for (let i = nMesi - 1; i >= 0; i--) {
      const inizioMese = new Date(oggi.getFullYear(), oggi.getMonth() - i, 1);
      const fineMese = new Date(oggi.getFullYear(), oggi.getMonth() - i + 1, 0);
      const da = inizioMese.toISOString().slice(0, 10);
      const a = (fineMese < oggi ? fineMese : oggi).toISOString().slice(0, 10);
      const { data, error } = await supabase.rpc("get_kpi_periodo", {
        p_studio_id: studioId,
        p_data_inizio: da,
        p_data_fine: a,
      });
      if (error) return { error: error.message };
      mesi.push({ mese: da.slice(0, 7), parziale: fineMese >= oggi, ...data });
    }
    return { mesi };
  }

  if (name === "richiami") {
    const entro = input.entro_giorni ?? 30;
    const oggi = new Date();
    const limite = new Date(oggi.getTime() + entro * 86400000);
    const { data: piani, error } = await supabase
      .from("plans")
      .select("voci, patients(nome, cognome, telefono)");
    if (error) return { error: error.message };
    const scaduti = [];
    const prossimi = [];
    for (const p of piani) {
      for (const v of (p.voci || [])) {
        if (!v.richiamoData) continue;
        const d = new Date(v.richiamoData + "T12:00");
        const paziente = p.patients ? `${p.patients.nome} ${p.patients.cognome}` : null;
        const telefono = p.patients?.telefono || null;
        const voce = { paziente, telefono, data: v.richiamoData, tipo: v.richiamoTipo || "Controllo" };
        if (d < oggi) scaduti.push(voce);
        else if (d <= limite) prossimi.push(voce);
      }
    }
    return { scaduti, prossimi };
  }

  if (name === "storico_paziente") {
    const { data: piani, error: errPl } = await supabase
      .from("plans")
      .select("id, titolo, data, stato, voci, sconto, sconto_tipo, scadenza_pagamento")
      .eq("paziente_id", input.paziente_id)
      .order("data", { ascending: false });
    if (errPl) return { error: errPl.message };

    const { data: pagamenti, error: errPa } = await supabase
      .from("payments")
      .select("data, importo, metodo, stato, nota")
      .eq("paziente_id", input.paziente_id)
      .order("data", { ascending: false });
    if (errPa) return { error: errPa.message };

    const { data: richiamiPaz, error: errRi } = await supabase
      .from("richiami")
      .select("categoria, motivo, data_scadenza, stato")
      .eq("paziente_id", input.paziente_id);
    if (errRi) return { error: errRi.message };

    const totaleSpeso = (pagamenti || []).filter((p) => p.stato === "pagato" || !p.stato).reduce((s, p) => s + Number(p.importo || 0), 0);
    return { piani: piani || [], pagamenti: pagamenti || [], richiami: richiamiPaz || [], totale_speso: Math.round(totaleSpeso * 100) / 100 };
  }

  if (name === "catalogo_prestazioni") {
    const { data, error } = await supabase.from("pricelist").select("cat, cod, nome, prezzo").order("cat");
    if (error) return { error: error.message };
    const perCategoria = {};
    for (const p of data || []) {
      const cat = p.cat || "Altro";
      if (!perCategoria[cat]) perCategoria[cat] = [];
      perCategoria[cat].push({ nome: p.nome, prezzo: p.prezzo, cod: p.cod || undefined });
    }
    return { catalogo: perCategoria };
  }

  if (name === "crea_proposta_commerciale") {
    const voci = (input.voci || []).map((v) => ({ prestazione: v.prestazione, prezzo: Number(v.prezzo) || 0, dente: v.dente || null, eseguita: false, incassata: false }));
    if (voci.length === 0) return { error: "Nessuna voce proposta." };
    const { data, error } = await supabase
      .from("plans")
      .insert({
        paziente_id: input.paziente_id,
        titolo: input.titolo,
        data: new Date().toISOString().slice(0, 10),
        voci,
        stato: "attivo",
        sconto: input.sconto || 0,
        sconto_tipo: input.sconto ? (input.sconto_tipo || "pct") : "pct",
        studio_id: studioId,
        user_id: userId,
      })
      .select()
      .single();
    if (error) return { error: error.message };
    return { creato: data, nota: "Bozza creata in stato 'in attesa' — visibile in Piani di Cura, non ancora mostrata al paziente." };
  }

  if (name === "crea_promemoria") {
    const { data, error } = await supabase
      .from("todos")
      .insert({ testo: input.testo, data: input.data || null, studio_id: studioId })
      .select()
      .single();
    if (error) return { error: error.message };
    return { creato: data };
  }

  if (name === "aggiungi_nota_paziente") {
    const { data: paz, error: errGet } = await supabase
      .from("patients")
      .select("annotazioni")
      .eq("id", input.paziente_id)
      .single();
    if (errGet) return { error: errGet.message };
    const nuove = [...(paz.annotazioni || []), { testo: input.testo, data: new Date().toISOString() }];
    const { error: errUpd } = await supabase
      .from("patients")
      .update({ annotazioni: nuove })
      .eq("id", input.paziente_id);
    if (errUpd) return { error: errUpd.message };
    return { ok: true };
  }

  if (name === "crea_appuntamento") {
    if (!input.forza_sovrapposizione) {
      const { data: esistenti, error: errCheck } = await supabase
        .from("appointments")
        .select("id, ora, durata, tipo, patients(nome, cognome)")
        .eq("data", input.data);
      if (errCheck) return { error: errCheck.message };

      const nuovoInizio = orarioInMinuti(input.ora);
      const nuovaDurata = input.durata || 30;
      const nuovoFine = nuovoInizio + nuovaDurata;
      const conflitto = (esistenti || []).find((e) => {
        const inizio = orarioInMinuti(e.ora);
        const fine = inizio + (e.durata || 30);
        return nuovoInizio < fine && inizio < nuovoFine;
      });
      if (conflitto) {
        return {
          conflitto: true,
          messaggio: "Slot già occupato da un altro appuntamento — NON creare, segnala il conflitto all'utente e chiedi come procedere (altro orario, o sovrapporre volutamente con forza_sovrapposizione=true).",
          appuntamento_esistente: {
            ora: conflitto.ora,
            tipo: conflitto.tipo,
            paziente: conflitto.patients ? `${conflitto.patients.nome} ${conflitto.patients.cognome}` : null,
          },
        };
      }

      const { data: impegniEsistenti, error: errImp } = await supabase
        .from("impegni_personali")
        .select("id, titolo, tipo, tutto_il_giorno, ora_inizio, ora_fine")
        .lte("data_inizio", input.data)
        .gte("data_fine", input.data);
      if (errImp) return { error: errImp.message };

      const conflittoImpegno = (impegniEsistenti || []).find((imp) => {
        if (imp.tutto_il_giorno) return true;
        const inizio = orarioInMinuti(imp.ora_inizio);
        const fine = orarioInMinuti(imp.ora_fine);
        return nuovoInizio < fine && inizio < nuovoFine;
      });
      if (conflittoImpegno) {
        return {
          conflitto: true,
          messaggio: "Slot occupato da un impegno personale (" + conflittoImpegno.titolo + ") — NON creare, segnala il conflitto all'utente e chiedi come procedere (altro orario, o sovrapporre volutamente con forza_sovrapposizione=true).",
          impegno_esistente: { titolo: conflittoImpegno.titolo, tipo: conflittoImpegno.tipo, tutto_il_giorno: conflittoImpegno.tutto_il_giorno },
        };
      }
    }

    const { data, error } = await supabase
      .from("appointments")
      .insert({
        paziente_id: input.paziente_id, data: input.data, ora: input.ora,
        durata: input.durata || 30, tipo: input.tipo, note: input.note || null,
        stato: "confermato", studio_id: studioId, user_id: userId,
      })
      .select()
      .single();
    if (error) return { error: error.message };
    return { creato: data };
  }

  if (name === "crea_impegno_personale") {
    const { data, error } = await supabase
      .from("impegni_personali")
      .insert({
        studio_id: studioId,
        user_id: userId,
        titolo: input.titolo,
        tipo: input.tipo || "personale",
        data_inizio: input.data_inizio,
        data_fine: input.data_fine || input.data_inizio,
        tutto_il_giorno: input.tutto_il_giorno !== false,
        ora_inizio: input.tutto_il_giorno === false ? input.ora_inizio || null : null,
        ora_fine: input.tutto_il_giorno === false ? input.ora_fine || null : null,
        note: input.note || null,
      })
      .select()
      .single();
    if (error) return { error: error.message };
    return { creato: data };
  }

  if (name === "modifica_appuntamento") {
    const upd = {};
    for (const k of ["data", "ora", "durata", "tipo", "stato", "note"]) {
      if (input[k] !== undefined) upd[k] = input[k];
    }
    const { data, error } = await supabase
      .from("appointments")
      .update(upd)
      .eq("id", input.appuntamento_id)
      .select()
      .single();
    if (error) return { error: error.message };
    return { aggiornato: data };
  }

  if (name === "elimina_appuntamento") {
    const { error } = await supabase.from("appointments").delete().eq("id", input.appuntamento_id);
    if (error) return { error: error.message };
    return { eliminato: true };
  }

  if (name === "registra_pagamento") {
    const { data, error } = await supabase
      .from("payments")
      .insert({
        paziente_id: input.paziente_id, importo: input.importo,
        data: input.data || new Date().toISOString().slice(0, 10),
        metodo: input.metodo || null, nota: input.nota || null,
        stato: "pagato", studio_id: studioId, user_id: userId,
      })
      .select()
      .single();
    if (error) return { error: error.message };
    return { registrato: data };
  }

  if (name === "crea_paziente") {
    const { data, error } = await supabase
      .from("patients")
      .insert({
        nome: input.nome, cognome: input.cognome, telefono: input.telefono || null,
        email: input.email || null, note: input.note || null, studio_id: studioId, user_id: userId,
      })
      .select()
      .single();
    if (error) return { error: error.message };
    return { creato: data };
  }

  if (name === "compila_ricetta_medica") {
    const { data: paz, error: errPaz } = await supabase
      .from("patients")
      .select("id, nome, cognome, data_nascita")
      .eq("id", input.paziente_id)
      .single();
    if (errPaz || !paz) return { error: "Paziente non trovato: " + (errPaz?.message || "") };

    const { data: si } = await supabase
      .from("studio_info")
      .select("nome, spec, iscr, addr1, tel, email, piva, firma_b64")
      .eq("studio_id", studioId)
      .maybeSingle();

    const { error: errLog } = await supabase
      .from("ricette_bozze")
      .insert({
        studio_id: studioId,
        paziente_id: input.paziente_id,
        farmaci: input.farmaci,
        note: input.note || null,
        stato: "confermata_dal_medico",
        created_by: userId,
      });

    return {
      ricetta_generata: true,
      audit_loggato: !errLog,
      pdf_data: {
        paziente: paz,
        studio: si || {},
        farmaci: input.farmaci,
        data: new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" }),
      },
    };
  }

  return { error: "Tool sconosciuto: " + name };
}

function buildDefaultSystemPrompt(isDentistico) {
  return `Il tuo compito è aiutare il personale dello studio (segreteria, assistenti, medici) a usare
il gestionale Poliedra — NON sei un assistente rivolto ai pazienti finali, a meno che
non ti venga esplicitamente detto il contrario nel contesto della conversazione.

## Cosa sai

Conosci SOLO le funzionalità di Poliedra elencate di seguito. Se una domanda riguarda
una funzionalità non elencata qui, o non sei sicuro che esista, dillo chiaramente invece di
inventare o supporre.

FUNZIONALITÀ ATTIVE:
- Gestione Pazienti (anagrafica, ricerca, scheda paziente, galleria foto cliniche, storico)
- Piani di Cura (preventivi, listino prezzi, sconti, stati, tracking prestazioni${isDentistico ? ", ortodonzia\n  con cambio allineatori, gestione impianti" : ""})
- Pagamenti & Finanza (registrazione pagamenti, logica eseguito/anticipo, collaborazioni
  esterne, spese studio, proiezioni)
- Controllo di Gestione (incassato, costi fissi/variabili, margine di contribuzione, EBITDA,
  break-even dinamico, ticket medio per periodo — dati reali, non stime, unica fonte di verità
  condivisa da Dashboard, Controllo di Gestione, Proiezioni e questo assistente)
- Agenda (vista giorno/settimana/mese, slot personalizzabili, drag & drop, colori per tipo
  visita, impegni personali/ferie non legati a pazienti)
- Richiami (sezione dedicata con richiami clinici, preventivi/incassi in standby, generati
  automaticamente o a mano, incrociati con l'agenda per evitare doppi richiami)
- WhatsApp Integration (reminder manuali da agenda o scheda paziente, template personalizzabili)
- Dashboard (widget personalizzabili, pannello economico, statistiche, agenda del giorno)
- Documenti Medici (ricette, certificati, lettere per specialisti, timbro e firma digitale)
- Documenti Fiscali (fatture esenti IVA art.10, rimborsi spese, numerazione automatica)
- Impostazioni & Profilo (dati studio, tipi appuntamento, gestione utenti e ruoli, inviti)

## Modello di permessi (vale per ogni azione, se hai accesso ad azioni)

- LETTURA: libera, sempre filtrata per studio. Nessuna conferma richiesta.
- SCRITTURA A ESECUZIONE DIRETTA (appuntamenti, impegni personali, promemoria, note paziente,
  ricette mediche, azioni personalizzate senza conferma): esegui subito, senza chiedere
  conferma prima.
- SCRITTURA CHE RICHIEDE CONFERMA (cancellazione appuntamento, pagamento, nuovo paziente, e
  ogni azione personalizzata marcata "richiede conferma" nel pannello Agente AI): prepari,
  mostri il riepilogo, chiedi conferma esplicita, ed esegui solo dopo conferma.
- VIETATO SEMPRE: cancellazioni permanenti al di fuori del tool dedicato, transazioni
  finanziarie reali, invii massivi senza conferma.

## Conflitti di orario in agenda

Se provi a creare un appuntamento in uno slot già occupato (da un altro appuntamento O da un
impegno personale come ferie/chiamate), il sistema blocca la creazione e te lo segnala. NON
cancellare, spostare o modificare l'appuntamento/impegno esistente di tua iniziativa: spiega
il conflitto all'utente e chiedi come procedere. Solo se l'utente conferma esplicitamente di
voler sovrapporre comunque, richiama il tool con forza_sovrapposizione=true.

## Controllo di gestione

Quando ti chiedono di margine, margine di contribuzione, EBITDA, break-even, marginalità,
andamento economico o redditività, usa SEMPRE il tool kpi_controllo_gestione — è la stessa
fonte dati mostrata in Controllo di Gestione e Dashboard, così i numeri che dai coincidono
sempre con quello che l'utente vede a schermo. Terminologia: margine_contribuzione = incassato
meno costi variabili; ebitda (= 'margine', stesso valore) = margine_contribuzione meno costi
fissi. Il campo break_even può essere null: significa che lo studio usa il metodo costi
variabili 'manuale' (somma spese taggate), col quale un break-even non è matematicamente
definibile — in quel caso leggi break_even_nota e suggerisci all'utente di impostare il
metodo 'percentuale sul fatturato' in Impostazioni economiche per attivarlo. Non calcolare
MAI break-even, margine o EBITDA a mano: se il tool restituisce break_even null, dillo
chiaramente invece di stimare un numero.

## Ruolo di CFO / consulente economico

Per le domande economiche non ti limiti a leggere un numero: ti comporti come
un consulente che conosce i conti dello studio. Quando è pertinente (l'utente
chiede "come va", un giudizio, un consiglio, o sta guardando margine/incassi/
costi/break-even), usa SEMPRE anche andamento_kpi oltre a kpi_controllo_gestione:
un numero isolato non è un'analisi, un trend sì. Nella risposta:
- individua un'osservazione concreta se c'è (es. margine in calo/crescita,
  costi variabili cresciuti più in fretta del fatturato, break-even mai
  raggiunto negli ultimi mesi, un mese anomalo rispetto agli altri);
- se noti qualcosa di rilevante, chiudi con un consiglio pratico e breve — non
  generico ("monitora i costi") ma legato al numero che hai appena mostrato;
- sii onesto sui limiti dei dati: se lo storico è troppo corto o incompleto
  per un giudizio serio, dillo chiaramente invece di inventare un trend che
  non c'è. Meglio "servono più mesi di dati per dirlo con sicurezza" che un
  consiglio costruito su due numeri.
Resta comunque valido tutto il resto: mai calcolare KPI a mano, mai inventare
numeri non restituiti dai tool.

## Ruolo commerciale

Quando ti si chiede cosa proporre a un paziente, come gestire una trattativa sul
prezzo, o un'idea per far ripartire un preventivo fermo, ti comporti da
responsabile commerciale dello studio — non da segretaria che aspetta ordini.
Regole:
- Prima di proporre qualsiasi upselling o cross-selling, usa storico_paziente:
  la proposta deve nascere da cosa il paziente ha già fatto/non ha mai fatto${isDentistico ? "\n  (es. ha fatto igiene ma mai sbiancamento, ha un impianto ma non fa il\n  richiamo di controllo)" : " (es. un\n  trattamento fatto una volta sola che di solito si ripete, o un servizio\n  collegato mai proposto)"}. Mai proporre a caso o per abitudine.
- Usa sempre catalogo_prestazioni per prezzi e nomi reali: non inventare mai
  una prestazione o un prezzo.
- "Vendita motivata": ogni proposta deve avere una ragione dichiarata e vera
  legata al paziente, mai una pressione generica ("colga l'occasione").
  Se non trovi un collegamento reale nello storico, dillo — meglio non
  proporre nulla che proporre qualcosa senza motivo.
- Se un preventivo è fermo per il prezzo, puoi proporre uno sconto o
  suggerire un pagamento rateizzato (dividi il totale in 2-3 rate con date
  proposte, spiegalo in chiaro nella conversazione) prima di scontare
  aggressivamente — non hai un tool per registrare rate pianificate, quindi
  descrivi il piano proposto a parole, in modo che l'operatore lo comunichi
  al paziente.
- Se ti chiedono di preparare la proposta, usa crea_proposta_commerciale
  (richiede conferma) per creare la bozza del piano di cura, poi scrivi anche
  un messaggio pronto per WhatsApp (tono cordiale, mai invadente, spiega il
  perché) che l'operatore può copiare e inviare manualmente — non lo invii
  mai tu direttamente, non hai un canale diretto verso il paziente.
- Tono: consulente di fiducia, non venditore. Se i dati non giustificano una
  proposta commerciale in questo momento, dillo onestamente.

## Cosa NON fai

- Non dai consigli clinici/medici (diagnosi, terapie, farmaci non dettati esplicitamente).
- Non riveli, confronti o accenni a dati di altri studi.
- Non negozi prezzi o condizioni contrattuali: indirizza al supporto commerciale.
- Non ti sostituisci al supporto tecnico per bug della piattaforma: suggerisci
  assistenza@poliedrasoft.it.

## Tono

Professionale ma cordiale, in italiano, frasi brevi e concrete. Rispondi come una persona
del team di supporto che conosce bene il prodotto, non come un chatbot generico.

## Lingua

Rispondi nella lingua in cui ti scrive l'utente. Se non specificato, italiano.`;
}

// Limiti di sicurezza/costo sui contenuti caricati dallo studio (FAQ e
// documenti), per non far esplodere il prompt in token/costo.
const MAX_CHAR_PER_DOCUMENTO = 6000;
const MAX_CHAR_DOCUMENTI_TOTALE = 20000;
const MAX_FAQ = 40;

function buildConoscenzaStudio(config, faq, documenti) {
  let blocco = "";

  if (config?.system_prompt && config.system_prompt.trim()) {
    blocco += `\n\n## Istruzioni aggiuntive dello studio\n\nQuesta sezione è scritta dallo studio dal pannello "Agente AI" e si aggiunge\n(non sostituisce) alle regole sopra — in caso di contraddizione, le regole\nsopra restano valide (permessi, conferme, cosa non fai).\n\n${config.system_prompt.trim()}`;
  }

  if (faq && faq.length > 0) {
    blocco += `\n\n## Domande frequenti dello studio\n\nUsa queste risposte quando pertinenti, adattando il tono alla conversazione.\n\n`;
    blocco += faq.slice(0, MAX_FAQ).map((f) => `D: ${f.domanda}\nR: ${f.risposta}`).join("\n\n");
  }

  if (documenti && documenti.length > 0) {
    let totale = 0;
    const blocchi = [];
    for (const d of documenti) {
      if (totale >= MAX_CHAR_DOCUMENTI_TOTALE) break;
      const spazioResiduo = MAX_CHAR_DOCUMENTI_TOTALE - totale;
      const testo = (d.testo || "").slice(0, Math.min(MAX_CHAR_PER_DOCUMENTO, spazioResiduo));
      totale += testo.length;
      blocchi.push(`### ${d.nome}\n\n${testo}${testo.length < (d.testo || "").length ? "\n[…troncato]" : ""}`);
    }
    blocco += `\n\n## Documenti di riferimento dello studio\n\n${blocchi.join("\n\n")}`;
  }

  return blocco;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autenticato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    // Le tabelle ai_agent_* sono ora RLS "solo admin" (istruzioni/FAQ/documenti/
    // azioni si configurano solo da chi ha ruolo admin) — ma la CHAT deve restare
    // disponibile a tutto lo staff. Per leggere quella configurazione (mai per
    // eseguire azioni: quelle passano sempre dal client `supabase` sopra, scoped
    // sull'utente che sta chattando) usiamo un client con la chiave service-role,
    // che bypassa RLS solo per queste 4 letture di sola configurazione.
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: { user }, error: errUser } = await supabase.auth.getUser();
    if (errUser || !user) {
      return new Response(JSON.stringify({ error: "Sessione non valida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const studioId = user.app_metadata?.studio_id;
    if (!studioId) {
      return new Response(JSON.stringify({ error: "Utente senza studio associato" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: studio, error: errStudio } = await supabase
      .from("studios")
      .select("nome, piano, feature_overrides, ai_trial_ends_at, vertical")
      .eq("id", studioId)
      .single();
    if (errStudio || !studio) {
      return new Response(JSON.stringify({ error: "Studio non trovato" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trialAttivo = studio.ai_trial_ends_at && new Date(studio.ai_trial_ends_at) > new Date();
    let livello = studio.feature_overrides?.assistente_ai ?? "off";
    if (!trialAttivo && studio.ai_trial_ends_at && livello === "premium") {
      livello = "off";
    }

    if (livello === "off") {
      return new Response(JSON.stringify({ error: "L'assistente AI non è attivo per questo studio. Contatta lo studio o l'assistenza per attivarlo." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const TOOL_SOLO_LETTURA = new Set(["cerca_pazienti", "appuntamenti", "situazione_economica", "kpi_controllo_gestione", "andamento_kpi", "richiami", "storico_paziente", "catalogo_prestazioni"]);

    // Filtrate manualmente per studioId qui (invece di affidarsi alla RLS, che
    // ora per queste tabelle richiede anche il ruolo admin): supabaseAdmin
    // bypassa RLS per intero, quindi l'isolamento tra studi lo garantiamo noi.
    const [{ data: config }, { data: faq }, { data: documenti }, { data: azioniPersonalizzate }] = await Promise.all([
      supabaseAdmin.from("ai_agent_config").select("system_prompt").eq("studio_id", studioId).maybeSingle(),
      supabaseAdmin.from("ai_agent_faq").select("domanda, risposta").eq("studio_id", studioId).order("ordine", { ascending: true }),
      supabaseAdmin.from("ai_agent_documenti").select("nome, testo").eq("studio_id", studioId),
      livello === "premium"
        ? supabaseAdmin.from("ai_agent_actions").select("nome, descrizione, tipo_effetto, parametri, config, richiede_conferma").eq("studio_id", studioId).eq("attiva", true)
        : Promise.resolve({ data: [] }),
    ]);

    const azioniAttive = azioniPersonalizzate || [];
    const azioniTools = azioniAttive.map((a) => ({
      name: "azione_" + a.nome,
      description: a.descrizione,
      input_schema: buildInputSchemaAzione(a),
    }));

    const toolsPerLivello =
      livello === "premium" ? [...TOOLS, ...azioniTools] :
      livello === "pro" ? TOOLS.filter((t) => TOOL_SOLO_LETTURA.has(t.name)) :
      [];

    const conferme = new Set([
      ...TOOLS_CHE_RICHIEDONO_CONFERMA,
      ...azioniAttive.filter((a) => a.richiede_conferma).map((a) => "azione_" + a.nome),
    ]);

    // Livello di autonomia dell'agente (dial studio, con tetto massimo dal
    // super admin) — indipendente dal livello base/pro/premium sopra, che
    // riguarda cosa lo studio ha PAGATO; questo riguarda quanto l'agente
    // può fare DA SOLO. Vive in feature_overrides come le altre chiavi.
    const RANK_AZIONE = { consulente: 0, medio: 1, su_richiesta: 2, completo: 3 };
    const azioneScelta = studio.feature_overrides?.agente_azione ?? "completo";
    const azioneMax = studio.feature_overrides?.agente_azione_max ?? "completo";
    const agenteAzione = (RANK_AZIONE[azioneScelta] ?? 3) <= (RANK_AZIONE[azioneMax] ?? 3) ? azioneScelta : azioneMax;

    let toolsFinali = toolsPerLivello;
    if (agenteAzione === "consulente") {
      toolsFinali = toolsPerLivello.filter((t) => TOOL_SOLO_LETTURA.has(t.name));
    }
    const confermeFinali = new Set(conferme);
    if (agenteAzione === "medio") {
      for (const t of toolsFinali) {
        if (!TOOL_SOLO_LETTURA.has(t.name)) confermeFinali.add(t.name);
      }
    }

    const oggiInfo = new Date().toLocaleDateString("it-IT", {
      weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Europe/Rome",
    });
    const oggiISO = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
    const noteLivello =
      livello === "base" ? "\n\nSei nel livello BASE: non hai accesso a nessun dato o azione del gestionale, puoi solo rispondere a domande su come si usa il software, basandoti sulle funzionalità descritte sopra." :
      livello === "pro" ? "\n\nSei nel livello PRO: puoi leggere dati reali (pazienti, agenda, situazione economica, controllo di gestione, richiami) ma NON puoi creare, modificare o cancellare nulla. Se ti chiedono un'azione di scrittura, spiega che serve il livello Premium." :
      "";
    const noteAzione =
      agenteAzione === "consulente" ? "\n\nIl titolare ha impostato l'agente in modalità CONSULENTE: puoi solo leggere dati e dare consigli, nessuna azione di scrittura è disponibile in questa chat, qualunque sia il piano. Se ti chiedono di creare/modificare/cancellare qualcosa, spiega che il titolare ha limitato l'agente a sola consulenza e che può cambiarlo dal pannello Agente AI." :
      agenteAzione === "medio" ? "\n\nIl titolare ha impostato l'agente in modalità MEDIA: ogni azione di scrittura, anche quelle normalmente immediate (appuntamenti, promemoria, note paziente), richiede SEMPRE conferma esplicita prima di essere eseguita." :
      agenteAzione === "su_richiesta" ? "\n\nIl titolare ha impostato l'agente in modalità SU RICHIESTA: puoi eseguire subito le azioni di scrittura che l'utente ti chiede esplicitamente in questa chat, senza bisogno di conferme aggiuntive oltre a quelle già previste per le azioni più delicate. Non proporre né avviare MAI di tua iniziativa un'azione, un'idea commerciale (upselling/cross-selling) o un promemoria che l'utente non ha chiesto: agisci solo quando te lo chiedono esplicitamente." :
      "";

    const conoscenzaStudio = buildConoscenzaStudio(config, faq, documenti);

    const isDentistico = !studio.vertical || studio.vertical === "dentistico";

    const systemPrompt = `Sei l'assistente virtuale di supporto di Poliedra per lo studio "${studio.nome}".

${buildDefaultSystemPrompt(isDentistico)}
${conoscenzaStudio}

## Data corrente

Oggi è ${oggiInfo} (${oggiISO} in formato YYYY-MM-DD). Usa SEMPRE questa data come riferimento
per calcolare date relative ("domani", "martedì prossimo", "tra due settimane", ecc.) — non
dedurre o assumere altre date, e non sbagliare mai l'anno.${noteLivello}${noteAzione}`;

    const { messages, confirm } = await req.json();

    let convo = [...messages];
    let finalText = "";
    const MAX_TURNS = 5;

    if (confirm && confirm.tool_use_id) {
      const lastMsg = convo[convo.length - 1];
      const pendingBlocks = lastMsg && lastMsg.role === "assistant" && Array.isArray(lastMsg.content)
        ? lastMsg.content.filter((b) => b.type === "tool_use")
        : [];
      const target = pendingBlocks.find((b) => b.id === confirm.tool_use_id);
      if (target) {
        const cancellato = !!confirm.cancelled;
        const result = cancellato
          ? { annullato: true, messaggio: "L'utente ha scelto di NON procedere con questa azione." }
          : await eseguiTool(supabase, target.name, target.input || {}, studioId, user.id, azioniAttive);
        const toolResults = pendingBlocks.map((b) => ({
          type: "tool_result",
          tool_use_id: b.id,
          content: JSON.stringify(
            b.id === confirm.tool_use_id
              ? result
              : { annullato: true, messaggio: "Turno annullato: azione non confermata singolarmente." }
          ),
        }));
        convo.push({ role: "user", content: toolResults });
      }
    }

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: 1024,
          system: systemPrompt,
          messages: convo,
          tools: toolsFinali,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        return new Response(JSON.stringify({ error: "Errore API Claude: " + errText }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await resp.json();
      if (data.usage) {
        const costo = data.usage.input_tokens * PREZZO_INPUT_PER_TOKEN + data.usage.output_tokens * PREZZO_OUTPUT_PER_TOKEN;
        await supabase.from("ai_agent_usage").insert({
          studio_id: studioId, fonte: "chat", modello: "claude-sonnet-5",
          input_tokens: data.usage.input_tokens, output_tokens: data.usage.output_tokens,
          costo_usd: Math.round(costo * 10000) / 10000,
        });
      }
      const toolUses = data.content.filter((b) => b.type === "tool_use");
      const textBlocks = data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");

      if (toolUses.length === 0) {
        finalText = textBlocks;
        break;
      }

      convo.push({ role: "assistant", content: data.content });

      const daConfermareList = toolUses.filter(
        (tu) => confermeFinali.has(tu.name) && !(confirm && confirm.tool_use_id === tu.id)
      );
      const daConfermare = daConfermareList[0];
      if (daConfermare) {
        return new Response(
          JSON.stringify({
            needsConfirmation: { tool_use_id: daConfermare.id, name: daConfermare.name, input: daConfermare.input },
            text: textBlocks,
            messages: convo,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const toolResults = [];
      for (const tu of toolUses) {
        const cancellato = confirm && confirm.tool_use_id === tu.id && confirm.cancelled;
        const result = cancellato
          ? { annullato: true, messaggio: "L'utente ha scelto di NON procedere con questa azione." }
          : await eseguiTool(supabase, tu.name, tu.input || {}, studioId, user.id, azioniAttive);
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(result) });
      }
      convo.push({ role: "user", content: toolResults });

      if (turn === MAX_TURNS - 1) {
        finalText = textBlocks || "Non sono riuscito a completare la richiesta, prova a riformularla in modo piu' semplice.";
      }
    }

    return new Response(JSON.stringify({ text: finalText, messages: convo }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
