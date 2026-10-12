-- POL-AI-011 (Product Owner, 2026-10-12): a dashboard showing how many requests
-- Poliedron closes by itself (Core, no model) and what still goes to the model,
-- so the share that depends on external AI APIs can be measured and reduced.
--
-- Learning Engine rule (docs/architecture/poliedron-learning-engine.md): no chat
-- text, no patient names or ids. One row per answer, only structured fields:
-- route, intent recognised by the Core, outcome, names of the actions the model
-- called, provider, duration. Written by agente-assistente with the user's own
-- login (RLS), readable by the studio's active members, kept 180 days.
--
-- Rollback:
--   SELECT cron.unschedule('poliedron-eventi-pulizia');
--   DROP FUNCTION IF EXISTS public.poliedron_statistiche_v1(uuid, integer);
--   DROP TABLE IF EXISTS public.poliedron_eventi;
BEGIN;

CREATE TABLE public.poliedron_eventi (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL REFERENCES public.studios(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  -- core: answered without the model; modello: LLM + tools; essenziale: model
  -- unavailable, read-only fallback; conferma: the user confirmed/cancelled a proposal.
  percorso text NOT NULL CHECK (percorso IN ('core', 'modello', 'essenziale', 'conferma')),
  -- Intent recognised by the Core (also when it handed the request to the model).
  intento text CHECK (intento ~ '^[A-Z_]{1,40}$'),
  esito text NOT NULL CHECK (esito IN ('eseguito', 'conferma', 'chiarimento', 'risposta', 'non_eseguito')),
  -- Names of the tools the model called (never their inputs).
  azioni text[] NOT NULL DEFAULT '{}' CHECK (
    cardinality(azioni) <= 12 AND array_to_string(azioni, ',') ~ '^[a-z0-9_,]*$'
  ),
  provider text CHECK (provider IN ('openai', 'anthropic')),
  durata_ms integer CHECK (durata_ms BETWEEN 0 AND 600000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX poliedron_eventi_studio_created ON public.poliedron_eventi (studio_id, created_at DESC);
ALTER TABLE public.poliedron_eventi ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.poliedron_eventi FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.poliedron_eventi TO authenticated;
CREATE POLICY poliedron_eventi_select ON public.poliedron_eventi
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.studio_users su WHERE su.user_id = (SELECT auth.uid())
  AND su.studio_id = poliedron_eventi.studio_id AND su.stato = 'attivo'
));
CREATE POLICY poliedron_eventi_insert ON public.poliedron_eventi
FOR INSERT TO authenticated WITH CHECK (
  user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.studio_users su WHERE su.user_id = (SELECT auth.uid())
    AND su.studio_id = poliedron_eventi.studio_id AND su.stato = 'attivo'
  )
);

-- Aggregates for the dashboard, computed with the caller's permissions.
CREATE FUNCTION public.poliedron_statistiche_v1(p_studio uuid, p_giorni integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  dal timestamptz := now() - make_interval(days => least(greatest(coalesce(p_giorni, 30), 1), 180));
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.studio_users WHERE user_id = auth.uid() AND studio_id = p_studio AND stato = 'attivo'
  ) THEN RAISE EXCEPTION 'Accesso allo studio non consentito'; END IF;
  RETURN (
    WITH e AS (SELECT * FROM public.poliedron_eventi WHERE studio_id = p_studio AND created_at >= dal)
    SELECT jsonb_build_object(
      'giorni', least(greatest(coalesce(p_giorni, 30), 1), 180),
      'totale', (SELECT count(*) FROM e),
      'percorsi', coalesce((SELECT jsonb_object_agg(percorso, n) FROM (SELECT percorso, count(*) n FROM e GROUP BY percorso) x), '{}'::jsonb),
      'esiti', coalesce((SELECT jsonb_object_agg(esito, n) FROM (SELECT esito, count(*) n FROM e GROUP BY esito) x), '{}'::jsonb),
      'intenti_core', coalesce((SELECT jsonb_agg(jsonb_build_object('intento', intento, 'n', n) ORDER BY n DESC, intento)
        FROM (SELECT intento, count(*) n FROM e WHERE percorso = 'core' AND intento IS NOT NULL GROUP BY intento ORDER BY count(*) DESC, intento LIMIT 10) x), '[]'::jsonb),
      'azioni_modello', coalesce((SELECT jsonb_agg(jsonb_build_object('azione', azione, 'n', n) ORDER BY n DESC, azione)
        FROM (SELECT a AS azione, count(*) n FROM e, unnest(e.azioni) a WHERE percorso = 'modello' GROUP BY a ORDER BY count(*) DESC, a LIMIT 10) x), '[]'::jsonb),
      'intenti_passati_al_modello', coalesce((SELECT jsonb_agg(jsonb_build_object('intento', intento, 'n', n) ORDER BY n DESC, intento)
        FROM (SELECT intento, count(*) n FROM e WHERE percorso = 'modello' AND intento IS NOT NULL GROUP BY intento ORDER BY count(*) DESC, intento LIMIT 10) x), '[]'::jsonb),
      'modello_senza_azioni', (SELECT count(*) FROM e WHERE percorso = 'modello' AND cardinality(azioni) = 0)
    )
  );
END $$;
REVOKE ALL ON FUNCTION public.poliedron_statistiche_v1(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.poliedron_statistiche_v1(uuid, integer) TO authenticated;

COMMENT ON TABLE public.poliedron_eventi IS
  'POL-AI-011: one row per Poliedron answer (route/intent/outcome/tool names). No chat text, no patient data. Kept 180 days.';

-- Retention: events older than 180 days are deleted every night.
DO $sched$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('poliedron-eventi-pulizia', '17 3 * * *',
      $job$DELETE FROM public.poliedron_eventi WHERE created_at < now() - interval '180 days'$job$);
  END IF;
END
$sched$;

COMMIT;
