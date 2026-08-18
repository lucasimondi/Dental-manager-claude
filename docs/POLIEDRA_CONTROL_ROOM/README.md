# POLIEDRA CONTROL ROOM

Questa cartella è l'indice documentale centrale del progetto Poliedra per Product Owner, Tech Lead, Codex e Claude Code.

## Obiettivo

Mantenere in un unico punto la visione del progetto, la roadmap, lo stato operativo, le decisioni e la strategia di backup/disaster recovery.

## Indice

- `01_STRUTTURA_SQUADRA.md` — ruoli, responsabilità e coordinamento degli agenti.
- `02_ROADMAP_MASTER.md` — roadmap tecnica e prodotto ad alto livello.
- `03_STATO_PROGETTO.md` — fotografia sintetica dello stato corrente.
- `04_BACKUP_E_DISASTER_RECOVERY.md` — cosa salvare, dove e cosa NON mettere in Git.

## Fonti operative già presenti nel repository

Questa Control Room non sostituisce i documenti operativi esistenti. Gli agenti devono continuare a seguire `AGENTS.md`, `CLAUDE.md`, `docs/coordination/current-task.md`, `docs/coordination/handoffs.md` e la documentazione architetturale.

## Regola

GitHub conserva codice, configurazioni non segrete, migrations, documentazione e procedure. Backup contenenti dati reali, credenziali, dati sanitari o dump grezzi NON devono essere committati nel repository.