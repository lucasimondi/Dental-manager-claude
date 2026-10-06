-- POL-AI-009: memoria di Poliedron.
-- Cose che Poliedron impara da un utente (preferenze, posologie abituali,
-- informazioni sullo studio): scritte dalla chat (strumento `ricorda` della
-- funzione agente-assistente, con il login dell'utente) o dalle ricette
-- generate nell'app, rilette a ogni richiesta. Ogni riga appartiene a un
-- utente in uno studio: solo lui la vede, la modifica o la cancella.
--
-- Additiva e rieseguibile. Rollback:
--   DROP TABLE IF EXISTS public.poliedron_memoria;
--   DROP FUNCTION IF EXISTS public.poliedron_memoria_guard_v1();
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.studios') IS NULL
     OR to_regclass('public.studio_users') IS NULL
     OR to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'POL-AI-009 preflight: studios, studio_users and auth.users are required';
  END IF;
END
$preflight$;

CREATE TABLE IF NOT EXISTS public.poliedron_memoria (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  categoria text NOT NULL DEFAULT 'altro',
  -- Facoltativa: una sola riga per chiave (es. 'farmaco:amoxicillina 1 g'),
  -- così una posologia aggiornata sostituisce la precedente.
  chiave text,
  testo text NOT NULL,
  origine text NOT NULL DEFAULT 'chat',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT poliedron_memoria_categoria_valida
    CHECK (categoria IN ('preferenza', 'prescrizione', 'studio', 'altro')),
  CONSTRAINT poliedron_memoria_origine_valida
    CHECK (origine IN ('chat', 'ricetta')),
  CONSTRAINT poliedron_memoria_testo_valido
    CHECK (char_length(btrim(testo)) BETWEEN 1 AND 500),
  CONSTRAINT poliedron_memoria_chiave_valida
    CHECK (chiave IS NULL OR char_length(chiave) BETWEEN 1 AND 160),
  CONSTRAINT poliedron_memoria_chiave_unica
    UNIQUE (studio_id, user_id, chiave)
);

CREATE INDEX IF NOT EXISTS poliedron_memoria_recenti_idx
  ON public.poliedron_memoria (user_id, studio_id, updated_at DESC);

-- Tetto di righe per utente e studio, e updated_at sempre del server.
CREATE OR REPLACE FUNCTION public.poliedron_memoria_guard_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF (SELECT count(*) FROM public.poliedron_memoria m
        WHERE m.user_id = NEW.user_id AND m.studio_id = NEW.studio_id) >= 300 THEN
      RAISE EXCEPTION 'Memoria di Poliedron piena (300 voci): cancellane qualcuna.'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.studio_id IS DISTINCT FROM OLD.studio_id THEN
      RAISE EXCEPTION 'Una voce della memoria non può cambiare proprietario.'
        USING ERRCODE = 'check_violation';
    END IF;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS poliedron_memoria_guard_v1 ON public.poliedron_memoria;
CREATE TRIGGER poliedron_memoria_guard_v1
BEFORE INSERT OR UPDATE ON public.poliedron_memoria
FOR EACH ROW EXECUTE FUNCTION public.poliedron_memoria_guard_v1();

ALTER TABLE public.poliedron_memoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS poliedron_memoria_own ON public.poliedron_memoria;
CREATE POLICY poliedron_memoria_own
ON public.poliedron_memoria FOR ALL TO authenticated
USING (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.studio_users su
    WHERE su.user_id = (SELECT auth.uid())
      AND su.studio_id = poliedron_memoria.studio_id
      AND su.stato = 'attivo'
  )
)
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.studio_users su
    WHERE su.user_id = (SELECT auth.uid())
      AND su.studio_id = poliedron_memoria.studio_id
      AND su.stato = 'attivo'
  )
);

-- Come per la chat: i privilegi di default del progetto concedono tutto ad
-- anon/authenticated; si revoca e si concede solo il necessario.
REVOKE ALL ON TABLE public.poliedron_memoria FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.poliedron_memoria_id_seq FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.poliedron_memoria_guard_v1() FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.poliedron_memoria TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.poliedron_memoria_id_seq TO authenticated;

COMMENT ON TABLE public.poliedron_memoria IS
  'POL-AI-009: ciò che Poliedron ricorda di un utente in uno studio. Privata per utente; letta da agente-assistente a ogni richiesta.';

COMMIT;
