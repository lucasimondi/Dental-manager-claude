-- POL-AI-010 step 2: patient record and clinical-organisation writes from Poliedron.
-- Same model as step 1 (20261004160708): the Edge Function signs a proposal, the
-- user confirms, and this SECURITY INVOKER function claims the confirmation and
-- performs the single write in one transaction, with the caller's RLS.
--
-- Also fixes todos.origine: the check allowed only 'manuale'/'controllo_dati', so
-- the WhatsApp assistant's hand-over activity (origine 'whatsapp', POL-WA-003a)
-- was rejected by the database. 'poliedron' is added for activities created here.
--
-- Rollback (after redeploying the step 1 Edge Function):
--   DROP FUNCTION IF EXISTS public.poliedron_execute_pazienti_v1(uuid, uuid, text, jsonb, jsonb);
--   (the wider todos.origine check can stay: it only admits two more values)
BEGIN;

ALTER TABLE public.todos DROP CONSTRAINT IF EXISTS todos_origine_check;
ALTER TABLE public.todos ADD CONSTRAINT todos_origine_check
  CHECK (origine = ANY (ARRAY['manuale', 'controllo_dati', 'whatsapp', 'poliedron']));

CREATE OR REPLACE FUNCTION public.poliedron_execute_pazienti_v1(
  p_id uuid, p_studio uuid, p_azione text, p_dati jsonb, p_before jsonb DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  d jsonb := coalesce(p_dati, '{}'::jsonb);
  oggi date := (now() AT TIME ZONE 'Europe/Rome')::date;
  v_paz bigint;
  v_id bigint;
  cur jsonb;
  v_consenso boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.studio_users WHERE user_id = auth.uid() AND studio_id = p_studio AND stato = 'attivo'
  ) THEN RAISE EXCEPTION 'Accesso allo studio non consentito'; END IF;

  IF d ? 'paziente_id' AND d->>'paziente_id' IS NOT NULL THEN
    v_paz := (d->>'paziente_id')::bigint;
    IF NOT EXISTS (SELECT 1 FROM public.patients WHERE id = v_paz AND studio_id = p_studio) THEN
      RAISE EXCEPTION 'Paziente non disponibile';
    END IF;
  ELSIF p_azione IN ('modifica_paziente', 'aggiungi_nota_paziente', 'crea_richiamo') THEN
    RAISE EXCEPTION 'Paziente obbligatorio';
  END IF;

  -- One confirmation, one write: a replayed token fails here (unique key).
  INSERT INTO public.poliedron_action_claims(id, studio_id, user_id) VALUES (p_id, p_studio, auth.uid());

  CASE p_azione
  WHEN 'crea_paziente' THEN
    IF coalesce(btrim(d->>'nome'), '') = '' OR coalesce(btrim(d->>'cognome'), '') = '' THEN
      RAISE EXCEPTION 'Nome e cognome obbligatori';
    END IF;
    IF (d->>'data_nascita') IS NOT NULL AND (d->>'data_nascita')::date > oggi THEN
      RAISE EXCEPTION 'Data di nascita nel futuro';
    END IF;
    v_consenso := coalesce((d->>'consenso_whatsapp')::boolean, false);
    INSERT INTO public.patients(nome, cognome, telefono, email, data_nascita, cf, note,
                                consenso_whatsapp, consenso_whatsapp_il, studio_id, user_id)
    VALUES (btrim(d->>'nome'), btrim(d->>'cognome'), nullif(btrim(d->>'telefono'), ''), nullif(btrim(d->>'email'), ''),
            (d->>'data_nascita')::date, nullif(upper(btrim(d->>'cf')), ''), nullif(btrim(d->>'note'), ''),
            v_consenso, CASE WHEN v_consenso THEN now() END, p_studio, auth.uid())
    RETURNING id INTO v_id;

  WHEN 'modifica_paziente' THEN
    SELECT jsonb_build_object('telefono', telefono, 'email', email, 'indirizzo', indirizzo, 'cap', cap,
             'comune', comune, 'provincia', provincia, 'data_nascita', data_nascita, 'cf', cf,
             'consenso_whatsapp', consenso_whatsapp)
      INTO cur FROM public.patients WHERE id = v_paz AND studio_id = p_studio FOR UPDATE;
    IF p_before IS NOT NULL AND NOT (cur @> p_before) THEN
      RAISE EXCEPTION 'Scheda paziente modificata nel frattempo. Ripeti la richiesta';
    END IF;
    IF d ? 'data_nascita' AND (d->>'data_nascita')::date > oggi THEN
      RAISE EXCEPTION 'Data di nascita nel futuro';
    END IF;
    UPDATE public.patients SET
      telefono = CASE WHEN d ? 'telefono' THEN nullif(btrim(d->>'telefono'), '') ELSE telefono END,
      email = CASE WHEN d ? 'email' THEN nullif(btrim(d->>'email'), '') ELSE email END,
      indirizzo = CASE WHEN d ? 'indirizzo' THEN nullif(btrim(d->>'indirizzo'), '') ELSE indirizzo END,
      cap = CASE WHEN d ? 'cap' THEN nullif(btrim(d->>'cap'), '') ELSE cap END,
      comune = CASE WHEN d ? 'comune' THEN nullif(btrim(d->>'comune'), '') ELSE comune END,
      provincia = CASE WHEN d ? 'provincia' THEN nullif(upper(btrim(d->>'provincia')), '') ELSE provincia END,
      data_nascita = CASE WHEN d ? 'data_nascita' THEN (d->>'data_nascita')::date ELSE data_nascita END,
      cf = CASE WHEN d ? 'cf' THEN nullif(upper(btrim(d->>'cf')), '') ELSE cf END,
      consenso_whatsapp_il = CASE
        WHEN d ? 'consenso_whatsapp' AND (d->>'consenso_whatsapp')::boolean IS DISTINCT FROM consenso_whatsapp
          THEN CASE WHEN (d->>'consenso_whatsapp')::boolean THEN now() END
        ELSE consenso_whatsapp_il END,
      consenso_whatsapp = CASE WHEN d ? 'consenso_whatsapp' THEN (d->>'consenso_whatsapp')::boolean ELSE consenso_whatsapp END
    WHERE id = v_paz AND studio_id = p_studio
    RETURNING id INTO v_id;

  WHEN 'aggiungi_nota_paziente' THEN
    IF coalesce(btrim(d->>'testo'), '') = '' THEN RAISE EXCEPTION 'Testo della nota obbligatorio'; END IF;
    -- Appended in the database (no read-modify-write from the client): two
    -- concurrent notes can never overwrite each other. Same shape as the app's notes.
    UPDATE public.patients
       SET annotazioni = coalesce(annotazioni, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
             'id', floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint,
             'data', to_char(oggi, 'YYYY-MM-DD'),
             'testo', btrim(d->>'testo'),
             'richiamo', NULL))
     WHERE id = v_paz AND studio_id = p_studio
    RETURNING id INTO v_id;

  WHEN 'crea_richiamo' THEN
    IF (d->>'data_scadenza') IS NULL OR (d->>'data_scadenza')::date < oggi THEN
      RAISE EXCEPTION 'Data del richiamo mancante o passata';
    END IF;
    IF coalesce(d->>'categoria', 'generico') NOT IN ('clinico', 'preventivo', 'incasso', 'generico') THEN
      RAISE EXCEPTION 'Categoria del richiamo non valida';
    END IF;
    INSERT INTO public.richiami(paziente_id, categoria, motivo, data_scadenza, origine, stato, studio_id, user_id)
    VALUES (v_paz, coalesce(d->>'categoria', 'generico'), nullif(btrim(d->>'motivo'), ''), (d->>'data_scadenza')::date,
            'bot', 'da_fare', p_studio, auth.uid())
    RETURNING id INTO v_id;

  WHEN 'crea_promemoria' THEN
    IF coalesce(btrim(d->>'testo'), '') = '' THEN RAISE EXCEPTION 'Testo del promemoria obbligatorio'; END IF;
    INSERT INTO public.todos(testo, data, fatto, studio_id, paziente_id, origine)
    VALUES (btrim(d->>'testo'), (d->>'data')::date, false, p_studio, v_paz, 'poliedron')
    RETURNING id INTO v_id;

  WHEN 'crea_impegno_personale' THEN
    IF coalesce(btrim(d->>'titolo'), '') = '' THEN RAISE EXCEPTION 'Titolo obbligatorio'; END IF;
    IF (d->>'data_inizio') IS NULL OR (d->>'data_inizio')::date < oggi THEN
      RAISE EXCEPTION 'Data di inizio mancante o passata';
    END IF;
    IF coalesce((d->>'tutto_il_giorno')::boolean, true) = false
       AND ((d->>'ora_inizio') IS NULL OR (d->>'ora_fine') IS NULL OR (d->>'ora_fine')::time <= (d->>'ora_inizio')::time) THEN
      RAISE EXCEPTION 'Orario dell''impegno non valido';
    END IF;
    INSERT INTO public.impegni_personali(studio_id, user_id, titolo, tipo, data_inizio, data_fine,
                                         tutto_il_giorno, ora_inizio, ora_fine, note)
    VALUES (p_studio, auth.uid(), btrim(d->>'titolo'), coalesce(d->>'tipo', 'personale'),
            (d->>'data_inizio')::date, coalesce((d->>'data_fine')::date, (d->>'data_inizio')::date),
            coalesce((d->>'tutto_il_giorno')::boolean, true),
            CASE WHEN coalesce((d->>'tutto_il_giorno')::boolean, true) THEN NULL ELSE (d->>'ora_inizio')::time END,
            CASE WHEN coalesce((d->>'tutto_il_giorno')::boolean, true) THEN NULL ELSE (d->>'ora_fine')::time END,
            nullif(btrim(d->>'note'), ''))
    RETURNING id INTO v_id;

  ELSE
    RAISE EXCEPTION 'Azione non supportata';
  END CASE;

  IF v_id IS NULL THEN RAISE EXCEPTION 'Operazione non consentita'; END IF;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.poliedron_execute_pazienti_v1(uuid, uuid, text, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.poliedron_execute_pazienti_v1(uuid, uuid, text, jsonb, jsonb) TO authenticated;

COMMIT;
