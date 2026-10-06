-- Replay protection only: no patient data or action payload is persisted here.
BEGIN;
CREATE TABLE public.poliedron_action_claims (
  id uuid NOT NULL,
  studio_id uuid NOT NULL REFERENCES public.studios(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, studio_id, id)
);
ALTER TABLE public.poliedron_action_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.poliedron_action_claims FROM PUBLIC, anon, authenticated;
GRANT INSERT ON public.poliedron_action_claims TO authenticated;
CREATE POLICY poliedron_action_claims_insert ON public.poliedron_action_claims
FOR INSERT TO authenticated WITH CHECK (
  user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.studio_users su WHERE su.user_id = (SELECT auth.uid())
    AND su.studio_id = poliedron_action_claims.studio_id AND su.stato = 'attivo'
  )
);
-- All business writes run with the caller's RLS privileges. No definer role.
CREATE FUNCTION public.poliedron_execute_agenda_v1(p_id uuid, p_studio uuid, p_before jsonb, p_after jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' SET lock_timeout = '2s' AS $$
DECLARE
  proposed public.appointments%ROWTYPE;
  previous public.appointments%ROWTYPE;
  saved_id bigint;
  start_min integer;
  end_min integer;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.studio_users WHERE user_id = auth.uid() AND studio_id = p_studio AND stato = 'attivo'
  ) THEN RAISE EXCEPTION 'Accesso allo studio non consentito'; END IF;
  proposed := jsonb_populate_record(NULL::public.appointments, p_after);
  IF proposed.data IS NULL OR proposed.ora IS NULL OR proposed.durata IS NULL
    OR proposed.durata < 1 OR proposed.durata > 1440 OR proposed.paziente_id IS NULL
    OR coalesce(btrim(proposed.tipo), '') = '' OR proposed.stato IS NULL
    OR proposed.stato NOT IN ('confermato', 'da confermare', 'annullato')
    OR proposed.ora::text !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:00)?$'
  THEN RAISE EXCEPTION 'Dati appuntamento non validi'; END IF;
  IF proposed.stato <> 'annullato' AND proposed.data::date < (now() AT TIME ZONE 'Europe/Rome')::date
  THEN RAISE EXCEPTION 'La data deve essere odierna o futura'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.patients WHERE id = proposed.paziente_id AND studio_id = p_studio)
  THEN RAISE EXCEPTION 'Paziente non disponibile'; END IF;
  IF proposed.operatore_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.operatori WHERE id = proposed.operatore_id AND studio_id = p_studio AND attivo = true
  ) THEN RAISE EXCEPTION 'Operatore non disponibile'; END IF;

  -- Short transaction-wide locks also serialize with legacy UI writers, which
  -- do not take advisory locks. No external/model calls occur while held.
  LOCK TABLE public.appointments, public.impegni_personali IN SHARE ROW EXCLUSIVE MODE;
  IF p_before IS NOT NULL AND p_before <> 'null'::jsonb THEN
    SELECT * INTO previous FROM public.appointments WHERE id = (p_before->>'id')::bigint AND studio_id = p_studio FOR UPDATE;
    IF NOT FOUND OR NOT (to_jsonb(previous) @> p_before) THEN
      RAISE EXCEPTION 'Appuntamento modificato nel frattempo. Ripeti la richiesta';
    END IF;
  END IF;
  start_min := extract(hour FROM proposed.ora::time)::integer * 60 + extract(minute FROM proposed.ora::time)::integer;
  end_min := start_min + proposed.durata;
  IF end_min > 1440 THEN RAISE EXCEPTION 'Durata oltre la fine del giorno'; END IF;
  IF proposed.stato <> 'annullato' AND (
    EXISTS (
      SELECT 1 FROM public.appointments a WHERE a.studio_id = p_studio AND a.data = proposed.data
      AND a.id IS DISTINCT FROM previous.id AND a.stato IS DISTINCT FROM 'annullato'
      AND (proposed.operatore_id IS NULL OR a.operatore_id IS NULL OR a.operatore_id = proposed.operatore_id)
      AND start_min < extract(hour FROM a.ora::time) * 60 + extract(minute FROM a.ora::time) + coalesce(a.durata,30)
      AND extract(hour FROM a.ora::time) * 60 + extract(minute FROM a.ora::time) < end_min
    ) OR EXISTS (
      SELECT 1 FROM public.impegni_personali i WHERE i.studio_id = p_studio
      AND proposed.data::date BETWEEN i.data_inizio::date AND i.data_fine::date
      AND (i.tutto_il_giorno OR (
        start_min < extract(hour FROM i.ora_fine::time) * 60 + extract(minute FROM i.ora_fine::time)
        AND extract(hour FROM i.ora_inizio::time) * 60 + extract(minute FROM i.ora_inizio::time) < end_min
      ))
    )
  ) THEN RAISE EXCEPTION 'Orario occupato. Scegli un altro orario'; END IF;
  INSERT INTO public.poliedron_action_claims(id, studio_id, user_id) VALUES (p_id, p_studio, auth.uid());
  IF previous.id IS NULL THEN
    -- appointments.id is GENERATED ALWAYS AS IDENTITY in production
    -- (information_schema shows no column_default for identity columns):
    -- the database assigns it, exactly as the app's own inserts do.
    INSERT INTO public.appointments(paziente_id, data, ora, durata, tipo, stato, note, operatore_id, studio_id, user_id)
    VALUES (proposed.paziente_id, proposed.data, proposed.ora, proposed.durata, proposed.tipo, proposed.stato, proposed.note, proposed.operatore_id, p_studio, auth.uid()) RETURNING id INTO saved_id;
  ELSE
    UPDATE public.appointments SET paziente_id=proposed.paziente_id, data=proposed.data, ora=proposed.ora,
      durata=proposed.durata, tipo=proposed.tipo, stato=proposed.stato, note=proposed.note, operatore_id=proposed.operatore_id
    WHERE id=previous.id AND studio_id=p_studio RETURNING id INTO saved_id;
  END IF;
  IF saved_id IS NULL THEN RAISE EXCEPTION 'Operazione non consentita'; END IF;
  RETURN saved_id;
END;
$$;
REVOKE ALL ON FUNCTION public.poliedron_execute_agenda_v1(uuid,uuid,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.poliedron_execute_agenda_v1(uuid,uuid,jsonb,jsonb) TO authenticated;
COMMIT;
-- Rollback after disabling new Edge Function: DROP TABLE public.poliedron_action_claims;
