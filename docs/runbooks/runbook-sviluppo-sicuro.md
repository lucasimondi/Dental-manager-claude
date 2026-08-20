# Runbook — Sviluppo sicuro Poliedra

Status: MANDATORY
Owner: Product / Engineering
Scope: tutti gli agenti e sviluppatori che modificano codice, schema, RLS, Supabase, dati finanziari o flussi sensibili.

## 1. Principio base
Poliedra usa il repository come unica fonte di verità operativa. Chat, memoria di un agente, sandbox o documenti esterni non possono sostituire il contenuto versionato nel repo.

Se un fatto necessario non è verificabile da repository, test o accesso read-only esplicitamente autorizzato, fermarsi e segnare `PRODUCT_OWNER_DECISION_REQUIRED`.

## 2. Pre-flight obbligatorio
Prima di modificare qualsiasi file:
1. leggere `AGENTS.md`;
2. leggere `docs/POLIEDRA_MASTER_CONTEXT.md`;
3. leggere `docs/coordination/current-task.md`;
4. leggere i documenti architetturali pertinenti;
5. leggere l'ultimo handoff;
6. se il task tocca Supabase/schema/RLS, leggere anche `docs/runbooks/runbook-rls-nuove-tabelle.md`;
7. verificare branch corrente e base rispetto a `origin/master`;
8. verificare `git status` e diff esistente;
9. dichiarare scope e non-goal prima di scrivere codice.

## 3. Branch e ownership
- Mai lavorare direttamente su `master`/`main`.
- Un solo agente possiede un task alla volta.
- Ogni task deve avere branch dedicato e task ID.
- Nessun merge senza approvazione esplicita del Product Owner.
- Nessun deploy manuale in produzione per compensare una migration mancante.

## 4. Regole non negoziabili
- Mai stampare, copiare o committare secret, service-role key, password DB, token o dati paziente reali.
- Mai disabilitare o indebolire RLS per far passare un test.
- Mai introdurre fallback tenant.
- Mai inventare tabelle, colonne, RPC, policy o stato della produzione.
- Mai duplicare formule finanziarie canoniche nel client.
- Mai usare dati di produzione nei test.
- Mai fare refactor non correlati dentro un task di sicurezza/schema.
- Ogni change deve avere rollback comprensibile.
- Fail closed se tenant, ruolo o autorizzazione non sono determinabili.

## 5. Metodo di sviluppo
Per ogni modifica sensibile:
1. **Evidence** — identificare file, schema o contratto esistente che giustifica la modifica.
2. **Design** — scrivere in breve cosa cambia e cosa resta invariato.
3. **Minimal change** — implementare il minimo necessario.
4. **Tests** — aggiungere test di regressione prima del merge.
5. **Security review** — verificare tenant isolation, privilege escalation, direct-object access e service-role leakage.
6. **Diff review** — `git diff --check`, controllo file inattesi e pattern secret.
7. **Build/test** — eseguire suite proporzionata al rischio.
8. **Handoff** — registrare risultato, rischi residui e next action.

## 6. Database e migration
Ogni modifica DB deve essere una migration versionata e idempotente dove applicabile.

La migration deve contenere insieme, quando pertinenti:
- DDL;
- vincoli e FK;
- indici;
- RLS;
- grant/revoke;
- funzioni helper;
- trigger;
- commenti essenziali.

I test SQL corrispondenti devono vivere nello stesso task/PR.

Non modificare retroattivamente una migration già applicata in produzione: creare una nuova migration correttiva.

## 7. Verifica locale prima della produzione
Prima di qualsiasi gate produzione:
- applicare migration su ambiente locale/pulito;
- eseguire test SQL multi-tenant;
- eseguire test applicativi pertinenti;
- eseguire build;
- verificare che una failure di autorizzazione fallisca chiusa;
- verificare che un utente autorizzato funzioni senza service-role nel client.

## 8. Dati reali / produzione
Accesso produzione ammesso solo se il Product Owner lo autorizza esplicitamente e preferibilmente in read-only.

Per audit produzione:
- usare solo metadati o aggregati necessari;
- non esportare cartelle cliniche o PII;
- non copiare dump in locale;
- non correggere manualmente righe per rendere verde un test;
- documentare query e risultato rilevante senza secret.

## 9. QA live
Una modifica non è considerata validata solo perché build e test passano se il requisito è visuale o dipende da runtime.

Per QA live registrare:
- ambiente e commit;
- percorso testato;
- esito;
- errori console/network pertinenti;
- differenze tra mobile e desktop quando rilevanti.

Se il sandbox non può raggiungere Supabase/Vercel, dichiarare `LIVE_QA_REQUIRED` invece di simulare un esito.

## 10. Definition of Done
Un task sensibile può essere presentato al Product Owner solo con:
- scope rispettato;
- test verdi;
- build verde;
- diff pulito;
- nessun secret;
- impatto DB/RLS dichiarato;
- rollback dichiarato;
- handoff aggiornato;
- eventuale `LIVE_QA_REQUIRED` esplicito.

## 11. Stop conditions
Fermarsi immediatamente se:
- manca una specifica necessaria;
- due documenti autorevoli sono in conflitto;
- esistono due modelli autorizzativi concorrenti non riconciliati;
- il fix richiede bypass RLS;
- il task richiede dati reali non accessibili;
- il branch contiene modifiche non spiegate.

In questi casi usare `STATUS: WAITING` e indicare esattamente il dato/decisione necessaria per ripartire.
