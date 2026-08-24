BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_true(condition boolean, message text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT COALESCE(condition, false) THEN
    RAISE EXCEPTION 'assertion failed: %', message;
  END IF;
END
$$;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000001","app_metadata":{"studio_id":"10000000-0000-4000-8000-000000000001"}}',
  true
);

INSERT INTO public.poliedron_conversations(studio_id, user_id)
VALUES (
  '10000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001'
);

INSERT INTO public.poliedron_messages(
  conversation_id, request_id, role, content, delivery_status
)
SELECT id, 'd0000000-0000-4000-8000-000000000001', 'user',
  'Quali pazienti devo richiamare?', 'pending'
FROM public.poliedron_conversations
WHERE conversation_kind = 'primary';

INSERT INTO public.poliedron_messages(
  conversation_id, request_id, role, content, delivery_status
)
SELECT id, 'd0000000-0000-4000-8000-000000000001', 'assistant',
  'Controllo i richiami autorevoli disponibili.', 'sent'
FROM public.poliedron_conversations
WHERE conversation_kind = 'primary';

SELECT pg_temp.assert_true(
  (SELECT count(*) = 2 FROM public.poliedron_messages),
  'owner must read both messages'
);
SELECT pg_temp.assert_true(
  (SELECT count(*) = 1 FROM public.poliedron_messages
    WHERE role IN ('assistant', 'system') AND read_at IS NULL),
  'assistant message must start unread'
);

UPDATE public.poliedron_messages
SET read_at = now()
WHERE role IN ('assistant', 'system') AND read_at IS NULL;
UPDATE public.poliedron_messages
SET delivery_status = 'sent'
WHERE role = 'user' AND delivery_status = 'pending';

SELECT pg_temp.assert_true(
  (SELECT count(*) = 0 FROM public.poliedron_messages
    WHERE role IN ('assistant', 'system') AND read_at IS NULL),
  'visible assistant messages must become read'
);
SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'poliedron_messages'
      AND column_name IN ('completed', 'completed_at', 'snoozed_at')
  ),
  'read state must not introduce task completion semantics'
);

DO $immutability$
BEGIN
  BEGIN
    UPDATE public.poliedron_messages
    SET content = 'tampered'
    WHERE role = 'assistant';
    RAISE EXCEPTION 'immutable message content was updated';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  BEGIN
    UPDATE public.poliedron_messages
    SET delivery_status = 'failed'
    WHERE role = 'user';
    RAISE EXCEPTION 'sent message returned to failed';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  BEGIN
    INSERT INTO public.poliedron_messages(
      conversation_id, request_id, role, content
    )
    SELECT id, 'd0000000-0000-4000-8000-000000000001', 'assistant', 'duplicate'
    FROM public.poliedron_conversations
    WHERE conversation_kind = 'primary';
    RAISE EXCEPTION 'duplicate request/role message was inserted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END
$immutability$;

-- A different user in the same studio cannot see or spoof the first user's
-- private conversation.
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000002","app_metadata":{"studio_id":"10000000-0000-4000-8000-000000000001"}}',
  true
);
SELECT pg_temp.assert_true(
  (SELECT count(*) = 0 FROM public.poliedron_conversations),
  'same-studio user must not read another user conversation'
);
SELECT pg_temp.assert_true(
  (SELECT count(*) = 0 FROM public.poliedron_messages),
  'same-studio user must not read another user messages'
);
DO $same_studio_spoof$
BEGIN
  BEGIN
    INSERT INTO public.poliedron_conversations(studio_id, user_id)
    VALUES (
      '10000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000001'
    );
    RAISE EXCEPTION 'same-studio ownership spoof was allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$same_studio_spoof$;

-- Tenant B can create its own conversation.
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"b0000000-0000-4000-8000-000000000001","app_metadata":{"studio_id":"20000000-0000-4000-8000-000000000002"}}',
  true
);
INSERT INTO public.poliedron_conversations(studio_id, user_id)
VALUES (
  '20000000-0000-4000-8000-000000000002',
  'b0000000-0000-4000-8000-000000000001'
);

-- Tenant A cannot observe tenant B and cannot create a conversation there.
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000001","app_metadata":{"studio_id":"10000000-0000-4000-8000-000000000001"}}',
  true
);
SELECT pg_temp.assert_true(
  (SELECT count(*) = 1 FROM public.poliedron_conversations),
  'tenant A must see only its own conversation'
);
DO $cross_tenant$
BEGIN
  BEGIN
    INSERT INTO public.poliedron_conversations(studio_id, user_id)
    VALUES (
      '20000000-0000-4000-8000-000000000002',
      'a0000000-0000-4000-8000-000000000001'
    );
    RAISE EXCEPTION 'cross-tenant conversation insert was allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$cross_tenant$;

-- Suspended membership fails closed.
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000007","app_metadata":{"studio_id":"10000000-0000-4000-8000-000000000001"}}',
  true
);
SELECT pg_temp.assert_true(
  (SELECT count(*) = 0 FROM public.poliedron_conversations),
  'suspended user must not read conversations'
);
DO $suspended$
BEGIN
  BEGIN
    INSERT INTO public.poliedron_conversations(studio_id, user_id)
    VALUES (
      '10000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000007'
    );
    RAISE EXCEPTION 'suspended user conversation insert was allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$suspended$;

RESET ROLE;
ROLLBACK;
