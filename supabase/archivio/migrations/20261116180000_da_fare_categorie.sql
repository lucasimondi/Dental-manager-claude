-- DA-FARE v2 (2026-11-16, Luca: "organizza meglio la sezione delle cose da fare ... cancellare, segnare
-- risolta, agire con mail di risposta"). Aggiunte idempotenti: categoria (per i filtri) e rimanda_al
-- (il promemoria sparisce dalla lista fino a quella data). Nessuna cancellazione: «Elimina» resta stato = 'rimosso'.
alter table promemoria_azioni add column if not exists categoria text;
alter table promemoria_azioni add column if not exists rimanda_al date;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'promemoria_azioni_categoria') then
    alter table promemoria_azioni add constraint promemoria_azioni_categoria
      check (categoria is null or categoria in ('soldi', 'legale', 'fisco', 'lavoro', 'famiglia'));
  end if;
end $$;
