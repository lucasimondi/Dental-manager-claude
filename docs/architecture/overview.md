# Architecture overview — current state

This document records the audited as-is architecture at commit `4b2b3b67a18f35d0768d3e59106ac172f15f1ed2`; it is not a target design.

Poliedra is a React 18/Vite 5 SPA. `src/App.jsx` is the composition root and currently coordinates authentication, initial full-table data loading, seed behavior, feature entitlements, roles, realtime subscriptions, optimistic CRUD synchronization, navigation, and module rendering.

The browser connects directly to Supabase. `src/lib/supabase.js` provides a partial generic adapter for core tables, while many components also query tables and RPC directly. The repository backend contains only `api/whatsapp-webhook.js`, a Vercel proxy to an external Supabase Edge Function.

Major modules: dashboard, patients, patient record, agenda, plans, payments, price list, recalls, expenses, documents, settings, users/resources, management control, booking, WhatsApp, AI setup/assistant, super-admin, dental clinical features, and Physio clinical features.

Known structural constraints:
- large components mix UI, domain calculations, and data access;
- application state is local React state;
- initial loading fetches complete tables;
- realtime refreshes entire tables for selected entities;
- optimistic array diffing is not transactional;
- the complete Supabase backend is not versioned;
- no automated tests or CI are currently present.

No target modularization is approved in POL-001.
