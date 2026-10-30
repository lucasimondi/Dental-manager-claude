# Poliedron Personal ↔ ChatGPT — integrazione sicura (work branch)

Stato: **non attiva**. Nessuna modifica alla produzione.

## Sistemi verificati
- Poliedron Personal: `https://personal.poliedrasoft.it/`
- Repository applicativo: `lucasimondi/Dental-manager-claude`
- Archivio canonico: Supabase `tkcwvjzjkfhcuebrjvsp`, tabelle `documenti`, `pratiche`, `scadenze`; originali su Google Drive `Archivio personale`.
- Flusso esistente di upload: `personal/README.md`, Apps Script `poliedron/archivio/Code.gs`, azione `doPost`, `registra_documento`.
- Il plugin ChatGPT `poliedron-personale` ha solo skill e manifest, **nessun tool MCP**.
- La Edge Function `poliedron-documents` salva su Storage privato e tabella `poliedron_documenti_personali`: **non** coincide con l'archivio canonico. Non usarla per importazioni nel sistema principale.

## Contratto di integrazione
Creare un **remote MCP server** HTTPS separato, collegato al plugin/App di ChatGPT, con autorizzazione OAuth 2.1 per utente e verifica lato server delle autorizzazioni. La sessione browser del telefono non deve essere riutilizzata né copiata.

Strumenti MCP previsti:
1. `search_documents(query, fascicolo?, limit?)`: ricerca metadata nell'archivio canonico, esclusi `clinico_pazienti` per qualunque uso LLM.
2. `get_document(id)`: metadata e link Drive solo per il proprietario, mai contenuto clinico.
3. `prepare_archive(filename, mime_type, metadata)`: determina fascicolo/persona/pratica, controlla hash duplicato e produce una proposta senza scritture.
4. `archive_document(file_reference, approved_metadata)`: importa l'originale su Drive tramite flusso server autorizzato, esegue `registra_documento` e restituisce ID, URL Drive e fascicolo. La scrittura richiede conferma esplicita; evitare file URL arbitrari (SSRF).
5. `link_document_to_case(document_id, pratica_id)`: associa una pratica esistente con verifica di proprietà e audit.

## Sicurezza obbligatoria
- OAuth authorization code + PKCE; token a breve durata, audience e scope specifici, revoca e refresh sicuri.
- Autorizzazione per singola richiesta, utente da identità verificata (mai dal body). RLS e `e_proprietario()` preservate.
- Segreti esclusivamente server-side, mai GitHub, plugin skill, browser o chat.
- Non esporre file dei pazienti o dati clinici a modelli; nessuna condivisione pubblica di Drive.
- Idempotenza con SHA-256 e `gmail_message_id` dedicato; niente duplicazioni su Drive.
- Errori parziali: compensazione o coda di riconciliazione; non dichiarare riuscita se manca la riga Supabase o il file Drive.
- Audit di ogni scrittura senza dati sensibili; rate limit; dimensione e MIME ammessi; no cancellazioni automatiche.
- Non modificare `DentalManager` (progetto clinico), solo l'archivio personale.

## Prima dell'attivazione
1. Identificare come aggiungere un MCP server/App al plugin esistente: una skill da sola non può aggiungere tool.
2. Implementare server OAuth/MCP e collegamento all'Apps Script o a un servizio Drive con identità delegata.
3. Verificare in staging con documento fittizio: autorizzazione negata senza login; ricerca; upload; hash duplicato; fascicolo; link Drive; gestione fallimenti.
4. Collegare in ChatGPT tramite il flusso di autorizzazione ufficiale, senza chiedere password/token in chat.
5. Eseguire test end-to-end e solo allora marcare la connessione attiva.

Non attivare un endpoint con token statico o anonimo come scorciatoia.
