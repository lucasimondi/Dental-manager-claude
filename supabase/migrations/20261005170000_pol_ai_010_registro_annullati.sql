-- POL-AI-010 step 2c (Product Owner, 2026-10-05): "Non rimane in agenda ma ci sarà
-- traccia di attività poliedron con elenco di tutto ciò che ha fatto" and "quando
-- non vengono rifissati vanno nei richiami da fare".
--
-- 1. poliedron_attivita: what Poliedron did, readable by the studio's active
--    members. A row can only be written by the user who claimed that exact action
--    (same id as poliedron_action_claims), never updated or deleted.
-- 2. A cancelled appointment whose patient has no other upcoming appointment
--    becomes a recall "da rifissare"; it closes by itself as soon as the patient
--    is booked again (any source: app, Poliedron, WhatsApp). Never blocks the
--    appointment write itself.
BEGIN;

CREATE TABLE public.poliedron_attivita (
  id uuid NOT NULL,
  studio_id uuid NOT NULL REFERENCES public.studios(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  azione text NOT NULL CHECK (char_length(azione) BETWEEN 1 AND 60),
  riepilogo text NOT NULL CHECK (char_length(riepilogo) BETWEEN 1 AND 4000),
  tabella text CHECK (tabella IN ('appointments', 'patients', 'richiami', 'todos', 'impegni_personali')),
  record_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, studio_id, id),
  FOREIGN KEY (user_id, studio_id, id) REFERENCES public.poliedron_action_claims(user_id, studio_id, id)
);
CREATE INDEX poliedron_attivita_studio_created ON public.poliedron_attivita (studio_id, created_at DESC);
ALTER TABLE public.poliedron_attivita ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.poliedron_attivita FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.poliedron_attivita TO authenticated;
CREATE POLICY poliedron_attivita_select ON public.poliedron_attivita
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.studio_users su WHERE su.user_id = (SELECT auth.uid())
  AND su.studio_id = poliedron_attivita.studio_id AND su.stato = 'attivo'
));
CREATE POLICY poliedron_attivita_insert ON public.poliedron_attivita
FOR INSERT TO authenticated WITH CHECK (
  user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.studio_users su WHERE su.user_id = (SELECT auth.uid())
    AND su.studio_id = poliedron_attivita.studio_id AND su.stato = 'attivo'
  )
);
-- Recall for a cancelled appointment that was not rebooked.
CREATE FUNCTION public.richiamo_appuntamento_annullato() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  oggi date := (now() AT TIME ZONE 'Europe/Rome')::date;
  autore uuid;
BEGIN
  BEGIN
    IF NEW.stato = 'annullato' AND OLD.stato IS DISTINCT FROM 'annullato'
      AND NEW.paziente_id IS NOT NULL AND NEW.data >= oggi
      AND NOT EXISTS (SELECT 1 FROM public.appointments a WHERE a.studio_id = NEW.studio_id
        AND a.paziente_id = NEW.paziente_id AND a.id <> NEW.id AND a.data >= oggi
        AND a.stato IS DISTINCT FROM 'annullato')
      AND NOT EXISTS (SELECT 1 FROM public.richiami r WHERE r.studio_id = NEW.studio_id
        AND r.chiave_bot = 'annullato:' || NEW.id AND r.stato = 'da_fare')
    THEN
      autore := coalesce(auth.uid(), NEW.user_id);
      INSERT INTO public.richiami(user_id, studio_id, paziente_id, categoria, motivo, data_scadenza, origine, stato, chiave_bot)
      VALUES (autore, NEW.studio_id, NEW.paziente_id, 'clinico',
        'Da rifissare: ' || coalesce(nullif(btrim(NEW.tipo), ''), 'appuntamento') || ' del ' || to_char(NEW.data, 'DD/MM/YYYY') || ' annullato',
        oggi, 'annullamento', 'da_fare', 'annullato:' || NEW.id);
    ELSIF NEW.stato IS DISTINCT FROM 'annullato' AND NEW.paziente_id IS NOT NULL AND NEW.data >= oggi THEN
      -- Booked again (or the cancellation was undone): the recall is done.
      UPDATE public.richiami SET stato = 'fatto'
      WHERE studio_id = NEW.studio_id AND paziente_id = NEW.paziente_id
        AND origine = 'annullamento' AND stato = 'da_fare';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- The recall is a convenience: it must never block the agenda write.
    RAISE WARNING 'richiamo_appuntamento_annullato: %', SQLERRM;
  END;
  RETURN NULL;
END $$;

CREATE TRIGGER appointments_richiamo_annullato
AFTER INSERT OR UPDATE OF stato, data, paziente_id ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.richiamo_appuntamento_annullato();

-- Existing upcoming cancellations not rebooked get their recall too.
INSERT INTO public.richiami(user_id, studio_id, paziente_id, categoria, motivo, data_scadenza, origine, stato, chiave_bot)
SELECT a.user_id, a.studio_id, a.paziente_id, 'clinico',
  'Da rifissare: ' || coalesce(nullif(btrim(a.tipo), ''), 'appuntamento') || ' del ' || to_char(a.data, 'DD/MM/YYYY') || ' annullato',
  (now() AT TIME ZONE 'Europe/Rome')::date, 'annullamento', 'da_fare', 'annullato:' || a.id
FROM public.appointments a
WHERE a.stato = 'annullato' AND a.paziente_id IS NOT NULL AND a.data >= (now() AT TIME ZONE 'Europe/Rome')::date
  AND NOT EXISTS (SELECT 1 FROM public.appointments b WHERE b.studio_id = a.studio_id AND b.paziente_id = a.paziente_id
    AND b.id <> a.id AND b.data >= (now() AT TIME ZONE 'Europe/Rome')::date AND b.stato IS DISTINCT FROM 'annullato')
  AND NOT EXISTS (SELECT 1 FROM public.richiami r WHERE r.studio_id = a.studio_id AND r.chiave_bot = 'annullato:' || a.id);

-- The app already listens to richiami changes; publish them so recalls created
-- by the trigger appear at once on every open device (RLS still applies).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'richiami')
  THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.richiami; END IF;
END $$;

COMMIT;
