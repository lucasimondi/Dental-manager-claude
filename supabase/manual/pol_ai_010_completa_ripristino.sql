-- POL-AI-010 passo 2c: completamento in produzione (editor SQL di Supabase).
-- Sostituisce il segnaposto di poliedron_ripristina_v1, pubblica i richiami in tempo reale
-- e registra la migration. Identico a supabase/migrations/20261005170000_pol_ai_010_registro_annullati.sql.
BEGIN;
CREATE OR REPLACE FUNCTION public.poliedron_ripristina_v1(p_attivita uuid, p_studio uuid)
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
  WHEN 'crea_appuntamento' THEN
    SELECT to_jsonb(x) INTO cur FROM public.appointments x WHERE id = a.record_id AND studio_id = p_studio FOR UPDATE;
    IF cur IS NULL OR NOT (cur @> (a.dopo - 'id')) THEN
      RAISE EXCEPTION 'L''appuntamento è stato cambiato dopo Poliedron: controllalo in agenda';
    END IF;
    DELETE FROM public.appointments WHERE id = a.record_id AND studio_id = p_studio;
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
  WHEN 'crea_richiamo' THEN
    DELETE FROM public.richiami WHERE id = a.record_id AND studio_id = p_studio AND stato = 'da_fare';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN RAISE EXCEPTION 'Il richiamo è già stato gestito'; END IF;
  WHEN 'crea_promemoria' THEN
    DELETE FROM public.todos WHERE id = a.record_id AND studio_id = p_studio AND fatto IS NOT TRUE;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN RAISE EXCEPTION 'L''attività è già stata completata o tolta'; END IF;
  WHEN 'crea_impegno_personale' THEN
    DELETE FROM public.impegni_personali WHERE id = a.record_id AND studio_id = p_studio;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN RAISE EXCEPTION 'Il blocco agenda non c''è più'; END IF;
  ELSE
    RAISE EXCEPTION 'Questa azione non si può ripristinare da qui';
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
INSERT INTO supabase_migrations.schema_migrations(version, name) VALUES ('20261005170000', 'pol_ai_010_registro_annullati') ON CONFLICT DO NOTHING;
COMMIT;

-- Da eseguire separatamente (fuori dalla transazione):
ALTER PUBLICATION supabase_realtime ADD TABLE public.richiami;
