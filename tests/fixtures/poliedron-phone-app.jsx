// Browser-only synthetic fixture. External requests are blocked by the runner.
import React from "react";
import { createRoot } from "react-dom/client";
import { supabase, DB } from "/src/lib/supabase.js";
import App from "/src/App.jsx";
import "/src/styles.css";
history.replaceState({}, "", "/poliedron/");
const session = {
  user: {
    id: "qa-user",
    app_metadata: { studio_id: "qa-studio" },
    user_metadata: { nome: "Utente", cognome: "Test" },
  },
};
supabase.auth.getSession = async () => ({ data: { session } });
supabase.auth.onAuthStateChange = () => ({
  data: { subscription: { unsubscribe() {} } },
});
supabase.channel = () => ({
  on() {
    return this;
  },
  subscribe() {
    return this;
  },
});
supabase.removeChannel = () => {};
DB.getAll = async (k) =>
  ["dm_pr", "dm_tp", "dm_at"].includes(k)
    ? [{ id: 1, nome: "Test", name: "Test", tipo: "visita" }]
    : [];
DB.getStudioInfo = async () => ({
  nome: "Studio di prova",
  vertical: "dentistico",
  poltrone: [],
  operatori: [],
});
DB.insert = () => {
  throw Error("Unexpected business write");
};
supabase.rpc = async (name) => ({
  data:
    name === "get_my_studio_capabilities_v1"
      ? ["studio.owner", "home.owner"]
      : false,
  error: null,
});
const rows =
  window.__QA_SCENARIO__ === "empty"
    ? []
    : Array.from({ length: 36 }, (_, i) => ({
        id: i + 1,
        conversation_id: "qa-conversation",
        request_id: "qa-" + i,
        role: i % 2 ? "assistant" : "user",
        content:
          i === 30
            ? "Messaggio lungo senza spazi: " + "abcdefghij".repeat(100)
            : i % 2
              ? "Ho verificato la richiesta. Gli appuntamenti e le attività sono consultabili nello studio."
              : "Mostrami gli appuntamenti di domani e i richiami da rifissare.",
        delivery_status: "sent",
        read_at: "2026-10-05T12:00:00Z",
        created_at: new Date(
          Date.UTC(2026, 9, 4 + Math.floor(i / 18), 9, i),
        ).toISOString(),
      }));
window.qaRows = rows;
window.qaRelease = null;
Object.defineProperty(supabase, "functions", {
  value: {
    invoke: () =>
      new Promise((resolve) => {
        window.qaRelease = () =>
          resolve({
            data: { text: "Risposta di prova verificata." },
            error: null,
          });
      }),
  },
});
supabase.from = (table) => {
  let action = "read",
    payload,
    filterId,
    head = false,
    limit = 40,
    before = Infinity;
  const q = {
    select(_f, options) {
      head = options?.head;
      return this;
    },
    eq(k, v) {
      if (k === "id") filterId = v;
      return this;
    },
    in() {
      return this;
    },
    is() {
      return this;
    },
    lt(_k, v) {
      before = v;
      return this;
    },
    order() {
      return this;
    },
    limit(v) {
      limit = v;
      return this;
    },
    insert(v) {
      action = "insert";
      payload = v;
      return this;
    },
    update(v) {
      action = "update";
      payload = v;
      return this;
    },
    maybeSingle() {
      return this.single();
    },
    single() {
      return this.then((v) => ({
        ...v,
        data: Array.isArray(v.data) ? v.data[0] : v.data,
      }));
    },
    then(resolve, reject) {
      let data = [];
      if (table === "studios") data = { attivo: true, piano: "premium" };
      if (table === "studio_users") data = { ruolo: "admin", stato: "attivo" };
      if (table === "poliedron_conversations")
        data = {
          id: "qa-conversation",
          studio_id: "qa-studio",
          user_id: "qa-user",
        };
      if (table === "poliedron_messages") {
        if (action === "insert") {
          data = {
            ...payload,
            id: rows.length + 1,
            created_at: new Date().toISOString(),
          };
          rows.push(data);
        } else if (action === "update") {
          data = rows.find((r) => r.id === filterId);
          if (data) Object.assign(data, payload);
          else data = [];
        } else
          data = rows
            .filter((r) => r.id < before)
            .slice(-limit)
            .reverse();
      }
      return Promise.resolve({
        data,
        error:
          table === "poliedron_conversations" &&
          window.__QA_SCENARIO__ === "error"
            ? { code: "PGRST205" }
            : null,
        count: head ? 0 : undefined,
      }).then(resolve, reject);
    },
  };
  return q;
};
createRoot(document.getElementById("root")).render(<App />);
