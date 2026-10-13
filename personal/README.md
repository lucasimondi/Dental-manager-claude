# Poliedron Personal (POL-VITA-001)

App separata dall'app dello studio, collegata solo al progetto Supabase `archivio-documenti`
(`tkcwvjzjkfhcuebrjvsp`). Decisione PO 2026-10-13: stesso repository, app distinta, accesso con link via email.

- Nessun codice, chiave o service worker dell'app dello studio (verificato da `tests/poliedronPersonal.test.mjs`).
- Core deterministico (`src/lib/coreArchivio.js`), nessun modello AI: "Quanto devo a Edison?", "Scadenze di questo mese",
  "Cosa devo fare?", "Bollette", "Le mie pratiche", "pratica Edison", ricerca libera.
- Azioni: scadenza pagata, pratica risolta, cancellazione definitiva del documento (`elimina_documento`).
- I documenti li carica Cowork (Gmail → Drive → `registra_documento`).

## Comandi

```sh
npm run dev:personal     # http://localhost:5174
npm run build:personal   # → dist-personal/
```

## Pubblicazione (una volta, dal PO)

1. Vercel → nuovo progetto dallo stesso repository: Root Directory `.`, Build Command `npm run build:personal`,
   Output Directory `dist-personal`, Install Command `npm ci`.
2. Supabase `archivio-documenti` → Authentication → URL Configuration: Site URL = indirizzo Vercel del punto 1,
   e lo stesso in Redirect URLs.
3. Primo accesso con la propria email (crea l'utente), poi Authentication → Sign In / Providers →
   "Allow new users to sign up" OFF.
