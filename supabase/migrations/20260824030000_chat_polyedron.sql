-- CHAT-POLYEDRON: persistent, per-studio/per-user conversation for the
-- existing singleton Poliedron. Additive and reversible; rollback drops
-- poliedron_messages, poliedron_conversations, and the two task-owned trigger
-- functions below. No existing data is changed.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.studios') IS NULL
     OR to_regclass('public.studio_users') IS NULL
     OR to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'CHAT-POLYEDRON preflight: studios, studio_users and auth.users are required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'studio_users' AND column_name = 'user_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'studio_users' AND column_name = 'studio_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'studio_users' AND column_name = 'stato'
  ) THEN
    RAISE EXCEPTION 'CHAT-POLYEDRON preflight: studio_users(user_id,studio_id,stato) is required';
  END IF;
  IF to_regclass('public.poliedron_conversations') IS NOT NULL
     OR to_regclass('public.poliedron_messages') IS NOT NULL THEN
    RAISE EXCEPTION 'CHAT-POLYEDRON preflight: conversation tables already exist';
  END IF;
END
$preflight$;

CREATE TABLE public.poliedron_conversations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_kind text NOT NULL DEFAULT 'primary',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT poliedron_conversations_kind_valid
    CHECK (conversation_kind ~ '^[a-z][a-z0-9_-]{0,63}$'),
  CONSTRAINT poliedron_conversations_owner_kind_unique
    UNIQUE (studio_id, user_id, conversation_kind)
);

CREATE INDEX poliedron_conversations_user_recent_idx
  ON public.poliedron_conversations (user_id, studio_id, updated_at DESC);

CREATE TABLE public.poliedron_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id bigint NOT NULL
    REFERENCES public.poliedron_conversations(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL CHECK (
    char_length(btrim(content)) BETWEEN 1 AND 16000
  ),
  delivery_status text NOT NULL DEFAULT 'sent'
    CHECK (delivery_status IN ('pending', 'sent', 'failed')),
  read_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT poliedron_messages_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT poliedron_messages_metadata_limit
    CHECK (pg_column_size(metadata) <= 8192),
  CONSTRAINT poliedron_messages_request_role_unique
    UNIQUE (conversation_id, request_id, role)
);

CREATE INDEX poliedron_messages_recent_idx
  ON public.poliedron_messages (conversation_id, id DESC);
CREATE INDEX poliedron_messages_unread_idx
  ON public.poliedron_messages (conversation_id, created_at, id)
  WHERE role IN ('assistant', 'system') AND read_at IS NULL;

ALTER TABLE public.poliedron_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poliedron_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY poliedron_conversations_select_own
ON public.poliedron_conversations FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.studio_users su
    WHERE su.user_id = (SELECT auth.uid())
      AND su.studio_id = poliedron_conversations.studio_id
      AND su.stato = 'attivo'
  )
);

CREATE POLICY poliedron_conversations_insert_own
ON public.poliedron_conversations FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.studio_users su
    WHERE su.user_id = (SELECT auth.uid())
      AND su.studio_id = poliedron_conversations.studio_id
      AND su.stato = 'attivo'
  )
);

CREATE POLICY poliedron_messages_select_own
ON public.poliedron_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.poliedron_conversations pc
    JOIN public.studio_users su
      ON su.studio_id = pc.studio_id
     AND su.user_id = pc.user_id
     AND su.stato = 'attivo'
    WHERE pc.id = poliedron_messages.conversation_id
      AND pc.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY poliedron_messages_insert_own
ON public.poliedron_messages FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.poliedron_conversations pc
    JOIN public.studio_users su
      ON su.studio_id = pc.studio_id
     AND su.user_id = pc.user_id
     AND su.stato = 'attivo'
    WHERE pc.id = poliedron_messages.conversation_id
      AND pc.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY poliedron_messages_update_own
ON public.poliedron_messages FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.poliedron_conversations pc
    JOIN public.studio_users su
      ON su.studio_id = pc.studio_id
     AND su.user_id = pc.user_id
     AND su.stato = 'attivo'
    WHERE pc.id = poliedron_messages.conversation_id
      AND pc.user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.poliedron_conversations pc
    JOIN public.studio_users su
      ON su.studio_id = pc.studio_id
     AND su.user_id = pc.user_id
     AND su.stato = 'attivo'
    WHERE pc.id = poliedron_messages.conversation_id
      AND pc.user_id = (SELECT auth.uid())
  )
);

CREATE OR REPLACE FUNCTION public.poliedron_messages_guard_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    IF NEW.role = 'user' AND NEW.read_at IS NULL THEN
      NEW.read_at := NEW.created_at;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.request_id IS DISTINCT FROM OLD.request_id
     OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.content IS DISTINCT FROM OLD.content
     OR NEW.metadata IS DISTINCT FROM OLD.metadata
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'CHAT-POLYEDRON: persisted message identity and content are append-only'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.read_at IS NOT NULL AND NEW.read_at IS DISTINCT FROM OLD.read_at THEN
    RAISE EXCEPTION 'CHAT-POLYEDRON: read_at cannot be cleared or rewritten'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.delivery_status = 'sent'
     AND NEW.delivery_status IS DISTINCT FROM OLD.delivery_status THEN
    RAISE EXCEPTION 'CHAT-POLYEDRON: a sent message cannot return to a pending or failed state'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER poliedron_messages_guard_v1
BEFORE INSERT OR UPDATE ON public.poliedron_messages
FOR EACH ROW EXECUTE FUNCTION public.poliedron_messages_guard_v1();

CREATE OR REPLACE FUNCTION public.poliedron_messages_touch_conversation_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.poliedron_conversations
  SET updated_at = GREATEST(updated_at, NEW.created_at)
  WHERE id = NEW.conversation_id;
  RETURN NULL;
END
$$;

CREATE TRIGGER poliedron_messages_touch_conversation_v1
AFTER INSERT ON public.poliedron_messages
FOR EACH ROW EXECUTE FUNCTION public.poliedron_messages_touch_conversation_v1();

REVOKE ALL ON TABLE public.poliedron_conversations, public.poliedron_messages
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.poliedron_messages_guard_v1(),
  public.poliedron_messages_touch_conversation_v1() FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.poliedron_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.poliedron_messages TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.poliedron_conversations_id_seq,
  public.poliedron_messages_id_seq TO authenticated;

COMMENT ON TABLE public.poliedron_conversations IS
  'CHAT-POLYEDRON persistent conversation identity. Current UI uses one primary thread per active studio user.';
COMMENT ON TABLE public.poliedron_messages IS
  'CHAT-POLYEDRON append-only messages. read_at is visibility state only and never task completion.';
COMMENT ON COLUMN public.poliedron_messages.metadata IS
  'Bounded future extension point for entity links; no Task 3 reminder/action semantics are implemented.';

DO $realtime$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'poliedron_messages'
     ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.poliedron_messages';
  END IF;
END
$realtime$;

COMMIT;
