-- POL-AI-010 step 2c (Product Owner, 2026-10-05): "Non rimane in agenda ma ci sarà
-- traccia di attività poliedron con elenco di tutto ciò che ha fatto" and "quando
-- non vengono rifissati vanno nei richiami da fare".
--
-- 1. poliedron_attivita: what Poliedron did, readable by the studio's active
--    members. A row can only be written by the user who claimed that exact
--    action (same id as poliedron_action_claims), never updated or deleted.
--    poliedron_ripristina_v1 undoes one action ("Ripristina").
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
  -- State before/after the action, used by "Ripristina" (only data the studio can already read).
  prima jsonb,
  dopo jsonb,
  -- Set on the row that records an undo: points to the undone action, at most once.
  ripristino_di uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, studio_id, id),
  FOREIGN KEY (user_id, studio_id, id) REFERENCES public.poliedron_action_claims(user_id, studio_id, id)
);
CREATE INDEX poliedron_attivita_studio_created ON public.poliedron_attivita (studio_id, created_at DESC);
CREATE UNIQUE INDEX poliedron_attivita_ripristino_unico ON public.poliedron_attivita (studio_id, ripristino_di) WHERE ripristino_di IS NOT NULL;
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

-- "Ripristina": undo one Poliedron action in a single transaction, as the caller
-- (RLS applies), only if the record is still exactly as Poliedron left it.
-- Recorded as a new 'ripristino' row; the unique index makes a second undo fail
-- and roll back. Two functions: the helper removes a record Poliedron created
-- (it gives the caller nothing beyond the table rights RLS already grants).
CREATE FUNCTION public.poliedron_ripristina_rimuovi_v1(p_azione text, p_record bigint, p_dopo jsonb, p_studio uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' SET lock_timeout = '2s' AS $$
DECLARE
  cur jsonb;
  n integer;
BEGIN
  CASE p_azione
  WHEN 'crea_appuntamento' THEN
    SELECT to_jsonb(x) INTO cur FROM public.appointments x WHERE id = p_record AND studio_id = p_studio FOR UPDATE;
    IF cur IS NULL OR NOT (cur @> (p_dopo - 'id')) THEN
      RAISE EXCEPTION 'L''appuntamento è stato cambiato dopo Poliedron: controllalo in agenda';
    END IF;
    DELETE FROM public.appointments WHERE id = p_record AND studio_id = p_studio;
  WHEN 'crea_richiamo' THEN
    DELETE FROM public.richiami WHERE id = p_record AND studio_id = p_studio AND stato = 'da_fare';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN RAISE EXCEPTION 'Il richiamo è già stato gestito'; END IF;
  WHEN 'crea_promemoria' THEN
    DELETE FROM public.todos WHERE id = p_record AND studio_id = p_studio AND fatto IS NOT TRUE;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN RAISE EXCEPTION 'L''attività è già stata completata o tolta'; END IF;
  WHEN 'crea_impegno_personale' THEN
    DELETE FROM public.impegni_personali WHERE id = p_record AND studio_id = p_studio;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN RAISE EXCEPTION 'Il blocco agenda non c''è più'; END IF;
  ELSE
    RAISE EXCEPTION 'Questa azione non si può ripristinare da qui';
  END CASE;
END $$;
REVOKE ALL ON FUNCTION public.poliedron_ripristina_rimuovi_v1(text, bigint, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.poliedron_ripristina_rimuovi_v1(text, bigint, jsonb, uuid) TO authenticated;

CREATE FUNCTION public.poliedron_ripristina_v1(p_attivita uuid, p_studio uuid)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' SET lock_timeout = '2s' AS $$
DECLARE
  a public.poliedron_attivita%ROWTYPE;
  v_id uuid := gen_random_uuid();
  cur jsonb;
  k text;
  n integer;
  titolo text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.studio_users WHERE user_id = auth.uid() AND studio_id = p_studio AND stato = 'attivo'
  ) THEN RAISE EXCEPTION 'Accesso allo studio non consentito'; END IF;
  SELECT * INTO a FROM public.poliedron_attivita WHERE id = p_attivita AND studio_id = p_studio;
  IF NOT FOUND THEN RAISE EXCEPTION 'Attività non trovata'; END IF;
  IF a.ripristino_di IS NOT NULL THEN RAISE EXCEPTION 'Un ripristino non si può ripristinare'; END IF;
  IF EXISTS (SELECT 1 FROM public.poliedron_attivita WHERE studio_id = p_studio AND ripristino_di = p_attivita) THEN
    RAISE EXCEPTION 'Azione già ripristinata';
  END IF;
  titolo := split_part(regexp_replace(a.riepilogo, '^Fatto\.\s*', ''), E'\n', 1);

  CASE a.azione
  WHEN 'modifica_appuntamento', 'elimina_appuntamento' THEN
    -- Same checks as any agenda write (unchanged since, free slot, future date).
    PERFORM public.poliedron_execute_agenda_v1(v_id, p_studio, a.dopo, a.prima);
  WHEN 'modifica_paziente' THEN
    SELECT jsonb_build_object('telefono', telefono, 'email', email, 'indirizzo', indirizzo, 'cap', cap,
             'comune', comune, 'provincia', provincia, 'data_nascita', data_nascita, 'cf', cf,
             'consenso_whatsapp', consenso_whatsapp)
      INTO cur FROM public.patients WHERE id = a.record_id AND studio_id = p_studio FOR UPDATE;
    IF cur IS NULL THEN RAISE EXCEPTION 'Paziente non disponibile'; END IF;
    FOR k IN SELECT jsonb_object_keys(a.dopo - 'paziente_id') LOOP
      IF lower(nullif(btrim(cur->>k), '')) IS DISTINCT FROM lower(nullif(btrim(a.dopo->>k), '')) THEN
        RAISE EXCEPTION 'La scheda è stata cambiata dopo Poliedron: controllala a mano';
      END IF;
    END LOOP;
    PERFORM public.poliedron_execute_pazienti_v1(v_id, p_studio, 'modifica_paziente',
      a.prima || jsonb_build_object('paziente_id', a.record_id), NULL);
  WHEN 'aggiungi_nota_paziente' THEN
    UPDATE public.patients SET annotazioni = annotazioni - (jsonb_array_length(annotazioni) - 1)
    WHERE id = a.record_id AND studio_id = p_studio AND jsonb_typeof(annotazioni) = 'array'
      AND jsonb_array_length(annotazioni) > 0
      AND annotazioni -> (jsonb_array_length(annotazioni) - 1) ->> 'testo' = a.dopo->>'testo';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN RAISE EXCEPTION 'La nota non è più l''ultima della scheda: rimuovila a mano'; END IF;
  ELSE
    PERFORM public.poliedron_ripristina_rimuovi_v1(a.azione, a.record_id, a.dopo, p_studio);
  END CASE;

  IF a.azione NOT IN ('modifica_appuntamento', 'elimina_appuntamento', 'modifica_paziente') THEN
    -- The agenda/patient functions above already record their own claim.
    INSERT INTO public.poliedron_action_claims(id, studio_id, user_id) VALUES (v_id, p_studio, auth.uid());
  END IF;
  INSERT INTO public.poliedron_attivita(id, studio_id, user_id, azione, riepilogo, tabella, record_id, ripristino_di)
  VALUES (v_id, p_studio, auth.uid(), 'ripristino', 'Ripristinato: ' || titolo, a.tabella, a.record_id, p_attivita);
  RETURN a.tabella;
END $$;
REVOKE ALL ON FUNCTION public.poliedron_ripristina_v1(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.poliedron_ripristina_v1(uuid, uuid) TO authenticated;

-- The app already listens to richiami changes; publish them so recalls created
-- by the trigger appear at once on every open device (RLS still applies).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'richiami')
  THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.richiami; END IF;
END $$;

COMMIT;
