# Piano — Collegamento esplicito pagamento → piano (sostituisce l'allocazione FIFO)

Data: 01/09/2026. Segue POL-FIN-002 (PR #75, mergiata) e l'audit fatto in sessione chat sulla PR #77. Da eseguire seguendo `runbook-sviluppo-sicuro.md` e `runbook-rls-nuove-tabelle.md`.

## 1. Problema

`public.payments` non ha mai avuto un collegamento al piano (`plans`) — solo a `paziente_id`. Quando un paziente ha più di un piano, `get_saldo_piano`/`get_saldi_aperti_studio` (POL-FIN-002) allocano i pagamenti del paziente ai piani con una regola **FIFO per data piano** (il più vecchio viene coperto per primo). Questa logica è stata validata solo su dati sintetici (`@electric-sql/pglite`), mai su un caso reale di paziente con più piani parzialmente pagati — è la fonte degli errori riscontrati.

`src/lib/domain/planPaymentAllocation.js` reimplementa la stessa logica FIFO lato client, solo per il testo di avviso alla rimozione di una prestazione — stesso problema, duplicato.

## 2. Decisione

Niente collegamento a livello di singola prestazione (un pagamento spesso copre più voci insieme — inutile complessità). Il collegamento va fatto **esplicitamente a livello di piano**, eliminando ogni logica di allocazione indovinata.

## 3. Modifica schema

```sql
ALTER TABLE public.payments ADD COLUMN piano_id uuid REFERENCES public.plans(id);
-- nullable: non rompe lo storico, i pagamenti vecchi restano piano_id = NULL finché non risolti (sezione 6)
```

Nessuna modifica a `plans`. RLS invariata (`payments` resta filtrata per `studio_id` come oggi) — la nuova colonna non introduce un nuovo vettore di accesso cross-studio, ma va comunque rilanciato `get_advisors(type: security)` dopo la migration per conferma esplicita.

## 4. Aggiornamento RPC

`get_saldo_piano(piano_id)` e `get_saldi_aperti_studio(studio_id)` (POL-FIN-002) passano da somma-con-allocazione-FIFO a somma diretta:

```sql
totale_pagato = SUM(payments.importo) WHERE payments.piano_id = p_piano_id AND payments.stato = 'pagato'
```

Rimuovere ogni riferimento alla logica FIFO in SQL. Eliminare `src/lib/domain/planPaymentAllocation.js` (o svuotarlo a stub se serve mantenere l'import per non rompere altri file, da verificare in review) — non serve più: il piano è già noto, non va più dedotto.

## 5. Punti di scrittura pagamento — assegnazione piano_id

Ogni form che oggi registra un pagamento deve valorizzare `piano_id`:

- **Completamento prestazione + "Registra pagamento adesso"** (Piani.jsx, SchedaPaz.jsx): il piano è già noto dal contesto (stai completando una voce di quel piano) → assegnazione automatica, nessuna scelta richiesta all'utente.
- **"Aggiungi da incassare"** (Incassi.jsx): il piano è già determinato dal flusso (piano più recente o piano contenitore appena creato) → assegnazione automatica.
- **Registrazione pagamento generica** (non partendo da una prestazione specifica, es. dalla scheda paziente sezione Pagamenti):
  - Paziente con **un solo piano attivo** → assegnazione automatica, nessuna scelta.
  - Paziente con **più piani attivi** → il form mostra un selettore piano obbligatorio prima di salvare. Niente inferenza silenziosa.

## 6. Dati storici (pagamenti già registrati, piano_id NULL)

- **Paziente con un solo piano** (a prescindere da quanti pagamenti storici ha) → migration di backfill automatico, sicuro: `UPDATE payments SET piano_id = (unico piano del paziente) WHERE paziente_id = ... AND piano_id IS NULL`. Nessuna ambiguità possibile.
- **Paziente con più piani** → **non toccare automaticamente**. Questi pagamenti restano `piano_id = NULL` e vanno esposti in una lista dedicata ("Pagamenti da assegnare") dentro la sezione Incassi o Controllo di Gestione, con un'azione rapida per assegnarli manualmente uno a uno. Finché `piano_id IS NULL`, quel pagamento **non entra** nel calcolo di `get_saldo_piano` per nessun piano (va escluso esplicitamente, non allocato a caso) — e va segnalato in un contatore visibile ("N pagamenti da assegnare, totale €X") così non spariscono silenziosamente dai conti.

## 7. Vincoli

- Nessuna cancellazione o perdita di pagamenti storici — solo assegnazione o stato "da assegnare" esplicito.
- Nessuna regressione su Studio Simondi: dopo la migration, confronto esplicito vecchio calcolo FIFO vs nuovo calcolo diretto su tutti i pazienti multi-piano reali dello studio, prima del merge.
- `get_advisors(security)` dopo la migration.
- Segue lo stesso branch/preview/test/merge del runbook; branch dedicato `feature/pagamenti-piano-esplicito`.

## 8. Messaggio operativo per la sessione Code

Lavoriamo sul repo GitHub lucasimondi/Dental-manager-claude (branch master). Prima verifica accesso push (git push --dry-run); se non funziona, fermati e dimmelo.

Crea il branch feature/pagamenti-piano-esplicito. Leggi in questo branch claude/piano-collegamento-pagamenti-piano.md (appena aggiunto) insieme a runbook-sviluppo-sicuro.md e runbook-rls-nuove-tabelle.md.

Sostituisci l'allocazione FIFO indovinata di POL-FIN-002 (payments non ha piano_id, i pagamenti di un paziente con più piani vengono allocati per data piano, mai validato su un caso reale) con un collegamento esplicito payments.piano_id come descritto nel documento, sezioni 3-7.

Passi: (1) migration additiva che aggiunge payments.piano_id nullable con FK a plans; (2) aggiorna get_saldo_piano/get_saldi_aperti_studio a somma diretta per piano_id, rimuovi la logica FIFO da SQL e da src/lib/domain/planPaymentAllocation.js; (3) ogni punto di scrittura pagamento assegna piano_id automaticamente quando il piano è già noto dal contesto (completamento prestazione, aggiungi da incassare), o chiede esplicitamente quale piano quando il paziente ha più piani attivi e il pagamento è generico; (4) migration di backfill automatico solo per pazienti con un unico piano; per pazienti con più piani, i pagamenti storici restano piano_id NULL, esclusi dai calcoli, esposti in una lista "Pagamenti da assegnare" con azione di assegnazione manuale e contatore visibile.

Vincoli: nessuna cancellazione di pagamenti; get_advisors(security) dopo la migration; confronto esplicito vecchio/nuovo calcolo sui pazienti multi-piano reali di Studio Simondi prima di proporre il merge; non toccare i file della PR #74 (già mergiata, non rilevante) né duplicare la UI Incassi già esistente — estendila.
