# Runbook — RLS per nuove tabelle Poliedra

Status: MANDATORY
Scope: ogni nuova tabella, view, RPC o funzione che espone dati tenant-scoped o clinici in Supabase/Postgres.

## 1. Obiettivo
Garantire che nessun nuovo oggetto DB introduca accesso cross-tenant, privilege escalation o dipendenza dal client per la sicurezza.

## 2. Requisiti minimi per ogni nuova tabella tenant-scoped
Ogni tabella deve avere, salvo motivazione documentata:
- `studio_id` NOT NULL;
- FK verso `public.studios(id)` o FK composita verso entità già tenant-scoped;
- RLS abilitata;
- `REVOKE ALL` da `PUBLIC` e `anon`;
- grant solo ai ruoli realmente necessari;
- policy separate per SELECT / INSERT / UPDATE / DELETE;
- controllo server-side dell'identità tramite `auth.uid()`;
- nessun tenant fallback derivato dal client.

Se esiste `created_by`, gli INSERT devono normalmente richiedere `created_by = auth.uid()` salvo flusso server-side esplicitamente progettato.

## 3. Modello di policy
Le policy devono dipendere da funzioni/capability autorevoli già definite nel progetto, non da job title o valori inviati dal frontend.

Pattern concettuale:

```sql
ALTER TABLE public.example ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.example FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.example TO authenticated;

CREATE POLICY example_select
ON public.example FOR SELECT TO authenticated
USING (private.authorized_for_studio(studio_id, 'read'));

CREATE POLICY example_insert
ON public.example FOR INSERT TO authenticated
WITH CHECK (
  private.authorized_for_studio(studio_id, 'write')
  AND created_by = (SELECT auth.uid())
);
```

Il nome della funzione è solo illustrativo: usare esclusivamente funzioni realmente presenti e approvate nel repo.

## 4. Vincoli tenant a livello relazionale
RLS non sostituisce i vincoli.

Quando un record figlio appartiene a un parent tenant-scoped, preferire FK composite del tipo:

```sql
FOREIGN KEY (studio_id, parent_id)
REFERENCES public.parent(studio_id, id)
```

Questo impedisce anche a codice privilegiato o bug applicativi di collegare record tra tenant diversi.

Quando una tabella esistente non supporta FK composita, aggiungere un trigger di validazione solo se necessario e documentato.

## 5. SECURITY DEFINER
Usare `SECURITY DEFINER` solo quando strettamente necessario.

Ogni funzione `SECURITY DEFINER` deve:
- avere `SET search_path TO ''` o search_path esplicito e sicuro;
- referenziare oggetti con schema qualificato;
- non fidarsi di `studio_id` inviato dal client senza validazione di membership/capability;
- avere grant/revoke espliciti;
- non esporre service-role o segreti;
- essere coperta da test negativi.

## 6. Simulazione JWT / multi-tenant
I test devono verificare il comportamento come utenti autenticati distinti. Non basta eseguire query come owner del database.

Usare utenti sintetici e tenant sintetici, mai dati reali.

Per ogni tabella sensibile creare almeno:
- `tenant_a`;
- `tenant_b`;
- `user_a_authorized`;
- `user_a_unauthorized` o ruolo limitato;
- `user_b_authorized`.

Il test deve impostare il contesto JWT/PostgREST usando il meccanismo già adottato dalla suite Supabase locale del repository. Se il repository usa `set_config('request.jwt.claims', ...)`, il pattern è concettualmente:

```sql
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', user_uuid::text,
    'role', 'authenticated'
  )::text,
  true
);
SET LOCAL ROLE authenticated;
```

Non copiare questo frammento ciecamente: prima cercare nei test SQL esistenti il pattern effettivamente usato dalla versione locale di Supabase/Postgres.

### Casi obbligatori
1. utente autorizzato legge il proprio tenant;
2. utente tenant A non legge tenant B;
3. utente tenant A non inserisce con `studio_id` di tenant B;
4. utente non autorizzato non aggiorna record altrui;
5. utente non autorizzato non elimina;
6. spoof di `created_by` fallisce;
7. FK cross-tenant fallisce;
8. capability mancante fallisce chiusa;
9. ruolo sospeso/inattivo non ottiene accesso;
10. admin/owner ottiene solo i privilegi esplicitamente previsti.

## 7. Tabelle cliniche
Per dati clinici applicare ulteriori regole:
- accesso non derivato automaticamente dal semplice fatto di appartenere allo studio;
- distinguere read, write, finalize e document access dove il modello lo richiede;
- note finalizzate immutabili salvo amendment controllato;
- audit trail append-only o comunque non modificabile dal client;
- PT, massaggiatore, front desk o altri collaboratori non ricevono automaticamente accesso clinico completo.

## 8. Audit table
Una tabella audit deve normalmente:
- essere scritta solo da trigger/funzioni server-side;
- non concedere INSERT/UPDATE/DELETE al client autenticato;
- consentire SELECT solo a chi ha capability pertinente;
- registrare actor, timestamp, entity, action e stato essenziale senza duplicare dati sensibili non necessari.

## 9. Sequenze
Se si usano identity/sequence e gli utenti authenticated devono inserire, verificare grant di `USAGE, SELECT` sulle sequenze necessarie. Non usare grant globali indiscriminati.

## 10. Validation checklist
Prima del merge:
- migration applicata su database locale pulito;
- tutte le nuove tabelle hanno RLS;
- nessuna policy usa solo un valore client-side come autorizzazione;
- cross-tenant SELECT/INSERT/UPDATE/DELETE testati negativamente;
- test con ruolo/capability limitata;
- test idempotenza dove applicabile;
- `supabase db lint` / controlli equivalenti eseguiti se disponibili;
- build applicativa verde;
- diff controllato;
- nessuna modifica produzione.

## 11. Produzione
Una migration RLS/schema non va applicata in produzione finché:
- PR non è approvata;
- modello autorizzativo non è univoco;
- test locali non sono verdi;
- rollback/forward-fix è definito;
- eventuale backfill è separato e verificabile;
- Product Owner ha dato gate esplicito.

## 12. Regola specifica Physio
Al momento del documento, il ramo POL-FIS-001 contiene un modello `physio_clinical_access_v1` indipendente dal modello RBAC autorevole già presente su master (`studio_user_capabilities` / patient care assignments). Questa duplicazione è un conflitto architetturale noto.

Nessun agente deve applicare o mergiare RLS Physio in produzione finché il modello unico autorevole non è stato deciso e documentato.

Se il task incontra questo conflitto: `PRODUCT_OWNER_DECISION_REQUIRED` + `STATUS: WAITING`.
