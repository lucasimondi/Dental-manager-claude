# POLIEDRA PHYSIO — Schema Source of Truth

Status: DRAFT_FROM_REPOSITORY_EVIDENCE
Scope: schema e contratti del verticale fisioterapia attualmente documentati nel repository.

## 1. Fonte
Questo documento non ricostruisce chat Claude. Riassume esclusivamente evidenza versionata presente nel repository e nella PR #14 `POL-FIS-001`.

La specifica clinica approvata descrive: episodi di cura, assessment iniziale, body map, esame obiettivo, outcome, problem list, goals, treatment plan, session note, reassessment, discharge, timeline, collaboratori, agenda, documenti e AI guardrail.

## 2. Nota importante sul numero delle tabelle
Nel materiale repository ispezionato non esiste evidenza affidabile di una specifica definitiva composta da **esattamente 7 tabelle**.

La migration attualmente proposta in PR #14 crea invece:
- 1 tabella capability/accesso;
- 8 tabelle cliniche principali;
- 1 tabella audit.

Totale: 10 nuove tabelle.

Pertanto nessun agente deve affermare che "lo schema concordato è di 7 tabelle" senza una fonte aggiuntiva. Se esiste una precedente decisione di Product Owner sulle 7 tabelle, va importata nel repository e questo documento va aggiornato prima di applicare migration in produzione.

## 3. Tabelle proposte nella PR #14

### 3.1 `physio_clinical_access_v1`
Capability cliniche per utente e studio.
Campi chiave:
- `studio_id`;
- `user_id`;
- `professional_role`;
- `clinical_read`;
- `clinical_write`;
- `clinical_finalize`;
- `clinical_documents`.

**ATTENZIONE:** questo modello è attualmente in conflitto con il modello RBAC autorevole già presente su master. Non è autorizzato come secondo sistema indipendente in produzione.

### 3.2 `physio_episodes_v1`
Boundary dell'episodio di cura.
Contiene:
- paziente;
- titolo/problema primario;
- regione corporea;
- eventuale referto diagnostico;
- stato draft/active/paused/completed/cancelled;
- date inizio/fine;
- responsabile;
- autore.

Vincolo fondamentale: il paziente deve appartenere allo stesso `studio_id`.

### 3.3 `physio_anamneses_v1`
Assessment/anamnesi iniziale per episodio, uno-a-uno nella vertical slice attuale.
Include motivo consulto, complaint, esordio, trend, trauma, precedenti, storia clinica, comorbidità, chirurgia, esami, farmaci, allergie, attività, limitazioni, fattori aggravanti/allevianti, aspettative e red flags.

### 3.4 `physio_body_maps_v1`
Snapshot append-only della body map.
Campi chiave:
- vista front/back/left/right;
- markers JSON;
- drawing JSON;
- note;
- timestamp/autore.

### 3.5 `physio_problems_v1`
Problem list dell'episodio.
Include descrizione, regione, priorità, stato, date rilevazione/risoluzione e note.

### 3.6 `physio_goals_v1`
Obiettivi del paziente e terapeutici.
Include:
- link opzionale al problema;
- tipo patient/therapeutic;
- orizzonte short/medium/long;
- descrizione;
- stato;
- target date;
- note.

### 3.7 `physio_plan_versions_v1`
Versioni append-only del piano di trattamento.
Include obiettivi, strategia, tecniche, frequenza, durata, data rivalutazione, responsabile, collaboratori, home program note e note libere.

### 3.8 `physio_clinical_notes_v1`
Note cliniche/sessioni/reassessment/discharge.
Tipi:
- free_note;
- assessment;
- session;
- reassessment;
- discharge.

Stati:
- draft;
- finalized;
- amendment.

Regola: note finalizzate/amendment immutabili; una correzione avviene tramite nuovo amendment controllato.

### 3.9 `physio_outcomes_v1`
Outcome measures per baseline, reassessment e discharge.
Contiene identificatore/nome scala, punteggio raw/normalized, unità e nota clinica.

### 3.10 `physio_clinical_audit_v1`
Audit trail server-side.
Registra studio, tabella, entity, action, actor, timestamp e cambio stato essenziale.
Il client autenticato deve avere al massimo SELECT autorizzato, non scrittura diretta.

## 4. Concetti approvati non ancora completamente rappresentati nella vertical slice
La specifica prodotto include anche concetti che non vanno inventati come nuove tabelle senza un task dedicato:
- misurazioni/esame obiettivo configurabile;
- exercise library;
- home program;
- care team / handoff;
- attachments privati;
- reassessment/discharge UX completa;
- integrazione agenda profonda;
- patient app;
- AI/voice avanzata.

## 5. Regole cliniche approvate
- Un paziente può avere episodi indipendenti nel tempo.
- Le note devono essere veloci da compilare su desktop/tablet/mobile.
- Il copia-da-precedente richiede conferma esplicita; mai propagare automaticamente findings clinici.
- Finalizzazione esplicita.
- Note finalizzate read-only salvo amendment.
- Ogni modifica clinica storicamente tracciabile.
- AI può proporre/sintetizzare, ma non creare silenziosamente diagnosi, findings, misure o trattamenti eseguiti.
- Dati finanziari restano nel motore canonico POL-003, mai duplicati nel verticale.

## 6. Modello autorizzativo — BLOCCO ATTUALE
Master contiene già un modello RBAC tenant-scoped autorevole basato su capability e assegnazioni paziente.
La PR #14 introduce `physio_clinical_access_v1` e helper `private.pol_fis_001_has_capability()` indipendenti.

Questi due sistemi non devono convivere come fonti di autorizzazione concorrenti.

### Decisione richiesta prima del merge schema
Il Product Owner/architecture deve definire un unico modello, preferibilmente riusando l'RBAC autorevole di master e applicando capability/assignment per-paziente alle entità Physio.

Fino a tale decisione:
- no merge della migration Physio in master;
- no deploy Supabase produzione;
- no bypass;
- `STATUS: WAITING` per task che richiedono la scelta.

## 7. Test minimi richiesti
Prima di autorizzare lo schema:
- due tenant sintetici;
- physio autorizzato;
- physio non assegnato/limitato;
- PT;
- massage therapist;
- front desk;
- owner/admin non clinico dove previsto;
- utente sospeso;
- tentativi cross-tenant SELECT/INSERT/UPDATE/DELETE;
- finalization autorizzata/non autorizzata;
- amendment valido/non valido;
- immutabilità body map, plan version e outcomes append-only;
- audit non scrivibile direttamente dal client.

## 8. Prossimo passo corretto
Prima di riprendere il lavoro Supabase sul verticale:
1. leggere `runbook-sviluppo-sicuro.md`;
2. leggere `runbook-rls-nuove-tabelle.md`;
3. leggere questo documento;
4. confrontare PR #14 con RBAC master corrente;
5. proporre una sola architettura autorizzativa;
6. fermarsi per Product Owner approval prima di modificare la migration.
