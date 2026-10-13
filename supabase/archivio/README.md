# Archivio personale (POL-VITA-001)

Progetto Supabase **separato** `archivio-documenti` (`tkcwvjzjkfhcuebrjvsp`, eu-central-1),
decisione del PO del 2026-10-12. Non è il progetto dello studio: queste migrazioni **non**
vanno mai applicate alla produzione di Poliedra e non stanno in `supabase/migrations/`.

- `migrations/20261012201509_schema_archivio_documenti.sql` — schema creato da Cowork,
  copiato parola per parola dal database (base approvata dal PO il 2026-10-13).
- `migrations/20261013090000_pol_vita_001_sicurezza_e_cancellazione.sql` — proprietario
  legato a un utente reale con email confermata, registrazioni chiuse ad altre email,
  niente accesso `anon`, cancellazione definitiva (`elimina_documento`, `elimina_pratica`),
  correzione di `registra_documento`. Rollback nell'intestazione.

Originali dei documenti: su Google Drive (`drive_file_id`). Le funzioni di cancellazione
restituiscono gli id dei file Drive: chi le chiama li deve cancellare da Drive.

## Test locale (PostgreSQL 16 usa e getta)

```sh
psql -d <db_vuoto> -f tests/bootstrap_locale.sql
for f in migrations/*.sql; do psql -v ON_ERROR_STOP=1 -d <db_vuoto> -f "$f"; done
psql -d <db_vuoto> -f tests/archivio_rls_cancellazione.sql   # stampa "tutti i test superati"
```

`bootstrap_locale.sql` imita ruoli, schema `auth` e privilegi predefiniti di Supabase: mai
su un progetto reale.
