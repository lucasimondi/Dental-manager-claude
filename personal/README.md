# Poliedron Personal (POL-VITA-001)

App separata dall'app dello studio, collegata solo al progetto Supabase `archivio-documenti`
(`tkcwvjzjkfhcuebrjvsp`). Decisione PO 2026-10-13: stesso repository, app distinta, accesso con email e password (il link via email richiede impostazioni di Supabase Auth non modificabili da qui).

- Nessun codice, chiave o service worker dell'app dello studio (verificato da `tests/poliedronPersonal.test.mjs`).
- Core deterministico (`src/lib/coreArchivio.js`), nessun modello AI: "Quanto devo a Edison?", "Scadenze di questo mese",
  "Cosa devo fare?", "Bollette", "Le mie pratiche", "pratica Edison", ricerca libera.
- Azioni: scadenza pagata, pratica risolta, cancellazione definitiva del documento (`elimina_documento`).
- I documenti li carica Cowork (Gmail → Drive → `registra_documento`).

## Dove gira

Entry della build principale, sullo stesso sito dell'app dello studio: **`/personal/`** (come `/poliedron/`).
Creare un progetto Vercel separato non è stato possibile (403: permesso negato al connettore).
Dati, chiavi e login restano quelli del solo progetto `archivio-documenti`; la sessione è salvata con una chiave propria.
Accesso con email e password ("Crea l'accesso" la prima volta, poi conferma dal link nell'email).

## Comandi

```sh
npm run dev:personal     # http://localhost:5174/personal/
npm run build            # include /personal/ in dist/
```
