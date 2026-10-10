# WhatsApp Business (Meta) — attivazione e modelli dei promemoria

Operatore: Product Owner (unico gestore della App Meta della piattaforma).
Stato al 2026-09-30: codice pronto per la ricezione e la risposta ai messaggi (POL-WA-001/002).
Aggiornamento POL-WA-003b: il codice dei promemoria automatici è pronto. Usa il modello
`promemoria_appuntamento` qui sotto (nome modificabile dal super admin in Impostazioni →
WhatsApp Business); finché Meta non lo approva, gli invii finiscono in errore e restano
visibili in `whatsapp_promemoria`. Questa pagina prepara la parte Meta, che richiede
giorni di approvazione e si può avviare in parallelo.

## Perché servono i modelli

WhatsApp permette testo libero solo entro 24 ore dall'ultimo messaggio del paziente.
Un promemoria lo scrive lo studio per primo, quindi deve usare un **modello (template)
approvato da Meta**, categoria **Utility** (messaggi di servizio legati a un appuntamento,
non promozionali).

## Passaggi nel pannello Meta (una sola volta per tutta la piattaforma)

1. **Meta Business Manager** (business.facebook.com): verifica dell'azienda
   (Impostazioni → Centro sicurezza → Verifica). Senza verifica i limiti di invio restano bassi.
2. **App Meta** (developers.facebook.com → Le mie app): una sola App di tipo Business con il
   prodotto **WhatsApp** aggiunto. È la stessa per tutti gli studi.
3. **Utente di sistema e token permanente**: Business Manager → Utenti → Utenti di sistema →
   crea un utente Admin, assegna l'App e il WhatsApp Business Account, genera un token con
   permessi `whatsapp_business_messaging` e `whatsapp_business_management`.
   Il token temporaneo della pagina "API Setup" scade dopo 24 ore: non usarlo.
4. **Secret su Supabase** (Dashboard → Edge Functions → Secrets), nomi esatti:
   - `WHATSAPP_ACCESS_TOKEN`: il token permanente del punto 3
   - `WHATSAPP_APP_SECRET`: App → Impostazioni → Base → Chiave segreta dell'app
   - `WHATSAPP_VERIFY_TOKEN`: una stringa lunga casuale scelta da te, da ripetere al punto 5
   - `ANTHROPIC_API_KEY`: già usato dalle altre funzioni AI, da verificare che ci sia
5. **Webhook**: App → WhatsApp → Configurazione → Webhook
   - URL di callback: `https://dental-manager-git-master-acmeproduction.vercel.app/api/whatsapp-webhook`
     (se il prodotto ha un dominio personalizzato, usare quello con lo stesso percorso)
   - Token di verifica: lo stesso valore di `WHATSAPP_VERIFY_TOKEN`
   - Dopo "Verifica e salva", sottoscrivere i campi **messages** e **smb_message_echoes**.
     `smb_message_echoes` (Coexistence) avvisa quando lo staff scrive dal telefono con
     WhatsApp Business: senza, l'assistente non si mette in pausa e risponde sopra lo staff.
     `history` e `smb_app_state_sync` oggi non sono usati dal codice (si possono lasciare spenti).
6. **Modelli**: WhatsApp Manager → Modelli di messaggio → Crea modello, con i testi qui sotto.
7. **Tech Provider**: per collegare i numeri degli studi con Coexistence (sotto) l'App deve
   usare l'Embedded Signup di Meta: App → Aggiungi prodotto → *Facebook Login for Business*,
   configurazione di tipo WhatsApp Embedded Signup, e registrazione dell'App come
   **Tech Provider** (developers.facebook.com → la tua App → WhatsApp → onboarding Tech Provider).
   Richiede la verifica dell'azienda (punto 1) e una revisione dell'App da parte di Meta.

## Per ogni studio che attiva il modulo

1. **Numero dello studio con Coexistence** (disponibile in tutta l'UE, Italia compresa):
   lo studio **continua a usare WhatsApp Business sul telefono** e lo stesso numero viene
   collegato anche all'API. Requisiti: app **WhatsApp Business** (non WhatsApp personale),
   versione 2.24.17 o successiva. Il collegamento si fa con l'Embedded Signup (login Meta +
   QR code dal telefono), che POL-WA-003 porterà dentro Impostazioni come pulsante
   "Collega WhatsApp". Limiti noti da verificare sulla documentazione Meta prima dello
   sviluppo: gruppi e alcune funzioni restano solo sul telefono; throughput ridotto;
   l'app sul telefono va aperta periodicamente per restare collegata.
   Alternativa senza Coexistence: numero dedicato solo all'API (non più usabile dal telefono).
2. Fino al pulsante di POL-WA-003: copiare il **Phone Number ID** (non il numero di telefono).
3. Attivare il modulo sullo studio (super admin, SQL dal dashboard):
   `update studios set feature_overrides = coalesce(feature_overrides,'{}'::jsonb) || '{"whatsapp_automatico": true}' where id = '<studio_id>';`
4. Collegare il numero: da Impostazioni → WhatsApp Business, loggati come super admin
   in quello studio; per un altro studio, inserire la riga in `whatsapp_config` dal dashboard.
5. Prova: scrivere dal proprio telefono al numero dello studio, controllare che arrivi la
   risposta e che compaiano due righe (`in`/`out`) in `whatsapp_messages`.

## Modelli proposti (lingua: Italiano `it`, categoria: Utility)

Regole Meta rispettate: il testo non inizia né finisce con una variabile, niente
variabili adiacenti, ogni variabile ha un esempio.

### `promemoria_appuntamento`

Corpo:

> Gentile {{1}}, le ricordiamo il suo appuntamento presso {{2}} per {{3}} alle ore {{4}}.
> Se non può venire, ci avvisi rispondendo a questo messaggio o chiamando lo studio. Grazie.

Esempi da inserire: `{{1}}` = Mario Rossi · `{{2}}` = Studio Dentistico Bianchi ·
`{{3}}` = domani, giovedì 2 ottobre · `{{4}}` = 10:30

Pulsanti di risposta rapida: **Confermo** · **Devo spostarlo**

Piè di pagina (facoltativo): `Messaggio automatico dello studio`

### `promemoria_appuntamento_breve` (alternativa senza nome del paziente)

> Promemoria: appuntamento presso {{1}} per {{2}} alle ore {{3}}.
> Per spostarlo risponda a questo messaggio o chiami lo studio.

Utile se in anagrafica il nome non è affidabile. Stessi pulsanti.
**Attenzione**: il codice di POL-WA-003b invia sempre 4 parametri (nome, studio, quando, ora),
quindi oggi funziona solo con `promemoria_appuntamento`. Usare la variante breve richiede
una modifica al codice.

## Consenso dei pazienti

Meta e il GDPR richiedono che il paziente abbia accettato di ricevere messaggi WhatsApp
dallo studio. Decisione del Product Owner (POL-WA-003a): **in anagrafica**. Da POL-WA-003b
la scheda paziente ha la casella "Acconsente a ricevere messaggi WhatsApp dallo studio"
(con data); i promemoria partono solo per chi l'ha spuntata. Di default è spenta.


## POL-WA-003d — Embedded Signup / Coexistence

Poliedra now has a self-service **Collega WhatsApp Business** flow. Do not migrate or
disconnect a number that must remain usable in the WhatsApp Business mobile app.

Meta setup required before enabling the button in production:

1. In the Meta app create an **Embedded Signup configuration** for WhatsApp Business App
   onboarding / Coexistence and note its Configuration ID.
2. Configure the production domain in the Meta app and complete the permissions/review
   Meta requires for Embedded Signup.
3. Vercel browser env: `VITE_META_APP_ID`, `VITE_META_WHATSAPP_CONFIG_ID`.
4. Vercel server-only env: `META_APP_ID`, `META_APP_SECRET`, `SUPABASE_ANON_KEY`,
   `SUPABASE_URL` (optional: code defaults to the production project URL).
5. Never put `META_APP_SECRET` or a permanent WhatsApp access token in a VITE_ variable.
6. The callback exchanges Meta's one-time code server-side and writes WABA/Phone Number ID
   through Supabase using the signed-in user's JWT, so existing RLS remains the authority.

After Meta returns the IDs, the callback calls `POST /{waba_id}/subscribed_apps` with
the business token from the code exchange: without this subscription Meta delivers none
of that number's webhooks. If Meta refuses, nothing is saved and the user retries.
The app-level webhook fields `messages` and `smb_message_echoes` (step 5 above) must
also be on.

The signup UI requests `featureType: whatsapp_business_app_onboarding` and listens only
to Meta origins for `WA_EMBEDDED_SIGNUP` session events. If Meta does not return both IDs,
the callback fails closed rather than guessing/attaching the wrong number.
