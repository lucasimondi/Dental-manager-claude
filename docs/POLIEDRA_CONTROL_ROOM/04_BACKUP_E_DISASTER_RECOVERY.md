# Backup e Disaster Recovery — Poliedra

## Sì: Poliedra deve avere backup separati dalla normale storia Git

Git non è un backup completo del sistema. La strategia deve coprire separatamente codice, database, Storage, configurazione e documentazione.

## 1. Codice e documentazione
Fonte primaria: GitHub.

Prevedere anche un mirror/export periodico indipendente del repository, incluse branches/tags importanti.

## 2. Database Supabase
Prevedere backup PostgreSQL secondo le possibilità del piano Supabase e/o export controllati.

I backup reali del database NON devono essere committati in GitHub se possono contenere dati personali, sanitari, Auth o segreti.

Conservazione: archivio cifrato, accesso limitato e retention definita.

## 3. Supabase Storage
I file caricati dagli utenti richiedono una strategia di backup separata dal database. Il database può contenere metadata/path senza contenere l'oggetto Storage stesso.

I file sanitari non devono essere copiati nel repository Git.

## 4. Schema/backend riproducibile
Versionare in Git:
- migrations;
- funzioni/RPC;
- trigger;
- RLS/policies;
- grants applicativi;
- dichiarazioni/configurazioni non segrete;
- Edge Function source;
- procedure di deploy/rollback.

## 5. Secrets
Mai nel repository e mai nei backup documentali in chiaro.

Mantenere un inventario dei nomi delle variabili necessarie, non dei valori segreti.

## 6. Disaster Recovery
Definire e testare periodicamente:
1. ripristino repository;
2. ricostruzione database/schema;
3. ripristino database da backup autorizzato;
4. ripristino Storage;
5. reiniezione secrets da vault/ambiente protetto;
6. deployment applicazione;
7. smoke test e test tenant/security;
8. verifica integrità e audit.

## 7. Backup della Control Room
La cartella `docs/POLIEDRA_CONTROL_ROOM/` è versionata in GitHub e deve essere inclusa nel mirror documentale del repository.

## Da implementare
- scegliere destinazione backup cifrata esterna a GitHub;
- definire frequenza e retention;
- verificare capacità di backup disponibili sul piano Supabase corrente;
- automatizzare quando possibile;
- creare test periodico di restore;
- documentare RPO/RTO target.

## Regola fondamentale
Un backup è considerato affidabile solo se è stato verificato almeno una volta tramite un restore controllato. Nessun backup contenente PHI/PII deve essere usato negli ambienti di test ordinari.