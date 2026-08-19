-- POL-003F synthetic-only extension to pol_003b_local_bootstrap.sql.
-- This file models only verified legacy columns used by the adapter.
ALTER TABLE public.spese
  ADD COLUMN ricorrente boolean,
  ADD COLUMN frequenza text,
  ADD COLUMN data_fine date;

CREATE TABLE public.personale (
  id bigint PRIMARY KEY,
  studio_id uuid NOT NULL,
  costo_mensile numeric NOT NULL,
  attivo boolean NOT NULL,
  data_inizio date
);

CREATE TABLE public.macchinari (
  id bigint PRIMARY KEY,
  studio_id uuid NOT NULL,
  costo_acquisto numeric NOT NULL,
  data_acquisto date NOT NULL,
  anni_ammortamento integer NOT NULL,
  attivo boolean NOT NULL
);

CREATE TABLE public.studio_info (
  studio_id uuid PRIMARY KEY,
  config_orario jsonb
);

CREATE TABLE public.appointments (
  id bigint PRIMARY KEY,
  studio_id uuid,
  data date,
  stato text,
  durata integer
);
