-- Optional OAuth integration. No clients enabled/secrets inserted automatically.
BEGIN;
CREATE TABLE public.poliedra_connector_clients (
  client_id uuid PRIMARY KEY,
  provider text NOT NULL CHECK (provider IN ('chatgpt','gemini')),
  resource_uri text NOT NULL CHECK (resource_uri ~ '^https://[^/?#]+/api/mcp$'),
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.poliedra_connector_clients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.poliedra_connector_clients FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT SELECT ON public.poliedra_connector_clients TO authenticated, supabase_auth_admin;
CREATE POLICY connector_client_self ON public.poliedra_connector_clients FOR SELECT TO authenticated
USING (enabled AND (client_id::text = (SELECT auth.jwt()->>'client_id') OR ((SELECT auth.jwt()->>'client_id') IS NULL AND (SELECT public.has_studio_capability_v1(((auth.jwt()->'app_metadata')->>'studio_id')::uuid,'clinical.general')))));
CREATE POLICY connector_hook_read ON public.poliedra_connector_clients FOR SELECT TO supabase_auth_admin USING (true);

-- Compose with an existing access-token hook; never replace one blindly.
-- Keep authenticated audience for PostgREST and bind OAuth tokens to this resource.
CREATE FUNCTION public.poliedra_connector_access_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE target text;
BEGIN
  SELECT resource_uri INTO target FROM public.poliedra_connector_clients
  WHERE client_id::text = coalesce(event->>'client_id', event->'claims'->>'client_id') AND enabled;
  IF target IS NULL THEN RETURN jsonb_build_object('claims', event->'claims'); END IF;
  RETURN jsonb_build_object('claims', jsonb_set(event->'claims', '{aud}', jsonb_build_array('authenticated', target)));
END;
$$;
REVOKE ALL ON FUNCTION public.poliedra_connector_access_token_hook(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.poliedra_connector_access_token_hook(jsonb) TO supabase_auth_admin;

CREATE TABLE public.poliedra_connector_requests (
  id uuid PRIMARY KEY,
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.poliedra_connector_clients(client_id) ON DELETE CASCADE,
  summary text NOT NULL CHECK (length(summary) BETWEEN 1 AND 16000),
  proposal_token text NOT NULL CHECK (length(proposal_token) BETWEEN 1 AND 32000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','cancelled','uncertain')),
  result jsonb,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX poliedra_connector_requests_owner ON public.poliedra_connector_requests(studio_id,user_id,created_at DESC);
ALTER TABLE public.poliedra_connector_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.poliedra_connector_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.poliedra_connector_requests TO authenticated;
GRANT UPDATE(status,result) ON public.poliedra_connector_requests TO authenticated;
CREATE POLICY connector_requests_read ON public.poliedra_connector_requests FOR SELECT TO authenticated USING (
 user_id = (SELECT auth.uid()) AND studio_id::text = (SELECT auth.jwt()->'app_metadata'->>'studio_id')
 AND (SELECT public.has_studio_capability_v1(studio_id,'clinical.general'))
 AND ((SELECT auth.jwt()->>'client_id') IS NULL OR client_id::text = (SELECT auth.jwt()->>'client_id'))
 AND EXISTS (SELECT 1 FROM public.studio_users su WHERE su.user_id = (SELECT auth.uid()) AND su.studio_id = poliedra_connector_requests.studio_id AND su.stato = 'attivo')
);
CREATE POLICY connector_requests_insert ON public.poliedra_connector_requests FOR INSERT TO authenticated WITH CHECK (
 user_id = (SELECT auth.uid()) AND studio_id::text = (SELECT auth.jwt()->'app_metadata'->>'studio_id')
 AND client_id::text = (SELECT auth.jwt()->>'client_id') AND status = 'pending' AND result IS NULL
 AND expires_at > now() AND expires_at <= now() + interval '15 minutes'
 AND (SELECT public.has_studio_capability_v1(studio_id,'clinical.general'))
 AND EXISTS (SELECT 1 FROM public.poliedra_connector_clients cc WHERE cc.client_id = poliedra_connector_requests.client_id AND cc.enabled)
);
CREATE POLICY connector_requests_finish ON public.poliedra_connector_requests FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()) AND studio_id::text = (SELECT auth.jwt()->'app_metadata'->>'studio_id') AND (SELECT auth.jwt()->>'client_id') IS NULL AND (SELECT public.has_studio_capability_v1(studio_id,'clinical.general')))
WITH CHECK (user_id = (SELECT auth.uid()) AND studio_id::text = (SELECT auth.jwt()->'app_metadata'->>'studio_id') AND (SELECT auth.jwt()->>'client_id') IS NULL AND (SELECT public.has_studio_capability_v1(studio_id,'clinical.general')));
CREATE POLICY connector_requests_delete ON public.poliedra_connector_requests FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()) AND studio_id::text = (SELECT auth.jwt()->'app_metadata'->>'studio_id') AND (SELECT auth.jwt()->>'client_id') IS NULL);
GRANT SELECT, DELETE ON public.poliedra_connector_requests TO service_role;
CREATE FUNCTION public.purge_poliedra_connector_requests() RETURNS bigint
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
 WITH removed AS (DELETE FROM public.poliedra_connector_requests WHERE created_at < now() - interval '24 hours' RETURNING id) SELECT count(*) FROM removed;
$$;
REVOKE ALL ON FUNCTION public.purge_poliedra_connector_requests() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_poliedra_connector_requests() TO service_role;
COMMENT ON TABLE public.poliedra_connector_requests IS 'Private operational clinical proposals; not training data. Delete after 24h via approved retention job; claims/activity remain authoritative. No original images.';
COMMIT;
